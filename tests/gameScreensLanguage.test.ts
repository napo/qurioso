import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import type { Quiz } from '../src/types/quiz';

// Italian interface words that must not appear on English or German screens.
const ITALIAN = /\b(Partecipa|Inserisci|Scegli|Entra nel|Indirizzo|Domanda|Risposta|Impostazioni|Testo della|Tipo di quiz|Copertina|Carica|Cerca su|Salva|Esci)\b/;

const quiz: Quiz = {
  id: 'language-fixture', title: 'Fixture', description: '', category: 'Test', author: 'Test', createdAt: 1,
  settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: true },
  questions: [{ id: 'q1', text: 'Mars?', type: 'multiple_choice', timeLimit: 20, points: 1000, options: [
    { id: 'a', text: 'Red', isCorrect: true, color: 'red', shape: 'triangle' }, { id: 'b', text: 'Blue', isCorrect: false, color: 'blue', shape: 'diamond' },
  ] }],
};

for (const [language, expected] of [
  ['en', { join: 'Join the quiz', enter: 'Join the quiz!', joinTitle: 'Join from your computer or device', copy: 'Copy address', quizType: 'Quiz type', settings: 'Question Parameters' }],
  ['de', { join: 'Am Quiz teilnehmen', enter: 'Quiz beitreten!', joinTitle: 'Nimm mit deinem Computer oder Gerät teil', copy: 'Adresse kopieren', quizType: 'Quiztyp', settings: 'Frage-Einstellungen' }],
] as const) test(`participant, lobby and editor screens are fully translated in ${language}`, async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: `http://localhost:4000/?lang=${language}` });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => new Response('{}', { status: 404 }),
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { PlayerScreen } = await import('../src/components/player/PlayerScreen');
  const { JoinInstructions } = await import('../src/components/common/JoinInstructions');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const render = async (element: React.ReactElement) => {
    await act(async () => root.render(React.createElement(LanguageProvider, null, element)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  };
  const text = () => document.body.textContent!;

  await render(React.createElement(PlayerScreen, { initialPin: '', onExit() {} }));
  assert.match(text(), new RegExp(expected.join)); assert.match(text(), new RegExp(expected.enter.replace('!', '')));
  assert.doesNotMatch(text(), ITALIAN, 'participant join form: ' + text().match(ITALIAN)?.[0] + ' in ' + text().slice(0, 600));

  await render(React.createElement(JoinInstructions, { pin: '123456', addresses: ['http://10.0.0.4:4000'], address: 'http://10.0.0.4:4000', onAddressChange() {} }));
  assert.match(text(), new RegExp(expected.joinTitle)); assert.ok([...document.querySelectorAll('button')].some(b => b.textContent === expected.copy));
  assert.doesNotMatch(text(), ITALIAN, 'join instructions');

  await render(React.createElement(QuizEditor, { initialQuiz: quiz, categories: [], onSave: async () => {}, onCancel() {} }));
  assert.ok(document.querySelector(`section[aria-label="${expected.quizType}"]`), 'quiz type selector');
  assert.match(text(), new RegExp(expected.settings));
  const labels = [...document.querySelectorAll('[aria-label],[placeholder],[title]')].map(element => ['aria-label', 'placeholder', 'title'].map(name => element.getAttribute(name) || '').join(' ')).join(' ');
  assert.doesNotMatch(text() + ' ' + labels, ITALIAN, 'editor text, labels and placeholders');
});

test('an unsupported browser language falls back to English', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:4000/' });
  Object.defineProperty(dom.window.navigator, 'language', { value: 'fr-FR', configurable: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider, useLanguage } = await import('../src/context/LanguageContext');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const Probe = () => React.createElement('span', null, useLanguage().language);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(Probe))));
  assert.equal(document.body.textContent, 'en');
  assert.equal(document.documentElement.lang, 'en', 'services read the same language from <html lang>');
});
