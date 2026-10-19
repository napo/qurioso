import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startLanServer, round } from './helpers/lanServer';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { applyPlayerAnswer } from '../src/services/sessionState';
import { MAX_MESSAGE_BYTES } from '../server/sessionProtocol';

const player = (id = 'alice') => ({ id, nickname: id, avatar: '🦊', score: 0, streak: 0 });
const isError = (m: any) => m.type === 'ERROR';
const isState = (m: any) => m.type === 'SESSION_STATE_UPDATE';

test('LAN credentials protect REST and WebSocket state, ownership, answers and reconnects', { timeout: 25000 }, async t => {
  const { request, mint, socket, base } = await startLanServer(t);
  const initial = round();
  const path = `/api/session/${initial.pin}`;
  const hostToken = await mint();
  assert.match(hostToken, /^[a-f0-9]{64}$/);
  assert.notEqual(hostToken, initial.pin);
  assert.notEqual(hostToken, await mint());
  assert.equal((await request('/api/session/create', 'POST', { session: initial })).status, 403);
  assert.equal((await request('/api/session/create', 'POST', { session: initial }, 'a'.repeat(64))).status, 403);
  const created = await request('/api/session/create', 'POST', { session: initial }, hostToken);
  assert.equal(created.status, 200);
  assert.equal((await created.json()).revision, 0);
  const otherHostToken = await mint();

  const joined = await request(path + '/join', 'POST', { player: { ...player(), score: 999999, streak: 999, isBot: true, lastAnswerCorrect: true } });
  assert.equal(joined.status, 200);
  const joinData = await joined.json();
  const aliceToken = joinData.playerToken;
  assert.match(aliceToken, /^[a-f0-9]{64}$/);
  assert.notEqual(aliceToken, hostToken);
  assert.equal(joinData.session.players.alice.score, 0);
  assert.equal(joinData.session.players.alice.streak, 0);
  assert.equal(joinData.session.players.alice.isBot, undefined);
  assert.equal(JSON.stringify(joinData).includes(hostToken), false);
  const bobToken = (await (await request(path + '/join', 'POST', { player: player('bob') })).json()).playerToken;
  const privateState = async () => {
    const { clock: _clock, ...state } = await (await request(path, 'GET', undefined, hostToken)).json();
    return state;
  };
  const before = await privateState();

  await t.test('participants cannot claim, update or delete an existing session', async () => {
    for (const credential of [undefined, aliceToken, otherHostToken, initial.pin]) {
      for (const endpoint of ['/api/session/create', path + '/state']) {
        assert.equal((await request(endpoint, 'POST', { session: { ...initial, status: 'finished' }, revision: 0 }, credential)).status, 403);
      }
      assert.equal((await request(path, 'DELETE', undefined, credential)).status, 403);
    }
    assert.deepEqual(await privateState(), before);
    assert.equal((await request(path + '/join', 'POST', { player: { ...player(), nickname: 'stolen' } })).status, 403);
    assert.equal((await request(path + '/join', 'POST', { player: player() }, bobToken)).status, 403);
    assert.equal((await request(path + '/join', 'POST', { player: player() }, aliceToken)).status, 200);
    assert.equal((await privateState()).session.players.alice.nickname, 'alice');
  });

  await t.test('wrong PIN and malformed identities do not create phantom sessions', async () => {
    assert.equal((await request('/api/session/999999/join', 'POST', { player: player() })).status, 404);
    assert.equal((await request('/api/session/not-a-pin')).status, 400);
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal((await request(path + '/join', 'POST', { player: player(key) })).status, 400);
    }
    assert.equal((await request(path + '/join', 'POST', { player: { ...player(), nickname: 'x'.repeat(1000) } })).status, 400);
    const unregistered = await socket();
    assert.equal((await unregistered.next({ type: 'REGISTER', pin: '999999', role: 'player', playerId: 'alice', token: aliceToken }, isError)).status, 404);
  });

  const host = await socket();
  const alice = await socket();
  const attacker = await socket();
  await t.test('WebSocket roles and room scope derive from authenticated credentials', async () => {
    assert.equal((await attacker.next({ type: 'SESSION_STATE_UPDATE', session: initial, revision: 0 }, isError)).status, 403);
    assert.equal((await attacker.next({ type: 'REGISTER', pin: initial.pin, role: 'host' }, isError)).status, 400);
    assert.equal((await attacker.next({ type: 'REGISTER', pin: initial.pin, role: 'host', playerId: 'alice', token: aliceToken }, isError)).status, 403);
    assert.equal((await attacker.next({ type: 'REGISTER', pin: initial.pin, role: 'host', token: otherHostToken, playerId: 'alice' }, isError)).status, 403);
    await host.next({ type: 'REGISTER', pin: initial.pin, role: 'host', token: hostToken }, isState);
    await alice.next({ type: 'REGISTER', pin: initial.pin, role: 'player', playerId: 'alice', token: aliceToken }, isState);
    assert.equal((await alice.next({ type: 'SESSION_STATE_UPDATE', session: { ...initial, status: 'finished' }, revision: 0 }, isError)).status, 403);
    assert.equal((await alice.next({ type: 'PLAYER_JOIN', pin: initial.pin, player: player('forged') }, isError)).status, 400);
    assert.equal((await alice.next({ type: 'HOST_CREATED_SESSION', pin: initial.pin, session: initial }, isError)).status, 400);
    assert.equal((await alice.next({ type: 'CUSTOM_BROADCAST', pin: initial.pin, role: 'host' }, isError)).status, 400);
    assert.equal((await alice.next({ type: 'REQUEST_SESSION_SYNC', pin: '999999' }, isError)).status, 403);
    assert.deepEqual(await privateState(), before);
  });

  await t.test('an in-flight host snapshot cannot erase accepted joins or answers', async () => {
    const snapshot = await privateState();
    const joined = await request(path + '/join', 'POST', { player: player('inflight') });
    const { playerToken } = await joined.json();
    const submitted = { roundId: snapshot.session.roundId, playerId: 'inflight', questionId: 'vq-1', optionId: 'vq1-b', timeTakenMs: 1200 };
    assert.equal((await request(path + '/answer', 'POST', submitted, playerToken)).status, 200);
    assert.equal((await request(path + '/state', 'POST', { session: snapshot.session, revision: snapshot.revision }, hostToken)).status, 200);
    const recovered = await privateState();
    assert.equal(recovered.session.players.inflight.nickname, 'inflight');
    assert.equal(recovered.session.answersForCurrentQuestion.inflight.optionId, submitted.optionId);
  });

  const answer = { roundId: (await privateState()).session.roundId, playerId: 'alice', questionId: 'vq-1', optionId: 'vq1-a', timeTakenMs: 1000 };
  await t.test('answer ownership and public state do not disclose live scoring or private answers', async () => {
    assert.equal((await request(path + '/answer', 'POST', answer)).status, 403);
    assert.equal((await request(path + '/answer', 'POST', answer, bobToken)).status, 403);
    assert.equal((await request(path + '/answer', 'POST', answer, hostToken)).status, 403);
    assert.equal((await alice.next({ type: 'PLAYER_ANSWER', pin: initial.pin, ...answer, playerId: 'bob' }, isError)).status, 403);
    assert.equal((await request(path + '/answer', 'POST', { ...answer, optionId: 'missing' }, aliceToken)).status, 400);
    assert.equal((await request(path + '/answer', 'POST', { ...answer, timeTakenMs: -1 }, aliceToken)).status, 400);
    const receipt = await alice.next({ type: 'PLAYER_ANSWER', pin: initial.pin, ...answer }, isState);
    assert.deepEqual(receipt.session.answersForCurrentQuestion, {});
    const received = await privateState();
    assert.equal(received.session.answersForCurrentQuestion.alice.optionId, 'vq1-a');
    const scored = applyPlayerAnswer(received.session, DEFAULT_QUIZZES[0], { ...answer, ...received.session.answersForCurrentQuestion.alice });
    // Also simulate an over-broad host payload: whitelist the question and all nested fields.
    const extra = { ...scored, hostToken, currentQuestion: DEFAULT_QUIZZES[0].questions[0], quiz: DEFAULT_QUIZZES[0] };
    assert.equal((await request(path + '/state', 'POST', { session: extra, revision: received.revision }, hostToken)).status, 200);
    const visible = (await (await request(path)).json()).session;
    assert.deepEqual(visible.answersForCurrentQuestion, {});
    assert.deepEqual((await (await request(path, 'GET', undefined, aliceToken)).json()).session, visible);
    assert.equal((await request(path, 'GET', undefined, otherHostToken)).status, 403);
    assert.equal(visible.players.alice.score, 0);
    assert.equal(visible.players.alice.streak, 0);
    assert.equal(visible.players.alice.lastAnswer, undefined);
    assert.equal(visible.players.alice.lastAnswerCorrect, undefined);
    assert.equal(visible.players.alice.correctAnswersCount, 0);
    assert.equal(visible.currentQuestion.options[0].isCorrect, undefined);
    assert.equal(visible.currentQuestion.explanation, undefined);
    assert.equal(visible.quiz, undefined);
    assert.equal(visible.hostToken, undefined);
    const resumed = await alice.next({ type: 'REQUEST_SESSION_SYNC', pin: initial.pin }, isState);
    assert.deepEqual(resumed.session, visible);
    assert.equal(alice.messages.some(m => m.type === 'PLAYER_ANSWER'), false);
    assert.equal(JSON.stringify(alice.messages).includes(hostToken), false);
    assert.equal(JSON.stringify(await (await request(path + '/join', 'POST', { player: player('late') })).json()).includes('pointsEarned'), false);
    assert.equal((await request(path + '/answer', 'POST', answer, aliceToken)).status, 200);
    assert.equal((await request(path + '/answer', 'POST', { ...answer, optionId: 'vq1-b' }, aliceToken)).status, 409);
  });

  await t.test('host revisions and PIN binding prevent replay and cross-session overwrites', async () => {
    const current = await privateState();
    assert.equal((await request(path + '/state', 'POST', { session: initial, revision: 0 }, hostToken)).status, 409);
    assert.equal((await host.next({ type: 'SESSION_STATE_UPDATE', session: initial, revision: 0 }, isError)).status, 409);
    assert.equal((await request(path + '/state', 'POST', { session: { ...initial, pin: '777777' }, revision: current.revision }, hostToken)).status, 400);
    assert.equal((await host.next({ type: 'SESSION_STATE_UPDATE', session: { ...initial, pin: '777777' }, revision: current.revision }, isError)).status, 400);
    assert.equal((await request('/api/session/777777')).status, 404);
    assert.deepEqual(await privateState(), current);
  });

  await t.test('authenticated reconnect restores each role and normal results still reach players', async () => {
    host.ws.close(); alice.ws.close();
    const hostAgain = await socket(), aliceAgain = await socket();
    const latest = await privateState();
    const recoveredHost = await hostAgain.next({ type: 'REGISTER', pin: initial.pin, role: 'host', token: hostToken }, isState);
    assert.deepEqual(recoveredHost.session, latest.session);
    assert.equal(recoveredHost.session.players.alice.lastAnswerCorrect, true);
    const recoveredPlayer = await aliceAgain.next({ type: 'REGISTER', pin: initial.pin, role: 'player', playerId: 'alice', token: aliceToken }, isState);
    assert.equal(recoveredPlayer.session.players.alice.score, 0);
    assert.equal(recoveredPlayer.ownAnswer.optionId, 'vq1-a');
    assert.equal(recoveredPlayer.ownAnswer.isCorrect, undefined);
    assert.deepEqual(recoveredPlayer.session.answersForCurrentQuestion, {});
    const closed = { ...latest.session, status: 'question_results' };
    const response = await hostAgain.next({ type: 'SESSION_STATE_UPDATE', session: closed, revision: latest.revision }, isState);
    assert.equal(response.session.status, 'question_results');
    const results = await aliceAgain.next({ type: 'REQUEST_SESSION_SYNC', pin: initial.pin }, isState);
    assert.equal(results.session.players.alice.lastAnswerCorrect, true);
    assert.ok(results.session.players.alice.score > 0);
    assert.equal(results.session.answersForCurrentQuestion.alice.isCorrect, true);
    assert.equal((await request(path + '/answer', 'POST', { ...answer, playerId: 'bob' }, bobToken)).status, 409);
    assert.equal((await request(path, 'DELETE', undefined, hostToken)).status, 200);
    assert.equal((await request(path)).status, 404);
    assert.equal((await request('/api/session/create', 'POST', { session: initial }, hostToken)).status, 403, 'a consumed/deleted credential cannot recreate the room');
  });

  await t.test('malformed, oversized and cross-origin traffic fails safely', async () => {
    let res = await fetch(base + '/api/session/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(res.status, 400); assert.deepEqual(await res.json(), { error: 'Invalid JSON' });
    res = await fetch(base + '/api/session/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(MAX_MESSAGE_BYTES) }) });
    assert.equal(res.status, 413); assert.deepEqual(await res.json(), { error: 'Message too large' });
    res = await fetch(base + '/api/presenter-token', { method: 'POST', headers: { Origin: 'https://attacker.example' } });
    assert.equal(res.status, 403);
    // Electron's stable origin needs precise CORS headers on modules/assets as well as APIs.
    for (const endpoint of ['/api/health', '/logo.svg']) {
      const response = await fetch(base + endpoint, { headers: { Origin: 'http://qurioso.localhost' } });
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://qurioso.localhost');
    }
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: 'https://attacker.example' });
    t.after(() => ws.terminate());
    assert.match(String((await once(ws, 'error'))[0]), /403/);
    const malformed = await socket();
    for (const value of [null, [], 42, {}, { type: 'REGISTER', pin: {} }]) {
      assert.equal((await malformed.next(value, isError)).status, 400);
    }
    const rawReply = once(malformed.ws, 'message');
    malformed.ws.send('{');
    assert.equal(JSON.parse(String((await rawReply)[0])).status, 400);
    const binaryReply = once(malformed.ws, 'message');
    malformed.ws.send(Buffer.from('{}'));
    assert.equal(JSON.parse(String((await binaryReply)[0])).status, 400);
    const oversized = await socket();
    const closed = once(oversized.ws, 'close');
    oversized.ws.send('x'.repeat(MAX_MESSAGE_BYTES + 1));
    assert.equal((await closed)[0], 1009);
    assert.equal((await request('/api/health')).status, 200);
  });
});
