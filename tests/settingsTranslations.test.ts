import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

test('settings, runtime notices and web installation work in every supported language', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://qurioso.it/?app=network&lang=it' });
  Object.defineProperty(dom.window.navigator, 'userAgent', { value: 'iPhone Safari', configurable: true });
  const saved = new Map<string, PropertyDescriptor | undefined>(); let requests = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('A public-site translation must not activate a server or download'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { LanguageSelector } = await import('../src/components/common/LanguageSelector');
  const { default: App } = await import('../src/App');
  const { PWAInstallButton } = await import('../src/components/common/PWAInstallButton');
  const { importText } = await import('../src/i18n/questionImport');
  const { backupError } = await import('../src/i18n/libraryBackup');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  const click = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
    assert.ok(button, `Missing localized button: ${text}`); await act(async () => button.click());
  };
  const mount = async (language: string, key: string, child: React.ReactNode, role = '') => {
    window.history.replaceState({}, '', `/?app=network&lang=${language}${role}`);
    await act(async () => root.render(React.createElement(LanguageProvider, { key, children: child })));
    for (let n = 0; n < 100 && !document.querySelector('[data-qurioso-dashboard], [data-internet-setup], main'); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  };
  const cases = [
    { language: 'it', settings: 'Impostazioni', download: 'Scarica Qurioso', title: 'Qurioso Web', data: 'Esporta backup', setup: 'Come vuoi usare i quiz in rete?', enable: 'Preferisci accesso Internet', error: 'Impossibile salvare la preferenza', ios: 'Versione web su iOS', iosTitle: 'Installa su iPhone / iPad', step: 'Aggiungi alla schermata Home', join: 'Il solo PIN su qurioso.it' },
    { language: 'en', settings: 'Settings', download: 'Download Qurioso', title: 'Qurioso Web', data: 'Export backup', setup: 'How would you like to run network quizzes?', enable: 'Prefer Internet access', error: 'Cannot save your preference', ios: 'Web version on iOS', iosTitle: 'Install on iPhone / iPad', step: 'Add to Home Screen', join: 'A PIN alone on qurioso.it' },
    { language: 'de', settings: 'Einstellungen', download: 'Qurioso für Netzwerkquiz herunterladen', title: 'Qurioso Web', data: 'Backup exportieren', setup: 'Wie möchtest du Netzwerkquiz nutzen?', enable: 'Internetzugang bevorzugen', error: 'Die Einstellung kann auf diesem Gerät nicht gespeichert werden', ios: 'Webversion unter iOS', iosTitle: 'Auf iPhone / iPad installieren', step: 'Zum Home-Bildschirm', join: 'Eine PIN allein auf qurioso.it' },
  ];
  for (const c of cases) {
    await mount(c.language, `website-${c.language}`, React.createElement(App));
    assert.equal(document.documentElement.lang, c.language);
    assert.ok(document.body.textContent!.includes(c.title));
    assert.ok([...document.querySelectorAll('a')].some(a => a.textContent!.startsWith(c.download) && a.href.includes(`lang=${c.language}`)));
    await act(async () => document.querySelector<HTMLButtonElement>(`button[aria-label="${c.settings}"]`)!.click());
    assert.equal(document.querySelector('h1')!.textContent, c.settings);
    assert.ok([...document.querySelectorAll('button')].some(b => b.textContent === c.data));
    const language = c.language as 'it' | 'en' | 'de';
    await click(importText(language, 'importQuestions'));
    assert.ok(document.querySelector('.question-import-dialog'));
    assert.ok(document.body.textContent!.includes(importText(language, 'chooseFile')));
    await click(importText(language, 'cancel'));
    assert.ok(document.querySelector('button[aria-expanded]'), 'language selector is available inside Settings');
    if (c.language === 'en') {
      await act(async () => document.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
      await act(async () => document.querySelector<HTMLButtonElement>('button[lang="de"]')!.click());
      assert.equal(document.querySelector('h1')!.textContent, 'Einstellungen');
      assert.ok(document.body.textContent!.includes('Webversion · qurioso.it'), 'parent runtime text also updates immediately');
    }
    await mount(c.language, `join-${c.language}`, React.createElement(App), '&role=player&pin=123456');
    assert.ok(document.body.textContent!.includes(c.join));
    await mount(c.language, `install-${c.language}`, React.createElement(React.Fragment, null,
      React.createElement(PWAInstallButton), React.createElement(LanguageSelector)));
    await click(c.ios);
    assert.equal(document.querySelector('h3')!.textContent!.trim(), c.iosTitle);
    assert.ok(document.body.textContent!.includes(c.step));
  }
  assert.equal(importText('de', 'invalidText', { field: 'optionA', max: 500 }), 'Antwort A: Nicht leerer Text erforderlich (höchstens 500 Zeichen).');
  assert.equal(importText('de', 'totals', { total: 8, valid: 6, errors: 2, duplicates: 1 }), '8 Datensätze · 6 gültig · 2 mit Fehlern · 1 mögliche Duplikate');
  assert.equal(backupError('de', new Error('backupMissing')), 'Eine angegebene Mediendatei fehlt oder hat die falsche Größe.');
  assert.equal(requests, 0, 'translating and configuring the interface never downloads or exposes a server');
});
