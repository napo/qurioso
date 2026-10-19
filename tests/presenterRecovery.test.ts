import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { GameSyncManager, gameSync } from '../src/services/gameSync';
import { presenterQuiz, storeVideo } from '../src/services/quizStorage';
import { readPresenterCredential, savePresenterCredential, clearPresenterCredential } from '../src/services/presenterRecovery';
import { publicQuestion } from '../src/services/sessionState';
import { round, startLanServer } from './helpers/lanServer';
import type { GameSession } from '../src/types/quiz';

function browser(base: string) {
  const dom = new JSDOM('<div id="app"></div>', { url: base + '/?app=network' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const originalFetch = globalThis.fetch;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage,
    indexedDB: new IDBFactory(), WebSocket, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => originalFetch(new URL(url, base), init),
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  return { dom, originalFetch, close() { dom.window.close(); globalThis.fetch = originalFetch; } };
}
const quiz = DEFAULT_QUIZZES[0];
function lobby(pin: string): GameSession {
  return { ...round(pin), mode: 'video', status: 'lobby', currentQuestion: undefined, questionStartTime: 0 };
}

test('fresh presenter managers recover authoritative question, accepted answers, results, progress and local source', { timeout: 15000 }, async t => {
  const { base, request } = await startLanServer(t), env = browser(base);
  t.after(() => env.close());
  const pin = '432176';
  let host = new GameSyncManager();
  t.after(() => host.dispose());
  const publish = async (partial: Partial<GameSession>) => {
    const previous = await host.fetchSessionFromServer(pin) || lobby(pin);
    assert.equal(await host.createSessionOnServer({ ...previous, ...partial }, quiz, quiz), true);
  };
  await publish({});
  const saved = readPresenterCredential(); assert.ok(saved && saved !== 'invalid');
  assert.equal(saved.pin, pin);
  assert.equal(env.dom.window.localStorage.getItem('qurioso_presenter_recovery_v1'), null);
  await publish({ status: 'countdown' }); await publish({ status: 'video' });
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), videoState: { currentTime: 13, isPlaying: false, activeCheckpointIndex: 0 } });
  const player = { id: 'phone', nickname: 'Telefono', avatar: '🦊', score: 0, streak: 0 };
  const token = (await (await request(`/api/session/${pin}/join`, 'POST', { player })).json()).playerToken;
  const first = await host.fetchSessionFromServer(pin);
  host.dispose(); // New JavaScript runtime: only sessionStorage and IndexedDB survive.
  const answer = { playerId: player.id, roundId: first!.roundId, questionId: quiz.questions[0].id, optionId: quiz.questions[0].options[0].id, timeTakenMs: 0 };
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', answer, token)).status, 200);
  host = new GameSyncManager();
  let restored = await host.recoverPresenter();
  assert.equal(restored.status, 'recovered'); if (restored.status !== 'recovered') return;
  assert.equal(restored.session.status, 'question');
  assert.equal(restored.session.roundId, first!.roundId);
  assert.equal(restored.session.videoQuestionsOpened, 1);
  assert.equal(restored.session.answersForCurrentQuestion.phone.optionId, answer.optionId);
  const score = restored.session.players.phone.score; assert.ok(score > 0);
  assert.ok(!JSON.stringify(restored.session).includes(saved.token));
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', answer, token)).status, 200);
  await publish({ status: 'question_results' });
  host.dispose(); host = new GameSyncManager(); restored = await host.recoverPresenter();
  assert.equal(restored.status, 'recovered'); if (restored.status !== 'recovered') return;
  assert.equal(restored.session.status, 'question_results');
  assert.equal(restored.session.players.phone.score, score);
  assert.deepEqual(restored.session.questionResult?.correctOptionIds, [answer.optionId]);
  await publish({ status: 'video', videoState: { currentTime: 33, isPlaying: true, activeCheckpointIndex: 0, ended: true } });
  const assetId = await storeVideo(new Blob(['local-test'], { type: 'video/webm' }));
  assert.equal(await host.savePresenterVideoSource(pin, { videoUrl: '', videoType: 'file', videoTitle: 'Locale', videoAssetId: assetId }), true);
  host.dispose(); host = new GameSyncManager(); restored = await host.recoverPresenter();
  assert.equal(restored.status, 'recovered'); if (restored.status !== 'recovered') return;
  assert.equal(restored.quiz.videoConfig?.videoAssetId, assetId);
  assert.equal(restored.session.videoState?.currentTime, 33);
  assert.equal(restored.session.videoState?.isPlaying, false);
  assert.equal(restored.session.videoState?.ended, true);
  assert.equal(restored.session.videoQuestionsOpened, 1);
  assert.equal((await (await request('/api/health')).json()).activeSessions, 1);
  await host.removeSession(pin);
  assert.equal(readPresenterCredential(), null);
  assert.equal(await presenterQuiz(pin, 'read'), undefined);
  assert.equal((await request(`/api/session/${pin}`)).status, 404);
  const pendingPin = '432179';
  const creating = host.createSessionOnServer(lobby(pendingPin), quiz, quiz);
  const closing = host.removeSession(pendingPin);
  assert.equal(await creating, true); await closing;
  assert.equal(readPresenterCredential(), null, 'pending creation cannot restore the secret after exit');
  assert.equal(await presenterQuiz(pendingPin, 'read'), undefined);
  assert.equal((await request(`/api/session/${pendingPin}`)).status, 404);
  assert.equal(await host.createSessionOnServer(lobby(pendingPin), quiz, quiz), false, 'late callbacks cannot recreate a closed room');
});

test('PIN-only, invalid and player credentials cannot recover a presenter; deletion/restart and outages fail safely', { timeout: 15000 }, async t => {
  const { base, request } = await startLanServer(t), env = browser(base);
  t.after(() => env.close());
  const host = new GameSyncManager(), restored = new GameSyncManager(), pin = '443321';
  t.after(() => { host.dispose(); restored.dispose(); });
  assert.equal(await host.createSessionOnServer(lobby(pin), quiz, quiz), true);
  const credential = readPresenterCredential(); assert.ok(credential && credential !== 'invalid');
  assert.equal((await request(`/api/session/${pin}/presenter`)).status, 403);
  env.dom.window.sessionStorage.setItem('qurioso_presenter_recovery_v1', JSON.stringify({ pin }));
  assert.equal((await restored.recoverPresenter()).status, 'invalid');
  assert.equal(readPresenterCredential(), null);
  const joined = await (await request(`/api/session/${pin}/join`, 'POST', { player: { id: 'p', nickname: 'P', avatar: '🦊' } })).json();
  for (const token of ['0'.repeat(64), joined.playerToken]) {
    savePresenterCredential(pin, token);
    assert.equal((await restored.recoverPresenter()).status, 'invalid');
    assert.equal(readPresenterCredential(), null);
  }
  savePresenterCredential(pin, credential.token);
  assert.equal((await restored.recoverPresenter()).status, 'context_missing');
  assert.deepEqual(readPresenterCredential(), credential);
  await presenterQuiz(pin, 'write', quiz);
  const onlineFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  assert.equal((await restored.recoverPresenter()).status, 'unavailable');
  assert.deepEqual(readPresenterCredential(), credential, 'outages do not discard the recovery secret');
  globalThis.fetch = onlineFetch;
  assert.equal((await restored.recoverPresenter()).status, 'recovered');
  restored.dispose();
  // A restarted backend has no rooms; the same old credential must not create or claim a room.
  const restarted = await startLanServer(t);
  globalThis.fetch = (url, init) => env.originalFetch(new URL(String(url), restarted.base), init);
  assert.equal((await restored.recoverPresenter()).status, 'gone');
  assert.equal(readPresenterCredential(), null);
  assert.equal((await (await restarted.request('/api/health')).json()).activeSessions, 0);
  globalThis.fetch = onlineFetch;
  savePresenterCredential(pin, credential.token);
  await host.removeSession(pin);
  savePresenterCredential(pin, credential.token); // Stale browser record after deletion by another presenter tab.
  assert.equal((await restored.recoverPresenter()).status, 'gone');
  assert.equal(readPresenterCredential(), null);
});

test('App refresh restores a video host paused, keeps checkpoints/results and explicitly cleans up on exit', { timeout: 20000 }, async t => {
  const { base, request } = await startLanServer(t), env = browser(base);
  const { dom } = env;
  const canvas = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  dom.window.HTMLCanvasElement.prototype.getContext = (() => new Proxy(canvas, { get: (target, key) => target[key as keyof typeof target] || (() => {}) })) as any;
  dom.window.matchMedia = (() => ({ matches: false })) as any;
  let plays = 0;
  const active = new WeakSet();
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'duration', { get: () => 33 });
  dom.window.HTMLMediaElement.prototype.play = async function () { active.add(this); plays++; this.dispatchEvent(new dom.window.Event('play')); };
  dom.window.HTMLMediaElement.prototype.pause = function () { if (!active.has(this)) return; active.delete(this); this.dispatchEvent(new dom.window.Event('pause')); };
  const creator = new GameSyncManager(), pin = '456732';
  await creator.createSessionOnServer(lobby(pin), quiz, quiz);
  const publish = async (partial: Partial<GameSession>) => {
    const previous = await creator.fetchSessionFromServer(pin);
    assert.equal(await creator.createSessionOnServer({ ...previous!, ...partial }, quiz, quiz), true);
  };
  await publish({ status: 'countdown' }); await publish({ status: 'video' });
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), videoState: { currentTime: 13, isPlaying: false, activeCheckpointIndex: 0 } });
  const player = { id: 'phone', nickname: 'Telefono', avatar: '🦊' };
  const token = (await (await request(`/api/session/${pin}/join`, 'POST', { player })).json()).playerToken;
  const answerCurrent = async () => {
    const session = (await (await request(`/api/session/${pin}`)).json()).session;
    const q = quiz.questions[session.currentQuestionIndex];
    const response = await request(`/api/session/${pin}/answer`, 'POST', { playerId: player.id, roundId: session.roundId, questionId: q.id, optionId: q.options.find(o => o.isCorrect)!.id, timeTakenMs: 0 }, token);
    assert.equal(response.status, 200);
  };
  await answerCurrent(); await publish({ status: 'question_results' });
  await publish({ status: 'video', videoState: { currentTime: 13, isPlaying: true, activeCheckpointIndex: 0 } });
  creator.dispose();
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  let root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); gameSync.dispose(); env.close(); });
  const render = async () => act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App))));
  const wait = async (condition: () => unknown, label: string) => {
    for (let n = 0; n < 150; n++) { let ready: unknown; await act(async () => { await delay(20); ready = await condition(); }); if (ready) return; }
    assert.fail(label + ': ' + document.body.textContent);
  };
  const click = async (label: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(label) || b.getAttribute('aria-label') === label);
    assert.ok(button, label); assert.equal(button.disabled, false); await act(async () => button.click());
  };
  const metadata = async () => act(async () => document.querySelector('video')!.dispatchEvent(new dom.window.Event('loadedmetadata')));
  const state = async () => (await (await request(`/api/session/${pin}`)).json()).session as GameSession;
  const refresh = async () => {
    await gameSync.flushSession(); await act(async () => root.unmount()); gameSync.dispose();
    assert.equal((await request(`/api/session/${pin}`)).status, 200, 'refresh does not delete the room');
    root = createRoot(document.getElementById('app')!); await render();
    await wait(() => document.body.textContent?.includes('Sessione recuperata'), 'host recovers'); await metadata();
  };
  await render(); await wait(() => document.body.textContent?.includes('Sessione recuperata'), 'automatic startup recovery'); await metadata();
  assert.equal(document.querySelector('video')!.currentTime, 13);
  assert.equal(plays, 0, 'refresh never auto-plays');
  assert.equal((await state()).videoState?.isPlaying, false);
  await act(async () => document.querySelector('video')!.dispatchEvent(new dom.window.Event('timeupdate')));
  assert.equal((await state()).status, 'video', 'restoring the media position does not open a question');
  await click('Riproduci video');
  await wait(async () => (await state()).status === 'question', 'next pending checkpoint');
  assert.equal((await state()).currentQuestionIndex, 1, 'first checkpoint stays completed');
  await refresh(); // Recover the actual active question and its original deadline/nonce.
  assert.equal((await state()).currentQuestionIndex, 1); assert.equal(plays, 0);
  await act(answerCurrent);
  await wait(async () => (await state()).status === 'question_results', 'accepted answer closes question');
  const scored = (await state()).players.phone.score;
  await refresh();
  assert.match(document.body.textContent!, /Risultati Domanda 2/);
  assert.equal((await state()).players.phone.score, scored); assert.equal(plays, 0);
  await click('Classifica Parziale'); await click('Riprendi video');
  await wait(() => plays === 1, 'explicit resume plays video');
  await act(async () => {
    const media = document.querySelector('video')!; media.currentTime = 33; media.dispatchEvent(new dom.window.Event('ended'));
  });
  await wait(async () => (await state()).status === 'question' && (await state()).currentQuestionIndex === 2, 'last checkpoint');
  await click('Chiudi tempo'); await wait(async () => (await state()).status === 'question_results', 'last results');
  await refresh();
  assert.equal(plays, 1, 'recovery of end-of-video results stays paused');
  await click('Classifica Parziale'); await click('Riprendi video');
  await wait(async () => (await state()).status === 'finished', 'restored ended flag reaches final summary');
  assert.equal((await (await request('/api/health')).json()).activeSessions, 1);
  await click('Esci');
  await wait(async () => (await (await request('/api/health')).json()).activeSessions === 0, 'explicit exit deletes room');
  assert.equal(readPresenterCredential(), null);
  assert.equal(await presenterQuiz(pin, 'read'), undefined);
  await act(async () => { await delay(40); });
  assert.ok(!window.location.href.includes('token'));
  clearPresenterCredential();
});

test('classic presenter refresh grades accepted offline receipts once without resetting the round', { timeout: 10000 }, async t => {
  const { base, request } = await startLanServer(t), env = browser(base);
  const classic = { ...quiz, videoConfig: undefined }, pin = '654329';
  const creator = new GameSyncManager();
  assert.equal(await creator.createSessionOnServer({ ...round(pin), status: 'lobby', currentQuestion: undefined, questionStartTime: 0 }, undefined, classic), true);
  const player = { id: 'phone', nickname: 'Telefono', avatar: '🦊' };
  const playerToken = (await (await request(`/api/session/${pin}/join`, 'POST', { player })).json()).playerToken;
  const previous = await creator.fetchSessionFromServer(pin);
  await creator.createSessionOnServer({ ...previous!, status: 'question', currentQuestion: publicQuestion(classic, 0), questionStartTime: Date.now() }, undefined, classic);
  const original = await creator.fetchSessionFromServer(pin);
  creator.dispose();
  await request(`/api/session/${pin}/answer`, 'POST', { playerId: player.id, questionId: classic.questions[0].id,
    roundId: original!.roundId, optionId: classic.questions[0].options[0].id, timeTakenMs: 0 }, playerToken);
  env.dom.window.HTMLCanvasElement.prototype.getContext = (() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), clearRect() {}, putImageData() {} })) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); await gameSync.removeSession(pin); gameSync.dispose(); env.close(); });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App))));
  let session: GameSession | undefined;
  for (let n = 0; n < 100; n++) {
    await act(async () => {
      await delay(20); session = (await (await request(`/api/session/${pin}`)).json()).session;
    });
    if (session?.players.phone.score) break;
  }
  assert.equal(session?.roundId, original!.roundId);
  assert.ok(session!.players.phone.score > 0);
  assert.equal(session!.players.phone.correctAnswersCount, 1);
  assert.equal(session!.answersForCurrentQuestion.phone.isCorrect, true);
});

test('blocked sessionStorage keeps normal LAN hosting usable without a persistent credential fallback', async t => {
  const { base, request } = await startLanServer(t), env = browser(base);
  const host = new GameSyncManager(), pin = '567432';
  t.after(() => { host.dispose(); env.close(); });
  Object.defineProperty(env.dom.window, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  assert.equal(await host.createSessionOnServer(lobby(pin), quiz, quiz), true);
  assert.equal(host.canRecoverPresenter(pin), false);
  assert.equal((await host.recoverPresenter()).status, 'none');
  assert.equal(await host.createSessionOnServer({ ...lobby(pin), status: 'countdown' }, quiz, quiz), true);
  assert.equal(env.dom.window.localStorage.getItem('qurioso_presenter_recovery_v1'), null);
  await host.removeSession(pin);
  assert.equal((await request(`/api/session/${pin}`)).status, 404);
});
