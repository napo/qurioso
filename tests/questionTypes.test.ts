import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import type { GameSession, Question, Quiz } from '../src/types/quiz';
import { choiceCorrect, displayOrder, makeChoice, validChoice } from '../src/services/questionTypes';
import { applyPlayerAnswer, publicQuestion } from '../src/services/sessionState';
import { csvImportSource, previewQuestionImport, suggestQuestionMapping } from '../src/services/questionImport';
import { portableQuiz } from '../src/services/libraryBackup';
import { startLanServer } from './helpers/lanServer';

const option = (id: string, isCorrect = false) => ({ id, text: id.toUpperCase(), isCorrect, color: 'red' as const, shape: 'triangle' as const });
const question = (type: Question['type'], correct: string[] = []): Question => ({ id: `q-${type}`, text: type, type, timeLimit: 20, points: 1000,
  options: ['a', 'b', 'c', 'd'].map(id => option(id, correct.includes(id))) });
const quizOf = (...questions: Question[]): Quiz => ({ id: 'types', title: 'Types', description: '', category: '', author: '', createdAt: 1,
  settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: false }, questions });
const session = (quiz: Quiz, index = 0): GameSession => ({ pin: '123456', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'question',
  currentQuestionIndex: index, questionStartTime: 1, timeRemaining: 20, totalQuestions: quiz.questions.length, answersForCurrentQuestion: {},
  players: { p: { id: 'p', nickname: 'P', avatar: '🦊', score: 0, streak: 2, correctAnswersCount: 0 } } });

test('choices are checked per type: all-or-nothing several answers, the exact order, and no right answer in a poll', () => {
  const several = question('multiple_select', ['a', 'c']), order = question('ordering'), poll = question('poll');
  assert.equal(choiceCorrect(several, makeChoice(several, ['c', 'a'])), true);
  assert.equal(choiceCorrect(several, makeChoice(several, ['a'])), false, 'a partial choice earns nothing');
  assert.equal(choiceCorrect(several, makeChoice(several, ['a', 'b', 'c'])), false, 'an extra option earns nothing');
  assert.equal(choiceCorrect(order, makeChoice(order, ['a', 'b', 'c', 'd'])), true);
  assert.equal(choiceCorrect(order, makeChoice(order, ['b', 'a', 'c', 'd'])), false);
  assert.equal(choiceCorrect(poll, makeChoice(poll, ['b'])), undefined);
  assert.equal(validChoice(order, makeChoice(order, ['a', 'b'])), false, 'an ordering needs every item');
  assert.equal(validChoice(several, { optionId: 'a', optionIds: ['a', 'a'] }), false, 'no repeats');
  assert.equal(validChoice(several, { optionId: 'a' }), false, 'several answers travel as a list');
  assert.equal(validChoice(question('multiple_choice', ['a']), { optionId: 'a', optionIds: ['a'] }), false, 'one answer travels alone');
  const shown = displayOrder(order, order.options).map(o => o.id);
  assert.notDeepEqual(shown, ['a', 'b', 'c', 'd'], 'never shown in the correct order');
  assert.deepEqual(displayOrder(order, order.options).map(o => o.id), shown, 'the same order on every device');
  assert.deepEqual(publicQuestion(quizOf(order), 0)!.options.map(o => o.id), shown);
  assert.equal(publicQuestion(quizOf(order), 0)!.type, 'ordering');
  assert.equal(JSON.stringify(publicQuestion(quizOf(several), 0)).includes('isCorrect'), false);
});

test('scoring: several answers and orderings score like a single answer, a poll records the vote and changes nothing else', () => {
  const several = question('multiple_select', ['a', 'c']), poll = question('poll');
  const quiz = quizOf(several, poll);
  const right = applyPlayerAnswer(session(quiz), quiz, { playerId: 'p', questionId: several.id, ...makeChoice(several, ['c', 'a']), timeTakenMs: 0 });
  assert.equal(right.players.p.score, 1000); assert.equal(right.players.p.streak, 3); assert.deepEqual(right.answersForCurrentQuestion.p.optionIds, ['c', 'a']);
  assert.equal(applyPlayerAnswer(right, quiz, { playerId: 'p', questionId: several.id, ...makeChoice(several, ['a']), timeTakenMs: 0 }), right, 'graded once');
  const partial = applyPlayerAnswer(session(quiz), quiz, { playerId: 'p', questionId: several.id, ...makeChoice(several, ['a']), timeTakenMs: 0 });
  assert.deepEqual([partial.players.p.score, partial.players.p.streak, partial.answersForCurrentQuestion.p.isCorrect], [0, 0, false]);
  const voted = applyPlayerAnswer(session(quiz, 1), quiz, { playerId: 'p', questionId: poll.id, optionId: 'b', timeTakenMs: 0 });
  assert.deepEqual(voted.players.p, session(quiz).players.p, 'score, streak and feedback untouched');
  assert.deepEqual(voted.answersForCurrentQuestion.p, { questionId: poll.id, optionId: 'b', timeTakenMs: 0, pointsEarned: 0 });
  assert.equal(applyPlayerAnswer(voted, quiz, { playerId: 'p', questionId: poll.id, optionId: 'c', timeTakenMs: 0 }), voted, 'one vote');
});

test('the server accepts only complete, unchanged choices for the question type', { timeout: 15000 }, async t => {
  const { request, mint } = await startLanServer(t);
  const order = question('ordering'), quiz = quizOf(order);
  const initial = { ...session(quiz), players: {}, currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now() };
  const hostToken = await mint(), path = '/api/session/123456';
  const created = await request('/api/session/create', 'POST', { session: initial }, hostToken);
  assert.equal(created.status, 200);
  const roundId = (await created.json()).session.roundId;
  const token = (await (await request(path + '/join', 'POST', { player: { id: 'p', nickname: 'P', avatar: '🦊', score: 0, streak: 0 } })).json()).playerToken;
  const send = (ids: string[]) => request(path + '/answer', 'POST', { playerId: 'p', questionId: order.id, ...makeChoice(order, ids), timeTakenMs: 0, roundId }, token);
  assert.equal((await send(['a', 'b'])).status, 400, 'an incomplete order is refused');
  assert.equal((await request(path + '/answer', 'POST', { playerId: 'p', questionId: order.id, optionId: 'a', timeTakenMs: 0, roundId }, token)).status, 400, 'a single option is refused');
  assert.equal((await send(['b', 'a', 'd', 'c'])).status, 200);
  assert.equal((await send(['b', 'a', 'd', 'c'])).status, 200, 'an identical retry is acknowledged');
  assert.equal((await send(['a', 'b', 'c', 'd'])).status, 409, 'the order cannot be changed');
  const state = await (await request(path, 'GET', undefined, hostToken)).json();
  assert.deepEqual(state.session.answersForCurrentQuestion.p.optionIds, ['b', 'a', 'd', 'c']);
  assert.equal(state.session.currentQuestion.type, 'ordering');
});

test('import, backup and sync accept the new types with their rules', () => {
  const text = 'domanda;tipo;risposta_A;risposta_B;risposta_C;corretta\nPari?;più risposte;2;3;4;A|C\nPreferenza?;sondaggio;Mare;Monti;Lago;\nIn ordine;ordinamento;Uno;Due;Tre;\nVuota?;più risposte;1;2;3;';
  const source = csvImportSource(text, ';', true);
  const rows = previewQuestionImport(source, { mapping: suggestQuestionMapping(source.columns), defaultType: 'multiple_choice', correctMode: 'letters' });
  assert.deepEqual(rows.slice(0, 3).map(row => [row.question!.type, row.question!.options.filter(o => o.isCorrect).length]), [['multiple_select', 2], ['poll', 0], ['ordering', 0]]);
  assert.equal(rows[3].errors[0].key, 'correctMissing');
  const quiz = quizOf(question('multiple_select', ['a', 'b']), question('poll'), question('ordering'));
  assert.deepEqual(portableQuiz(quiz).questions.map(q => q.type), ['multiple_select', 'poll', 'ordering']);
});

test('classroom: the class confirms several answers, an ordering in sequence and a poll without a verdict', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.org/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const { ClassroomScreen } = await import('../src/components/classroom/ClassroomScreen');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, d] of saved) { if (d) Object.defineProperty(globalThis, key, d); else Reflect.deleteProperty(globalThis, key); } });
  const several = question('multiple_select', ['a', 'c']), order = question('ordering'), poll = question('poll');
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(ClassroomScreen, { quiz: quizOf(several, order, poll), onExit() {} }))));
  // Each option shows its letter, then its text: match the text, which may carry the position picked.
  const option = (text: string) => [...document.querySelectorAll('button[aria-keyshortcuts]')].find(b => b.querySelector('span:last-child')!.textContent!.split(' · ')[0] === text) as HTMLButtonElement;
  const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement;
  const click = async (element: HTMLButtonElement) => act(async () => element.click());
  await click(option('A')); assert.equal(button('Conferma risposta della classe').disabled, false);
  await click(option('C')); await click(button('Conferma risposta della classe'));
  assert.match(document.body.textContent!, /Risposta corretta!/);
  await click(button('Prossima domanda'));
  await click(option('A')); assert.equal(button('Conferma risposta della classe').disabled, true, 'an ordering needs every item');
  for (const text of ['B', 'C', 'D']) await click(option(text));
  await click(button('Conferma risposta della classe'));
  assert.match(document.body.textContent!, /Risposta corretta!/);
  await click(button('Prossima domanda'));
  await click(option('B')); await click(button('Conferma risposta della classe'));
  assert.match(document.body.textContent!, /Voto della classe registrato/);
  await click(button('Mostra riepilogo'));
  assert.match(document.body.textContent!, /2 su 2/, 'the poll is not counted');
  assert.match(document.body.textContent!, /Soluzione: A → B → C → D/);
});
