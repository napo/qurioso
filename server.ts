import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { performance } from 'node:perf_hooks';
import { remainingMs, receivedTimeMs, type RoundClock } from './server/roundClock';
import type { GameSession, Player, Quiz } from './src/types/quiz';
import { applyPlayerAnswer, publicQuestion } from './src/services/sessionState';
import { MAX_MESSAGE_BYTES, MAX_PLAYERS, ProtocolError, check, object, id, pin as validatePin,
  player as validatePlayer, session as validateSession, submission, participantSession, videoQuizDefinition } from './server/sessionProtocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
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
  roundPlayers: Record<string, Player>;
  revision: number;
  sequence: number;
  round?: RoundClock;
  operations: Map<string, string>;
}
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
  return room;
}
function requireHost(room: Room, credential: unknown) {
  if (!matches(credential, room.hostToken)) throw new ProtocolError(403, 'Presenter authorization required');
}
function requirePlayer(room: Room, playerId: string, credential: unknown) {
  if (!matches(credential, room.playerTokens.get(playerId))) throw new ProtocolError(403, 'Player authorization required');
}
function reader(room: Room, req: express.Request): { host: boolean; playerId?: string } {
  if (!req.headers.authorization) return { host: false };
  const credential = bearer(req);
  if (matches(credential, room.hostToken)) return { host: true };
  for (const [playerId, expected] of room.playerTokens) if (matches(credential, expected)) return { host: false, playerId };
  throw new ProtocolError(403, 'Invalid authorization');
}
function envelope(room: Room, host: boolean, playerId?: string) {
  const visible = host ? { ...room.session } : participantSession(room.session, room.roundPlayers);
  if (room.videoQuiz) visible.videoQuestionsOpened = room.openedQuestions;
  if (room.videoQuiz && ['question_results', 'leaderboard'].includes(visible.status)) {
    const question = room.videoQuiz.questions[visible.currentQuestionIndex];
    visible.questionResult = { correctOptionIds: question.options.filter(o => o.isCorrect).map(o => o.id),
      ...(room.videoQuiz.settings.showExplanation ? { explanation: question.explanation } : {}) };
  }
  const own = playerId && room.session.answersForCurrentQuestion[playerId];
  return { type: 'SESSION_STATE_UPDATE', revision: room.revision, sequence: room.sequence,
    clock: room.round ? { roundId: room.session.roundId, questionStartTime: room.session.questionStartTime,
      remainingMs: remainingMs(room.round, performance.now()), durationMs: room.round.durationMs } : undefined,
    ownAnswer: own ? { questionId: own.questionId, optionId: own.optionId, timeTakenMs: own.timeTakenMs } : undefined,
    session: visible };
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
app.use(express.json({ limit: MAX_MESSAGE_BYTES, strict: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Qurioso', port: listeningPort, uptime: process.uptime(), activeSessions: sessions.size });
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
  check(Object.keys(next.players).length <= MAX_PLAYERS, 'Too many players');
  if (sameRound) {
    const incoming = next.answersForCurrentQuestion;
    next.answersForCurrentQuestion = { ...room.session.answersForCurrentQuestion, ...incoming };
    for (const [playerId, received] of Object.entries(room.session.answersForCurrentQuestion)) {
      const supplied = incoming[playerId];
      if (!supplied || supplied.optionId !== received.optionId || supplied.questionId !== received.questionId || supplied.timeTakenMs !== received.timeTakenMs) {
        next.answersForCurrentQuestion[playerId] = received;
      }
    }
  }
  if (room.videoQuiz) {
    // Scores/receipts are server-owned. Stale presenter snapshots cannot erase accepted answers.
    next.players = Object.fromEntries(Object.entries(next.players).map(([id, p]) => [id, room.session.players[id] || validatePlayer(p, true)]));
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
  const videoQuiz = session.mode === 'video' ? videoQuizDefinition(body.videoQuiz) : undefined;
  if (videoQuiz) check(session.status === 'lobby' && videoQuiz.id === session.quizId && videoQuiz.questions.length === session.totalQuestions, 'Invalid video setup');
  const room: Room = { session, videoQuiz, openedQuestions: 0, hostToken: credential!, playerTokens: new Map(), roundPlayers: structuredClone(session.players), revision: 0, sequence: 0, operations: new Map() };
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
app.post('/api/session/:pin/join', (req, res) => {
  const room = roomFor(req.params.pin);
  const player = validatePlayer(object(req.body).player, true);
  let playerToken = room.playerTokens.get(player.id);
  if (Object.hasOwn(room.session.players, player.id)) {
    requirePlayer(room, player.id, bearer(req)); // A public player ID is never a reconnect credential.
  } else {
    if (Object.keys(room.session.players).length >= MAX_PLAYERS) throw new ProtocolError(429, 'Too many players');
    playerToken = secret();
    room.playerTokens.set(player.id, playerToken);
    room.session.players[player.id] = player;
    room.sequence++;
    // Only the presenter needs join events containing the private player record.
    broadcast(req.params.pin, { type: 'PLAYER_JOIN', pin: req.params.pin, player }, true);
    broadcastState(room);
  }
  res.json({ success: true, playerToken, ...envelope(room, false, player.id) });
});

function receiveAnswer(room: Room, value: unknown, credential: unknown, registeredPlayerId?: string, bot = false) {
  const data = submission(value);
  if (bot) {
    requireHost(room, credential);
    check(room.videoQuiz && room.session.players[data.playerId]?.isBot, 'Invalid bot');
  } else requirePlayer(room, data.playerId, credential);
  if (registeredPlayerId && registeredPlayerId !== data.playerId) throw new ProtocolError(403, 'Player identity mismatch');
  const session = room.session;
  if (session.roundId !== data.roundId || session.currentQuestion?.id !== data.questionId ||
      !session.currentQuestion.options.some(option => option.id === data.optionId)) {
    throw new ProtocolError(400, 'Invalid answer or question no longer active');
  }
  const previous = session.answersForCurrentQuestion[data.playerId];
  if (previous) {
    if (previous.optionId !== data.optionId) throw new ProtocolError(409, 'Answer already submitted');
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
  const clients = sessionClients.get(req.params.pin);
  sessionClients.delete(req.params.pin);
  for (const client of clients || []) client.ws.close(1000, 'Session ended');
  res.json({ success: true });
});
// Every API error is JSON, including invalid JSON and oversized bodies. Never expose a stack trace.
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof ProtocolError ? err.status : err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: err instanceof ProtocolError ? err.message : status === 413 ? 'Message too large' : status === 400 ? 'Invalid JSON' : 'Internal server error' });
});

wss.on('connection', (ws: WebSocket) => {
  let client: ConnectedClient | undefined;
  let credential: string | undefined;
  const deadline = setTimeout(() => ws.close(1008, 'Registration required'), 10000);
  deadline.unref();
  ws.on('error', () => {}); // Includes maxPayload violations; ws closes with 1009.
  ws.on('message', (message, isBinary) => {
    try {
      if (isBinary) throw new ProtocolError(400, 'Text messages required');
      let parsed: unknown;
      try { parsed = JSON.parse(message.toString()); } catch { throw new ProtocolError(400, 'Invalid JSON'); }
      const data = object(parsed);
      check(typeof data.type === 'string' && data.type.length <= 64, 'Invalid message type');
      if (data.type === 'REGISTER') {
        const pin = validatePin(data.pin), room = roomFor(pin);
        const supplied = token(data.token);
        // Derive privileges from the credential. A declared role cannot elevate a player.
        let role: 'host' | 'player';
        let playerId: string | undefined;
        if (matches(supplied, room.hostToken)) {
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

  server.on('error', (error) => {
    console.error('Unable to start Qurioso:', error.message);
    process.exit(1);
  });
  server.listen(requestedPort, '0.0.0.0', () => {
    listeningPort = (server.address() as import('net').AddressInfo).port;
    const parentPort = (process as NodeJS.Process & { parentPort?: { postMessage: (message: unknown) => void } }).parentPort;
    parentPort?.postMessage({ type: 'ready', port: listeningPort });
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
