import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
import React, { act } from 'react';
import { GameSyncManager, gameSync } from '../src/services/gameSync';
import { readPlayerCredential, savePlayerCredential, clearPlayerCredential } from '../src/services/playerRecovery';
import { PLAYER_CREDENTIAL_TTL_MS } from '../src/types/playerCredential';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { publicQuestion, applyPlayerAnswer } from '../src/services/sessionState';
import { round, startLanServer } from './helpers/lanServer';
import type { GameSession, Quiz } from '../src/types/quiz';

function environment(t: any, base: string) {
  const dom = new JSDOM('<div id="app"></div>', { url: base + '/?role=player' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const nativeFetch = globalThis.fetch, descriptors = new Map<string, PropertyDescriptor | undefined>();
  let joins = 0;
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, indexedDB: new IDBFactory(), HTMLElement: dom.window.HTMLElement, WebSocket, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string | URL, init?: RequestInit) => { if (String(url).endsWith('/join')) joins++; return nativeFetch(new URL(url, base), init); },
  })) { descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  t.after(() => { gameSync.dispose(); dom.window.close(); for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } });
  return { dom, joins: () => joins, nativeFetch };
}
function setupQuiz(mode: 'standard' | 'video'): Quiz {
  const source = structuredClone(DEFAULT_QUIZZES[0]);
  source.questions = source.questions.slice(0, 2);
  source.questions[0].timeLimit = 30; source.questions[1].timeLimit = .2;
  if (mode === 'standard') source.videoConfig = undefined;
  return source;
}
const student = { id: 'alice', nickname: 'Alice', avatar: '🦊', score: 0, streak: 0 };

for (const mode of ['standard', 'video'] as const) test(`${mode}: fresh student runtimes recover every phase, immutable answers and scores without duplicate joins`, { timeout: 15000 }, async t => {
  const { base } = await startLanServer(t), env = environment(t, base), quiz = setupQuiz(mode), pin = '543219';
  const host = new GameSyncManager(); let client = new GameSyncManager();
  t.after(() => { host.dispose(); client.dispose(); }); host.register(pin, 'host');
  const initial: GameSession = { ...round(pin), quizId: quiz.id, mode, status: 'lobby', currentQuestion: undefined, questionStartTime: 0, totalQuestions: 2 };
  const publish = async (partial: Partial<GameSession>) => {
    const current = await host.fetchSessionFromServer(pin) || initial;
    assert.equal(await host.createSessionOnServer({ ...current, ...partial }, mode === 'video' ? quiz : undefined, quiz), true);
  };
  await publish({});
  assert.equal(await client.joinSessionOnServer(pin, student), true);
  const credential = readPlayerCredential(pin); assert.ok(credential && typeof credential === 'object');
  const restore = async () => {
    client.dispose(); client = new GameSyncManager();
    const result = await client.recoverPlayer(pin);
    assert.equal(result.status, 'recovered'); if (result.status !== 'recovered') throw new Error('Recovery failed');
    assert.equal(result.player.id, student.id); assert.equal(result.player.nickname, student.nickname);
    assert.equal(Object.keys(result.session.players).length, 1); assert.equal(env.joins(), 1);
    return result;
  };
  assert.equal((await restore()).session.status, 'lobby');
  await publish({ status: 'countdown' });
  if (mode === 'video') { await publish({ status: 'video' }); assert.equal((await restore()).session.status, 'video'); }
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), timeRemaining: 30 });
  const before = await restore(); assert.equal(before.ownAnswer, undefined);
  const roundId = before.session.roundId;
  const choice = quiz.questions[0].options.find(o => o.isCorrect)!.id;
  assert.equal(await client.submitAnswerOnServer(pin, student.id, choice, 0, quiz.questions[0].id, roundId), true);
  const accepted = (await host.fetchSessionFromServer(pin))!;
  const receipt = accepted.answersForCurrentQuestion.alice;
  const after = await restore(); assert.equal(after.session.roundId, roundId); assert.equal(after.ownAnswer?.optionId, choice);
  assert.equal('isCorrect' in after.ownAnswer!, false);
  assert.equal(Object.keys(after.session.answersForCurrentQuestion).length, 0, 'no live answers leaked');
  assert.equal(await client.submitAnswerOnServer(pin, student.id, choice, 9999, quiz.questions[0].id, roundId), true, 'identical retries acknowledge once');
  assert.equal(await client.submitAnswerOnServer(pin, student.id, quiz.questions[0].options.find(o => !o.isCorrect)!.id, 0, quiz.questions[0].id, roundId), false);
  const scored = mode === 'standard' ? applyPlayerAnswer(accepted, quiz, { playerId: student.id, ...receipt }) : accepted;
  await publish({ ...scored, status: 'question_results' });
  const score = scored.players.alice.score; assert.ok(score > 0);
  assert.equal((await restore()).player.score, score);
  assert.equal(Object.keys((await host.fetchSessionFromServer(pin))!.answersForCurrentQuestion).length, 1);
  await publish({ status: 'leaderboard' });
  assert.equal((await restore()).player.score, score);
  if (mode === 'video') await publish({ status: 'video' });
  await publish({ status: 'question', currentQuestionIndex: 1, currentQuestion: publicQuestion(quiz, 1), questionStartTime: Date.now() + 1, timeRemaining: .2, answersForCurrentQuestion: {} });
  const deadline = (await host.fetchSessionFromServer(pin))!.roundId;
  await restore(); await delay(250);
  assert.equal(await client.submitAnswerOnServer(pin, student.id, quiz.questions[1].options[0].id, 0, quiz.questions[1].id, deadline), false, 'recovery cannot extend server deadline');
  await publish({ status: 'question_results' });
  assert.equal((await restore()).player.score, score, 'no double grading');
  if (mode === 'video') { await publish({ status: 'leaderboard' }); await publish({ status: 'video' }); }
  await publish({ status: 'finished' });
  client.dispose(); client = new GameSyncManager();
  assert.equal((await client.recoverPlayer(pin)).status, 'ended');
  assert.equal(readPlayerCredential(pin), null);
  assert.equal(env.joins(), 1);
});

test('recovery rejects swapped, forged, expired credentials, closed/restarted rooms and preserves secrets on network errors', { timeout: 15000 }, async t => {
  const server = await startLanServer(t, true), env = environment(t, server.base), pin = '543218';
  const host = new GameSyncManager(), client = new GameSyncManager();
  t.after(() => { host.dispose(); client.dispose(); }); host.register(pin, 'host');
  assert.equal(await host.createSessionOnServer({ ...round(pin), status: 'lobby', currentQuestion: undefined }), true);
  assert.equal(await client.joinSessionOnServer(pin, student), true);
  const saved = readPlayerCredential(pin); assert.ok(saved && typeof saved === 'object');
  const bob = await (await server.request(`/api/session/${pin}/join`, 'POST', { player: { ...student, id: 'bob', nickname: 'Alice' } })).json();
  const path = `/api/session/${pin}/player/alice`;
  for (const token of [undefined, '0'.repeat(64), bob.playerToken]) assert.equal((await server.request(path, 'GET', undefined, token)).status, 403);
  assert.equal((await server.request(`/api/session/${pin}/presenter`, 'GET', undefined, saved.token)).status, 403);
  assert.equal((await server.request(`/api/session/${pin}`, 'DELETE', undefined, saved.token)).status, 403);
  const publicState = JSON.stringify(await (await server.request(`/api/session/${pin}`)).json());
  assert.equal(publicState.includes(saved.token), false); assert.equal(publicState.includes(bob.playerToken), false);
  window.localStorage.setItem('qurioso_player_recovery_v1:' + pin, '{');
  assert.equal((await client.recoverPlayer(pin)).status, 'invalid'); assert.equal(readPlayerCredential(pin), null);
  savePlayerCredential({ ...saved, token: bob.playerToken });
  assert.equal((await client.recoverPlayer(pin)).status, 'invalid'); assert.equal(readPlayerCredential(pin), null);
  savePlayerCredential(saved);
  const online = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await client.recoverPlayer(pin)).status, 'unavailable'); assert.deepEqual(readPlayerCredential(pin), saved);
  globalThis.fetch = online;
  assert.equal((await client.recoverPlayer(pin)).status, 'recovered');
  savePlayerCredential({ ...saved, expiresAt: Date.now() - 1 });
  assert.equal((await client.recoverPlayer(pin)).status, 'recovered', 'local wall-clock expiry is not authoritative');
  savePlayerCredential(saved);
  await server.advanceClock(PLAYER_CREDENTIAL_TTL_MS + 1);
  assert.equal((await server.request(path, 'GET', undefined, saved.token)).status, 410, 'server enforces expiry even with a forged local expiry');
  assert.equal((await server.request(`/api/session/${pin}`, 'GET', undefined, saved.token)).status, 410);
  assert.equal((await client.recoverPlayer(pin)).status, 'expired');
  // A fresh backend cannot accept the old credential, even if the browser retained it.
  savePlayerCredential(saved); const restarted = await startLanServer(t);
  globalThis.fetch = (url, init) => env.nativeFetch(new URL(String(url), restarted.base), init);
  assert.equal((await client.recoverPlayer(pin)).status, 'gone'); assert.equal(readPlayerCredential(pin), null);
  globalThis.fetch = online;
  // Closing a room also clears stale recovery records and cannot create a phantom room.
  await host.removeSession(pin); savePlayerCredential(saved);
  assert.equal((await client.recoverPlayer(pin)).status, 'gone');
  assert.equal((await (await server.request('/api/health')).json()).activeSessions, 0);
});

test('explicit leave revokes only the participant credential; storage failure keeps ordinary play usable', async t => {
  const { base, request } = await startLanServer(t), env = environment(t, base), pin = '543217';
  const host = new GameSyncManager(), client = new GameSyncManager();
  t.after(() => { host.dispose(); client.dispose(); }); host.register(pin, 'host');
  assert.equal(await host.createSessionOnServer({ ...round(pin), status: 'lobby', currentQuestion: undefined }), true);
  assert.equal(await client.joinSessionOnServer(pin, student), true);
  const saved = readPlayerCredential(pin); assert.ok(saved && typeof saved === 'object');
  savePlayerCredential({ ...saved, pin: '999999' });
  window.localStorage.setItem('qurioso_player_recovery_v1:' + pin, '{'); // Explicit leave also removes an unreadable pertinent record.
  await client.leavePlayer(pin, student.id);
  assert.equal(readPlayerCredential(pin), null); assert.ok(readPlayerCredential('999999'));
  assert.equal((await request(`/api/session/${pin}/player/alice`, 'GET', undefined, saved.token)).status, 403);
  assert.equal(Object.keys((await host.fetchSessionFromServer(pin))!.players).length, 1, 'historical records remain unchanged');
  const proto = Object.getPrototypeOf(env.dom.window.localStorage), original = proto.setItem;
  proto.setItem = () => { throw new Error('storage blocked'); };
  try { assert.equal(await client.joinSessionOnServer(pin, { ...student, id: 'new-student' }), true); assert.equal(client.canRecoverPlayer(pin, 'new-student'), false); }
  finally { proto.setItem = original; }
});

for (const mode of ['standard', 'video'] as const) test(`${mode}: real PlayerScreen restores lobby, unanswered/answered question, results and leaderboard after remount`, { timeout: 20000 }, async t => {
  let cleanup = async () => {}; t.after(() => cleanup());
  const { base } = await startLanServer(t), env = environment(t, base), pin = '543216', quiz = setupQuiz(mode);
  const host = new GameSyncManager(), joining = new GameSyncManager();
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  let root = createRoot(document.getElementById('app')!);
  cleanup = async () => { await act(async () => root.unmount()); host.dispose(); joining.dispose(); }; host.register(pin, 'host');
  const initial: GameSession = { ...round(pin), mode, status: 'lobby', currentQuestion: undefined, questionStartTime: 0, totalQuestions: 2 };
  const publish = async (partial: Partial<GameSession>) => {
    const current = await host.fetchSessionFromServer(pin) || initial;
    await act(async () => { assert.equal(await host.createSessionOnServer({ ...current, ...partial }, mode === 'video' ? quiz : undefined, quiz), true); });
  };
  const wait = async (condition: () => unknown, label: string) => {
    for (let n = 0; n < 200; n++) { let ready; await act(async () => { await delay(10); ready = condition(); }); if (ready) return; }
    assert.fail('Player UI timeout: ' + label + ' | ' + document.body.textContent);
  };
  const click = async (text: string) => { const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().endsWith(text)); assert.ok(button, text); await act(async () => button.click()); };
  const remount = async () => {
    await act(async () => root.unmount()); gameSync.dispose(); root = createRoot(document.getElementById('app')!);
    await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(PlayerScreen, { initialPin: pin }))));
    await wait(() => !document.body.textContent?.includes('Recupero della partecipazione in corso'), 'automatic recovery');
    assert.equal(env.joins(), 1);
    assert.equal(Object.keys((await host.fetchSessionFromServer(pin))!.players).length, 1);
  };
  await publish({}); assert.equal(await joining.joinSessionOnServer(pin, student), true); joining.dispose();
  await remount(); assert.match(document.body.textContent!, /Alice/); assert.match(document.body.textContent!, /Sei nella lobby/);
  assert.equal(document.querySelector('form'), null);
  await publish({ status: 'countdown' }); if (mode === 'video') await publish({ status: 'video' });
  await publish({ status: 'question', currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(), timeRemaining: 30 });
  await remount();
  const correct = quiz.questions[0].options.find(o => o.isCorrect)!;
  await click(correct.text); await wait(() => document.body.textContent?.includes('Risposta Inviata'), 'accepted answer');
  await remount(); assert.match(document.body.textContent!, /Risposta Inviata/);
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent?.trim().endsWith(correct.text)), false, 'cannot change an accepted answer after refresh');
  const current = (await host.fetchSessionFromServer(pin))!;
  const scored = mode === 'standard' ? applyPlayerAnswer(current, quiz, { playerId: student.id, ...current.answersForCurrentQuestion.alice }) : current;
  await publish({ ...scored, status: 'question_results' });
  await remount(); assert.match(document.body.textContent!, /Risposta Esatta/); assert.match(document.body.textContent!, new RegExp(String(scored.players.alice.score)));
  await publish({ status: 'leaderboard' }); await remount(); assert.match(document.body.textContent!, /Guarda la classifica/);
  // Returning from a temporary recovery failure must retain the secret until explicitly abandoned.
  const saved = readPlayerCredential(pin); assert.ok(saved && typeof saved === 'object');
  await click('Abbandona partita');
  await wait(() => document.querySelector('form'), 'new entry after explicit leave'); assert.equal(readPlayerCredential(pin), null);
  assert.equal(new URL(env.dom.window.location.href).searchParams.has('pin'), false);
  assert.equal((await env.nativeFetch(`${base}/api/session/${pin}/player/alice`, { headers: { Authorization: 'Bearer ' + saved.token } })).status, 403);
});
