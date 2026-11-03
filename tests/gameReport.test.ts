import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { hardestFirst, mostChosenWrong, questionReport, reportCsv, reviewQuiz, type QuestionReport } from '../src/services/gameReport';

const quiz = structuredClone(DEFAULT_QUIZZES.find(q => q.videoConfig)!);
const players = Object.fromEntries(['a', 'b', 'c', 'd'].map(id => [id, { id, nickname: id, avatar: '🦊', score: 0, streak: 0 }]));
const answer = (index: number, optionIndex: number) => {
  const question = quiz.questions[index], option = question.options[optionIndex];
  return { questionId: question.id, optionId: option.id, isCorrect: option.isCorrect, timeTakenMs: 1000 };
};
const correctIndex = (index: number) => quiz.questions[index].options.findIndex(option => option.isCorrect);
const wrongIndex = (index: number) => quiz.questions[index].options.findIndex(option => !option.isCorrect);

function reports(): QuestionReport[] {
  // Question 1: all right. Question 2: one right of four. Question 3: nobody answered.
  return [
    questionReport(quiz, 0, { players, answersForCurrentQuestion: { a: answer(0, correctIndex(0)), b: answer(0, correctIndex(0)) } })!,
    questionReport(quiz, 1, { players, answersForCurrentQuestion: { a: answer(1, correctIndex(1)), b: answer(1, wrongIndex(1)), c: answer(1, wrongIndex(1)), d: answer(1, wrongIndex(1)) } })!,
    questionReport(quiz, 2, { players, answersForCurrentQuestion: {} })!,
  ];
}

test('the report counts answers per question without names, puts the hardest first and builds a review of the missed ones', () => {
  const list = reports();
  assert.deepEqual(list.map(r => [r.players, r.answered, r.correct]), [[4, 2, 2], [4, 4, 1], [4, 0, 0]]);
  assert.equal(JSON.stringify(list).includes('"nickname"'), false, 'no names in the report');
  assert.deepEqual(hardestFirst(list).map(r => r.index), [1, 0, 2], 'unanswered questions go last');
  assert.equal(mostChosenWrong(list[1])!.id, quiz.questions[1].options[wrongIndex(1)].id);
  const review = reviewQuiz(quiz, list, 'Ripasso')!;
  assert.deepEqual(review.questions.map(q => q.id), [quiz.questions[1].id]);
  assert.equal(review.videoConfig, undefined); assert.equal(review.questions[0].videoTimestamp, undefined);
  assert.equal(review.title, 'Ripasso'); assert.notEqual(review.id, quiz.id);
  assert.equal(reviewQuiz(quiz, [list[0], list[2]], 'Ripasso'), undefined, 'nothing to review');
  const csv = reportCsv(list, ['N.', 'Domanda', 'Risposte', 'Corrette', '%', 'Sbagliata']).replace('﻿', '').split('\r\n');
  assert.equal(csv[0], 'N.;Domanda;Risposte;Corrette;%;Sbagliata');
  assert.match(csv[2], /^2;.*;4;1;25;/);
  assert.match(csv[3], /^3;.*;0;0;;$/);
});

test('the final screen shows the report hardest first and offers the review only when there is something to review', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.HTMLCanvasElement.prototype.getContext = (() => null) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { FinalPodium } = await import('../src/components/leaderboard/FinalPodium');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  let reviewed = 0;
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(FinalPodium, { players: {}, totalQuestions: 3, reports: reports(), onReview: () => { reviewed++; }, onExit() {} }))));
  const items = [...document.querySelectorAll('.question-report li')].map(li => li.textContent!);
  assert.match(items[0], /^2\..*25% corrette.*4 risposte su 4.*Risposta sbagliata più scelta/);
  assert.match(items[1], /100% corrette/); assert.match(items[2], /Nessuna risposta/);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Ripassa in classe le domande sbagliate')!.click());
  assert.equal(reviewed, 1);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(FinalPodium, { players: {}, totalQuestions: 3, reports: [reports()[0]], onExit() {} }))));
  assert.match(document.body.textContent!, /niente da ripassare/);
});
