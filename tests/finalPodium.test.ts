import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import type { Player } from '../src/types/quiz';

test('final podium counts correct answers and accuracy against the real number of questions, also in the CSV export', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:4000/?lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const downloads: string[] = [];
  dom.window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { downloads.push(this.getAttribute('href') || ''); };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { FinalPodium } = await import('../src/components/leaderboard/FinalPodium');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });

  const players: Player[] = [
    { id: 'p0', nickname: 'Cleo', avatar: '🐯', score: 4100, streak: 0, correctAnswersCount: 5, totalTimeTakenMs: 10000 },
    { id: 'p1', nickname: 'Ada', avatar: '🦊', score: 3200, streak: 0, correctAnswersCount: 4, totalTimeTakenMs: 12000 },
    { id: 'p2', nickname: 'Bea', avatar: '🐼', score: 1500, streak: 0, correctAnswersCount: 2, totalTimeTakenMs: 9000 },
  ];
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(FinalPodium, { players, quizTitle: 'Cinque domande', totalQuestions: 5, onExit() {} }))));

  const text = document.body.textContent!;
  assert.match(text, /4\/5/);
  assert.match(text, /4 \/ 5/);
  assert.match(text, /80%/);
  assert.doesNotMatch(text, /\/ ?10\b/);

  await act(async () => [...document.querySelectorAll('button')].find(button => button.title === 'CSV Export')!.click());
  const csv = decodeURI(downloads.at(-1)!);
  assert.match(csv, /"Cleo",4100,5\/5,100%/);
  assert.match(csv, /"Ada",3200,4\/5,80%/);
  assert.match(csv, /"Bea",1500,2\/5,40%/);
});
