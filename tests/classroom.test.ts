import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';

test('classroom collects a collective answer, reveals feedback and summarizes without a server', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.org/qurioso/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { throw new Error('Classroom must not contact the server'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { ClassroomScreen } = await import('../src/components/classroom/ClassroomScreen');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const original = DEFAULT_QUIZZES[0];
  const quiz = { ...original, questions: original.questions.slice(0, 2) };
  await act(async () => root.render(React.createElement(ClassroomScreen, { quiz, onExit() {} })));
  const click = async (label: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === label); assert.ok(button, label);
    await act(async () => button.click());
  };
  assert.match(document.body.textContent!, /senza limite di tempo/);
  assert.equal(document.body.textContent!.includes('Prossima domanda'), false);
  await click(quiz.questions[0].options.find(o => o.isCorrect)!.text);
  assert.match(document.body.textContent!, /Risposta corretta!/);
  assert.equal([...document.querySelectorAll('button')].filter(b => b.disabled).length, quiz.questions[0].options.length);
  await click('Prossima domanda');
  await click(quiz.questions[1].options.find(o => !o.isCorrect)!.text);
  await click('Mostra riepilogo');
  assert.match(document.body.textContent!, /Risposte collettive corrette: 1 su 2/);
  await click('Ricomincia');
  assert.match(document.body.textContent!, /Domanda 1 di 2/);
  assert.equal(document.body.textContent!.includes('Risposta corretta!'), false);
});
