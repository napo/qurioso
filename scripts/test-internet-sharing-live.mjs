// Explicit, opt-in network smoke: publishes only a temporary synthetic game, never a user's library.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { WebSocket } = require('ws');
const { createInternetSharing } = require('../desktop/internetSharing.cjs');
const secret = randomBytes(32).toString('hex'), pin = String(randomInt(100000, 1000000));
const scratch = await mkdtemp(path.join(tmpdir(), 'qurioso-public-smoke-'));
const backend = spawn(process.execPath, ['build/desktop/server.mjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '0', QURIOSO_PUBLIC_TUNNEL_TOKEN: secret }, stdio: ['ignore', 'pipe', 'pipe'] });
let sharing, socket;
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server did not start')), 10000);
    backend.stdout.on('data', data => { const match = String(data).match(/Qurioso: (http:\/\/localhost:\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    backend.once('exit', () => { clearTimeout(timer); reject(new Error('Local server exited')); });
    backend.once('error', reject);
  });
  const local = (url, method = 'GET', body, token) => fetch(base + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const hostToken = (await (await local('/api/presenter-token', 'POST')).json()).hostToken;
  const currentQuestion = { id: 'probe-question', text: 'Temporary technical test', type: 'multiple_choice', timeLimit: 300, points: 1000,
    options: [{ id: 'probe-a', text: 'A', color: 'red', shape: 'triangle' }, { id: 'probe-b', text: 'B', color: 'blue', shape: 'diamond' }] };
  const initial = { pin, quizId: 'temporary-internet-test', quizTitle: 'Temporary technical test', mode: 'standard', status: 'question', currentQuestionIndex: 0,
    currentQuestion, questionStartTime: Date.now(), timeRemaining: 300, players: {}, answersForCurrentQuestion: {}, totalQuestions: 1 };
  assert.equal((await local('/api/session/create', 'POST', { session: initial }, hostToken)).status, 200);
  const directory = process.env.QURIOSO_CLOUDFLARE_TEST_CACHE || path.join(scratch, 'components');
  sharing = createInternetSharing({ directory, port: Number(new URL(base).port), hostHeader: `qurioso-public-${secret}.localhost`,
    configure: async share => { assert.equal((await local('/api/desktop/internet-sharing', 'POST', { share }, secret)).status, 200); },
    onChange: state => console.log('Cloudflare test:', state.phase, state.error || ''),
  });
  const state = await sharing.start(pin);
  assert.equal(state.phase, 'active', `Cloudflare connection failed: ${state.error || state.phase}`);
  const remote = (url, method = 'GET', body, token) => fetch(state.url + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  let entry;
  for (let attempt = 0; attempt < 15; attempt++) {
    try { entry = await remote('/'); if (entry.status === 302) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(entry?.status, 302, 'Public tunnel must open participant entry');
  assert.equal((await remote('/api/presenter-token', 'POST')).status, 403);
  assert.equal((await remote(`/api/session/${pin}/presenter`, 'GET', undefined, hostToken)).status, 403);
  const joined = await remote(`/api/session/${pin}/join`, 'POST', { player: { id: 'technical-probe', nickname: 'Technical test', avatar: '🦊', score: 0, streak: 0 } });
  assert.equal(joined.status, 200); const credentials = await joined.json();
  socket = new WebSocket(state.url.replace('https:', 'wss:') + '/ws', { origin: state.url, handshakeTimeout: 20000 });
  const registration = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Public WebSocket registration timed out')), 20000);
    socket.on('message', bytes => { const data = JSON.parse(bytes); if (data.type === 'SESSION_STATE_UPDATE') { clearTimeout(timer); resolve(data); } });
    socket.on('error', error => { clearTimeout(timer); reject(error); });
  });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'REGISTER', role: 'player', pin, playerId: 'technical-probe', token: credentials.playerToken }));
  const registered = await registration;
  const answer = { playerId: 'technical-probe', questionId: currentQuestion.id, optionId: 'probe-a', roundId: registered.session.roundId, timeTakenMs: 0 };
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Public WebSocket answer timed out')), 10000);
    socket.on('message', bytes => { const data = JSON.parse(bytes); if (data.ownAnswer) { clearTimeout(timer); resolve(data); } });
  });
  socket.send(JSON.stringify({ type: 'PLAYER_ANSWER', pin, ...answer })); await received;
  assert.equal((await remote(`/api/session/${pin}/answer`, 'POST', answer, credentials.playerToken)).status, 200);
  assert.equal((await remote(`/api/session/${pin}/player/technical-probe`, 'GET', undefined, credentials.playerToken)).status, 200);
  // Consecutive games: releasing the first game keeps the tunnel open but shares nothing,
  // then a second game reuses the same connector and address with its own PIN.
  const socketClosed = once(socket, 'close');
  assert.equal((await sharing.release()).phase, 'idle');
  await socketClosed;
  assert.equal(sharing.hasConnector(), true, 'the tunnel stays open between games');
  assert.equal((await remote(`/api/session/${pin}`)).status, 403, 'a released game is not reachable from the Internet');
  const secondPin = String((Number(pin) + 1) % 900000 + 100000);
  const secondHost = (await (await local('/api/presenter-token', 'POST')).json()).hostToken;
  assert.equal((await local('/api/session/create', 'POST', { session: { ...initial, pin: secondPin, quizId: 'temporary-internet-test-2' } }, secondHost)).status, 200);
  const reused = await sharing.start(secondPin);
  assert.deepEqual([reused.phase, reused.url, reused.pin], ['active', state.url, secondPin], 'the next game reuses the open tunnel');
  let second;
  for (let attempt = 0; attempt < 10; attempt++) {
    second = await remote(`/api/session/${secondPin}/join`, 'POST', { player: { id: 'technical-probe-2', nickname: 'Technical test 2', avatar: '🦊', score: 0, streak: 0 } }).catch(() => undefined);
    if (second?.status === 200) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(second?.status, 200, 'participants join the second game through the reused tunnel');
  assert.equal((await remote(`/api/session/${pin}`)).status, 403, 'the previous game stays closed to the Internet');
  await sharing.stop();
  assert.equal(sharing.hasConnector(), false);
  assert.equal((await local(`/api/session/${pin}`, 'GET', undefined, hostToken)).status, 200);
  console.log('LIVE Cloudflare smoke passed: verified component, HTTPS participant entry, protected teacher API, WebSocket answer, HTTP retry, player recovery, tunnel released between games and reused by the next game, shutdown and local teacher continuity.');
} finally {
  socket?.terminate(); await sharing?.stop(); backend.kill();
  await rm(scratch, { recursive: true, force: true });
}
