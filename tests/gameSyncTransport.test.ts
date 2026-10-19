import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { WebSocket } from 'ws';
import { startLanServer, round } from './helpers/lanServer';
import { GameSyncManager, type GameSyncMessage } from '../src/services/gameSync';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { applyPlayerAnswer, publicQuestion } from '../src/services/sessionState';

test('real transport authenticates automatic reconnects, ignores local spoofing and orders deletion', { timeout: 20000 }, async t => {
  const { base, request } = await startLanServer(t);
  const dom = new JSDOM('', { url: base });
  const originalFetch = globalThis.fetch;
  const sockets: ClientSocket[] = [];
  class ClientSocket extends WebSocket {
    registrations: any[] = [];
    constructor(url: string) { super(url); sockets.push(this); }
    send(data: any, ...args: any[]) {
      try { const frame = JSON.parse(String(data)); if (frame.type === 'REGISTER') this.registrations.push(frame); } catch {}
      return super.send(data, ...args);
    }
  }
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let blockReads = false;
  let loseCreationAcknowledgement = true;
  let blockWritesUntil = 0;
  const writes: any[] = [];
  let holdReadToken: string | undefined;
  let heldRead: { response: Response; release: (response: Response) => void } | undefined;
  for (const [key, value] of Object.entries({ window: dom.window, localStorage: dom.window.localStorage, WebSocket: ClientSocket,
    // Plain HTTP LAN origins expose getRandomValues, but may not expose randomUUID.
    crypto: { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) },
    fetch: async (url: string | URL, init?: RequestInit) => {
      if (blockReads && init?.method !== 'POST' && String(url).includes('/api/session/')) return new Response('{}', { status: 503 });
      const writing = String(url).endsWith('/api/session/create');
      if (writing) {
        writes.push(JSON.parse(String(init?.body)));
        if (Date.now() < blockWritesUntil) return new Response('{}', { status: 503 });
      }
      const response = await originalFetch(new URL(String(url), base), init);
      if (writing && loseCreationAcknowledgement) {
        loseCreationAcknowledgement = false;
        throw new Error('Simulated lost creation acknowledgement after server commit');
      }
      if (holdReadToken && new Headers(init?.headers).get('Authorization') === `Bearer ${holdReadToken}` && init?.method !== 'POST') {
        holdReadToken = undefined;
        return new Promise<Response>(release => { heldRead = { response, release }; });
      }
      return response;
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const host = new GameSyncManager(), player = new GameSyncManager();
  t.after(() => {
    host.dispose(); player.dispose();
    for (const ws of sockets) ws.terminate();
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  });
  const hostEvents: GameSyncMessage[] = [], playerEvents: GameSyncMessage[] = [];
  host.subscribe(msg => hostEvents.push(msg)); player.subscribe(msg => playerEvents.push(msg));
  const waitFor = async (condition: () => unknown, label: string) => {
    const end = Date.now() + 6000;
    while (Date.now() < end) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out: ' + label);
  };
  const state = round();
  host.register(state.pin, 'host');
  assert.equal(await host.createSessionOnServer(state), true);
  assert.equal(writes.length, 2, 'lost creation acknowledgement retries the same request');
  assert.deepEqual(writes[0], writes[1]);
  assert.equal((await (await request('/api/health')).json()).activeSessions, 1);
  assert.equal(await player.joinSessionOnServer(state.pin, { id: 'phone', nickname: 'Phone', avatar: '🦊', score: 0, streak: 0 }), true);
  await waitFor(() => host.isServerConnected() && player.isServerConnected() && playerEvents.some(m => m.type === 'SESSION_STATE_UPDATE'), 'authenticated sockets');
  const hostRegistration = sockets.flatMap(ws => ws.registrations).find(frame => frame.role === 'host');
  const playerRegistration = sockets.flatMap(ws => ws.registrations).find(frame => frame.role === 'player');
  assert.ok(hostRegistration?.token);
  assert.notEqual(hostRegistration.token, playerRegistration.token);
  assert.equal(JSON.stringify(playerEvents).includes(hostRegistration.token), false);
  assert.equal(localStorage.length, 0, 'no credentials or private snapshots are written to localStorage');

  // Legacy cross-tab/cache data must never be an alternate authority for multiplayer.
  const spoofed = { ...state, status: 'finished' };
  localStorage.setItem(`qurioso_session_${state.pin}`, JSON.stringify(spoofed));
  dom.window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'qurioso_latest_event', newValue: JSON.stringify({ type: 'SESSION_STATE_UPDATE', session: spoofed }),
  }));
  assert.equal((await player.fetchSessionFromServer(state.pin))?.status, 'question');
  assert.equal(playerEvents.some(m => m.type === 'SESSION_STATE_UPDATE' && m.session.status === 'finished'), false);
  blockReads = true;
  assert.equal(await player.fetchSessionFromServer(state.pin), null, 'failed HTTP reads never trust the legacy cache');
  blockReads = false;

  assert.equal(await player.submitAnswerOnServer(state.pin, 'phone', 'vq1-a', 1000, 'vq-1'), true);
  const received = (await host.fetchSessionFromServer(state.pin))!;
  const scored = applyPlayerAnswer(received, DEFAULT_QUIZZES[0], { playerId: 'phone', ...received.answersForCurrentQuestion.phone });
  loseCreationAcknowledgement = true; // Also lose a write acknowledgement after the server has graded the snapshot.
  assert.equal(await host.createSessionOnServer(scored), true);
  assert.equal((await player.fetchSessionFromServer(state.pin))?.players.phone.score, 0);
  assert.ok((await host.fetchSessionFromServer(state.pin))!.players.phone.score > 0);

  for (const ws of [...sockets]) ws.close();
  await waitFor(() => !host.isServerConnected() && !player.isServerConnected(), 'transport outage');
  blockWritesUntil = Date.now() + 600;
  assert.equal(await host.createSessionOnServer({ ...scored, status: 'question_results' }), true);
  const closingWrites = writes.filter(write => write.session.status === 'question_results');
  assert.ok(closingWrites.length >= 2);
  assert.ok(closingWrites.every(write => write.operationId === closingWrites[0].operationId));
  await waitFor(() => playerEvents.some(m => m.type === 'SESSION_STATE_UPDATE' && m.session.status === 'question_results'), 'HTTP recovery during socket outage');
  await waitFor(() => sockets.flatMap(ws => ws.registrations).filter(frame => frame.role === 'host').length >= 2 &&
    sockets.flatMap(ws => ws.registrations).filter(frame => frame.role === 'player').length >= 2 &&
    host.isServerConnected() && player.isServerConnected(), 'automatic authenticated reconnect');
  const hostTokens = sockets.flatMap(ws => ws.registrations).filter(frame => frame.role === 'host').map(frame => frame.token);
  const playerTokens = sockets.flatMap(ws => ws.registrations).filter(frame => frame.role === 'player').map(frame => frame.token);
  assert.ok(hostTokens.every(token => token === hostRegistration.token));
  assert.ok(playerTokens.every(token => token === playerRegistration.token));
  assert.equal((await player.fetchSessionFromServer(state.pin))!.players.phone.lastAnswerCorrect, true);
  // Hold an old HTTP response, then change the question while the participant is disconnected.
  assert.equal(await host.createSessionOnServer({ ...scored, status: 'leaderboard' }), true);
  holdReadToken = playerRegistration.token;
  const staleRead = player.fetchSessionFromServer(state.pin, true);
  await waitFor(() => heldRead, 'old response captured');
  const beforeChange = playerEvents.length;
  const playerSocket = sockets.findLast(ws => ws.registrations.some(frame => frame.role === 'player'))!;
  playerSocket.close();
  blockReads = true;
  await waitFor(() => !player.isServerConnected(), 'participant disconnected');
  const second = { ...scored, status: 'question' as const, currentQuestionIndex: 1,
    currentQuestion: publicQuestion(DEFAULT_QUIZZES[0], 1), questionStartTime: state.questionStartTime + 1,
    timeRemaining: DEFAULT_QUIZZES[0].questions[1].timeLimit, answersForCurrentQuestion: {} };
  assert.equal(await host.createSessionOnServer(second), true);
  blockReads = false;
  await waitFor(() => playerEvents.slice(beforeChange).some(m => m.type === 'SESSION_STATE_UPDATE' && m.session.currentQuestionIndex === 1), 'current question recovered');
  heldRead!.release(heldRead!.response);
  assert.equal((await staleRead)?.currentQuestionIndex, 1, 'an old HTTP response cannot roll the player back');
  assert.equal(await player.submitAnswerOnServer(state.pin, 'phone', 'vq1-a', 0, 'vq-1', scored.roundId), false);
  const restored = (await player.fetchSessionFromServer(state.pin))!;
  assert.equal(restored.players.phone.score, scored.players.phone.score);
  assert.equal(await player.joinSessionOnServer(state.pin, { id: 'phone', nickname: 'Phone', avatar: '🦊', score: 0, streak: 0 }), true);
  assert.equal(Object.keys((await host.fetchSessionFromServer(state.pin))!.players).length, 1, 'rejoin retains the original identity');
  assert.equal((await player.fetchSessionFromServer(state.pin))!.players.phone.score, scored.players.phone.score);
  await host.removeSession(state.pin);
  player.unregister(state.pin);
  assert.equal((await request('/api/session/' + state.pin)).status, 404);

  // Cleanup queued while initial creation is in flight must run after that creation.
  const pending = round('234567');
  host.register(pending.pin, 'host');
  const creating = host.createSessionOnServer(pending);
  const deleting = host.removeSession(pending.pin);
  assert.equal(await creating, true);
  await deleting;
  assert.equal((await request('/api/session/' + pending.pin)).status, 404);
});
