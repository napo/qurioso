import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { applyPlayerAnswer, publicQuestion } from '../src/services/sessionState';
import { getJoinBaseUrl, isLoopbackOrigin } from '../src/utils/connectionUrl';
import type { GameSession } from '../src/types/quiz';

const quiz = DEFAULT_QUIZZES[0];
function round(index = 0): GameSession {
  return {
    pin: '123456', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'question',
    currentQuestionIndex: index, currentQuestion: publicQuestion(quiz, index),
    questionStartTime: Date.now(), timeRemaining: quiz.questions[index].timeLimit,
    players: { player: { id: 'player', nickname: 'Test', avatar: '🦊', score: 0, streak: 0 } },
    answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length,
  };
}

test('Marte is scored correctly once and updates the final statistics', () => {
  const session = round();
  const answer = { playerId: 'player', questionId: 'vq-1', optionId: 'vq1-a', timeTakenMs: 1000 };
  const updated = applyPlayerAnswer(session, quiz, answer);
  assert.equal(updated.players.player.lastAnswerCorrect, true);
  assert.ok(updated.players.player.score > 0);
  assert.equal(updated.players.player.correctAnswersCount, 1);
  assert.equal(updated.players.player.totalTimeTakenMs, 1000);
  assert.equal(applyPlayerAnswer(updated, quiz, answer), updated);
  assert.equal(session.players.player.score, 0);
});

test('the second round uses its own options; stale, invalid and closed-round answers are ignored', () => {
  const session = round(1);
  const answer = { playerId: 'player', questionId: quiz.questions[1].id,
    optionId: quiz.questions[1].options.find(o => o.isCorrect)!.id, timeTakenMs: 1000 };
  assert.equal(applyPlayerAnswer(session, quiz, answer).players.player.lastAnswerCorrect, true);
  assert.equal(applyPlayerAnswer(session, quiz, { ...answer, questionId: 'vq-1' }), session);
  assert.equal(applyPlayerAnswer(session, quiz, { ...answer, optionId: 'opt_0' }), session);
  assert.equal(applyPlayerAnswer(session, quiz, { ...answer, timeTakenMs: -1 }), session);
  const closed = { ...session, status: 'question_results' as const };
  assert.equal(applyPlayerAnswer(closed, quiz, answer), closed);
});

test('participants get real option IDs, all six answers and no solution key', () => {
  const six = structuredClone(quiz);
  six.questions[0].options.push({ ...six.questions[0].options[0], id: 'fifth' }, { ...six.questions[0].options[0], id: 'sixth' });
  const question = publicQuestion(six, 0)!;
  assert.equal(question.options.length, 6);
  assert.equal(question.options[0].id, 'vq1-a');
  assert.equal('isCorrect' in question.options[0], false);
});

test('LAN QR links preserve the actual dynamically assigned port', () => {
  const info = { port: 52317, localIps: ['192.168.1.79'] };
  assert.ok(isLoopbackOrigin('http://localhost:52317'));
  assert.ok(isLoopbackOrigin('http://qurioso.localhost'));
  assert.equal(getJoinBaseUrl('http://qurioso.localhost', info, 'lan'), 'http://192.168.1.79:52317');
  assert.equal(getJoinBaseUrl('http://localhost:52317', info, 'lan'), 'http://192.168.1.79:52317');
  assert.equal(getJoinBaseUrl('https://quiz.example.org', info, 'origin'), 'https://quiz.example.org');
});
