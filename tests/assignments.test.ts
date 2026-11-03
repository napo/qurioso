import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, type AddressInfo } from 'node:net';
import { startLanServer, round } from './helpers/lanServer';
import { assignmentOpen, assignmentView, deadlineAllowed, gradeAssignmentAnswer, MAX_ASSIGNMENT_MS, MIN_ASSIGNMENT_MS } from '../server/assignments';
import { participantRouteAllowed } from '../server/internetSharing';
import type { GameSession, Quiz } from '../src/types/quiz';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
export function homeworkQuiz(): Quiz {
  const option = (id: string, text: string, isCorrect: boolean, color: 'red' | 'blue' | 'yellow' | 'green', shape: 'triangle' | 'diamond' | 'circle' | 'square') => ({ id, text, isCorrect, color, shape });
  return {
    id: 'hw-quiz', title: 'Compito', description: '', category: '', author: '', createdAt: 1,
    settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: true },
    questions: [
      { id: 'q1', type: 'multiple_choice', text: 'Capitale d’Italia?', timeLimit: 20, points: 1000, mediaUrl: PIXEL, mediaType: 'image', explanation: 'Roma dal 1871.',
        options: [option('a', 'Roma', true, 'red', 'triangle'), option('b', 'Milano', false, 'blue', 'diamond')] },
      { id: 'q2', type: 'poll', text: 'Ti è piaciuto?', timeLimit: 20, points: 1000,
        options: [option('c', 'Sì', false, 'red', 'triangle'), option('d', 'No', false, 'blue', 'diamond')] },
      { id: 'q3', type: 'ordering', text: 'Ordina', timeLimit: 20, points: 500,
        options: [option('e', 'Uno', false, 'red', 'triangle'), option('f', 'Due', false, 'blue', 'diamond'), option('g', 'Tre', false, 'yellow', 'circle')] },
    ],
  };
}
export function homeworkSession(pin: string, quiz: Quiz, deadline = Date.now() + 24 * 3600_000, showFeedback = true): GameSession {
  return { ...round(pin), quizId: quiz.id, quizTitle: quiz.title, mode: 'assignment', status: 'lobby', currentQuestion: undefined, questionStartTime: 0,
    totalQuestions: quiz.questions.length, assignment: { deadline, showFeedback } };
}
const person = (id: string) => ({ id, nickname: id, avatar: '🦊', score: 0, streak: 0 });

test('homework rules: deadline bounds, open until deadline or closing, one answer per question in order, no speed bonus', () => {
  const now = 1_000_000_000_000, quiz = homeworkQuiz();
  assert.equal(deadlineAllowed(now + MIN_ASSIGNMENT_MS - 1, now), false);
  assert.equal(deadlineAllowed(now + MIN_ASSIGNMENT_MS, now), true);
  assert.equal(deadlineAllowed(now + MAX_ASSIGNMENT_MS, now), true);
  assert.equal(deadlineAllowed(now + MAX_ASSIGNMENT_MS + 120_000, now), false);
  const session = homeworkSession('100000', quiz, now + 3600_000);
  assert.equal(assignmentOpen(session, now), true);
  assert.equal(assignmentOpen(session, now + 3600_000), false, 'closed at the deadline');
  assert.equal(assignmentOpen({ ...session, assignment: { ...session.assignment!, closed: true } }, now), false);

  const first = gradeAssignmentAnswer(quiz, {}, 'q1', { optionId: 'a' }, now);
  assert.deepEqual(first, { fresh: true, answer: { optionId: 'a', isCorrect: true, pointsEarned: 1000, answeredAt: now } });
  assert.throws(() => gradeAssignmentAnswer(quiz, {}, 'q2', { optionId: 'c' }), /out of order/);
  const answers = { q1: first.answer };
  assert.equal(gradeAssignmentAnswer(quiz, answers, 'q1', { optionId: 'a' }).fresh, false, 'a retry is acknowledged');
  assert.throws(() => gradeAssignmentAnswer(quiz, answers, 'q1', { optionId: 'b' }), /already submitted/);
  assert.deepEqual(gradeAssignmentAnswer(quiz, answers, 'q2', { optionId: 'd' }, now).answer, { optionId: 'd', pointsEarned: 0, answeredAt: now }, 'a poll has no grade');

  const view = assignmentView(quiz, session, answers, now);
  assert.deepEqual([view.done, view.total, view.score, view.correct, view.scored, view.question?.id], [1, 3, 1000, 1, 2, 'q2']);
  assert.equal(assignmentView(quiz, session, {}, now).question?.mediaUrl, PIXEL, 'the student sees the image on the phone');
  assert.equal(JSON.stringify(assignmentView(quiz, session, {}, now)).includes('isCorrect'), false, 'no solution key');
  assert.equal(assignmentView(quiz, session, {}, now + 3600_000).question, undefined, 'nothing to answer after the deadline');

  for (const [method, route] of [['GET', '/api/session/123456/assignment'], ['POST', '/api/session/123456/assignment/answer']]) assert.equal(participantRouteAllowed(method, route), true, route);
  for (const [method, route] of [['POST', '/api/assignment/create'], ['POST', '/api/session/123456/assignment/close'], ['POST', '/api/session/123456/assignment/extend']]) assert.equal(participantRouteAllowed(method, route), false, route);
});

test('homework on the server: each student alone at their own pace, private results, presenter report, close and extend', { timeout: 20000 }, async t => {
  const { request, mint } = await startLanServer(t);
  const quiz = homeworkQuiz(), session = homeworkSession('345678', quiz), path = `/api/session/${session.pin}`;
  const create = async (body: unknown, token?: string) => request('/api/assignment/create', 'POST', body, token ?? await mint());

  assert.equal((await create({ session: { ...session, assignment: { deadline: Date.now() + 60_000, showFeedback: true } }, assignmentQuiz: quiz })).status, 400, 'deadline too close');
  assert.equal((await create({ session: { ...session, teams: [{ id: 't1', name: 'A', color: 'red' }, { id: 't2', name: 'B', color: 'blue' }] }, assignmentQuiz: quiz })).status, 400, 'no teams in homework');
  assert.equal((await request('/api/session/create', 'POST', { session }, await mint())).status, 400, 'homework is not a live game');
  assert.equal((await create({ session, assignmentQuiz: { ...quiz, questions: [{ ...quiz.questions[0], mediaUrl: 'javascript:alert(1)' }] } })).status, 400, 'only data images or https links');
  assert.equal((await create({ session, assignmentQuiz: quiz }, 'f'.repeat(64))).status, 403);

  const hostToken = await mint();
  const created = await create({ session, assignmentQuiz: quiz }, hostToken);
  assert.equal(created.status, 200, await created.clone().text());
  assert.equal((await request(path + '/state', 'POST', { session: (await created.json()).session, revision: 0 }, hostToken)).status, 409, 'no live-game snapshots');

  const join = async (id: string) => (await (await request(path + '/join', 'POST', { player: person(id) })).json());
  const anna = await join('anna'), bruno = await join('bruno');
  assert.ok(anna.playerExpiresAt >= session.assignment!.deadline, 'the credential lasts until the deadline');
  assert.deepEqual(Object.keys(anna.session.players), ['anna'], 'a student does not see classmates');

  const next = async (token: string) => (await (await request(path + '/assignment', 'GET', undefined, token)).json()).assignment;
  const answer = (id: string, token: string, questionId: string, choice: object) => request(path + '/assignment/answer', 'POST', { playerId: id, questionId, ...choice }, token);
  assert.equal((await next(anna.playerToken)).question.id, 'q1');
  assert.equal((await request(path + '/assignment')).status, 403, 'only a participant reads their homework');
  assert.equal((await answer('anna', bruno.playerToken, 'q1', { optionId: 'a' })).status, 403, 'nobody answers for someone else');

  const graded = await (await answer('anna', anna.playerToken, 'q1', { optionId: 'a' })).json();
  assert.deepEqual(graded.feedback, { isCorrect: true, pointsEarned: 1000, correctOptionIds: ['a'], explanation: 'Roma dal 1871.' });
  assert.equal(graded.assignment.question.id, 'q2');
  assert.equal((await answer('anna', anna.playerToken, 'q1', { optionId: 'a' })).status, 200, 'a retry is acknowledged');
  assert.equal((await answer('anna', anna.playerToken, 'q1', { optionId: 'b' })).status, 409);
  assert.equal((await next(bruno.playerToken)).question.id, 'q1', 'each student has their own position');
  await answer('anna', anna.playerToken, 'q2', { optionId: 'c' });
  const order = (await next(anna.playerToken)).question.options.map((o: { id: string }) => o.id);
  assert.notDeepEqual(order, ['e', 'f', 'g'], 'an ordering is shuffled');
  const last = await (await answer('anna', anna.playerToken, 'q3', { optionId: 'e', optionIds: ['e', 'f', 'g'] })).json();
  assert.deepEqual([last.feedback.isCorrect, last.assignment.done, last.assignment.score, last.assignment.question], [true, 3, 1500, undefined]);

  await answer('bruno', bruno.playerToken, 'q1', { optionId: 'b' });
  const presenter = await (await request(path + '/presenter', 'GET', undefined, hostToken)).json();
  assert.deepEqual(Object.keys(presenter.assignmentAnswers.anna), ['q1', 'q2', 'q3']);
  assert.equal(presenter.assignmentAnswers.bruno.q1.isCorrect, false);
  assert.deepEqual([presenter.session.players.anna.score, presenter.session.players.anna.correctAnswersCount, presenter.session.players.bruno.score], [1500, 2, 0]);
  assert.equal((await request(path + '/presenter', 'GET', undefined, anna.playerToken)).status, 403);

  // Closing: no new answers or participants, a retry of a recorded answer is still acknowledged.
  assert.equal((await request(path + '/assignment/close', 'POST', {}, anna.playerToken)).status, 403);
  assert.equal((await request(path + '/assignment/close', 'POST', {}, hostToken)).status, 200);
  assert.equal((await answer('bruno', bruno.playerToken, 'q2', { optionId: 'c' })).status, 410);
  assert.equal((await answer('bruno', bruno.playerToken, 'q1', { optionId: 'b' })).status, 200);
  assert.equal((await request(path + '/join', 'POST', { player: person('carla') })).status, 410);
  assert.equal((await next(bruno.playerToken)).open, false);

  // A new deadline reopens it.
  assert.equal((await request(path + '/assignment/extend', 'POST', { deadline: Date.now() + 1000 }, hostToken)).status, 400);
  const deadline = Date.now() + 2 * 24 * 3600_000;
  const extended = await request(path + '/assignment/extend', 'POST', { deadline }, hostToken);
  assert.equal(extended.status, 200);
  assert.deepEqual((await extended.json()).session.assignment, { deadline, showFeedback: true });
  assert.equal((await answer('bruno', bruno.playerToken, 'q2', { optionId: 'c' })).status, 200);
  assert.equal((await request(path + '/join', 'POST', { player: person('carla') })).status, 200);
});

test('homework without feedback gives only the points; open homework survives a server restart with the same credentials', { timeout: 20000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qurioso-homework-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'homework.json'), quiz = homeworkQuiz();
  const session = homeworkSession('456789', quiz, Date.now() + 24 * 3600_000, false), pin = `/api/session/${session.pin}`;

  const first = await startLanServer(t, false, { QURIOSO_ASSIGNMENTS_FILE: file });
  const hostToken = await first.mint();
  assert.equal((await first.request('/api/assignment/create', 'POST', { session, assignmentQuiz: quiz }, hostToken)).status, 200);
  const anna = await (await first.request(pin + '/join', 'POST', { player: person('anna') })).json();
  const graded = await (await first.request(pin + '/assignment/answer', 'POST', { playerId: 'anna', questionId: 'q1', optionId: 'b' }, anna.playerToken)).json();
  assert.deepEqual(graded.feedback, { isCorrect: false, pointsEarned: 0 });
  assert.equal((await (await first.request('/api/health')).json()).activeSessions, 0, 'homework does not hold back an update');
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.equal((await stat(file)).mode & 0o777, 0o600, 'the file with the credentials is private');
  assert.match(await readFile(file, 'utf8'), /"q1"/);

  const second = await startLanServer(t, false, { QURIOSO_ASSIGNMENTS_FILE: file });
  const view = (await (await second.request(pin + '/assignment', 'GET', undefined, anna.playerToken)).json()).assignment;
  assert.deepEqual([view.done, view.question.id], [1, 'q2'], 'the student continues where they were');
  assert.equal((await second.request(pin + '/presenter', 'GET', undefined, hostToken)).status, 200, 'the teacher keeps the homework');
});

test('the server reuses the preferred port when it is free, and falls back to any free port when it is taken', { timeout: 20000 }, async t => {
  const free = await new Promise<number>(resolve => { const probe = createServer().listen(0, () => { const { port } = probe.address() as AddressInfo; probe.close(() => resolve(port)); }); });
  const first = await startLanServer(t, false, { QURIOSO_PREFERRED_PORT: String(free) });
  assert.equal(new URL(first.base).port, String(free));
  const second = await startLanServer(t, false, { QURIOSO_PREFERRED_PORT: String(free) });
  assert.notEqual(new URL(second.base).port, String(free));
  assert.equal((await second.request('/api/health')).status, 200);
});
