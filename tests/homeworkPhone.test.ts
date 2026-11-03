import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import type { GameSession, Quiz } from '../src/types/quiz';
import { startLanServer } from './helpers/lanServer';

test('a participant can answer homework on their phone, leave, resume and keep the result', { timeout: 30000 }, async t => {
  const { base, request, mint } = await startLanServer(t);
  const pin = '468024', quiz: Quiz = {
    id: 'phone-homework', title: 'Compito telefono', description: '', category: '', author: '', createdAt: 1,
    settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: false },
    questions: [
      { id: 'q1', type: 'multiple_choice', text: 'Capitale d’Italia?', timeLimit: 20, points: 1000, explanation: 'Roma.',
        options: [{ id: 'roma', text: 'Roma', isCorrect: true, color: 'red', shape: 'triangle' }, { id: 'milano', text: 'Milano', isCorrect: false, color: 'blue', shape: 'diamond' }] },
      { id: 'q2', type: 'multiple_choice', text: 'Due più due?', timeLimit: 20, points: 500,
        options: [{ id: 'tre', text: 'Tre', isCorrect: false, color: 'red', shape: 'triangle' }, { id: 'quattro', text: 'Quattro', isCorrect: true, color: 'blue', shape: 'diamond' }] },
    ],
  };
  const session: GameSession = { pin, quizId: quiz.id, quizTitle: quiz.title, mode: 'assignment', status: 'lobby', currentQuestionIndex: 0,
    questionStartTime: 0, timeRemaining: 0, totalQuestions: quiz.questions.length, players: {}, answersForCurrentQuestion: {},
    assignment: { deadline: Date.now() + 60 * 60_000, showFeedback: true } };
  const hostToken = await mint();
  const created = await request('/api/assignment/create', 'POST', { session, assignmentQuiz: quiz }, hostToken);
  assert.equal(created.status, 200, await created.clone().text());

  const originalFetch = globalThis.fetch;
  const dom = new JSDOM('<div id="app"></div>', { url: `${base}/?pin=${pin}&role=player` });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), HTMLElement: dom.window.HTMLElement, WebSocket,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string | URL, init?: RequestInit) => originalFetch(new URL(String(url), base), init) };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  const { gameSync } = await import('../src/services/gameSync');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => {
    await act(async () => root.unmount());
    gameSync.dispose();
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const waitFor = async (condition: () => unknown, label: string) => {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      let done: unknown;
      await act(async () => { await delay(40); done = condition(); });
      if (done) return;
    }
    throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
  };
  const submitName = async () => act(async () => {
    const name = document.querySelectorAll<HTMLInputElement>('form input')[1];
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(name, 'Ada');
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await delay(80);
  });
  const clickText = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes(text));
    assert.ok(button, `${text}\n${document.body.textContent}`);
    await act(async () => { button.click(); await delay(60); });
  };

  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(PlayerScreen, { initialPin: pin }))));
  await waitFor(() => document.querySelectorAll('form input').length > 1, 'join form');
  await submitName();
  await waitFor(() => document.querySelector('.homework-player')?.textContent?.includes('Capitale d’Italia?'), 'homework question');
  await clickText('Roma');
  await waitFor(() => document.body.textContent?.includes('Risposta giusta!'), 'server-graded feedback');
  await clickText('Avanti');
  await waitFor(() => document.body.textContent?.includes('Due più due?'), 'second question');
  await act(async () => {
    const closed = await request(`/api/session/${pin}/assignment/close`, 'POST', {}, hostToken);
    assert.equal(closed.status, 200);
    await delay(80);
  });
  await waitFor(() => document.querySelector('.homework-end')?.textContent?.includes('Il compito è chiuso'), 'live closure on the phone');
  await act(async () => {
    const reopened = await request(`/api/session/${pin}/assignment/extend`, 'POST', { deadline: Date.now() + 60 * 60_000 }, hostToken);
    assert.equal(reopened.status, 200);
    await delay(80);
  });
  await waitFor(() => document.querySelector('.homework-question')?.textContent?.includes('Due più due?'), 'live reopening on the phone');
  await clickText('Quattro');
  await waitFor(() => document.body.textContent?.includes('Risposta giusta!'), 'second answer feedback');
  await clickText('Avanti');
  await waitFor(() => document.body.textContent?.includes('Compito consegnato!'), 'completed homework');

  await clickText('Esci dal compito');
  await waitFor(() => document.querySelector('form'), 'return to entry');
  const report = await (await request(`/api/session/${pin}/presenter`, 'GET', undefined, hostToken)).json();
  assert.equal(Object.keys(report.assignmentAnswers).length, 1);
  const [answers] = Object.values(report.assignmentAnswers) as Array<Record<string, { isCorrect?: boolean }>>;
  assert.deepEqual([answers.q1.isCorrect, answers.q2.isCorrect], [true, true], 'leaving does not delete homework progress');

  const closedAgain = await request(`/api/session/${pin}/assignment/close`, 'POST', {}, hostToken);
  assert.equal(closedAgain.status, 200);
  await submitName();
  await waitFor(() => document.querySelector('.homework-end')?.textContent?.includes('Compito consegnato!'), 'recover completed homework after the teacher closes it');
});
