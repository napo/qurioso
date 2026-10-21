import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';

test('classroom collects a collective answer, reveals feedback and summarizes without a server', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.org/qurioso/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { throw new Error('Classroom must not contact the server'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { ClassroomScreen } = await import('../src/components/classroom/ClassroomScreen');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const original = DEFAULT_QUIZZES[0];
  let exits = 0;
  const quiz = { ...original, questions: original.questions.slice(0, 2) };
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(ClassroomScreen, { quiz, onExit() { exits++; } }))));
  const buttons = () => [...document.querySelectorAll('button')];
  const answer = (text: string) => buttons().find(b => b.textContent?.endsWith(text) && b.hasAttribute('aria-pressed') && b.getAttribute('aria-keyshortcuts'))!;
  const click = async (label: string) => {
    const button = buttons().find(b => b.textContent === label) ?? answer(label); assert.ok(button, label);
    await act(async () => button.click());
  };
  const press = async (key: string, target: EventTarget = document.body) => act(async () => { target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
  const [first, second] = quiz.questions;
  const rightFirst = first.options.findIndex(o => o.isCorrect), wrongFirst = first.options.findIndex(o => !o.isCorrect);
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.match(document.body.textContent!, /Tastiera: 1–\d o/);
  assert.deepEqual(first.options.map((o, i) => answer(o.text).querySelector('span')!.textContent), first.options.map((_, i) => first.type === 'true_false' ? ['V', 'F'][i] : String.fromCharCode(65 + i)));
  // Selecting does not reveal the solution and the choice can still change.
  await click(first.options[wrongFirst].text);
  assert.equal(answer(first.options[wrongFirst].text).getAttribute('aria-pressed'), 'true');
  assert.equal(document.body.textContent!.includes('Discutiamo la soluzione'), false);
  assert.equal(document.body.textContent!.includes('✓'), false);
  assert.equal(document.activeElement?.textContent, 'Conferma risposta della classe');
  await press(String(rightFirst + 1));
  assert.equal(answer(first.options[rightFirst].text).getAttribute('aria-pressed'), 'true');
  assert.equal(answer(first.options[wrongFirst].text).getAttribute('aria-pressed'), 'false');
  // Escape never leaves the activity; Enter confirms.
  await press('Escape');
  assert.equal(exits, 0);
  await press('Enter');
  assert.match(document.body.textContent!, /Risposta corretta!/);
  assert.equal(document.querySelector('[role="status"][aria-live="polite"]')?.textContent?.includes('Risposta corretta!'), true);
  assert.equal(buttons().filter(b => b.disabled).length, first.options.length);
  assert.equal(document.activeElement?.textContent, 'Prossima domanda');
  await press('ArrowRight');
  assert.match(document.body.textContent!, /Domanda 2 di 2/);
  // Letter shortcut, confirmation button, then the summary.
  const wrongSecond = second.options.findIndex(o => !o.isCorrect);
  await press(answer(second.options[wrongSecond].text).querySelector('span')!.textContent!.toLowerCase());
  assert.equal(answer(second.options[wrongSecond].text).getAttribute('aria-pressed'), 'true');
  await press('Enter', document.activeElement!);
  assert.equal(document.activeElement?.textContent, 'Conferma risposta della classe');
  assert.equal(document.body.textContent!.includes('Discutiamo la soluzione'), false, 'Enter on a focused button is left to its native click, never handled twice');
  await click('Conferma risposta della classe');
  assert.match(document.body.textContent!, /Discutiamo la soluzione/);
  await press(' ');
  assert.match(document.body.textContent!, /Risposte collettive corrette: 1 su 2/);
  await click('Ricomincia');
  assert.match(document.body.textContent!, /Domanda 1 di 2/);
  assert.equal(document.body.textContent!.includes('Risposta corretta!'), false);
});
