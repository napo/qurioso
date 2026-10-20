import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { finalResult, readFinalResult, saveFinalResult } from '../src/services/finalResult';
import { round } from './helpers/lanServer';

test('final results remain read-only after refresh and sharing exports the avatar, quiz and full ranking with safe fallbacks', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://classroom.test/?pin=123456' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const texts: string[] = []; let downloads = 0, closeCalls = 0, closeCleanup = 0, failCanvas = false;
  const context = { fillRect() {}, fillText(value: string) { texts.push(value); }, measureText: (value: string) => ({ width: value.length * 20 }) };
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => failCanvas ? null : context });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'toBlob', { value: (callback: (blob: Blob) => void) => callback(new Blob(['PNG fixture'], { type: 'image/png' })) });
  dom.window.HTMLAnchorElement.prototype.click = () => { downloads++; };
  dom.window.close = () => { closeCalls++; };
  const session = { ...round('123456'), status: 'finished' as const, quizTitle: 'Volcanoes', players: {
    alice: { id: 'alice', nickname: 'Alice', avatar: '🦊', score: 250, streak: 0 },
    bob: { id: 'bob', nickname: 'Bob', avatar: '🦁', score: 900, streak: 0 },
  } };
  const result = finalResult(session, 'alice');
  saveFinalResult(result);
  assert.deepEqual(readFinalResult('123456'), result);
  assert.equal(readFinalResult('654321'), null);
  const stored = window.sessionStorage.getItem('qurioso_final_result_v1:123456')!;
  assert.equal(/token|credential|answersForCurrentQuestion|currentQuestion/.test(stored), false);
  saveFinalResult({ ...result, expiresAt: Date.now() - 1 }); assert.equal(readFinalResult('123456'), null);
  window.sessionStorage.setItem('qurioso_final_result_v1:123456', JSON.stringify({ ...result, players: [null] })); assert.equal(readFinalResult('123456'), null);
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { PlayerFinalResult } = await import('../src/components/player/PlayerFinalResult');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close = () => {}; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const mount = async (language: string, key = language) => {
    window.history.replaceState({}, '', `/?lang=${language}`);
    await act(async () => root.render(React.createElement(LanguageProvider, { key, children: React.createElement(PlayerFinalResult, { result, onClose: () => { closeCleanup++; } }) })));
  };
  const click = async (label: string) => { const button = [...document.querySelectorAll('button')].find(b => b.textContent === label)!; assert.ok(button, label); await act(async () => button.click()); };
  let shared: ShareData | undefined;
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { shared = data; } });
  await mount('en');
  assert.equal(document.querySelectorAll('button').length, 2);
  assert.deepEqual([...document.querySelectorAll('ol li')].map(e => e.textContent), ['#1🦁 Bob900', '#2🦊 Alice250']);
  assert.equal(document.querySelector('img')?.alt, 'Volcanoes · Alice · Final score: 250 · Position 2 of 2');
  await click('Share result');
  assert.equal(shared?.files?.[0].type, 'image/png'); assert.equal(shared?.url, undefined); assert.equal(shared?.text, undefined);
  assert.ok(texts.some(value => value.includes('🦊 Alice'))); assert.ok(texts.some(value => /🦁\s+Bob/.test(value))); assert.ok(texts.includes('Volcanoes')); assert.equal(texts.includes('123456'), false);
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  await click('Share result'); assert.equal(downloads, 0); assert.equal(document.querySelector('[role="status"]'), null);
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('Unavailable'); } });
  await click('Share result'); assert.match(document.querySelector('[role="status"]')!.textContent!, /Press again/);
  await click('Share result'); assert.equal(downloads, 1);
  await click('Close window'); assert.equal(closeCalls, 1); assert.equal(closeCleanup, 1);
  assert.match(document.querySelector('[role="status"]')!.textContent!, /manually/);
  for (const [language, heading, share, close] of [['it', 'Gara conclusa', 'Condividi risultato', 'Chiudi finestra'], ['de', 'Spiel beendet', 'Ergebnis teilen', 'Fenster schließen']]) {
    await mount(language); assert.equal(document.querySelector('h1')!.textContent, heading);
    assert.deepEqual([...document.querySelectorAll('button')].map(b => b.textContent), [share, close]);
  }
  failCanvas = true; await mount('en', 'no-canvas'); assert.match(document.querySelector('[role="status"]')!.textContent!, /Cannot prepare/);
  failCanvas = false; await click('Retry'); assert.ok(document.querySelector('img'));
});
