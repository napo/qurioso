import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import QRCode from 'qrcode';
import type { InternetSharingState } from '../src/types/desktop';

test('actual host switches both QR views and copied address to the active public tunnel, then returns to LAN on interruption and stop', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let listener: (state: InternetSharingState) => void = () => {}, starts = 0, copied = '';
  let finishStart: (state: InternetSharingState) => void = () => {};
  window.quriosoDesktop = { serverPort: 54321, internetSharing: {
    status: async () => ({ phase: 'idle' }),
    start: () => { starts++; return new Promise(resolve => { finishStart = resolve; }); },
    stop: async () => ({ phase: 'idle' }),
    onChange: callback => { listener = callback; return () => { listener = () => {}; }; },
  } };
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { copied = text; } } });
  const payloads = new Map<HTMLCanvasElement, string>();
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = ((canvas: HTMLCanvasElement, value: string) => { payloads.set(canvas, value); }) as typeof QRCode.toCanvas;
  const { gameSync } = await import('../src/services/gameSync');
  const methods = { getServerInfo: gameSync.getServerInfo, register: gameSync.register, unregister: gameSync.unregister, subscribe: gameSync.subscribe, createSessionOnServer: gameSync.createSessionOnServer, canRecoverPresenter: gameSync.canRecoverPresenter, generatePin: gameSync.generatePin };
  gameSync.getServerInfo = async () => ({ port: 54321, localIps: ['192.168.1.7', '10.0.0.2'], status: 'ok', protocol: 'http', host: 'test', fullUrl: 'http://192.168.1.7:54321' });
  gameSync.generatePin = () => '123456';
  gameSync.register = () => {}; gameSync.unregister = () => {}; gameSync.subscribe = () => () => {};
  gameSync.createSessionOnServer = async () => true; gameSync.canRecoverPresenter = () => true;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { DEFAULT_QUIZZES } = await import('../src/data/defaultQuizzes');
  const quiz = DEFAULT_QUIZZES.find(q => !q.videoConfig)!;
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); Object.assign(gameSync, methods); QRCode.toCanvas = originalCanvas; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const click = async (text: string) => { const button = [...document.querySelectorAll('button')].find(b => b.textContent!.trim() === text); assert.ok(button, text); await act(async () => button.click()); };
  const address = () => document.querySelector<HTMLElement>('[data-testid="join-address"]')!.dataset.url;
  const emit = async (state: InternetSharingState) => { await act(async () => listener(state)); };
  const toolbar = () => document.querySelector<HTMLButtonElement>('button[data-sharing-phase]')!;
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { quiz, onExit: () => {} }))));
  assert.equal(starts, 0);
  assert.equal(address(), 'http://192.168.1.7:54321');
  await act(async () => toolbar().click());
  await click('Attiva condivisione');
  assert.equal(starts, 1);
  assert.equal(toolbar().dataset.sharingPhase, 'connecting', 'click gives immediate feedback while native activation is pending');
  await emit({ phase: 'downloading', progress: 42, pin: '123456' });
  assert.match(document.querySelector('[data-sharing-controls]')!.textContent!, /42%/);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(address(), 'http://192.168.1.7:54321');
  const active: InternetSharingState = { phase: 'active', pin: '123456', url: 'https://first-example.trycloudflare.com' };
  await act(async () => { listener(active); finishStart(active); });
  assert.equal(toolbar().dataset.sharingPhase, 'active');
  assert.equal(toolbar().getAttribute('aria-checked'), 'true');
  assert.equal(document.querySelector('[role="dialog"]'), null, 'activation closes the service modal');
  assert.equal(document.querySelector('[data-session-access]')!.getAttribute('data-session-access'), 'public');
  assert.equal(address(), active.url);
  assert.equal(document.querySelector('[data-testid="join-address"]')!.textContent, 'first-example.trycloudflare.com');
  // A boolean, not the element: printing a JSDOM node in a failed assertion walks the whole window and exhausts memory.
  assert.equal(Boolean(document.querySelector('select[aria-label="Indirizzo di rete da mostrare"]')), false, 'LAN interfaces cannot override the advertised public address');
  await click('Copia indirizzo'); assert.equal(copied, active.url);
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Mostra QR Code Ingrandito"]')!.click());
  const checkQRs = (base: string) => {
    const canvases = [...document.querySelectorAll('canvas')]; assert.equal(canvases.length, 2);
    for (const canvas of canvases) assert.equal(payloads.get(canvas), `${base}/?pin=123456&role=player`);
  };
  checkQRs(active.url!);
  await emit({ phase: 'reconnecting', pin: '123456', error: 'interrupted' });
  assert.equal(toolbar().dataset.sharingPhase, 'reconnecting');
  assert.equal(address(), 'http://192.168.1.7:54321'); checkQRs('http://192.168.1.7:54321');
  const renewed = { ...active, url: 'https://second-example.trycloudflare.com' };
  await emit(renewed); assert.equal(address(), renewed.url); checkQRs(renewed.url);
  await emit({ ...active, pin: '999999' }); assert.equal(address(), 'http://192.168.1.7:54321', 'a different game cannot replace this game’s address');
  await emit(renewed);
  await act(async () => toolbar().click());
  assert.equal(toolbar().getAttribute('aria-checked'), 'false', 'the switch stops public sharing');
  assert.equal(address(), 'http://192.168.1.7:54321'); checkQRs('http://192.168.1.7:54321');
  await act(async () => toolbar().click());
  assert.equal(starts, 2, 'the switch reactivates an already authorized tunnel directly');
  assert.equal(document.querySelector('[aria-labelledby="internet-sharing-title"]'), null);
  await act(async () => { listener(renewed); finishStart(renewed); });
  assert.equal(toolbar().getAttribute('aria-checked'), 'true');
});

test('the presenter removes a participant from the lobby: removal on the server first, then the name leaves the screen', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = (() => {}) as unknown as typeof QRCode.toCanvas;
  const { gameSync } = await import('../src/services/gameSync');
  const methods = { getServerInfo: gameSync.getServerInfo, register: gameSync.register, unregister: gameSync.unregister, subscribe: gameSync.subscribe, createSessionOnServer: gameSync.createSessionOnServer, canRecoverPresenter: gameSync.canRecoverPresenter, removePlayer: gameSync.removePlayer, fetchSessionFromServer: gameSync.fetchSessionFromServer };
  const calls: string[] = [];
  gameSync.getServerInfo = async () => null; gameSync.register = () => {}; gameSync.unregister = () => {}; gameSync.subscribe = () => () => {};
  gameSync.fetchSessionFromServer = async () => null; gameSync.canRecoverPresenter = () => true;
  gameSync.createSessionOnServer = async session => { calls.push(`write:${Object.keys(session.players).join(',')}`); return true; };
  gameSync.removePlayer = async (_pin, id) => { calls.push(`remove:${id}`); return true; };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { DEFAULT_QUIZZES } = await import('../src/data/defaultQuizzes');
  const quiz = DEFAULT_QUIZZES.find(q => !q.videoConfig)!;
  const person = (id: string, name: string) => ({ id, nickname: name, name, avatar: '🦊', score: 0, streak: 0, correctAnswersCount: 0, totalTimeTakenMs: 0, joinedAt: 1, connected: true });
  const session = { pin: '123456', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard' as const, status: 'lobby' as const, currentQuestionIndex: 0, questionStartTime: 0, timeRemaining: 20,
    players: { a: person('a', 'Anna'), b: person('b', 'Bruno') }, answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length };
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); Object.assign(gameSync, methods); QRCode.toCanvas = originalCanvas; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { quiz, onExit: () => {}, recoveredSession: session }))));
  const names = () => [...document.querySelectorAll('.host-player-list span.font-bold')].map(element => element.textContent);
  assert.deepEqual(names(), ['Anna', 'Bruno']);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Togli Bruno dalla partita"]')!.click());
  assert.deepEqual(calls, ['remove:b', 'write:a']);
  assert.deepEqual(names(), ['Anna']);
});

test('the presenter records each closed question, keeps the report across a reload and opens the review at the end', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.HTMLCanvasElement.prototype.getContext = (() => null) as any;
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = (() => {}) as unknown as typeof QRCode.toCanvas;
  const { gameSync } = await import('../src/services/gameSync');
  const methods = { getServerInfo: gameSync.getServerInfo, register: gameSync.register, unregister: gameSync.unregister, subscribe: gameSync.subscribe, createSessionOnServer: gameSync.createSessionOnServer, canRecoverPresenter: gameSync.canRecoverPresenter, fetchSessionFromServer: gameSync.fetchSessionFromServer, removeSession: gameSync.removeSession };
  gameSync.getServerInfo = async () => null; gameSync.register = () => {}; gameSync.unregister = () => {}; gameSync.subscribe = () => () => {};
  gameSync.fetchSessionFromServer = async () => null; gameSync.canRecoverPresenter = () => true; gameSync.createSessionOnServer = async () => true;
  let removed = 0; gameSync.removeSession = async () => { removed++; };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { DEFAULT_QUIZZES } = await import('../src/data/defaultQuizzes');
  const quiz = DEFAULT_QUIZZES.find(q => !q.videoConfig)!, question = quiz.questions[0];
  const wrong = question.options.find(option => !option.isCorrect)!;
  const person = (id: string) => ({ id, nickname: id, name: id, avatar: '🦊', score: 0, streak: 0 });
  const session = { pin: '654321', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard' as const, status: 'question_results' as const, currentQuestionIndex: 0, questionStartTime: 1, timeRemaining: 0,
    currentQuestion: { id: question.id, text: question.text, options: question.options.map(({ isCorrect: _c, ...option }) => option) },
    players: { a: person('a'), b: person('b') }, answersForCurrentQuestion: { a: { questionId: question.id, optionId: wrong.id, isCorrect: false, timeTakenMs: 900 } }, totalQuestions: quiz.questions.length };
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); Object.assign(gameSync, methods); QRCode.toCanvas = originalCanvas; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const render = async (element: React.ReactElement) => { await act(async () => root.render(React.createElement(LanguageProvider, null, element))); };
  await render(React.createElement(HostScreen, { key: 'question', quiz, onExit: () => {}, recoveredSession: session }));
  const stored = JSON.parse(sessionStorage.getItem('qurioso_game_report_654321')!);
  assert.deepEqual([stored[question.id].answered, stored[question.id].correct, stored[question.id].players], [1, 0, 2]);

  // After a presenter reload at the end of the game the report is still there.
  let review: { title: string; questions: { id: string }[] } | undefined;
  await render(React.createElement(HostScreen, { key: 'finished', quiz, onExit: () => {}, onReview: (quiz: any) => { review = quiz; }, recoveredSession: { ...session, status: 'finished' as const, answersForCurrentQuestion: {} } }));
  assert.match(document.querySelector('.question-report')!.textContent!, /0% corrette/);
  await act(async () => { [...document.querySelectorAll('button')].find(b => b.textContent === 'Ripassa in classe le domande sbagliate')!.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.equal(removed, 1, 'the game ends before the review');
  assert.deepEqual(review!.questions.map(q => q.id), [question.id]);
  assert.match(review!.title, /ripasso/);
  assert.equal(sessionStorage.getItem('qurioso_game_report_654321'), null);
});
