import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { publicQuestion, applyPlayerAnswer } from '../src/services/sessionState';
import { startLanServer, round } from './helpers/lanServer';
import type { GameSession } from '../src/types/quiz';

test('video LAN: server owns grading, order and timing; player sockets cannot control playback or questions', { timeout: 15000 }, async t => {
  const { request, mint, socket } = await startLanServer(t);
  const quiz = structuredClone(DEFAULT_QUIZZES[0]);
  quiz.settings.showExplanation = false;
  quiz.questions[1].timeLimit = 0.1;
  const pin = '712345', hostToken = await mint();
  const initial = { ...round(pin), mode: 'video', status: 'lobby', currentQuestion: undefined, questionStartTime: 0 };
  const created = await request('/api/session/create', 'POST', { session: initial, videoQuiz: quiz }, hostToken);
  assert.equal(created.status, 200);
  let state = await created.json();
  const firstPresenter = await socket();
  await firstPresenter.next({ type: 'REGISTER', pin, role: 'host', token: hostToken }, m => m.type === 'SESSION_STATE_UPDATE');
  const presenterDisconnected = once(firstPresenter.ws, 'close'); firstPresenter.ws.close(); await presenterDisconnected;
  const publish = async (partial: Partial<GameSession>, expected = 200, revision = state.revision, operationId?: string) => {
    const response = await request(`/api/session/${pin}/state`, 'POST', { session: { ...state.session, ...partial }, revision, operationId }, hostToken);
    assert.equal(response.status, expected, await response.clone().text());
    if (response.ok) state = await response.json();
  };
  const player = { id: 'alice', nickname: 'Alice', avatar: '🦊', score: 0, streak: 0 };
  const joined = await (await request(`/api/session/${pin}/join`, 'POST', { player })).json();
  const playerToken = joined.playerToken;
  assert.equal((await request(`/api/session/${pin}/state`, 'POST', { session: state.session, revision: state.revision }, playerToken)).status, 403);
  assert.equal((await request(`/api/session/${pin}`, 'DELETE', undefined, playerToken)).status, 403);
  const ws = await socket();
  assert.equal((await ws.next({ type: 'SESSION_STATE_UPDATE', session: state.session }, m => m.type === 'ERROR')).status, 403);
  await ws.next({ type: 'REGISTER', pin, role: 'player', playerId: player.id, token: playerToken }, m => m.type === 'SESSION_STATE_UPDATE');
  assert.equal((await ws.next({ type: 'SESSION_STATE_UPDATE', pin, revision: state.revision, session: { ...state.session, videoState: { currentTime: 100, isPlaying: true, activeCheckpointIndex: 2 } } }, m => m.type === 'ERROR')).status, 403);
  await publish({ status: 'countdown' });
  await publish({ status: 'video' });
  await publish({ status: 'finished' }, 409);
  await publish({ status: 'question', currentQuestionIndex: 1, currentQuestion: publicQuestion(quiz, 1), questionStartTime: Date.now() }, 409);
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), timeRemaining: 999 });
  assert.equal(state.session.timeRemaining, quiz.questions[0].timeLimit);
  const beforeAnswer = state.session as GameSession;
  const answer = { playerId: player.id, roundId: state.session.roundId, questionId: quiz.questions[0].id, optionId: quiz.questions[0].options[0].id, timeTakenMs: 0 };
  await delay(250);
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', answer, playerToken)).status, 200);
  state = await (await request(`/api/session/${pin}`, 'GET', undefined, hostToken)).json();
  const accepted = state.session.answersForCurrentQuestion.alice;
  assert.ok(accepted.timeTakenMs >= 100);
  const expected = applyPlayerAnswer(beforeAnswer, quiz, { ...answer, timeTakenMs: accepted.timeTakenMs });
  assert.equal(state.session.players.alice.score, expected.players.alice.score);
  const publicState = await (await request(`/api/session/${pin}`)).json();
  assert.equal(publicState.session.players.alice.score, 0);
  assert.deepEqual(publicState.session.answersForCurrentQuestion, {});
  assert.equal(publicState.session.questionResult, undefined);
  assert.ok(!JSON.stringify(publicState).includes('videoUrl'));
  assert.ok(!JSON.stringify(publicState).includes('isCorrect'));
  const score = state.session.players.alice.score;
  await publish({ players: { ...state.session.players, alice: { ...player, score: 999999 } }, answersForCurrentQuestion: {} });
  assert.equal(state.session.players.alice.score, score);
  assert.equal(Object.keys(state.session.answersForCurrentQuestion).length, 1);
  await ws.next({ type: 'PLAYER_ANSWER', pin, ...answer }, m => m.type === 'SESSION_STATE_UPDATE');
  await publish({ status: 'question_results' });
  assert.deepEqual(state.session.questionResult.correctOptionIds, [answer.optionId]);
  assert.equal(state.session.questionResult.explanation, undefined);
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', { ...answer, optionId: quiz.questions[0].options[1].id }, playerToken)).status, 409);
  const disconnected = once(ws.ws, 'close'); ws.ws.close(); await disconnected;
  await publish({ status: 'video' });
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now() }, 409);
  const oldRevision = state.revision;
  await publish({ status: 'question', currentQuestionIndex: 1, currentQuestion: publicQuestion(quiz, 1), questionStartTime: Date.now() }, 200, state.revision, 'open-second-question');
  const reopened = await socket();
  const restored = await reopened.next({ type: 'REGISTER', pin, role: 'player', playerId: player.id, token: playerToken }, m => m.type === 'SESSION_STATE_UPDATE');
  assert.equal(restored.session.currentQuestion.id, quiz.questions[1].id);
  assert.equal(Object.keys(restored.session.players).length, 1);
  assert.equal(restored.session.players.alice.score, score);
  await publish({ status: 'question_results' }, 409, oldRevision);
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', answer, playerToken)).status, 400);
  assert.equal((await request(`/api/session/${pin}/bot-answer`, 'POST', answer, playerToken)).status, 403);
  await delay(150);
  assert.equal((await request(`/api/session/${pin}/answer`, 'POST', { ...answer, roundId: state.session.roundId,
    questionId: quiz.questions[1].id, optionId: quiz.questions[1].options[0].id }, playerToken)).status, 409);
  // Presenter reconnect restores the existing room and current round, never creates another PIN.
  const hostWs = await socket();
  const restoredHost = await hostWs.next({ type: 'REGISTER', pin, role: 'host', token: hostToken }, m => m.type === 'SESSION_STATE_UPDATE');
  assert.equal(restoredHost.session.roundId, state.session.roundId);
  assert.equal((await (await request('/api/health')).json()).activeSessions, 1);
});

test('real video host: pause/resume, multiple students, seeks, reconnect and end-of-video residual questions', { timeout: 20000 }, async t => {
  const { base, request, socket, mint } = await startLanServer(t);
  const dom = new JSDOM('<div id="app"></div>', { url: base });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const originalFetch = globalThis.fetch;
  const requests: any[] = [];
  let loseFirstOpenAck = true;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage,
    indexedDB: new IDBFactory(), WebSocket, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, init?: RequestInit) => {
      const body = String(url).endsWith('/api/session/create') ? JSON.parse(String(init?.body)) : undefined;
      if (body) requests.push(body);
      const response = await originalFetch(new URL(url, base), init);
      if (body?.session.status === 'question' && body.session.currentQuestionIndex === 0 && loseFirstOpenAck) {
        loseFirstOpenAck = false; await response.arrayBuffer(); throw new Error('Lost question-opening acknowledgement');
      }
      return response;
    },
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  dom.window.HTMLCanvasElement.prototype.getContext = (() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), clearRect() {}, putImageData() {} })) as any;
  let paused = true, plays = 0;
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'duration', { get: () => 20 });
  dom.window.HTMLMediaElement.prototype.play = async function () { paused = false; plays++; this.dispatchEvent(new dom.window.Event('play')); };
  dom.window.HTMLMediaElement.prototype.pause = function () { if (paused) return; paused = true; this.dispatchEvent(new dom.window.Event('pause')); };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { gameSync } = await import('../src/services/gameSync');
  let root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); gameSync.dispose(); dom.window.close(); globalThis.fetch = originalFetch; });
  const quiz = structuredClone(DEFAULT_QUIZZES[0]);
  quiz.questions[2].videoTimestamp = 40;
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { quiz, onExit() {} }))));
  const wait = async (condition: () => unknown, label: string) => {
    for (let n = 0; n < 200; n++) { let ready: unknown; await act(async () => { await delay(20); ready = await condition(); }); if (ready) return; }
    assert.fail(label + ': ' + document.body.textContent);
  };
  const click = async (label: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(label) || b.getAttribute('aria-label') === label);
    assert.ok(button, label); assert.equal(button.disabled, false, label);
    await act(async () => button.click());
  };
  await wait(() => requests.length && document.querySelector('video'), 'host creation');
  const media = document.querySelector('video')!;
  await act(async () => media.dispatchEvent(new dom.window.Event('loadedmetadata')));
  const pin = requests[0].session.pin;
  const players = ['alice', 'bob'].map(id => ({ id, nickname: id, avatar: '🦊', score: 0, streak: 0 }));
  const tokens: Record<string, string> = {};
  await act(async () => { for (const player of players) tokens[player.id] = (await (await request(`/api/session/${pin}/join`, 'POST', { player })).json()).playerToken; });
  let current: GameSession;
  const read = async () => { current = (await (await request(`/api/session/${pin}`)).json()).session; return current; };
  await wait(() => document.body.textContent?.includes('alice'), 'two joins');
  await click('Inizia il quiz video');
  await wait(async () => (await read()).status === 'video' && !paused, 'video starts');
  await click('Pausa video'); assert.equal(paused, true);
  await click('Riproduci video'); assert.equal(paused, false);
  const move = async (time: number, ended = false) => { await act(async () => {
    media.currentTime = time; media.dispatchEvent(new dom.window.Event(ended ? 'ended' : 'timeupdate'));
    if (!ended) media.dispatchEvent(new dom.window.Event('timeupdate'));
  }); };
  await move(13);
  await wait(async () => (await read()).status === 'question', 'first checkpoint');
  assert.equal(current!.currentQuestion?.id, quiz.questions[0].id); assert.equal(paused, true);
  const firstRound = current!.roundId;
  assert.equal(current!.videoQuestionsOpened, 1);
  const answerBoth = async () => {
    await read(); const q = quiz.questions.find(q => q.id === current.currentQuestion!.id)!;
    for (const player of players) {
      const body = { playerId: player.id, questionId: q.id, roundId: current.roundId, optionId: q.options.find(o => o.isCorrect)!.id, timeTakenMs: 0 };
      await act(async () => { assert.equal((await request(`/api/session/${pin}/answer`, 'POST', body, tokens[player.id])).status, 200); });
    }
    await wait(async () => (await read()).status === 'question_results', 'automatic question closure');
    assert.ok(current.players.alice.score > 0); assert.ok(current.players.bob.score > 0);
    assert.ok(current.questionResult?.explanation);
  };
  await answerBoth();
  await click('Classifica Parziale'); await click('Riprendi video');
  await wait(async () => (await read()).status === 'question' && current.currentQuestionIndex === 1, 'second crossed checkpoint is queued');
  assert.notEqual(current!.roundId, firstRound); assert.equal(paused, true);
  const reconnect = await socket();
  const restored = await reconnect.next({ type: 'REGISTER', pin, role: 'player', playerId: 'alice', token: tokens.alice }, m => m.type === 'SESSION_STATE_UPDATE');
  assert.equal(restored.session.currentQuestion.id, quiz.questions[1].id);
  assert.equal(Object.keys(restored.session.players).length, 2);
  await answerBoth();
  // Going back preserves completed questions, then playing across their timestamps does not reopen them.
  await move(1);
  await click('Classifica Parziale'); await click('Riprendi video');
  await wait(async () => (await read()).status === 'video' && !paused, 'backward seek resumes');
  await move(15); await delay(80); assert.equal((await read()).status, 'video');
  assert.ok(plays >= 3);
  await move(20, true);
  await wait(async () => (await read()).status === 'question' && current.currentQuestionIndex === 2, 'video end drains checkpoint beyond duration');
  await answerBoth(); await click('Classifica Parziale'); await click('Riprendi video');
  await wait(async () => (await read()).status === 'finished', 'multiplayer final summary');
  assert.equal(current!.videoQuestionsOpened, 3);
  const firstOpens = requests.filter(body => body.session.status === 'question' && body.session.currentQuestionIndex === 0);
  assert.ok(firstOpens.length >= 2);
  assert.equal(firstOpens[0].operationId, firstOpens[1].operationId, 'lost ACK retries the same operation');
  assert.equal(current!.players.alice.correctAnswersCount, 3);
  assert.equal(current!.players.bob.correctAnswersCount, 3);
  assert.equal(document.querySelectorAll('video').length, 1, 'same teacher media element survives questions');
  assert.ok(requests.every(body => !JSON.stringify(body).includes(quiz.videoConfig!.videoUrl)), 'video URL never sent to LAN server');
  await act(async () => root.unmount());
  await gameSync.flushSession();
  // The actual phone UI waits without a media element, then shows the canonical question and feedback.
  const phonePin = '765432', phoneHost = await mint();
  let phoneState = await (await request('/api/session/create', 'POST', { videoQuiz: quiz, session: {
    ...round(phonePin), mode: 'video', status: 'lobby', currentQuestion: undefined, questionStartTime: 0,
  } }, phoneHost)).json();
  const phonePublish = async (partial: Partial<GameSession>) => {
    phoneState = await (await request(`/api/session/${phonePin}`, 'GET', undefined, phoneHost)).json();
    await act(async () => {
      const response = await request(`/api/session/${phonePin}/state`, 'POST', {
        session: { ...phoneState.session, ...partial }, revision: phoneState.revision,
      }, phoneHost);
      assert.equal(response.status, 200); phoneState = await response.json();
    });
  };
  await phonePublish({ status: 'countdown' }); await phonePublish({ status: 'video' });
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  root = createRoot(document.getElementById('app')!);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(PlayerScreen, { initialPin: phonePin }))));
  const input = document.querySelector('input[placeholder="Nome o soprannome..."]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Telefono');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await wait(() => document.body.textContent?.includes('Guarda il video sullo schermo del docente'), 'phone waits for projected video');
  assert.equal(document.querySelectorAll('video, youtube-video, vimeo-video, iframe').length, 0);
  assert.ok(!document.body.textContent?.includes('Quiz Completato'));
  await phonePublish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now() });
  await wait(() => [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Marte')), 'phone receives checkpoint');
  assert.ok(!document.body.textContent?.includes('Risposta corretta:'));
  await click('Marte');
  await wait(() => document.body.textContent?.includes('Risposta Inviata'), 'phone answer accepted');
  await phonePublish({ status: 'question_results' });
  await wait(() => document.body.textContent?.includes('Risposta corretta: Marte'), 'phone receives released answer key');
  assert.ok(document.body.textContent?.includes(quiz.questions[0].explanation!));

});
