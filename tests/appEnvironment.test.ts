import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

test('the official hosted app offers classroom and downloads, never a quiz server; settings contain library tools and creation stays visible', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://qurioso.it/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>(); let requests = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('The static site must not contact a quiz server'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  const { isPublicWebsite } = await import('../src/services/appEnvironment');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const mount = async (key: string, classroomOnly = false) => {
    await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App, { key, classroomOnly }))));
    for (let n = 0; n < 100 && /Caricamento quiz/.test(document.body.textContent!); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  };
  const click = async (text: string) => { const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text); assert.ok(button, text); await act(async () => button.click()); };
  assert.equal(isPublicWebsite('www.qurioso.it'), true); assert.equal(isPublicWebsite('qurioso.it.attacker.test'), false);
  await mount('website');
  assert.ok(document.querySelector('[data-qurioso-dashboard]'));
  assert.match(document.body.textContent!, /Qurioso Web/);
  assert.ok([...document.querySelectorAll('a')].some(a => a.textContent?.includes('Scarica Qurioso') && a.href.endsWith('#quiz-in-rete')));
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent === 'Quiz classico in rete'), false);
  assert.equal(document.querySelector('header')!.textContent!.includes(' Live'), false);
  assert.equal(document.querySelector('.library-data'), null);
  assert.equal([...document.querySelectorAll('button[aria-haspopup="menu"]')].map(b => b.textContent).join(), 'Nuovo quiz', 'a single creation control in the library');
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Impostazioni"]')!.click());
  assert.ok(document.querySelector('[data-qurioso-settings] .library-data'));
  assert.equal(document.querySelector('[data-internet-setup]'), null, 'the public website cannot configure native Cloudflare');
  await click('Crea quiz'); assert.ok(document.querySelector('.quiz-editor'));
  assert.equal(requests, 0);

  await mount('website-classroom', true);
  await click('Attività in classe');
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.equal(requests, 0, 'classroom play is available without a backend on qurioso.it');

  dom.window.history.replaceState({}, '', '/?role=player&pin=123456&lang=it');
  await mount('public-player');
  assert.match(document.body.textContent!, /Il solo PIN su qurioso.it non collega alla partita/);
  assert.equal(requests, 0);

  // Desktop exposes both activity modes, without a global Cloudflare preference.
  const { gameSync } = await import('../src/services/gameSync');
  const getInfo = gameSync.getServerInfo;
  gameSync.getServerInfo = async () => ({ port: 54321, localIps: ['192.168.1.7'], status: 'ok', protocol: 'http', host: 'test', fullUrl: 'http://192.168.1.7:54321' });
  t.after(() => { gameSync.getServerInfo = getInfo; });
  (window as any).quriosoDesktop = { internetSharing: {} };
  dom.reconfigure({ url: 'http://qurioso.localhost/?app=classroom&lang=it' });
  dom.window.history.replaceState({}, '', '/?app=classroom&lang=it');
  const { storeQuizzes, readLibrarySnapshot } = await import('../src/services/quizStorage');
  const { DEFAULT_QUIZZES } = await import('../src/data/defaultQuizzes');
  await storeQuizzes([DEFAULT_QUIZZES.find(q => !q.videoConfig)!]);
  await mount('first-desktop', true);
  assert.match(document.body.textContent!, /Tipi di vulcani con geopop/);
  assert.equal((await readLibrarySnapshot())!.length, 1, 'included quiz does not rewrite a saved library');
  assert.equal(document.querySelector('[data-internet-setup]'), null);
  await act(async () => document.querySelector<HTMLButtonElement>('[data-activity-mode="network"]')!.click());
  assert.equal(new URL(window.location.href).searchParams.get('app'), 'network', 'refresh retains the selected workspace and presenter recovery');
  assert.ok([...document.querySelectorAll('button')].some(b => b.textContent === 'Quiz classico in rete'));
  assert.ok([...document.querySelectorAll('button')].some(b => b.textContent === 'Quiz video in rete' && !b.disabled), 'the included volcano quiz is playable on the network');
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent === 'Attività in classe'), false);
  await act(async () => document.querySelector<HTMLButtonElement>('[data-activity-mode="classroom"]')!.click());
  assert.equal([...document.querySelectorAll('button')].some(b => b.textContent === 'Quiz classico in rete'), false);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Impostazioni"]')!.click());
  assert.equal(document.querySelector('[data-internet-setup]'), null);
  assert.equal(document.body.textContent!.includes('Preferisci accesso Internet'), false);
  assert.equal(requests, 0);
});
