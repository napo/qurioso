import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import React, { act } from 'react';
import type { GameSession, Question, Quiz } from '../src/types/quiz';
import { applyPlayerAnswer, publicQuestion } from '../src/services/sessionState';
import { startLanServer } from './helpers/lanServer';

const option = (id: string, isCorrect = false) => ({ id, text: id.toUpperCase(), isCorrect, color: 'red' as const, shape: 'triangle' as const });
const question = (type: Question['type'], correct: string[] = []): Question => ({ id: `q-${type}`, text: `Domanda ${type}`, type, timeLimit: 60, points: 1000,
  options: ['a', 'b', 'c', 'd'].map(id => option(id, correct.includes(id))) });

test('a real phone answers an ordering in sequence, a multiple_select with confirmation and a poll, and sees the right feedback', { timeout: 30000 }, async t => {
  const { base, request, mint } = await startLanServer(t);
  const quiz: Quiz = { id: 'phone-types', title: 'Tipi', description: '', category: '', author: '', createdAt: 1,
    settings: { pointsMultiplier: 1, showExplanation: false, streakBonus: false },
    questions: [question('ordering'), question('multiple_select', ['a', 'c']), question('poll')] };
  const pin = '246810', path = `/api/session/${pin}`, hostToken = await mint();
  const lobby: GameSession = { pin, quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'lobby', currentQuestionIndex: 0,
    questionStartTime: 0, timeRemaining: 60, totalQuestions: 3, players: {}, answersForCurrentQuestion: {} };
  assert.equal((await request('/api/session/create', 'POST', { session: lobby }, hostToken)).status, 200);
  // The presenter's writes, as the host screen sends them.
  const hostState = async () => (await (await request(path, 'GET', undefined, hostToken)).json()) as { session: GameSession; revision: number };
  const hostWrite = async (change: (session: GameSession) => GameSession) => {
    const { session, revision } = await hostState();
    assert.equal((await request(path + '/state', 'POST', { session: change(session), revision }, hostToken)).status, 200);
  };
  const open = (index: number) => hostWrite(session => ({ ...session, status: 'question', currentQuestionIndex: index, currentQuestion: publicQuestion(quiz, index), questionStartTime: Date.now(), answersForCurrentQuestion: {} }));
  const close = () => hostWrite(session => {
    let graded = session;
    for (const [playerId, answer] of Object.entries(session.answersForCurrentQuestion)) graded = applyPlayerAnswer(graded, quiz, { playerId, ...answer });
    return { ...graded, status: 'question_results' };
  });

  const originalFetch = globalThis.fetch;
  const dom = new JSDOM('<div id="app"></div>', { url: base });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, indexedDB: new IDBFactory(),
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, WebSocket, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string | URL, init?: RequestInit) => originalFetch(new URL(String(url), base), init) })) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  const { gameSync } = await import('../src/services/gameSync');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); gameSync.dispose(); dom.window.close(); globalThis.fetch = originalFetch; });
  const waitFor = async (condition: () => unknown, label: string) => {
    const end = Date.now() + 8000;
    while (Date.now() < end) { let done: unknown; await act(async () => { await delay(40); done = condition(); }); if (done) return; }
    throw new Error('Timed out: ' + label + '\n' + document.body.textContent);
  };
  const answer = (text: string) => document.querySelector<HTMLButtonElement>(`button[aria-label$=": ${text}"], button[aria-label*=": ${text} ·"]`)!;
  const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement;
  const click = async (element: HTMLButtonElement) => { assert.ok(element); await act(async () => element.click()); };

  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(PlayerScreen, { initialPin: pin }))));
  const nickname = document.querySelector('input[placeholder="Nome o soprannome..."]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'Ada');
    nickname.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => Object.keys((await hostState()).session.players).length === 1, 'joined');
  const playerId = Object.keys((await hostState()).session.players)[0];

  // Ordering: items arrive shuffled, the phone numbers them as tapped, confirm needs them all.
  await open(0);
  await waitFor(() => document.body.textContent!.includes('Tocca gli elementi in ordine'), 'ordering shown');
  const shown = [...document.querySelectorAll('.player-answer')].map(b => b.getAttribute('aria-label')!.split(': ')[1]);
  assert.deepEqual([...shown].sort(), ['A', 'B', 'C', 'D']);
  assert.notDeepEqual(shown, ['A', 'B', 'C', 'D'], 'never in the correct order');
  for (const text of ['A', 'B', 'C']) await click(answer(text));
  assert.equal(button('Conferma').disabled, true);
  await click(answer('C')); await click(answer('C'));
  assert.match(answer('C').getAttribute('aria-label')!, /posizione 3/, 'a second tap removes, a third puts it back last');
  await click(answer('D')); await click(button('Conferma'));
  await waitFor(() => document.body.textContent!.includes('Risposta inviata'), 'ordering sent');
  assert.deepEqual((await hostState()).session.answersForCurrentQuestion[playerId].optionIds, ['a', 'b', 'c', 'd']);
  await close();
  await waitFor(() => document.body.textContent!.includes('Risposta esatta!'), 'ordering right');

  // Several answers: taps select and deselect, nothing is sent before confirming.
  await open(1);
  await waitFor(() => document.body.textContent!.includes('Scegli tutte le risposte giuste'), 'multiple select shown');
  await click(answer('A')); await click(answer('B')); await click(answer('B')); await click(answer('C'));
  assert.equal((await hostState()).session.answersForCurrentQuestion[playerId], undefined, 'nothing sent before confirming');
  await click(button('Conferma'));
  await waitFor(() => document.body.textContent!.includes('Risposta inviata'), 'multiple select sent');
  await close();
  await waitFor(() => document.body.textContent!.includes('Risposta esatta!'), 'multiple select right');
  const scored = (await hostState()).session.players[playerId].score;
  assert.ok(scored > 0);

  // Poll: one tap sends; the result has no verdict and no points.
  await open(2);
  await waitFor(() => answer('B'), 'poll shown');
  await click(answer('B'));
  await waitFor(() => document.body.textContent!.includes('Risposta inviata'), 'poll sent');
  await close();
  await waitFor(() => document.body.textContent!.includes('Grazie, il tuo voto è stato contato!'), 'poll thanks');
  assert.doesNotMatch(document.body.textContent!, /Ops, non esatta/);
  assert.equal((await hostState()).session.players[playerId].score, scored, 'a poll gives no points');
});
