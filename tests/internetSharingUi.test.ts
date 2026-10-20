import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import type { InternetSharingState } from '../src/types/desktop';

test('sharing panel explains Cloudflare before activation, keeps documentation visible and gives actionable error messages in all languages', async t => {
  const dom = new JSDOM('<button id="trigger">Open</button><div id="app"></div>', { url: 'http://qurioso.localhost/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { InternetSharingPanel } = await import('../src/components/host/InternetSharingPanel');
  const root = createRoot(document.getElementById('app')!); let starts = 0, stops = 0, closes = 0;
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const render = async (state: InternetSharingState, language = 'it') => {
    window.history.replaceState({}, '', '/?lang=' + language);
    await act(async () => root.render(React.createElement(LanguageProvider, { key: language, children: React.createElement(InternetSharingPanel, { state, onStart: () => starts++, onStop: () => stops++, onClose: () => closes++ }) })));
  };
  await render({ phase: 'idle' }); assert.equal(starts, 0, 'opening the information panel never starts a download or tunnel');
  assert.match(document.body.textContent!, /nomi dei partecipanti e le risposte/);
  assert.match(document.body.textContent!, /Non serve un account/);
  assert.match(document.body.textContent!, /test e dimostrazioni/);
  assert.equal(document.querySelectorAll('nav[aria-label="Cloudflare"] a').length, 4);
  assert.ok(document.querySelector('a[href="https://www.cloudflarestatus.com/"]'));
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Attiva condivisione')!.click()); assert.equal(starts, 1);
  await render({ phase: 'downloading', progress: 42 });
  assert.equal(document.querySelector('progress')?.value, 42);
  assert.equal([...document.querySelectorAll('button')].find(button => button.textContent === 'Attiva condivisione')?.disabled, true);
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Interrompi condivisione')!.click()); assert.equal(stops, 1);
  for (const language of ['it', 'en', 'de']) {
    for (const error of ['download_unavailable', 'download', 'integrity', 'network', 'interrupted', 'launch', 'unsupported', 'local']) {
      await render({ phase: 'error', error, detail: 'HTTP 410', version: '2026.10.2' }, language);
      assert.match(document.querySelector('[role="alert"]')!.textContent!, /Cloudflare/);
      assert.equal(document.querySelectorAll('nav a').length, 4);
      assert.ok(document.querySelector('details pre')?.textContent?.includes('HTTP 410'));
    }
  }
  await render({ phase: 'reconnecting', error: 'interrupted' });
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /ripristino automatico/);
  await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closes, 1);
});
