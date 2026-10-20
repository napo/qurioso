import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { guideLessons, tutorialIds } from '../src/i18n/guide';

test('the tutorial guide is complete in all languages, supports direct links and browser history, and never starts a service', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://qurioso.it/?app=guide&topic=video&step=3&lang=en' });
  const saved = new Map<string, PropertyDescriptor | undefined>(); let requests = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Opening the manual must not contact a server or download a component'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { TutorialGuide, readGuideLocation } = await import('../src/components/guide/TutorialGuide');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const mount = async (url: string) => {
    window.history.replaceState({}, '', url);
    await act(async () => root.render(React.createElement(LanguageProvider, { key: url, children: React.createElement(TutorialGuide) })));
  };
  const click = async (text: string) => { const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text); assert.ok(button, text); await act(async () => button.click()); };
  await mount('/?app=guide&topic=video&step=3&lang=en');
  assert.equal(document.querySelector('[data-guide-step] h3')!.textContent, 'Attach a checkpoint');
  assert.equal(document.querySelector('progress')!.value, 3);
  await click('Next');
  assert.equal(new URL(window.location.href).searchParams.get('step'), '4');
  assert.equal(document.querySelector('[data-guide-step] h3')!.textContent, 'Check order and source');
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
  await act(async () => document.querySelector<HTMLButtonElement>('button[lang="de"]')!.click());
  assert.equal(document.querySelector('h1')!.textContent, 'Schritt-für-Schritt-Anleitung');
  assert.equal(document.querySelector('[data-guide-step] h3')!.textContent, 'Reihenfolge und Quelle prüfen');
  assert.equal(document.querySelector('progress')!.value, 4);
  await click('Zurück'); assert.equal(new URL(window.location.href).searchParams.get('step'), '3');
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.equal(document.querySelector('progress')!.value, 4, 'browser back restores the previous tutorial position');
  for (const [language, heading] of [['it', 'Guida passo passo'], ['en', 'Step-by-step guide'], ['de', 'Schritt-für-Schritt-Anleitung']] as const) {
    await mount(`/?app=guide&topic=internet&step=2&lang=${language}`);
    assert.equal(document.querySelector('h1')!.textContent, heading);
    assert.equal(document.querySelector('[aria-current="page"]')!.textContent!.slice(2), guideLessons[language].internet.title);
    assert.equal(document.querySelector('[data-guide-step] h3')!.textContent, guideLessons[language].internet.steps[1].title);
    assert.ok(document.querySelector('a[href="https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/"]'));
    assert.ok(document.querySelector('a[href="https://www.cloudflare.com/privacypolicy/"]'));
    assert.ok(document.querySelector('a[href="https://www.cloudflarestatus.com/"]'));
    for (const id of tutorialIds) {
      const lesson = guideLessons[language][id];
      assert.ok(lesson.title && lesson.summary && lesson.needs);
      assert.equal(lesson.steps.length, guideLessons.it[id].steps.length, 'all languages retain the same tutorial steps');
      assert.ok(lesson.steps.every(s => s.title && s.body));
    }
  }
  await mount('/?app=guide&topic=unknown&step=-999&lang=it');
  assert.deepEqual(readGuideLocation(), { topic: 'start', step: 0 });
  await click('Avanti');
  assert.ok(document.querySelector('a[href="./?lang=it#quiz-in-rete"]'), 'the desktop prerequisite points to executable downloads');
  assert.equal(requests, 0);
});
