import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';

const published = { ...DEFAULT_QUIZZES.find(quiz => !quiz.videoConfig)!, id: 'demo-published', title: 'Quiz pubblicato sul server' };

test('a quiz link resolves library IDs and bundled slugs without the network, then published JSON validated like a backup', async t => {
  const requests: string[] = [];
  const responses: Record<string, Response | Error> = {
    'quizzes/demo-classe.json': new Response(JSON.stringify(published)),
    'quizzes/altro.json': new Response('not found', { status: 404 }),
    'quizzes/rotto.json': new Response(JSON.stringify({ ...published, questions: [{ id: 'q', text: 'x', type: 'essay' }] })),
    'quizzes/offline.json': new Error('offline'),
  };
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async (url: string) => {
    requests.push(url); const response = responses[url]; if (response instanceof Error) throw response; return response;
  } });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'fetch', saved); });
  const { resolveQuizLink } = await import('../src/services/quizLink');
  const { OFFICIAL_QUIZ_SLUGS } = await import('../src/services/officialQuizzes');

  assert.equal(await resolveQuizLink(DEFAULT_QUIZZES[1].id, DEFAULT_QUIZZES), DEFAULT_QUIZZES[1]);
  assert.equal(await resolveQuizLink('tipi-di-vulcani', []), OFFICIAL_QUIZ_SLUGS['tipi-di-vulcani']);
  assert.deepEqual(requests, [], 'known quizzes open offline');

  const fetched = await resolveQuizLink('demo-classe', []);
  assert.equal(fetched?.title, 'Quiz pubblicato sul server');
  assert.equal(fetched?.questions.length, published.questions.length);
  for (const missing of ['altro', 'rotto', 'offline', '../secret', 'Maiuscolo', 'toString']) assert.equal(await resolveQuizLink(missing, []), null, missing);
  assert.deepEqual(requests, ['quizzes/demo-classe.json', 'quizzes/altro.json', 'quizzes/rotto.json', 'quizzes/offline.json'], 'only plain slugs reach the network');
});

test('the public site opens a linked quiz directly in the classroom activity and returns to the library on exit', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://qurioso.it/?app=classroom&quiz=demo-classe&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string) => url === 'quizzes/demo-classe.json' ? new Response(JSON.stringify(published)) : new Response('', { status: 404 }),
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const mount = async (key: string) => {
    await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App, { key, classroomOnly: true }))));
    for (let n = 0; n < 100 && /Caricamento quiz/.test(document.body.textContent!); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  };

  await mount('linked');
  assert.match(document.body.textContent!, /Quiz pubblicato sul server/);
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.equal(new URL(window.location.href).searchParams.get('quiz'), 'demo-classe', 'the address still reopens the activity');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Esci')!.click());
  assert.ok(document.querySelector('[data-qurioso-dashboard]'));
  assert.equal(new URL(window.location.href).searchParams.has('quiz'), false);

  window.history.replaceState({}, '', '/?app=classroom&quiz=inesistente&lang=it');
  await mount('missing');
  assert.ok(document.querySelector('[data-qurioso-dashboard]'));
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /non è disponibile/);
  assert.equal(new URL(window.location.href).searchParams.has('quiz'), false);
});
