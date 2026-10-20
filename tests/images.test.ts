import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import React, { act } from 'react';
import { setTimeout as delay } from 'node:timers/promises';
import { imageFileError, parseCommonsImages } from '../src/services/images';
import { loadQuizzes, storeQuizzes } from '../src/services/quizStorage';
import { portableQuiz } from '../src/services/libraryBackup';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';

const fixture = { query: { pages: { 42: {
  pageid: 42, index: 1, title: 'File:Mars.jpg', imageinfo: [{
    mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/mars.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Mars.jpg',
    extmetadata: { Artist: { value: '<a href="https://example.org">Autore &amp; Team</a>' },
      Attribution: { value: '<b>Foto di Autore &amp; Team, via Wikimedia Commons</b>' },
      Credit: { value: '<a href="https://example.org">Archivio fotografico</a>' },
      LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
  }],
} } } };

test('editor embeds local and Commons images with their credits; storage and JSON retain them', async (t) => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:39817' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const nativeFetch = globalThis.fetch;
  let offline = false;
  const requests: string[] = [];
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, FileReader: dom.window.FileReader,
    DOMParser: dom.window.DOMParser, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    Image: class {
      naturalWidth = 1; naturalHeight = 1; onload?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    },
    fetch: async (input: string | URL) => {
      assert.equal(offline, false, 'saved images and credits must work offline');
      requests.push(String(input));
      return String(input).includes('w/api.php')
        ? { ok: true, json: async () => fixture } as Response
        : { ok: true, blob: async () => new dom.window.Blob(['image'], { type: 'image/jpeg' }) } as Response;
    },
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); globalThis.fetch = nativeFetch; });
  let saved: typeof DEFAULT_QUIZZES[0] | undefined;
  const quiz = structuredClone(DEFAULT_QUIZZES[0]);
  await act(async () => root.render(React.createElement(LanguageProvider, null,
    React.createElement(QuizEditor, { initialQuiz: quiz, onSave: value => { saved = value; }, onCancel() {} }))));
  const waitFor = async (condition: () => unknown) => {
    for (let count = 0; count < 40; count++) {
      await act(async () => { await delay(15); });
      if (condition()) return;
    }
    assert.fail('Editor did not reach expected state: ' + document.body.textContent);
  };
  const questionPicker = document.querySelector('section[aria-label="Immagine della domanda"]')!;
  const fileInput = questionPicker.querySelector('input[type="file"]')!;
  Object.defineProperty(fileInput, 'files', { value: [new dom.window.File([Buffer.from('iVBORw0KGgo=', 'base64')], 'question.png', { type: 'image/png' })] });
  await act(async () => fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
  await waitFor(() => questionPicker.querySelector('img')?.src.startsWith('data:image/png;base64,'));
  const coverPicker = document.querySelector('section[aria-label="Copertina del quiz"]')!;
  const button = [...coverPicker.querySelectorAll('button')].find(b => b.textContent?.includes('Cerca su Commons'))!;
  await act(async () => button.click());
  const search = document.querySelector('[role="dialog"] input[type="search"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, 'Marte');
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Cerca')!.click());
  await waitFor(() => document.body.textContent?.includes('Usa questa immagine'));
  assert.ok(document.body.textContent?.includes('Autore & Team'));
  assert.equal(document.querySelector('script'), null);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Usa questa immagine')!.click());
  await waitFor(() => !document.querySelector('[role="dialog"]'));
  offline = true;
  assert.ok(requests.includes('https://upload.wikimedia.org/mars.jpg'), 'Commons image bytes were downloaded');
  assert.ok(new URL(requests[0]).searchParams.get('iiextmetadatafilter')?.includes('Attribution'));
  assert.match(coverPicker.textContent!, /Attribuzione: Mars.jpg/);
  assert.match(coverPicker.textContent!, /Licenza: CC BY-SA 4.0/);
  assert.match(coverPicker.textContent!, /Foto di Autore & Team, via Wikimedia Commons/);
  assert.match(coverPicker.textContent!, /Crediti: Archivio fotografico/);
  assert.equal(coverPicker.querySelector('b'), null, 'Commons HTML is rendered as plain text');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Salva Quiz'))!.click());
  assert.ok(saved);
  assert.match(saved.questions[0].mediaUrl!, /^data:image\/png;base64,/);
  assert.match(saved.coverImage!, /^data:image\/jpeg;base64,/);
  assert.equal(saved.coverAttribution?.creator, 'Autore & Team');
  assert.equal(saved.coverAttribution?.license, 'CC BY-SA 4.0');
  assert.equal(saved.coverAttribution?.attributionText, 'Foto di Autore & Team, via Wikimedia Commons');
  assert.equal(saved.coverAttribution?.credit, 'Archivio fotografico');
  assert.deepEqual(JSON.parse(JSON.stringify(portableQuiz(saved))).coverAttribution, JSON.parse(JSON.stringify(saved.coverAttribution)), 'backup whitelist retains all attribution fields');
  assert.deepEqual(JSON.parse(JSON.stringify(saved)).coverAttribution, saved.coverAttribution);

  // Migrates the existing library without deleting the legacy backup.
  localStorage.setItem('qurioso_quizzes', JSON.stringify([quiz]));
  assert.equal((await loadQuizzes())![0].id, quiz.id);
  assert.ok(localStorage.getItem('qurioso_quizzes'));
  await storeQuizzes([saved]);
  const restored = (await loadQuizzes())![0];
  assert.equal(restored.coverImage, saved.coverImage, 'offline cover bytes survive storage');
  assert.equal(restored.questions[0].mediaUrl, saved.questions[0].mediaUrl);
  assert.deepEqual(restored.coverAttribution, saved.coverAttribution);

  assert.ok(imageFileError({ type: 'application/pdf', size: 100 }));
  assert.ok(imageFileError({ type: 'image/png', size: 16 * 1024 * 1024 }));
  assert.equal(imageFileError({ type: 'image/jpeg', size: 2000 }), null);
  const uncredited = structuredClone(fixture);
  uncredited.query.pages[42].imageinfo[0].extmetadata.Artist.value = '';
  uncredited.query.pages[42].imageinfo[0].extmetadata.Credit.value = '';
  assert.deepEqual(parseCommonsImages(uncredited), []);
  await waitFor(() => ![...document.querySelectorAll('button')].find(b => b.textContent?.includes('Salva Quiz'))?.disabled);
});
