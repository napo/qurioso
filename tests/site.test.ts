import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

test('public entry opens classroom directly and classroom library makes no server requests', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.org/qurioso/?app=classroom' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let requests = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Unexpected server request'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  const { LandingPage } = await import('../src/components/site/LandingPage');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App, { classroomOnly: true }))));
  for (let n = 0; n < 40 && document.body.textContent?.includes('Caricamento quiz'); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
  assert.match(document.body.textContent!, /Una domanda, tutta la classe/);
  assert.equal(requests, 0);
  assert.equal([...document.querySelectorAll('button')].some(button => button.textContent === 'Quiz in Rete'), false);
  const start = [...document.querySelectorAll('button')].find(button => button.textContent === 'Attività in classe');
  assert.ok(start);
  await act(async () => start.click());
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.equal(requests, 0);
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  await act(async () => root.render(React.createElement(LandingPage)));
  const entry = [...document.querySelectorAll('a')].find(a => a.textContent?.includes('Apri Attività in classe'));
  assert.equal(entry?.getAttribute('href'), '?app=classroom');
  assert.ok(document.querySelector('#quiz-in-rete'));
  assert.match(document.body.textContent!, /Tutti sulla stessa LAN/);
  assert.equal(document.body.textContent?.match(/Build non ancora disponibile/g)?.length, 3);
});
