import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

test('desktop defaults to the system language (English fallback from Electron) and keeps the native menu in sync', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network' });
  Object.defineProperty(dom.window.navigator, 'language', { value: 'fr-FR', configurable: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const reported: string[] = [];
  (window as any).quriosoDesktop = { serverPort: 1, systemLanguage: 'en', menu: { onCommand: () => () => {}, setLibraryVisible: () => {}, setLanguage: (language: string) => reported.push(language) } };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider, useLanguage } = await import('../src/context/LanguageContext');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  let change: (language: 'it' | 'en' | 'de') => void = () => {};
  const Probe = () => { const { language, setLanguage } = useLanguage(); change = setLanguage; return React.createElement('span', null, language); };
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(Probe))));
  assert.equal(document.body.textContent, 'en', 'an unsupported system language (fr) becomes English on desktop');
  assert.deepEqual(reported, ['en']);
  await act(async () => change('de'));
  assert.equal(document.body.textContent, 'de');
  assert.deepEqual(reported, ['en', 'de'], 'choosing a language in the app relabels the native menu');
});
