import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

test('classroom runs without a server; landing switches, remembers and passes all three languages', async t => {
  const dom = new JSDOM('<meta name="description" /><meta property="og:title" /><meta property="og:locale" /><div id="app"></div>', { url: 'https://example.org/qurioso/?app=classroom' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
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
  assert.match(document.body.textContent!, /Tipi di vulcani con geopop/);
  const volcanoCredit = document.querySelector('a[href="https://commons.wikimedia.org/wiki/File:Fimmvorduhals_2010_03_27_dawn.jpg"]');
  assert.ok(volcanoCredit, 'the included volcano quiz displays its Commons credit');
  assert.match(volcanoCredit.parentElement!.textContent!, /Boaworm.*CC BY 3.0/);
  assert.equal(requests, 0);
  assert.equal([...document.querySelectorAll('button')].some(button => button.textContent === 'Quiz in Rete'), false);
  const start = [...document.querySelectorAll('button')].find(button => button.textContent === 'Attività in classe');
  assert.ok(start);
  await act(async () => start.click());
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.equal(requests, 0);
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(LandingPage))));
  const entry = [...document.querySelectorAll('a')].find(a => a.textContent?.includes('Apri Attività in classe'));
  assert.equal(entry?.getAttribute('href'), '?app=classroom&lang=it');
  assert.ok(document.querySelector('#quiz-in-rete'));
  assert.equal([...document.querySelectorAll('a')].find(a => a.textContent === 'Partecipa con PIN')?.getAttribute('href'), '?role=player&lang=it');
  assert.match(document.body.textContent!, /Tutti sulla stessa LAN/);
  assert.equal(document.body.textContent?.match(/Build non ancora disponibile/g)?.length, 3);
  const chooseLanguage = async (label: string) => {
    const selector = document.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    await act(async () => selector.click());
    const option = [...document.querySelectorAll('button')].find(button => button.textContent?.includes(label));
    assert.ok(option);
    await act(async () => option.click());
  };
  await chooseLanguage('English');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(localStorage.getItem('qurioso_language'), 'en');
  assert.equal(new URL(window.location.href).searchParams.get('lang'), 'en');
  assert.match(document.title, /Network quizzes and classroom activities/);
  assert.equal(document.querySelector('meta[property="og:locale"]')?.getAttribute('content'), 'en_GB');
  assert.match(document.querySelector('meta[name="description"]')?.getAttribute('content') || '', /Quizzes with images and videos/);
  assert.match(document.body.textContent!, /Everyone on the same LAN/);
  assert.match(document.body.textContent!, /Do I need an account/);
  assert.equal(document.body.textContent?.match(/Build not available yet/g)?.length, 3);
  assert.ok(document.querySelector('a[href="?app=classroom&lang=en"]'));
  assert.equal(document.body.textContent?.includes('Attività in classe'), false);
  await chooseLanguage('Deutsch');
  assert.equal(document.documentElement.lang, 'de');
  assert.equal(localStorage.getItem('qurioso_language'), 'de');
  assert.match(document.body.textContent!, /Alle im selben lokalen Netzwerk/);
  assert.match(document.body.textContent!, /Brauche ich ein Konto/);
  assert.equal(document.body.textContent?.match(/Noch keine Installationsdatei verfügbar/g)?.length, 3);
  assert.ok(document.querySelector('a[href="?app=classroom&lang=de"]'));
  await act(async () => root.render(React.createElement('div')));
  // A URL language takes precedence over the saved preference.
  window.history.replaceState({}, '', '?lang=en#quiz-in-rete');
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(LandingPage))));
  assert.equal(document.documentElement.lang, 'en');
  await chooseLanguage('Italiano');
  assert.match(document.body.textContent!, /Tutti sulla stessa LAN/);
  assert.equal(window.location.hash, '#quiz-in-rete');
  await act(async () => root.render(React.createElement('div')));
  window.history.replaceState({}, '', './');
  localStorage.setItem('qurioso_language', 'de');
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(LandingPage))));
  assert.equal(document.documentElement.lang, 'de');


});
