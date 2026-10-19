import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startLanServer, round } from './helpers/lanServer';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { applyPlayerAnswer, publicQuestion } from '../src/services/sessionState';
import { remainingMs, receivedTimeMs } from '../server/roundClock';

const isState = (m: any) => m.type === 'SESSION_STATE_UPDATE';
const isError = (m: any) => m.type === 'ERROR';

test('server monotonic receipt timing uses a fixed allowance, coarse precision and an independent deadline', () => {
  const clock = { startedAt: 10000, durationMs: 15000 };
  assert.equal(receivedTimeMs(clock, 10050), 0);
  assert.equal(receivedTimeMs(clock, 11342), 1200);
  assert.equal(receivedTimeMs(clock, 11380), 1300);
  assert.equal(remainingMs(clock, 24999), 1);
  assert.equal(remainingMs(clock, 25000), 0);
  assert.equal(remainingMs(clock, 28000), 0);
});

test('multiple players: fabricated times, duplicate transports, expiry, immutable round timing and ordered writes', { timeout: 15000 }, async t => {
  const { request, mint, socket } = await startLanServer(t);
  const hostToken = await mint(), initial = round();
  // The presenter's wall clock can be a day ahead; it must not control elapsed time or expiry.
  initial.questionStartTime = Date.now() + 86400000;
  const creation = { session: initial, operationId: 'create-once' };
  assert.equal((await request('/api/session/create', 'POST', creation, hostToken)).status, 200);
  const path = '/api/session/' + initial.pin;
  const get = async () => (await (await request(path, 'GET', undefined, hostToken)).json());
  const players = new Map<string, string>();
  for (const id of ['alice', 'bob', 'carlo']) {
    const response = await request(path + '/join', 'POST', { player: { id, nickname: id, avatar: '🦊', score: 0, streak: 0 } });
    players.set(id, (await response.json()).playerToken);
  }
  const current = await get();
  await delay(350);
  const answer = { roundId: current.session.roundId, playerId: 'alice', questionId: 'vq-1', optionId: 'vq1-a', timeTakenMs: 0 };
  assert.equal((await request(path + '/answer', 'POST', answer, players.get('alice'))).status, 200);
  const accepted = (await get()).session.answersForCurrentQuestion.alice;
  assert.ok(accepted.timeTakenMs >= 200, 'declaring zero cannot erase time already measured by the server');
  assert.equal(accepted.timeTakenMs % 100, 0);
  const sequence = (await get()).sequence;
  assert.equal((await request(path + '/answer', 'POST', { ...answer, timeTakenMs: 999999 }, players.get('alice'))).status, 200);
  const alice = await socket();
  await alice.next({ type: 'REGISTER', pin: initial.pin, role: 'player', playerId: 'alice', token: players.get('alice') }, isState);
  const duplicate = await alice.next({ type: 'PLAYER_ANSWER', pin: initial.pin, ...answer }, isState);
  assert.equal(duplicate.sequence, sequence);
  assert.equal(duplicate.ownAnswer.optionId, 'vq1-a');
  assert.equal('isCorrect' in duplicate.ownAnswer, false);
  assert.equal((await alice.next({ type: 'PLAYER_ANSWER', pin: initial.pin, ...answer, optionId: 'vq1-b' }, isError)).status, 409);
  assert.deepEqual((await get()).session.answersForCurrentQuestion.alice, accepted);

  const bob = { ...answer, playerId: 'bob', optionId: 'vq1-b', timeTakenMs: 0 };
  assert.equal((await request(path + '/answer', 'POST', bob, players.get('bob'))).status, 200);
  let snapshot = await get();
  let scored = snapshot.session;
  for (const [playerId, submission] of Object.entries(scored.answersForCurrentQuestion)) {
    scored = applyPlayerAnswer(scored, DEFAULT_QUIZZES[0], { playerId, ...submission as any });
  }
  const firstScore = scored.players.alice.score;
  assert.equal(scored.players.alice.correctAnswersCount, 1);
  assert.equal(scored.players.bob.correctAnswersCount, 0);
  const closed = { session: { ...scored, status: 'question_results' }, revision: snapshot.revision, operationId: 'close-once' };
  assert.equal((await request(path + '/state', 'POST', closed, hostToken)).status, 200);
  assert.equal((await request(path + '/state', 'POST', closed, hostToken)).status, 200);
  assert.equal((await get()).revision, snapshot.revision + 1, 'lost acknowledgements never apply an operation twice');
  assert.equal((await request(path + '/state', 'POST', { ...closed, session: { ...closed.session, quizTitle: 'changed' } }, hostToken)).status, 409);
  assert.equal((await request(path + '/answer', 'POST', { ...answer, playerId: 'carlo' }, players.get('carlo'))).status, 409);
  assert.equal((await request(path + '/answer', 'POST', answer, players.get('alice'))).status, 200, 'retry of a recorded answer is an acknowledgement, not a late new answer');
  assert.equal((await get()).session.players.alice.score, firstScore);

  snapshot = await get();
  assert.equal((await request(path + '/state', 'POST', { session: snapshot.session, revision: 0 }, hostToken)).status, 409);
  assert.equal((await request(path + '/state', 'POST', { session: { ...snapshot.session, status: 'question' }, revision: snapshot.revision }, hostToken)).status, 409, 'fresh revisions cannot reopen a closed question');
  const second = { ...snapshot.session, status: 'question', currentQuestionIndex: 1, currentQuestion: publicQuestion(DEFAULT_QUIZZES[0], 1),
    questionStartTime: initial.questionStartTime + 1, timeRemaining: 0.15, answersForCurrentQuestion: {} };
  assert.equal((await request(path + '/state', 'POST', { session: { ...second, currentQuestionIndex: 2, currentQuestion: publicQuestion(DEFAULT_QUIZZES[0], 2) }, revision: snapshot.revision }, hostToken)).status, 409, 'a new revision cannot skip a question');
  assert.equal((await request(path + '/state', 'POST', { session: second, revision: snapshot.revision }, hostToken)).status, 200);
  snapshot = await get();
  assert.notEqual(snapshot.session.roundId, answer.roundId);
  // A later snapshot may not reset or extend the fixed server deadline.
  assert.equal((await request(path + '/state', 'POST', { session: { ...snapshot.session, timeRemaining: 86400 }, revision: snapshot.revision }, hostToken)).status, 200);
  await delay(250);
  const expired = await get();
  assert.equal(expired.clock.remainingMs, 0);
  assert.equal(expired.session.timeRemaining, 0.15);
  assert.equal(expired.session.status, 'question', 'even without the host closing the UI, the server rejects expired answers');
  const late = { ...answer, roundId: expired.session.roundId, questionId: expired.session.currentQuestion.id, optionId: expired.session.currentQuestion.options[0].id, playerId: 'bob' };
  assert.equal((await request(path + '/answer', 'POST', late, players.get('bob'))).status, 409);
  assert.deepEqual((await get()).session.answersForCurrentQuestion, {});
  assert.equal((await request('/api/session/create', 'POST', creation, hostToken)).status, 200);
  assert.equal((await get()).session.currentQuestionIndex, 1, 'replaying a creation acknowledgement cannot roll back the game');
  assert.equal((await (await request('/api/health')).json()).activeSessions, 1);

  // A new playthrough may contain the same question ID; only its new server nonce is valid.
  let latest = await get();
  for (const state of ['question_results', 'finished', 'lobby'] as const) {
    const session = { ...latest.session, status: state, ...(state === 'lobby' ? { questionStartTime: 0, currentQuestionIndex: 0, currentQuestion: undefined, answersForCurrentQuestion: {} } : {}) };
    assert.equal((await request(path + '/state', 'POST', { session, revision: latest.revision }, hostToken)).status, 200);
    latest = await get();
  }
  assert.equal((await request(path + '/state', 'POST', { session: { ...initial, players: latest.session.players }, revision: latest.revision }, hostToken)).status, 200);
  assert.equal((await request(path + '/answer', 'POST', answer, players.get('alice'))).status, 400, 'old nonce is invalid even with the same question ID and host timestamp');
  assert.equal(Object.keys((await get()).session.players).length, 3);
});
