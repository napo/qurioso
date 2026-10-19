import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import React, { act } from 'react';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { DEMO_VIDEO_URL } from '../src/utils/videoSource';
import { publicQuestion, applyPlayerAnswer } from '../src/services/sessionState';
import type { GameSession } from '../src/types/quiz';

test('real host and player components exchange correct answers across rounds with HTTP and WebSocket', { timeout: 20000 }, async (t) => {
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { server.kill(); await once(server, 'exit'); });
  const base = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
    server.stdout.on('data', bytes => {
      const match = bytes.toString().match(/Qurioso: (http:\/\/localhost:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    server.once('error', reject);
  });
  const originalFetch = globalThis.fetch;
  const dom = new JSDOM('<div id="app"></div>', { url: base });
  const sockets: WebSocket[] = [];
  let blockHost = false;
  let hostAuthorization: string | null = null;
  class ClientSocket extends WebSocket {
    constructor(url: string) { super(url); sockets.push(this); }
    emit(event: string | symbol, ...args: any[]): boolean {
      if (event === 'message' && blockHost) return false;
      return super.emit(event, ...args);
    }
  }
  let rejectAnswer = false;
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, indexedDB: new IDBFactory(),
    localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
    WebSocket: ClientSocket, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string | URL, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization');
      if (String(url).endsWith('/api/session/create')) hostAuthorization = authorization;
      if (blockHost && authorization && authorization === hostAuthorization) return Promise.resolve(new Response('{}', { status: 503 }));
      if (rejectAnswer && String(url).endsWith('/answer')) return Promise.resolve(new Response('{}', { status: 503 }));
      return originalFetch(new URL(String(url), base), init);
    },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  // QR code rendering is outside this transport/component regression test.
  dom.window.HTMLCanvasElement.prototype.getContext = (() => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    clearRect() {}, putImageData() {},
  })) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  const { VideoQuizPlayer } = await import('../src/components/video/VideoQuizPlayer');
  const { gameSync } = await import('../src/services/gameSync');
  t.after(() => { gameSync.dispose(); dom.window.close(); globalThis.fetch = originalFetch; });
  let root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); });
  const quiz = DEFAULT_QUIZZES[0];
  const hosts = new Map<string, string>();
  const participantTokens = new Map<string, string>();
  const post = async (url: string, body: any) => {
    let credential: string | undefined;
    if (url === '/api/session/create') {
      const pin = body.session.pin;
      credential = hosts.get(pin);
      if (!credential) {
        const minted = await fetch(base + '/api/presenter-token', { method: 'POST' });
        credential = (await minted.json()).hostToken;
        hosts.set(pin, credential!);
      } else {
        const response = await fetch(base + '/api/session/' + pin, { headers: { Authorization: `Bearer ${credential}` } });
        body = { ...body, revision: (await response.json()).revision };
      }
    } else {
      const pin = url.split('/')[3];
      credential = participantTokens.get(`${pin}:${body.playerId || body.player?.id}`);
      if (url.endsWith('/answer') && !body.roundId) {
        const state = await (await fetch(base + '/api/session/' + pin)).json();
        body = { ...body, roundId: state.session?.roundId };
      }
    }
    const response = await fetch(base + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      body: JSON.stringify(body),
    });
    if (response.ok && url.endsWith('/join')) {
      participantTokens.set(`${url.split('/')[3]}:${body.player.id}`, (await response.clone().json()).playerToken);
    }
    return response;
  };
  const getSession = async (pin: string): Promise<GameSession | undefined> => (await (await fetch(base + '/api/session/' + pin, {
    headers: hosts.has(pin) ? { Authorization: `Bearer ${hosts.get(pin)}` } : {},
  })).json()).session;
  const waitFor = async (condition: () => unknown | Promise<unknown>, label: string) => {
    const end = Date.now() + 6000;
    while (Date.now() < end) {
      let done: unknown;
      await act(async () => { await delay(30); done = await condition(); });
      if (done) return;
    }
    throw new Error('Timed out: ' + label + '\n' + document.body.textContent);
  };
  const click = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
    assert.ok(button, 'Missing button: ' + text);
    assert.equal(button.disabled, false);
    await act(async () => button.click());
  };

  const info = await (await fetch(base + '/api/server-info')).json();
  assert.equal(info.port, Number(new URL(base).port));
  assert.notEqual(info.port, 0);
  await act(async () => root.render(React.createElement(LanguageProvider, null,
    React.createElement(HostScreen, { quiz: { ...quiz, videoConfig: undefined }, onExit() {} }))));
  const pin = [...document.querySelectorAll('span')].find(el => /^\d{6}$/.test(el.textContent || ''))!.textContent!;
  await waitFor(async () => !!await getSession(pin), 'host creates a room');
  await act(async () => {
    const res = await post(`/api/session/${pin}/join`, { player: { id: 'remote', nickname: 'Remoto', name: 'Remoto', score: 0, streak: 0, avatar: '🦊' } });
    assert.equal(res.status, 200);
  });
  await waitFor(() => document.body.textContent?.includes('Remoto'), 'remote player joins the host');
  await click('Inizia il Quiz');
  await waitFor(async () => (await getSession(pin))?.status === 'question', 'first question');
  const answer = { playerId: 'remote', questionId: 'vq-1', optionId: 'vq1-a', timeTakenMs: 1000 };
  await act(async () => assert.equal((await post(`/api/session/${pin}/answer`, answer)).status, 200));
  await waitFor(async () => (await getSession(pin))?.status === 'question_results', 'automatic results after every player answers');
  const first = (await getSession(pin))!;
  assert.equal(first.players.remote.lastAnswerCorrect, true);
  assert.ok(first.players.remote.score > 0);
  assert.equal((await post(`/api/session/${pin}/answer`, answer)).status, 200);
  assert.equal((await getSession(pin))!.players.remote.score, first.players.remote.score);
  await click('Classifica Parziale');
  await click('Prossima Domanda');
  await waitFor(async () => (await getSession(pin))?.currentQuestionIndex === 1, 'second question');
  // Force an outage in the host's WebSocket; its HTTP poll must recover the answer.
  await act(async () => { sockets[0].close(); await delay(30); });
  assert.equal(gameSync.isServerConnected(), false);
  const secondQuestion = quiz.questions[1];
  await act(async () => assert.equal((await post(`/api/session/${pin}/answer`, {
    playerId: 'remote', questionId: secondQuestion.id,
    optionId: secondQuestion.options.find(o => o.isCorrect)!.id, timeTakenMs: 1500,
  })).status, 200));
  await waitFor(async () => (await getSession(pin))?.players.remote.correctAnswersCount === 2, 'second round scored with current state');
  assert.equal(gameSync.isServerConnected(), false, 'HTTP fallback scores before the WebSocket reconnects');
  assert.equal((await post(`/api/session/${pin}/answer`, answer)).status, 400);
  await click('Classifica Parziale');
  await click('Prossima Domanda');
  await waitFor(async () => (await getSession(pin))?.currentQuestionIndex === 2, 'third question before a full host outage');
  blockHost = true;
  const thirdQuestion = quiz.questions[2];
  await act(async () => assert.equal((await post(`/api/session/${pin}/answer`, {
    playerId: 'remote', questionId: thirdQuestion.id, optionId: thirdQuestion.options.find(o => o.isCorrect)!.id, timeTakenMs: 0,
  })).status, 200));
  await click('Chiudi tempo e mostra risposte');
  await act(async () => { await delay(350); blockHost = false; });
  await waitFor(async () => (await getSession(pin))?.players.remote.correctAnswersCount === 3, 'an accepted answer is graded after reconnect even when results were shown locally');
  const recovered = (await getSession(pin))!;
  assert.equal(Object.keys(recovered.players).length, 1);
  assert.equal((await (await fetch(base + '/api/health')).json()).activeSessions, 1);
  assert.equal(recovered.status, 'question_results');
  await click('Classifica Parziale');
  await click('Classifica Finale');
  await waitFor(async () => (await getSession(pin))?.status === 'finished', 'host continues the same game after reconnect');
  await act(async () => root.unmount());

  // Mount the actual phone component against the same real HTTP server.
  root = createRoot(document.getElementById('app')!);
  const phonePin = '654321';
  const phoneSession: GameSession = {
    ...first, pin: phonePin, status: 'question', currentQuestionIndex: 0,
    currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), timeRemaining: 20,
    players: {}, answersForCurrentQuestion: {},
  };
  await post('/api/session/create', { session: phoneSession });
  await act(async () => root.render(React.createElement(LanguageProvider, null,
    React.createElement(PlayerScreen, { initialPin: phonePin }))));
  const nickname = document.querySelector('input[placeholder="Nome o soprannome..."]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'Telefono');
    nickname.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await waitFor(() => [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Marte')), 'phone renders real option text and IDs');
  rejectAnswer = true;
  await click('Marte');
  await waitFor(() => document.body.textContent?.includes('Risposta non ricevuta'), 'failed submissions display an error');
  assert.doesNotMatch(document.body.textContent || '', /Risposta Inviata/);
  rejectAnswer = false;
  await click('Marte');
  await waitFor(async () => Object.keys((await getSession(phonePin))!.answersForCurrentQuestion).length === 1, 'phone answer reaches backend');
  const received = (await getSession(phonePin))!;
  const [playerId, submission] = Object.entries(received.answersForCurrentQuestion)[0];
  assert.equal(submission.optionId, 'vq1-a');
  assert.equal(submission.questionId, 'vq-1');
  assert.match(document.body.textContent || '', /Risposta Inviata/);
  const scored = applyPlayerAnswer(received, quiz, { playerId, ...submission });
  await act(async () => { await post('/api/session/create', { session: { ...scored, status: 'question_results' } }); });
  await waitFor(() => document.body.textContent?.includes('Risposta Esatta!'), 'phone receives the correctness message');
  await act(async () => root.unmount());

  // Also exercise the independent video quiz mode with the Mars checkpoint.
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  root = createRoot(document.getElementById('app')!);
  await act(async () => root.render(React.createElement(LanguageProvider, null,
    React.createElement(VideoQuizPlayer, { quiz, onExit() {} }))));
  const video = document.querySelector('video')!;
  Object.defineProperty(video, 'duration', { value: 60 });
  await act(async () => {
    video.currentTime = 5;
    video.dispatchEvent(new dom.window.Event('timeupdate', { bubbles: true }));
  });
  await click('Marte');
  assert.match(document.querySelector('[role="status"]')?.textContent || '', /Corrett|Esatt|Ottimo/i);
  assert.match(document.querySelector('[role="status"]')?.textContent || '', /ossido di ferro/);
  assert.equal(document.querySelector('video')!.src, DEMO_VIDEO_URL);

  const originalCreateURL = URL.createObjectURL;
  const originalRevokeURL = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.createObjectURL = () => 'blob:test-local-video';
  URL.revokeObjectURL = url => revoked.push(url);
  t.after(() => { URL.createObjectURL = originalCreateURL; URL.revokeObjectURL = originalRevokeURL; });
  await click('Configura Video');
  const fileInput = document.querySelector('input[type="file"]')!;
  Object.defineProperty(fileInput, 'files', { value: [new File(['test'], 'lezione.mp4', { type: 'video/mp4' })] });
  await act(async () => fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
  await waitFor(() => document.querySelector('video')?.src === 'blob:test-local-video', 'stored local video is loaded');
  assert.equal(document.querySelector('[role="status"]'), null, 'loading a new video clears the previous quiz result');
  await act(async () => document.querySelector('video')!.dispatchEvent(new dom.window.Event('error')));
  assert.match(document.querySelector('[role="alert"]')?.textContent || '', /Impossibile riprodurre/);
  await click('Scegli un altro video');
  await click('Big Buck Bunny');
  assert.deepEqual(revoked, ['blob:test-local-video']);
  assert.equal(document.querySelector('video')!.src, DEMO_VIDEO_URL);


  // Exercise the user's dashboard entry point, not only the isolated editor.
  await act(async () => root.unmount());
  dom.window.matchMedia = (() => ({ matches: false })) as any;
  const { default: App } = await import('../src/App');
  root = createRoot(document.getElementById('app')!);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App))));
  await waitFor(() => document.body.textContent?.includes('Crea quiz video'), 'dashboard exposes video quiz creation');
  await click('Crea quiz video');
  assert.ok(document.querySelector('section[aria-label="Tipo di quiz"]'));
  assert.equal(document.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Quiz con video'), true);
  assert.ok(document.querySelector('section[aria-label="Sorgente video"] input[type="url"]'));
  assert.ok(document.querySelector('input[aria-label="Carica video dal computer"]'));


});
