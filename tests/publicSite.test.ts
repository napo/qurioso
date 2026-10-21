import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

test('the public website presents classroom activities and offers the desktop app instead of network quizzes', async t => {
  const dom = new JSDOM('<meta name="description" /><div id="app"></div>', { url: 'https://qurioso.it/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: string[] = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string) => { requests.push(String(url)); return new Response('{}', { status: 404 }); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { LandingPage } = await import('../src/components/site/LandingPage');
  const { default: App } = await import('../src/App');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const render = (element: React.ReactElement) => act(async () => root.render(React.createElement(LanguageProvider, null, element)));
  const settle = async (busy: RegExp) => { for (let n = 0; n < 40 && busy.test(document.body.textContent || ''); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
  const links = () => [...document.querySelectorAll('a')];

  // Landing: no PIN entry, the classroom activity is one click away from the header and the hero.
  await render(React.createElement(LandingPage));
  assert.equal(links().some(a => a.getAttribute('href')?.includes('role=player')), false, 'a PIN cannot reach the teacher’s computer from the website');
  assert.ok(document.querySelector('nav a[href="?app=classroom&lang=it"]'));
  assert.ok(links().some(a => a.textContent?.includes('Apri Attività in classe') && a.getAttribute('href') === '?app=classroom&lang=it'));
  assert.equal(requests.some(url => !url.startsWith('https://api.github.com/')), false, 'the website never looks for a quiz server');

  // Library (?app=classroom and ?app=network): classroom only, with a compact download box.
  for (const classroomOnly of [true, false]) {
    await render(React.createElement('div'));
    await render(React.createElement(App, { classroomOnly }));
    await settle(/Caricamento quiz/);
    assert.match(document.body.textContent!, /Tipi di vulcani con geopop/);
    assert.equal(document.querySelector('[data-activity-mode="network"]'), null);
    assert.equal(links().some(a => a.getAttribute('href')?.includes('role=player')) || [...document.querySelectorAll('button')].some(b => /PIN/.test(b.textContent || '')), false);
    const box = document.querySelector('[data-device-download]');
    assert.match(box?.textContent || '', /Vuoi che ogni studente risponda dal proprio dispositivo\?/);
    assert.equal(box?.querySelector('a')?.getAttribute('href'), './?lang=it#quiz-in-rete');
    assert.doesNotMatch(document.body.textContent!, /\b(port[ae]?|server|LAN|Cloudflare|WebSocket|tunnel)\b/i);
    // Simplified library: one creation menu, compact cards, credits behind an ⓘ disclosure.
    assert.equal(document.querySelectorAll('button[aria-haspopup="menu"]').length, 1);
    const count = (needle: string) => document.body.textContent!.split(needle).length - 1;
    assert.equal(count('Proietta il quiz e scegli la risposta insieme alla classe'), 1, 'the mode description is not repeated under the library title or on cards');
    assert.equal(count('Qurioso Web'), 1, 'the environment name appears only in the header');
    assert.equal(count('di Maurizio Napolitano'), 0);
    assert.doesNotMatch(document.body.textContent!, /Quiz Live:|Video Quiz:/);
    const credit = document.querySelector('a[href="https://commons.wikimedia.org/wiki/File:Fimmvorduhals_2010_03_27_dawn.jpg"]');
    assert.ok(credit?.closest('details[data-image-credits]'), 'image credits sit in the card disclosure');
    assert.equal(credit!.closest('details')!.querySelector('summary')!.getAttribute('aria-label'), 'Crediti dell’immagine');
    // Compact list (below 640px): play button and "⋯" with secondary actions and credits.
    const volcano = document.querySelector('[data-quiz-id="quiz-1792489106413"]')!;
    assert.ok(volcano.querySelector('button[aria-label="Attività in classe con video"]'));
    const more = volcano.querySelector<HTMLButtonElement>('button[aria-label="Altre azioni"]')!;
    await act(async () => more.click());
    assert.equal(more.getAttribute('aria-expanded'), 'true');
    const panel = document.getElementById(more.getAttribute('aria-controls')!)!;
    assert.deepEqual([...panel.querySelectorAll('button')].map(b => b.textContent), ['Modifica', 'Duplica'], 'included quizzes cannot be deleted');
    assert.match(panel.textContent!, /Crediti dell’immagine.*Boaworm/);
    await act(async () => { more.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert.equal(more.getAttribute('aria-expanded'), 'false');
    // Author credit without a personal e-mail address.
    assert.equal(document.querySelector('footer a[href="https://github.com/napo"]')?.textContent, 'Maurizio Napolitano');
    assert.doesNotMatch(document.body.innerHTML, /gmail|mailto:/);
    assert.equal(requests.some(url => !url.startsWith('https://api.github.com/')), false);
  }

  // A participant opening a join link by hand still gets the explanation.
  await render(React.createElement('div'));
  window.history.replaceState({}, '', '?role=player&pin=123456&lang=it');
  await render(React.createElement(App));
  await settle(/Caricamento quiz/);
  assert.match(document.body.textContent!, /Partecipa a un quiz in rete/);
  assert.match(document.body.textContent!, /Apri il link o inquadra il QR fornito dal docente/);
});
