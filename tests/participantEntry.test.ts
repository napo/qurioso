import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

const requests: string[] = [];
test('participants open only the join screen, with the PIN from the QR link', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://10.0.0.4:4000/?pin=123456&role=player&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string) => { requests.push(String(url)); return new Response('{}', { status: 404 }); },
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

  // An offensive name is explained on the form and never sent.
  const nickname = document.querySelectorAll<HTMLInputElement>('form input')[1];
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'Str0nz0'); nickname.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.match(document.body.textContent!, /Questo nome non è adatto/);
  assert.equal(requests.some(url => url.includes('/join')), false);

  // The entry decides before loading anything else: a participant never downloads the teacher app.
  const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(main, /participant \? <ParticipantApp \/>/);
  const entry = await readFile(new URL('../src/ParticipantApp.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /^import .*['"]\.\/App(\.tsx)?['"]/m, 'App is only loaded lazily, for the website');
});
