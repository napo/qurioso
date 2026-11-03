import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { performance } from 'node:perf_hooks';
import { createPublicAccess, loopback, participantRouteAllowed } from './server/internetSharing';
import { remainingMs, receivedTimeMs, type RoundClock } from './server/roundClock';
import { nicknameAllowed } from './src/services/nicknameFilter';
import { sameChoice, validChoice } from './src/services/questionTypes';
import type { GameSession, Player, Quiz } from './src/types/quiz';
import { applyPlayerAnswer, publicQuestion } from './src/services/sessionState';
import { PLAYER_CREDENTIAL_TTL_MS, playerCredentialExpired } from './src/types/playerCredential';
import { MAX_ASSIGNMENT_BYTES, MAX_MESSAGE_BYTES, MAX_PLAYERS, ProtocolError, check, object, id, pin as validatePin,
  player as validatePlayer, session as validateSession, submission, participantSession, videoQuizDefinition,
  assignmentQuizDefinition, assignmentSubmission } from './server/sessionProtocol';
import { ASSIGNMENT_GRACE_MS, KEEP_CLOSED_MS, assignmentFeedback, assignmentOpen, assignmentTotals, assignmentView, deadlineAllowed,
  gradeAssignmentAnswer, readAssignmentsFile, writeAssignmentsFile, type AssignmentProgress } from './server/assignments';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const publicAccess = createPublicAccess(process.env.QURIOSO_PUBLIC_TUNNEL_TOKEN);
const publicSockets = new Set<WebSocket>();
const requestedPort = Number(process.env.PORT ?? 0);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
let listeningPort = requestedPort;
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });

// Accountless capabilities: a new presenter may create their own room, never claim an existing PIN.
// Unused creation credentials expire; bound credentials live only in server memory until room deletion.
const creationTokens = new Map<string, number>();
interface Room {
  session: GameSession;
  videoQuiz?: Quiz;
  openedQuestions: number;
  hostToken: string;
  playerTokens: Map<string, string>;
  playerExpiries: Map<string, number>;
  roundPlayers: Record<string, Player>;
  revision: number;
  sequence: number;
  round?: RoundClock;
  operations: Map<string, string>;
  /** Participants the presenter removed, and their revoked credentials: a stale host snapshot cannot bring them back. */
  removed: Set<string>;
  removedTokens: Set<string>;
  /** Homework: the private quiz with its images, and every participant's graded answers. */
  assignmentQuiz?: Quiz;
  assignmentAnswers: Record<string, AssignmentProgress>;
  /** Random device code sent with each join. It never leaves the server: the presenter sees only who shares a device. */
  devices: Map<string, string>;
}
const REMOVED = 'Removed by the presenter';
interface ConnectedClient {
  ws: WebSocket;
  role: 'host' | 'player';
  playerId?: string;
  pin: string;
}
const sessions = new Map<string, Room>();
const sessionClients = new Map<string, Set<ConnectedClient>>();
const secret = () => randomBytes(32).toString('hex');
function token(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
function matches(value: unknown, expected: string | undefined): boolean {
  const actual = token(value);
  return Boolean(actual && expected && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)));
}
function bearer(req: express.Request) {
  return req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
}
function roomFor(pin: string): Room {
  validatePin(pin);
  const room = sessions.get(pin);
  if (!room) throw new ProtocolError(404, 'Session not found');
  // Homework ends by itself at the deadline: nobody has to be connected for it to close.
  if (room.assignmentQuiz && room.session.status !== 'finished' && !assignmentOpen(room.session)) {
    room.session.status = 'finished'; room.sequence++; saveAssignments();
  }
  return room;
}

// Open homework survives a restart of the app: the native app names a private file in its profile.
const assignmentsFile = process.env.QURIOSO_ASSIGNMENTS_FILE;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function flushAssignments() {
  clearTimeout(saveTimer); saveTimer = undefined;
  announceHomework();
  if (!assignmentsFile) return;
  try {
    writeAssignmentsFile(assignmentsFile, [...sessions.values()].filter(room => room.assignmentQuiz).map(room => ({
      session: room.session, quiz: room.assignmentQuiz, hostToken: room.hostToken, answers: room.assignmentAnswers,
      playerTokens: [...room.playerTokens], playerExpiries: [...room.playerExpiries], removed: [...room.removed], removedTokens: [...room.removedTokens], devices: [...room.devices],
    })));
  } catch (error) { console.error('Unable to save homework:', (error as Error).message); }
}
/** Answers arrive in bursts: one write per second at most, and a final one on exit. */
function saveAssignments() {
  announceHomework();
  if (assignmentsFile && !saveTimer) saveTimer = setTimeout(flushAssignments, 1000);
}
const parentPort = (process as NodeJS.Process & { parentPort?: { postMessage: (message: unknown) => void } }).parentPort;
/** Tells the native app how many homework are open, so it keeps the computer awake and warns before quitting. */
function announceHomework() {
  const open = [...sessions.values()].filter(room => room.assignmentQuiz && assignmentOpen(room.session));
  parentPort?.postMessage({ type: 'homework', open: open.length });
}
function restoreAssignments() {
  if (!assignmentsFile) return;
  const credential = (value: unknown) => { check(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)); return value as string; };
  for (const value of readAssignmentsFile(assignmentsFile)) {
    try {
      const record = object(value), session = validateSession(record.session), quiz = assignmentQuizDefinition(record.quiz);
      check(session.mode === 'assignment' && quiz.id === session.quizId && !sessions.has(session.pin));
      if (session.assignment!.deadline + KEEP_CLOSED_MS < Date.now()) continue;
      const answers = object(record.answers) as Record<string, AssignmentProgress>;
      const devices = new Map<string, string>();
      for (const [player, code] of (record.devices ?? []) as [string, unknown][]) { const device = deviceCode(code); if (device) devices.set(id(player), device); }
      sessions.set(session.pin, { session, assignmentQuiz: quiz, assignmentAnswers: answers, devices, openedQuestions: 0, hostToken: credential(record.hostToken),
        playerTokens: new Map((record.playerTokens as [string, unknown][]).map(([player, token]) => [id(player), credential(token)])),
        playerExpiries: new Map((record.playerExpiries as [string, number][]).map(([player, expiry]) => [id(player), Number(expiry)])),
        removed: new Set((record.removed as string[]).map(player => id(player))), removedTokens: new Set((record.removedTokens as unknown[]).map(credential)),
        roundPlayers: {}, revision: 0, sequence: 0, operations: new Map() });
      sessionClients.set(session.pin, new Set());
    } catch (error) { console.error('Unable to restore a homework record:', error instanceof Error ? error.message : String(error)); }
  }
}
restoreAssignments();
// Deadlines pass with nobody connected: check every minute.
setInterval(() => { for (const pin of sessions.keys()) roomFor(pin); announceHomework(); }, 60_000).unref();
process.on('SIGTERM', () => { flushAssignments(); process.exit(0); });
process.on('beforeExit', flushAssignments);
function requireHost(room: Room, credential: unknown) {
  if (!matches(credential, room.hostToken)) throw new ProtocolError(403, 'Presenter authorization required');
}
function requirePlayer(room: Room, playerId: string, credential: unknown) {
  if (room.removed.has(playerId)) throw new ProtocolError(403, REMOVED);
  if (!matches(credential, room.playerTokens.get(playerId))) throw new ProtocolError(403, 'Player authorization required');
  if (playerCredentialExpired(room.playerExpiries.get(playerId))) throw new ProtocolError(410, 'Player credential expired');
}
// Participants reach the server over the LAN or the tunnel; presenter features answer only on this computer.
// A loopback Host also stops DNS rebinding: a web page cannot borrow its own hostname to reach loopback.
function presenterDevice(request: http.IncomingMessage) {
  const hostname = (request.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  return loopback(request.socket.remoteAddress) && !publicAccess.isPublic(request) && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
/** Every page opened from a participant device starts in participant mode. */
function participantEntry(req: express.Request, pin?: string) {
  if (req.method !== 'GET' || (req.path !== '/' && req.query.app === undefined)) return undefined;
  if (req.query.role === 'player' && req.query.app === undefined) return undefined;
  const target = new URL(req.originalUrl, 'http://localhost');
  target.searchParams.delete('app');
  target.searchParams.set('role', 'player');
  if (pin) target.searchParams.set('pin', pin);
  return target.pathname + target.search;
}
function reader(room: Room, req: express.Request): { host: boolean; playerId?: string } {
  if (!req.headers.authorization) return { host: false };
  const credential = bearer(req);
  if (matches(credential, room.hostToken)) {
    if (!presenterDevice(req)) throw new ProtocolError(403, 'Presenter access is available only on the teacher computer');
    return { host: true };
  }
  for (const [playerId, expected] of room.playerTokens) if (matches(credential, expected)) { requirePlayer(room, playerId, credential); return { host: false, playerId }; }
  throw new ProtocolError(403, credential && room.removedTokens.has(credential) ? REMOVED : 'Invalid authorization');
}
function deviceCode(value: unknown) {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : undefined;
}
/** For each participant, the others who joined from the same browser. A hint for the presenter, not a proof. */
function sharedDevices(room: Room) {
  const byCode = new Map<string, string[]>();
  for (const [player, code] of room.devices) if (room.session.players[player]) byCode.set(code, [...(byCode.get(code) ?? []), player]);
  const shared: Record<string, string[]> = {};
  for (const players of byCode.values()) if (players.length > 1) for (const player of players) shared[player] = players.filter(other => other !== player);
  return shared;
}
const sharedField = (room: Room) => { const shared = sharedDevices(room); return Object.keys(shared).length ? { sharedDevices: shared } : {}; };
function envelope(room: Room, host: boolean, playerId?: string) {
  const visible = host ? { ...room.session } : participantSession(room.session, room.roundPlayers);
  // Homework is private: a participant sees no classmates, names or scores.
  if (room.assignmentQuiz && !host) visible.players = playerId && room.session.players[playerId] ? { [playerId]: room.session.players[playerId] } : {};
  if (room.videoQuiz) visible.videoQuestionsOpened = room.openedQuestions;
  if (room.videoQuiz && ['question_results', 'leaderboard'].includes(visible.status)) {
    const question = room.videoQuiz.questions[visible.currentQuestionIndex];
    // An ordering's solution is its saved order; a poll has none.
    visible.questionResult = { correctOptionIds: question.type === 'ordering' ? question.options.map(o => o.id) : question.options.filter(o => o.isCorrect).map(o => o.id),
      ...(room.videoQuiz.settings.showExplanation ? { explanation: question.explanation } : {}) };
  }
  const own = playerId && room.session.answersForCurrentQuestion[playerId];
  return { type: 'SESSION_STATE_UPDATE', revision: room.revision, sequence: room.sequence,
    clock: room.round ? { roundId: room.session.roundId, questionStartTime: room.session.questionStartTime,
      remainingMs: remainingMs(room.round, performance.now()), durationMs: room.round.durationMs } : undefined,
    ownAnswer: own ? { questionId: own.questionId, optionId: own.optionId, ...(own.optionIds ? { optionIds: own.optionIds } : {}), timeTakenMs: own.timeTakenMs } : undefined,
    session: visible, ...(host && room.assignmentQuiz ? { assignmentAnswers: room.assignmentAnswers } : {}),
    ...(host ? sharedField(room) : {}) };
}
function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcast(pin: string, data: unknown, hostsOnly = false) {
  for (const client of sessionClients.get(pin) || []) {
    if (!hostsOnly || client.role === 'host') send(client.ws, data);
  }
}
function broadcastState(room: Room) {
  // Serialize two distinct views, never a presenter payload to participant sockets.
  const host = envelope(room, true);
  for (const client of sessionClients.get(room.session.pin) || []) {
    if (client.role === 'player' && (!room.playerTokens.has(client.playerId!) || playerCredentialExpired(room.playerExpiries.get(client.playerId!)))) {
      client.ws.close(1008, 'Player credential expired'); continue;
    }
    send(client.ws, client.role === 'host' ? host : envelope(room, false, client.playerId));
  }
}
function allowedOrigin(origin: string | undefined, host: string | undefined, remoteAddress?: string): boolean {
  if (!origin) return true; // Native clients authenticate with the same bearer credentials.
  if (origin === `http://${host}` || origin === `https://${host}`) return true;
  // Electron forwards HTTP to loopback but intentionally retains a stable renderer origin.
  return origin === 'http://qurioso.localhost' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress || '');
}
function attachWsUpgrade(httpServer: http.Server) {
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') return; // Vite owns its HMR upgrade path.
      if (publicAccess.isPublic(request)) {
        if (!publicAccess.originAllowed(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
        wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)); return;
      }
      if (!allowedOrigin(request.headers.origin, request.headers.host, request.socket.remoteAddress)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
    } catch { socket.destroy(); }
  });
}

app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Electron forwards assets as well as APIs from its stable origin to the loopback server.
// Give its module/script responses the same narrowly scoped CORS headers as its API responses.
app.use((req, res, next) => {
  if (publicAccess.isPublic(req)) {
    if (!publicAccess.originAllowed(req) || !publicAccess.routeAllowed(req.method, new URL(req.url, 'http://localhost').pathname)) {
      res.status(403).json({ error: 'Internet sharing permits participants in the shared session only' }); return;
    }
    // The public entry always opens participant mode; the local teacher library stays local.
    const entry = participantEntry(req, publicAccess.snapshot()!.pin);
    if (entry) { res.redirect(entry); return; }
    next(); return;
  }
  if (!presenterDevice(req)) {
    if (!participantRouteAllowed(req.method, new URL(req.url, 'http://localhost').pathname)) {
      res.status(403).json({ error: 'Presenter features are available only on the teacher computer' }); return;
    }
    const entry = participantEntry(req);
    if (entry) { res.redirect(entry); return; }
  }
  if (!allowedOrigin(req.headers.origin, req.headers.host, req.socket.remoteAddress)) {
    res.status(403).json({ error: 'Origin not allowed' }); return;
  }
  if (req.headers.origin) {
    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.vary('Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});
const smallJson = express.json({ limit: MAX_MESSAGE_BYTES, strict: true });
// Homework carries its images. Only the teacher computer reaches this route: the checks above stop everyone else.
const homeworkJson = express.json({ limit: MAX_ASSIGNMENT_BYTES, strict: true });
app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/assignment/create' ? homeworkJson : smallJson)(req, res, next));

// Only the native app knows this credential. Never accepted through the public tunnel.
app.post('/api/desktop/internet-sharing', (req, res) => {
  if (!publicAccess.controlAllowed(req)) { res.status(403).json({ error: 'Native authorization required' }); return; }
  try {
    if (req.body?.share !== null) roomFor(validatePin(req.body?.share?.pin));
    publicAccess.configure(req.body?.share);
    for (const ws of publicSockets) ws.close(1008, 'Internet sharing changed');
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Invalid share or session' }); }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Qurioso', port: listeningPort, uptime: process.uptime(), activeSessions: [...sessions.values()].filter(room => !room.assignmentQuiz).length });
});
app.get('/api/server-info', (req, res) => {
  const localIps = Object.values(os.networkInterfaces()).flatMap(networks => (networks || [])
    .filter(net => net.family === 'IPv4' && !net.internal).map(net => net.address));
  const protocol = req.protocol || 'http';
  const host = req.headers.host || `localhost:${listeningPort}`;
  res.json({ status: 'ok', port: listeningPort, protocol, host, localIps, fullUrl: `${protocol}://${host}` });
});

app.post('/api/presenter-token', (_req, res) => {
  for (const [credential, expires] of creationTokens) if (expires < Date.now()) creationTokens.delete(credential);
  if (creationTokens.size >= 256 || sessions.size >= 100) {
    res.status(429).json({ error: 'Too many sessions or pending presenters' }); return;
  }
  const hostToken = secret();
  creationTokens.set(hostToken, Date.now() + 5 * 60 * 1000);
  res.json({ hostToken });
});

// Retry IDs acknowledge an already applied write without applying its state a second time.
function operationDigest(value: unknown, revision: unknown): string {
  return createHash('sha256').update(JSON.stringify({ session: value, revision })).digest('hex');
}
function replay(room: Room, operationId: unknown, value: unknown, revision: unknown): boolean {
  if (operationId === undefined) return false;
  id(operationId);
  const previous = room.operations.get(operationId as string);
  if (!previous) return false;
  if (previous !== operationDigest(value, revision)) throw new ProtocolError(409, 'Operation ID reused with different input');
  return true;
}
function remember(room: Room, operationId: unknown, value: unknown, revision: unknown) {
  if (operationId === undefined) return;
  room.operations.set(id(operationId), operationDigest(value, revision));
  if (room.operations.size > 64) room.operations.delete(room.operations.keys().next().value!);
}
function startRound(room: Room) {
  room.round = { startedAt: performance.now(), durationMs: room.session.timeRemaining * 1000 };
  room.session.roundId = secret();
  room.session.answersForCurrentQuestion = {};
  room.roundPlayers = structuredClone(room.session.players);
}
function validateTransition(previous: GameSession, next: GameSession) {
  const allowed: Record<GameSession['status'], GameSession['status'][]> = {
    lobby: ['lobby', 'countdown', 'question'], countdown: ['countdown', 'question'], video: [],
    question: ['question', 'question_results'], question_results: ['question_results', 'leaderboard', 'question', 'finished'],
    leaderboard: ['leaderboard', 'question', 'finished'], finished: ['finished', 'lobby'],
  };
  if (!allowed[previous.status].includes(next.status)) throw new ProtocolError(409, 'Invalid state transition');
  if (next.status === 'lobby') return;
  if (next.status === 'question' && previous.status !== 'question') {
    const expected = ['lobby', 'countdown'].includes(previous.status) ? 0 : previous.currentQuestionIndex + 1;
    if (next.currentQuestionIndex !== expected) throw new ProtocolError(409, 'Question out of order');
  } else if (next.currentQuestionIndex !== previous.currentQuestionIndex ||
      next.questionStartTime !== previous.questionStartTime || next.currentQuestion?.id !== previous.currentQuestion?.id) {
    throw new ProtocolError(409, 'Cannot replace or reopen the current round');
  }
}
function updateRoom(room: Room, value: unknown, revision: unknown, operationId?: unknown) {
  if (room.assignmentQuiz) throw new ProtocolError(409, 'Homework is changed only through its own requests');
  if (replay(room, operationId, value, revision)) return;
  check(Number.isSafeInteger(revision), 'Invalid session revision');
  if (revision !== room.revision) throw new ProtocolError(409, 'Stale session revision');
  const next = validateSession(value);
  check(next.pin === room.session.pin, 'Session PIN mismatch');
  check(next.mode === room.session.mode && next.quizId === room.session.quizId && next.totalQuestions === room.session.totalQuestions, 'Cannot replace quiz');
  if (room.videoQuiz) {
    const transitions: Record<GameSession['status'], GameSession['status'][]> = {
      lobby: ['lobby', 'countdown'], countdown: ['countdown', 'video'], video: ['video', 'question', 'finished'],
      question: ['question', 'question_results'], question_results: ['question_results', 'leaderboard', 'video'],
      leaderboard: ['leaderboard', 'video'], finished: ['finished', 'lobby'],
    };
    if (!transitions[room.session.status].includes(next.status)) throw new ProtocolError(409, 'Invalid video transition');
    if (next.status === 'question' && room.session.status === 'video') {
      if (next.currentQuestionIndex !== room.openedQuestions) throw new ProtocolError(409, 'Question out of order');
      const question = room.videoQuiz.questions[next.currentQuestionIndex];
      check(question && next.currentQuestion?.id === question.id, 'Invalid video question');
      next.currentQuestion = publicQuestion(room.videoQuiz, next.currentQuestionIndex);
      next.timeRemaining = question.timeLimit;
    } else if (next.status !== 'lobby' && (next.currentQuestionIndex !== room.session.currentQuestionIndex ||
      next.questionStartTime !== room.session.questionStartTime || next.currentQuestion?.id !== room.session.currentQuestion?.id)) {
      throw new ProtocolError(409, 'Cannot replace or reopen the current round');
    }
    if (next.currentQuestion) next.currentQuestion = publicQuestion(room.videoQuiz, next.currentQuestionIndex);
    if (next.status === 'finished' && room.openedQuestions !== room.videoQuiz.questions.length) throw new ProtocolError(409, 'Unanswered video checkpoints');
  } else validateTransition(room.session, next);
  const sameRound = next.questionStartTime === room.session.questionStartTime &&
    next.currentQuestion?.id === room.session.currentQuestion?.id && next.currentQuestionIndex === room.session.currentQuestionIndex;
  // A host snapshot in flight must not erase a participant joining or submitting in the meantime.
  next.players = { ...room.session.players, ...next.players };
  for (const id of room.removed) { delete next.players[id]; delete next.answersForCurrentQuestion[id]; }
  // Someone who joined after this snapshot keeps their team only if the presenter did not just remove it.
  const teamIds = new Set(next.teams?.map(team => team.id));
  for (const [id, p] of Object.entries(next.players)) if (p.teamId !== undefined && !teamIds.has(p.teamId)) { const { teamId: _team, ...rest } = p; next.players[id] = rest; }
  check(Object.keys(next.players).length <= MAX_PLAYERS, 'Too many players');
  if (sameRound) {
    const incoming = next.answersForCurrentQuestion;
    next.answersForCurrentQuestion = { ...room.session.answersForCurrentQuestion, ...incoming };
    for (const [playerId, received] of Object.entries(room.session.answersForCurrentQuestion)) {
      const supplied = incoming[playerId];
      if (!supplied || !sameChoice(supplied, received) || supplied.questionId !== received.questionId || supplied.timeTakenMs !== received.timeTakenMs) {
        next.answersForCurrentQuestion[playerId] = received;
      }
    }
  }
  if (room.videoQuiz) {
    // Scores/receipts are server-owned. Stale presenter snapshots cannot erase accepted answers.
    // The presenter may still move a participant to another team.
    next.players = Object.fromEntries(Object.entries(next.players).map(([id, p]) => {
      const current = room.session.players[id];
      if (!current) return [id, validatePlayer(p, true)];
      const { teamId: _team, ...rest } = current;
      return [id, p.teamId !== undefined ? { ...rest, teamId: p.teamId } : rest];
    }));
    // Keep explicitly presenter-created bots distinguishable from authenticated students.
    for (const [id, p] of Object.entries(next.players)) if (!room.session.players[id] && !room.playerTokens.has(id)) p.isBot = true;
    next.answersForCurrentQuestion = sameRound ? room.session.answersForCurrentQuestion : {};
  }
  if (sameRound) {
    next.roundId = room.session.roundId;
    if (room.round) next.timeRemaining = room.round.durationMs / 1000; // Never extend a round with a later host snapshot.
  }
  room.session = next;
  if (!sameRound && next.status === 'question') { startRound(room); if (room.videoQuiz) room.openedQuestions++; }
  else if (next.status === 'lobby') { room.round = undefined; room.openedQuestions = 0; }
  room.revision++;
  room.sequence++;
  remember(room, operationId, value, revision);
  broadcastState(room);
}

app.post('/api/session/create', (req, res) => {
  const body = object(req.body);
  const pin = validatePin(object(body.session).pin);
  const existing = sessions.get(pin);
  const credential = bearer(req);
  if (existing) {
    requireHost(existing, credential);
    if (body.videoQuiz !== undefined) check(JSON.stringify(videoQuizDefinition(body.videoQuiz)) === JSON.stringify(existing.videoQuiz), 'Cannot replace private quiz');
    updateRoom(existing, body.session, body.revision, body.operationId);
    res.json({ success: true, pin, ...envelope(existing, true) }); return;
  }
  const expires = credential && creationTokens.get(credential);
  if (!expires || expires < Date.now()) throw new ProtocolError(403, 'Presenter creation credential required');
  if (sessions.size >= 100) throw new ProtocolError(429, 'Too many sessions');
  const session = validateSession(body.session);
  check(session.mode !== 'assignment', 'Homework has its own creation request');
  const videoQuiz = session.mode === 'video' ? videoQuizDefinition(body.videoQuiz) : undefined;
  if (videoQuiz) check(session.status === 'lobby' && videoQuiz.id === session.quizId && videoQuiz.questions.length === session.totalQuestions, 'Invalid video setup');
  const room: Room = { session, videoQuiz, openedQuestions: 0, hostToken: credential!, playerTokens: new Map(), playerExpiries: new Map(), roundPlayers: structuredClone(session.players), revision: 0, sequence: 0, operations: new Map(), removed: new Set(), removedTokens: new Set(), assignmentAnswers: {}, devices: new Map() };
  if (body.operationId !== undefined) id(body.operationId);
  if (session.status === 'question') startRound(room);
  remember(room, body.operationId, body.session, body.revision);
  creationTokens.delete(credential!);
  sessions.set(pin, room);
  sessionClients.set(pin, new Set());
  res.json({ success: true, pin, ...envelope(room, true) });
});
app.get('/api/session/:pin', (req, res) => {
  const room = roomFor(req.params.pin);
  const identity = reader(room, req);
  res.json({ success: true, ...envelope(room, identity.host, identity.playerId) });
});
app.get('/api/session/:pin/presenter', (req, res) => {
  const room = roomFor(req.params.pin);
  requireHost(room, bearer(req));
  // The homework report follows the quiz as it was assigned, even if the library copy changed since. Images stay out.
  const quiz = room.assignmentQuiz && { ...room.assignmentQuiz, questions: room.assignmentQuiz.questions.map(({ mediaUrl: _image, ...question }) => question) };
  res.json({ success: true, ...envelope(room, true), ...(quiz ? { assignmentQuiz: quiz } : {}) });
});
app.post('/api/session/:pin/join', (req, res) => {
  const room = roomFor(req.params.pin);
  if (room.session.status === 'finished') throw new ProtocolError(410, 'Session finished');
  const player = validatePlayer(object(req.body).player, true);
  let playerToken = room.playerTokens.get(player.id);
  if (Object.hasOwn(room.session.players, player.id)) {
    requirePlayer(room, player.id, bearer(req)); // A public player ID is never a reconnect credential.
  } else {
    if (room.removed.has(player.id)) throw new ProtocolError(403, REMOVED);
    if (!nicknameAllowed(player.nickname)) throw new ProtocolError(400, 'Nickname not allowed');
    // In a team game a new participant joins one of its teams; otherwise any team sent is dropped.
    if (room.session.teams?.length) check(room.session.teams.some(team => team.id === player.teamId), 'Team required');
    else delete player.teamId;
    if (Object.keys(room.session.players).length >= MAX_PLAYERS) throw new ProtocolError(429, 'Too many players');
    playerToken = secret();
    room.playerTokens.set(player.id, playerToken);
    // A homework credential lasts until the deadline, so a participant can finish it another day.
    room.playerExpiries.set(player.id, room.session.assignment ? room.session.assignment.deadline + ASSIGNMENT_GRACE_MS : Date.now() + PLAYER_CREDENTIAL_TTL_MS);
    room.session.players[player.id] = player;
    const device = deviceCode(object(req.body).deviceId);
    if (device) room.devices.set(player.id, device);
    room.sequence++;
    // Only the presenter needs join events containing the private player record.
    broadcast(req.params.pin, { type: 'PLAYER_JOIN', pin: req.params.pin, player }, true);
    broadcastState(room);
    if (room.assignmentQuiz) saveAssignments();
  }
  res.json({ success: true, playerToken, playerExpiresAt: room.playerExpiries.get(player.id), ...envelope(room, false, player.id) });
});

// Recover without joining or mutating players, rounds, answers, deadlines or scores.
app.get('/api/session/:pin/player/:playerId', (req, res) => {
  const room = roomFor(req.params.pin), playerId = id(req.params.playerId);
  requirePlayer(room, playerId, bearer(req));
  // A returning participant may read their final result, without rejoining the game.
  res.json({ success: true, playerExpiresAt: room.playerExpiries.get(playerId), ...envelope(room, false, playerId) });
});
app.post('/api/session/:pin/player/:playerId/leave', (req, res) => {
  const room = roomFor(req.params.pin), playerId = id(req.params.playerId);
  requirePlayer(room, playerId, bearer(req));
  room.playerTokens.delete(playerId); room.playerExpiries.delete(playerId);
  // Retain historical answers and scores. Disconnecting alone never revokes anything.
  for (const client of sessionClients.get(req.params.pin) || []) {
    if (client.role === 'player' && client.playerId === playerId) client.ws.close(1000, 'Player left');
  }
  res.json({ success: true });
});

// The presenter removes a participant: their name leaves the game and the ranking, their device returns to the PIN form.
app.post('/api/session/:pin/player/:playerId/remove', (req, res) => {
  const room = roomFor(req.params.pin), playerId = id(req.params.playerId);
  requireHost(room, bearer(req));
  const token = room.playerTokens.get(playerId);
  if (token) room.removedTokens.add(token);
  room.removed.add(playerId);
  room.playerTokens.delete(playerId); room.playerExpiries.delete(playerId);
  delete room.session.players[playerId]; delete room.roundPlayers[playerId]; delete room.session.answersForCurrentQuestion[playerId];
  delete room.assignmentAnswers[playerId]; room.devices.delete(playerId);
  if (room.assignmentQuiz) saveAssignments();
  for (const client of sessionClients.get(req.params.pin) || []) {
    if (client.role === 'player' && client.playerId === playerId) client.ws.close(4003, REMOVED);
  }
  room.sequence++;
  broadcastState(room);
  res.json({ success: true, ...envelope(room, true) });
});

function receiveAnswer(room: Room, value: unknown, credential: unknown, registeredPlayerId?: string, bot = false) {
  const data = submission(value);
  if (bot) {
    requireHost(room, credential);
    check(room.videoQuiz && room.session.players[data.playerId]?.isBot, 'Invalid bot');
  } else requirePlayer(room, data.playerId, credential);
  if (registeredPlayerId && registeredPlayerId !== data.playerId) throw new ProtocolError(403, 'Player identity mismatch');
  const session = room.session;
  if (session.roundId !== data.roundId || session.currentQuestion?.id !== data.questionId || !validChoice(session.currentQuestion, data)) {
    throw new ProtocolError(400, 'Invalid answer or question no longer active');
  }
  const previous = session.answersForCurrentQuestion[data.playerId];
  if (previous) {
    if (!sameChoice(previous, data)) throw new ProtocolError(409, 'Answer already submitted');
    return false; // Retries acknowledge the original submission, without scoring twice.
  }
  if (session.status !== 'question' || !room.round || remainingMs(room.round, performance.now()) <= 0) {
    throw new ProtocolError(409, 'Question expired');
  }
  const { playerId, roundId: _roundId, timeTakenMs: _untrustedTime, ...choice } = data;
  const answer = { ...choice, timeTakenMs: receivedTimeMs(room.round, performance.now()) };
  if (room.videoQuiz) room.session = applyPlayerAnswer(session, room.videoQuiz, { playerId, ...answer });
  else session.answersForCurrentQuestion[playerId] = answer;
  room.sequence++;
  broadcast(session.pin, { type: 'PLAYER_ANSWER', pin: session.pin, playerId, ...answer, roundId: session.roundId, questionStartTime: session.questionStartTime }, true);
  broadcastState(room);
  return true;
}
app.post('/api/session/:pin/answer', (req, res) => {
  receiveAnswer(roomFor(req.params.pin), req.body, bearer(req));
  res.json({ success: true, received: true });
});
app.post('/api/session/:pin/bot-answer', (req, res) => {
  receiveAnswer(roomFor(req.params.pin), req.body, bearer(req), undefined, true);
  res.json({ success: true });
});
app.post('/api/session/:pin/state', (req, res) => {
  const room = roomFor(req.params.pin);
  requireHost(room, bearer(req));
  const body = object(req.body);
  updateRoom(room, body.session, body.revision, body.operationId);
  res.json({ success: true, ...envelope(room, true) });
});
app.delete('/api/session/:pin', (req, res) => {
  const room = roomFor(req.params.pin);
  requireHost(room, bearer(req));
  sessions.delete(req.params.pin);
  if (room.assignmentQuiz) saveAssignments();
  const clients = sessionClients.get(req.params.pin);
  sessionClients.delete(req.params.pin);
  for (const client of clients || []) client.ws.close(1000, 'Session ended');
  res.json({ success: true });
});
// Homework: created whole, then each participant moves through it alone. The presenter only reads, closes or extends it.
app.post('/api/assignment/create', (req, res) => {
  const body = object(req.body), credential = bearer(req);
  const expires = credential && creationTokens.get(credential);
  if (!expires || expires < Date.now()) throw new ProtocolError(403, 'Presenter creation credential required');
  if (sessions.size >= 100) throw new ProtocolError(429, 'Too many sessions');
  const session = validateSession(body.session), quiz = assignmentQuizDefinition(body.assignmentQuiz);
  check(session.mode === 'assignment' && session.status === 'lobby' && !Object.keys(session.players).length && !session.assignment!.closed, 'Invalid homework');
  check(quiz.id === session.quizId && quiz.questions.length === session.totalQuestions, 'Invalid homework');
  check(deadlineAllowed(session.assignment!.deadline), 'Invalid deadline');
  check(!sessions.has(session.pin), 'PIN in use');
  const room: Room = { session: { ...session, currentQuestion: undefined, answersForCurrentQuestion: {} }, assignmentQuiz: quiz, assignmentAnswers: {}, devices: new Map(), openedQuestions: 0,
    hostToken: credential!, playerTokens: new Map(), playerExpiries: new Map(), roundPlayers: {}, revision: 0, sequence: 0, operations: new Map(), removed: new Set(), removedTokens: new Set() };
  creationTokens.delete(credential!);
  sessions.set(session.pin, room);
  sessionClients.set(session.pin, new Set());
  flushAssignments();
  res.json({ success: true, pin: session.pin, ...envelope(room, true) });
});
function homework(pin: string) {
  const room = roomFor(pin);
  if (!room.assignmentQuiz) throw new ProtocolError(404, 'Homework not found');
  return room as Room & { assignmentQuiz: Quiz };
}
app.get('/api/session/:pin/assignment', (req, res) => {
  const room = homework(req.params.pin), { playerId } = reader(room, req);
  if (!playerId) throw new ProtocolError(403, 'Player authorization required');
  res.json({ success: true, assignment: assignmentView(room.assignmentQuiz, room.session, room.assignmentAnswers[playerId]) });
});
app.post('/api/session/:pin/assignment/answer', (req, res) => {
  const room = homework(req.params.pin), data = assignmentSubmission(req.body);
  requirePlayer(room, data.playerId, bearer(req));
  const answers = room.assignmentAnswers[data.playerId] ?? {};
  // A retry of an answer already recorded is acknowledged even after the deadline; a new one is not.
  if (!answers[data.questionId] && !assignmentOpen(room.session)) throw new ProtocolError(410, 'Homework closed');
  const { playerId, questionId, ...choice } = data;
  const { answer, fresh } = gradeAssignmentAnswer(room.assignmentQuiz, answers, questionId, choice);
  if (fresh) {
    room.assignmentAnswers[playerId] = { ...answers, [questionId]: answer };
    const totals = assignmentTotals(room.assignmentQuiz, room.assignmentAnswers[playerId]), player = room.session.players[playerId];
    if (player) room.session.players[playerId] = { ...player, score: totals.score, correctAnswersCount: totals.correct };
    room.sequence++;
    broadcastState(room);
    saveAssignments();
  }
  res.json({ success: true, feedback: assignmentFeedback(room.assignmentQuiz, questionId, answer, room.session.assignment!.showFeedback),
    assignment: assignmentView(room.assignmentQuiz, room.session, room.assignmentAnswers[playerId]) });
});
app.post('/api/session/:pin/assignment/close', (req, res) => {
  const room = homework(req.params.pin);
  requireHost(room, bearer(req));
  room.session = { ...room.session, status: 'finished', assignment: { ...room.session.assignment!, closed: true } };
  room.sequence++;
  broadcastState(room);
  flushAssignments();
  res.json({ success: true, ...envelope(room, true) });
});
// A new deadline also reopens a closed homework; participant credentials follow it.
app.post('/api/session/:pin/assignment/extend', (req, res) => {
  const room = homework(req.params.pin);
  requireHost(room, bearer(req));
  const deadline = Number(object(req.body).deadline);
  check(deadlineAllowed(deadline), 'Invalid deadline');
  room.session = { ...room.session, status: 'lobby', assignment: { deadline, showFeedback: room.session.assignment!.showFeedback } };
  for (const player of room.playerExpiries.keys()) room.playerExpiries.set(player, deadline + ASSIGNMENT_GRACE_MS);
  room.sequence++;
  broadcastState(room);
  flushAssignments();
  res.json({ success: true, ...envelope(room, true) });
});

// Every API error is JSON, including invalid JSON and oversized bodies. Never expose a stack trace.
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof ProtocolError ? err.status : err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: err instanceof ProtocolError ? err.message : status === 413 ? 'Message too large' : status === 400 ? 'Invalid JSON' : 'Internal server error' });
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
  const publicShare = publicAccess.isPublic(request) ? publicAccess.snapshot() : null;
  if (publicShare) { publicSockets.add(ws); ws.once('close', () => publicSockets.delete(ws)); }
  let client: ConnectedClient | undefined;
  let credential: string | undefined;
  const deadline = setTimeout(() => ws.close(1008, 'Registration required'), 10000);
  deadline.unref();
  ws.on('error', () => {}); // Includes maxPayload violations; ws closes with 1009.
  ws.on('message', (message, isBinary) => {
    try {
      if (publicShare && publicAccess.snapshot() !== publicShare) { ws.close(1008, 'Internet sharing stopped'); return; }
      if (isBinary) throw new ProtocolError(400, 'Text messages required');
      let parsed: unknown;
      try { parsed = JSON.parse(message.toString()); } catch { throw new ProtocolError(400, 'Invalid JSON'); }
      const data = object(parsed);
      check(typeof data.type === 'string' && data.type.length <= 64, 'Invalid message type');
      if (data.type === 'REGISTER') {
        const pin = validatePin(data.pin), room = roomFor(pin);
        if (publicShare && (pin !== publicShare.pin || data.role !== 'player')) throw new ProtocolError(403, 'Public access is for participants in the shared session only');
        const supplied = token(data.token);
        // Derive privileges from the credential. A declared role cannot elevate a player.
        let role: 'host' | 'player';
        let playerId: string | undefined;
        if (matches(supplied, room.hostToken)) {
          if (!presenterDevice(request)) throw new ProtocolError(403, 'Presenter access is available only on the teacher computer');
          role = 'host'; check(data.role === 'host');
        } else {
          playerId = id(data.playerId);
          requirePlayer(room, playerId, supplied);
          role = 'player';
          if (data.role !== role) throw new ProtocolError(403, 'Role not authorized');
        }
        if (client) sessionClients.get(client.pin)?.delete(client);
        client = { ws, pin, role, playerId };
        credential = supplied;
        sessionClients.get(pin)!.add(client);
        clearTimeout(deadline);
        send(ws, envelope(room, role === 'host', playerId)); return;
      }
      if (!client) throw new ProtocolError(403, 'Registration required');
      const room = roomFor(client.pin);
      if (client.role === 'host') requireHost(room, credential);
      else requirePlayer(room, client.playerId!, credential);
      if (data.pin !== undefined && data.pin !== client.pin) throw new ProtocolError(403, 'Session mismatch');
      if (data.type === 'SESSION_STATE_UPDATE') {
        requireHost(room, credential);
        updateRoom(room, data.session, data.revision, data.operationId); return;
      }
      if (data.type === 'PLAYER_ANSWER') {
        if (client.role !== 'player') throw new ProtocolError(403, 'Player authorization required');
        if (!receiveAnswer(room, data, credential, client.playerId)) send(ws, envelope(room, false, client.playerId));
        return;
      }
      if (data.type === 'REQUEST_SESSION_SYNC') {
        send(ws, envelope(room, client.role === 'host', client.playerId)); return;
      }
      if (data.type === 'REACTION') {
        if (client.role !== 'player' || data.playerId !== client.playerId) throw new ProtocolError(403, 'Player identity mismatch');
        check(typeof data.emoji === 'string' && ['👏', '🎉', '🔥', '❤️', '👍', '😮'].includes(data.emoji));
        broadcast(client.pin, { type: 'REACTION', pin: client.pin, playerId: client.playerId, emoji: data.emoji }); return;
      }
      throw new ProtocolError(400, 'Unsupported message type');
    } catch (error) {
      send(ws, { type: 'ERROR', status: error instanceof ProtocolError ? error.status : 500,
        error: error instanceof ProtocolError ? error.message : 'Internal server error' });
    }
  });
  ws.on('close', () => {
    clearTimeout(deadline);
    if (!client) return;
    const clients = sessionClients.get(client.pin);
    clients?.delete(client);
    if (client.role === 'player' && ![...(clients || [])].some(other => other.playerId === client!.playerId)) {
      broadcast(client.pin, { type: 'PLAYER_DISCONNECTED', pin: client.pin, playerId: client.playerId }, true);
    }
  });
  send(ws, { type: 'PING' });
});
setInterval(() => {
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.ping();
}, 30000).unref();

// Mounting Vite in development or static serving in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const server = http.createServer(app);
  attachWsUpgrade(server);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.QURIOSO_DIST_PATH || path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // The native app asks for the previous port: links and saved participant credentials of open homework keep working.
  const preferredPort = Number(process.env.QURIOSO_PREFERRED_PORT ?? 0);
  let fallback = requestedPort === 0 && Number.isInteger(preferredPort) && preferredPort > 0 && preferredPort <= 65535;
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (fallback && ['EADDRINUSE', 'EACCES'].includes(error.code || '')) { fallback = false; server.listen(requestedPort, '0.0.0.0'); return; }
    console.error('Unable to start Qurioso:', error.message);
    process.exit(1);
  });
  server.listen(fallback ? preferredPort : requestedPort, '0.0.0.0');
  server.once('listening', () => {
    listeningPort = (server.address() as import('net').AddressInfo).port;
    parentPort?.postMessage({ type: 'ready', port: listeningPort });
    announceHomework();
    console.log(`Qurioso: http://localhost:${listeningPort}`);
    for (const networks of Object.values(os.networkInterfaces())) {
      for (const net of networks || []) {
        if (net.family === 'IPv4' && !net.internal) console.log(`Wi-Fi / LAN: http://${net.address}:${listeningPort}`);
      }
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
