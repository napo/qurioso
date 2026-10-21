import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('a broken image is replaced by the placeholder and retried when the source changes', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.org/qurioso/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const { FallbackImage } = await import('../src/components/common/FallbackImage');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  const render = (src: string) => act(async () => root.render(React.createElement(FallbackImage, { src, alt: 'Copertina', placeholderClassName: 'h-48' })));
  await render('quizzes/covers/missing.webp');
  await act(async () => { document.querySelector('img')!.dispatchEvent(new dom.window.Event('error')); });
  assert.equal(document.querySelector('img'), null);
  assert.equal(document.querySelector('[role="img"]')?.getAttribute('aria-label'), 'Copertina');
  assert.equal(document.body.textContent, '', 'alt text is never shown');
  await render('quizzes/covers/earth.webp');
  assert.equal(document.querySelector('img')?.getAttribute('src'), 'quizzes/covers/earth.webp');
});
