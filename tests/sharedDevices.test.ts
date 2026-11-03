import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import QRCode from 'qrcode';
import { startLanServer, round } from './helpers/lanServer';
import { homeworkQuiz, homeworkSession } from './helpers/homework';
import type { GameSession, Player } from '../src/types/quiz';

const person = (id: string) => ({ id, nickname: id, avatar: '🦊', score: 0, streak: 0 });
const ADA = 'a'.repeat(32), OTHER = 'b'.repeat(32);

test('the device code: random, kept by the browser, absent when storage is unavailable', async t => {
  const dom = new JSDOM('', { url: 'http://10.0.0.4:4000/' });
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true, writable: true });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else Reflect.deleteProperty(globalThis, 'localStorage'); dom.window.close(); });
  const { deviceId } = await import('../src/services/deviceId');
  const first = deviceId();
  assert.match(first!, /^[a-f0-9]{32}$/);
  assert.equal(deviceId(), first, 'the same browser keeps its code');
  dom.window.localStorage.clear();
  assert.notEqual(deviceId(), first, 'cleared site data gives a new code');
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem() { throw new Error('blocked'); } }, configurable: true, writable: true });
  assert.equal(deviceId(), undefined);
});

test('live games and homework: the presenter learns who joined from the same browser, nobody sees the codes', { timeout: 20000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qurioso-devices-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'homework.json');
  const { request, mint } = await startLanServer(t, false, { QURIOSO_ASSIGNMENTS_FILE: file });

  const live = { ...round('612345'), status: 'lobby' as const }, livePath = `/api/session/${live.pin}`, hostToken = await mint();
  assert.equal((await request('/api/session/create', 'POST', { session: live }, hostToken)).status, 200);
  const join = async (pin: string, id: string, deviceId?: unknown) => (await request(`/api/session/${pin}/join`, 'POST', { player: person(id), deviceId })).json();
  const ada = await join(live.pin, 'ada', ADA);
  await join(live.pin, 'bea', ADA); await join(live.pin, 'carlo', OTHER); await join(live.pin, 'dino', 'not-a-code'); await join(live.pin, 'elio');
  const presenter = async (pin: string, token: string) => (await request(`/api/session/${pin}/presenter`, 'GET', undefined, token)).json();
  assert.deepEqual((await presenter(live.pin, hostToken)).sharedDevices, { ada: ['bea'], bea: ['ada'] });
  assert.equal(JSON.stringify(ada).includes(ADA) || 'sharedDevices' in ada, false, 'participants see neither codes nor matches');
  assert.equal(JSON.stringify(await presenter(live.pin, hostToken)).includes(ADA), false, 'the presenter gets the match, not the code');
  assert.equal((await request(livePath + '/player/bea/remove', 'POST', {}, hostToken)).status, 200);
  assert.equal((await presenter(live.pin, hostToken)).sharedDevices, undefined, 'a removed participant matches nobody');

  // Homework keeps the codes across a restart, like its answers.
  const quiz = homeworkQuiz(), session = homeworkSession('612346', quiz), homeworkToken = await mint();
  assert.equal((await request('/api/assignment/create', 'POST', { session, assignmentQuiz: quiz }, homeworkToken)).status, 200);
  await join(session.pin, 'ada', ADA); await join(session.pin, 'bea', ADA);
  assert.deepEqual((await presenter(session.pin, homeworkToken)).sharedDevices, { ada: ['bea'], bea: ['ada'] });
  await new Promise(resolve => setTimeout(resolve, 1300));
  const restarted = await startLanServer(t, false, { QURIOSO_ASSIGNMENTS_FILE: file });
  assert.deepEqual((await (await restarted.request(`/api/session/${session.pin}/presenter`, 'GET', undefined, homeworkToken)).json()).sharedDevices, { ada: ['bea'], bea: ['ada'] });
});

test('presenter lobby: a participant who shares a browser with another is marked, with both names', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = (() => {}) as unknown as typeof QRCode.toCanvas;
  const { gameSync } = await import('../src/services/gameSync');
  const methods = { getServerInfo: gameSync.getServerInfo, register: gameSync.register, unregister: gameSync.unregister, subscribe: gameSync.subscribe, createSessionOnServer: gameSync.createSessionOnServer, canRecoverPresenter: gameSync.canRecoverPresenter, fetchSessionFromServer: gameSync.fetchSessionFromServer };
  let listener: (message: any) => void = () => {};
  gameSync.getServerInfo = async () => null; gameSync.register = () => {}; gameSync.unregister = () => {};
  gameSync.subscribe = callback => { listener = callback; return () => {}; };
  gameSync.fetchSessionFromServer = async () => null; gameSync.canRecoverPresenter = () => true; gameSync.createSessionOnServer = async () => true;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { DEFAULT_QUIZZES } = await import('../src/data/defaultQuizzes');
  const quiz = DEFAULT_QUIZZES.find(q => !q.videoConfig)!;
  const player = (id: string, name: string): Player => ({ id, nickname: name, name, avatar: '🦊', score: 0, streak: 0 });
  const session: GameSession = { pin: '712345', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'lobby', currentQuestionIndex: 0, questionStartTime: 0, timeRemaining: 20,
    players: { a: player('a', 'Ada'), b: player('b', 'Bea'), c: player('c', 'Carlo') }, answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length };
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); Object.assign(gameSync, methods); QRCode.toCanvas = originalCanvas; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { quiz, onExit: () => {}, recoveredSession: session }))));
  assert.equal(document.querySelector('.shared-device'), null);
  await act(async () => listener({ type: 'SESSION_STATE_UPDATE', session, sharedDevices: { a: ['b'], b: ['a'] } }));
  const marks = [...document.querySelectorAll('.shared-device')].map(mark => mark.querySelector('.sr-only')!.textContent);
  assert.deepEqual(marks.map(mark => mark!.split('.')[0]), ['Stesso dispositivo di Bea', 'Stesso dispositivo di Ada']);
  assert.deepEqual([...document.querySelectorAll('.host-player-list span.font-bold')].map(name => name.textContent), ['Ada', 'Bea', 'Carlo'], 'names unchanged');
});
