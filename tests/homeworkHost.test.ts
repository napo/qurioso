import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import QRCode from 'qrcode';
import { WebSocket } from 'ws';
import { startLanServer } from './helpers/lanServer';

test('the teacher assigns a library quiz and can reopen its report from the dashboard', { timeout: 30000 }, async t => {
  const { base } = await startLanServer(t);
  const dom = new JSDOM('<div id="app"></div>', { url: `${base}/?app=network&lang=it` });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch, originalCanvas = QRCode.toCanvas;
  const assignmentErrors: string[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), HTMLElement: dom.window.HTMLElement, WebSocket,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string | URL, init?: RequestInit) => {
      const response = await originalFetch(new URL(String(url), base), init);
      if (String(url).includes('/api/assignment/create')) {
        if (!response.ok) assignmentErrors.push(await response.clone().text());
      }
      return response;
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  dom.window.localStorage.setItem('qurioso_language', 'it');
  QRCode.toCanvas = (() => {}) as unknown as typeof QRCode.toCanvas;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: App } = await import('../src/App');
  const { gameSync } = await import('../src/services/gameSync');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => {
    await act(async () => root.unmount());
    gameSync.dispose();
    QRCode.toCanvas = originalCanvas;
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const waitFor = async (condition: () => unknown, label: string) => {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      let done: unknown;
      await act(async () => { await delay(50); done = condition(); });
      if (done) return;
    }
    throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
  };
  const clickText = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === text);
    assert.ok(button, `${text}\n${document.body.textContent}`);
    await act(async () => { button.click(); await delay(50); });
  };

  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App))));
  await waitFor(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Assegna come compito'), 'assignment action in the library');
  const videoQuiz = [...document.querySelectorAll<HTMLElement>('[data-quiz-id]')].find(card => card.textContent?.includes('Viaggio nello Spazio & Scienze'));
  const videoAssign = [...(videoQuiz?.querySelectorAll('button') ?? [])].find(button => button.textContent?.trim() === 'Assegna come compito');
  assert.ok(videoAssign);
  await act(async () => videoAssign.click());
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /quiz video non si possono ancora/);
  await clickText('Annulla');
  const classicQuiz = [...document.querySelectorAll<HTMLElement>('[data-quiz-id]')].find(card => card.textContent?.includes('Cultura Generale & Italia'));
  const assignButton = [...(classicQuiz?.querySelectorAll('button') ?? [])].find(button => button.textContent?.trim() === 'Assegna come compito');
  assert.ok(assignButton, 'classic quizzes have an assignment action');
  await act(async () => assignButton.click());
  assert.ok(document.querySelector('[role="dialog"]'));
  await clickText('Assegna');
  await waitFor(() => document.querySelector('.homework-screen') || assignmentErrors.length > 0, 'teacher homework report or create response');
  assert.ok(document.querySelector('.homework-screen'), `homework creation failed: ${assignmentErrors.join('; ')}`);
  assert.match(document.querySelector('.homework-screen')!.textContent!, /Aperto fino a/);
  await clickText('Torna alla biblioteca');
  await waitFor(() => document.querySelector('[data-assigned-homework]'), 'saved homework on the dashboard');
  await clickText('Apri');
  await waitFor(() => document.querySelector('.homework-screen'), 'reopened teacher report');
});
