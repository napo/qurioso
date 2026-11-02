import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';

// WCAG 2.1 relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('the page lets people zoom', () => {
  const viewport = /<meta name="viewport" content="([^"]+)"/.exec(fs.readFileSync('index.html', 'utf8'))?.[1] || '';
  assert.match(viewport, /width=device-width/);
  assert.doesNotMatch(viewport, /user-scalable=no|maximum-scale/);
});

test('text colours of the theme reach WCAG AA contrast', () => {
  const css = fs.readFileSync('src/index.css', 'utf8');
  const token = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];
  const white = '#ffffff', selected = '#cddfe0'; // bg-petrolio/20 on white: the selected question in the editor
  for (const [text, background, minimum] of [
    ['ink', white, 4.5], ['muted', white, 4.5], ['muted', 'surface-soft', 4.5], ['muted', 'surface-hover', 4.5],
    ['petrolio', white, 4.5], ['accent-ink', white, 4.5], ['ink', selected, 4.5],
  ] as const) {
    const ratio = contrast(token(text), background.startsWith('#') ? background : token(background));
    assert.ok(ratio >= minimum, `${text} on ${background}: ${ratio.toFixed(2)}:1`);
  }
  // Mandarino is a fill colour: it is too light for text on white.
  assert.ok(contrast(token('mandarino'), white) < 3);
});

test('every control of the classroom video player has a name in each language', { timeout: 10000 }, async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:39818' });
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, customElements: dom.window.customElements,
    localStorage: dom.window.localStorage, indexedDB: new IDBFactory(),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  dom.window.customElements.define('youtube-video', class extends dom.window.HTMLElement { currentTime = 0; duration = 60; paused = true; muted = false; async play() {} async pause() {} });
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { VideoQuizPlayer } = await import('../src/components/video/VideoQuizPlayer');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); });
  const quiz = structuredClone(DEFAULT_QUIZZES[0]);
  quiz.videoConfig!.videoUrl = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';
  quiz.videoConfig!.videoType = 'youtube';
  for (const language of ['it', 'en', 'de']) {
    dom.window.localStorage.setItem('qurioso_language', language);
    await act(async () => root.render(React.createElement(LanguageProvider, { key: language, children: null },
      React.createElement(VideoQuizPlayer, { quiz, classroom: true }))));
    for (let n = 0; n < 50 && !document.querySelector('youtube-video'); n++) await act(async () => { await delay(20); });
    const buttons = [...document.querySelectorAll('button')];
    assert.ok(buttons.length >= 3);
    const unnamed = buttons.filter(button => !button.getAttribute('aria-label')?.trim() && !button.textContent?.trim());
    assert.deepEqual(unnamed.map(button => button.outerHTML.slice(0, 120)), [], language);
  }
});
