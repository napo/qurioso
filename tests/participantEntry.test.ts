import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

test('participants open only the join screen, with the PIN from the QR link', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://10.0.0.4:4000/?pin=123456&role=player&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => new Response('{}', { status: 404 }),
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: ParticipantApp } = await import('../src/ParticipantApp');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(ParticipantApp))));
  assert.equal(document.querySelector<HTMLInputElement>('form input')!.value, '123456');
  assert.equal(document.querySelector('[data-qurioso-dashboard]'), null, 'no library');

  // The entry decides before loading anything else: a participant never downloads the teacher app.
  const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(main, /participant \? <ParticipantApp \/>/);
  const entry = await readFile(new URL('../src/ParticipantApp.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /^import .*['"]\.\/App(\.tsx)?['"]/m, 'App is only loaded lazily, for the website');
});
