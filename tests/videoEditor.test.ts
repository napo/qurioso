import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { checkpointProblems, editableVideoQuiz, formatVideoTime, parseVideoTime, prepareVideoQuiz, quizCheckpoints, setQuestionCheckpoint } from '../src/services/videoQuiz';
import { editorDraft, formatAssetSize, inspectVideoAssets, loadQuizzes, storeQuizzes, storeVideo, videoAssetInfo } from '../src/services/quizStorage';
import type { Quiz } from '../src/types/quiz';

function browser(t: any) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:39911/?app=classroom' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  let requests = 0, urls = 0;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, indexedDB: new IDBFactory(),
    customElements: dom.window.customElements, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Editor and preview must not contact multiplayer'); },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => 60 });
  dom.window.HTMLMediaElement.prototype.play = async function () { this.dispatchEvent(new dom.window.Event('play')); };
  dom.window.HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new dom.window.Event('pause')); };
  dom.window.HTMLMediaElement.prototype.load = function () {};
  dom.window.HTMLCanvasElement.prototype.getContext = (() => new Proxy({}, { get: () => () => {} })) as any;
  dom.window.confirm = () => false;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => `blob:editor-${++urls}`; URL.revokeObjectURL = () => {};
  let cleanup = async () => {};
  t.after(async () => { await cleanup(); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  });
  return { dom, requests: () => requests, cleanup(fn: () => Promise<void>) { cleanup = fn; } };
}

test('timeline model preserves legacy timestamps, explicit unassigned questions, stable ties, and rejects incoherent checkpoints', () => {
  const original = structuredClone(DEFAULT_QUIZZES[0]), before = JSON.stringify(original);
  original.questions[0].videoTimestamp = 7;
  const edited = editableVideoQuiz(original);
  assert.equal(quizCheckpoints(edited)[0].timestamp, 7);
  let changed = setQuestionCheckpoint(edited, original.questions[0].id);
  assert.equal(changed.questions.length, original.questions.length);
  assert.equal(quizCheckpoints(changed).some(cp => cp.questionId === original.questions[0].id), false);
  changed = setQuestionCheckpoint(changed, original.questions[0].id, 12);
  assert.deepEqual(quizCheckpoints(changed).slice(0, 2).map(cp => cp.questionId), original.questions.slice(0, 2).map(q => q.id));
  changed = setQuestionCheckpoint(changed, original.questions[0].id, 13);
  assert.equal(quizCheckpoints(changed).filter(cp => cp.questionId === original.questions[0].id).length, 1);
  assert.throws(() => setQuestionCheckpoint(changed, 'missing', 3), /non esiste/);
  for (const timestamp of [-1, NaN, Infinity]) assert.throws(() => setQuestionCheckpoint(changed, original.questions[0].id, timestamp));
  assert.equal(checkpointProblems(changed, 10).length, 1);
  assert.throws(() => prepareVideoQuiz(changed, 10), /durata/);
  assert.doesNotThrow(() => prepareVideoQuiz(changed));
  const invalid = structuredClone(changed); invalid.videoConfig!.checkpoints.push({ questionId: 'missing', timestamp: 3 });
  assert.throws(() => prepareVideoQuiz(editableVideoQuiz(invalid)), /inesistente/);
  const duplicate = structuredClone(changed); duplicate.videoConfig!.checkpoints.push(duplicate.videoConfig!.checkpoints[0]);
  assert.throws(() => prepareVideoQuiz(duplicate), /più checkpoint/);
  assert.equal(formatVideoTime(parseVideoTime('01:02:03.5')), '1:02:03.5');
  assert.equal(parseVideoTime('125:12'), 7512);
  for (const text of ['', '-1:00', 'abc', '00:60', '1:61:00', '1.2:03']) assert.throws(() => parseVideoTime(text));
  assert.equal(formatVideoTime(59.99), '01:00');
  original.questions[0].videoTimestamp = JSON.parse(before).questions[0].videoTimestamp;
  assert.equal(JSON.stringify(original), before, 'editor operations never mutate the source quiz');
});

test('video asset identity, MIME and bytes survive question/timeline edits, draft recovery and saving without Blob copies', async t => {
  browser(t);
  const id = await storeVideo(new Blob(['original-video-bytes'], { type: 'video/webm' }));
  let quiz = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0]));
  quiz.videoConfig = { ...quiz.videoConfig!, videoUrl: '', videoAssetId: id, videoType: 'file', videoFileName: 'lezione.webm' };
  for (let i = 0; i < 8; i++) { quiz = setQuestionCheckpoint(quiz, quiz.questions[0].id, i); await storeQuizzes([quiz]); await editorDraft('write', quiz); }
  const metadata = await videoAssetInfo(id);
  assert.equal(metadata.id, id); assert.equal(metadata.mime, 'video/webm'); assert.equal(metadata.size, 20);
  assert.equal((await inspectVideoAssets()).length, 1); assert.equal((await inspectVideoAssets())[0].referenced, true);
  assert.equal((await loadQuizzes())![0].videoConfig!.videoAssetId, id);
  assert.equal((await editorDraft('read'))!.quiz.videoConfig!.videoAssetId, id);
  const writing = editorDraft('write', quiz); const deleting = editorDraft('delete'); await writing; await deleting;
  assert.equal(await editorDraft('read'), undefined, 'late draft writes cannot resurrect a discarded draft');
  const orphan = await storeVideo(new Blob(['unused'], { type: 'video/mp4' }));
  assert.equal((await inspectVideoAssets()).find(asset => asset.id === orphan)!.referenced, false);
  assert.equal(formatAssetSize(12), '12 B'); assert.equal(formatAssetSize(1500), '1,5 KB'); assert.equal(formatAssetSize(1_500_000), '1,5 MB'); assert.equal(formatAssetSize(1_500_000_000), '1,5 GB');
});

test('real editor captures a timestamp, creates/associates/edits/removes checkpoints, previews ties and restores a draft', { timeout: 15000 }, async t => {
  const env = browser(t), { dom } = env;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  let root = createRoot(document.getElementById('app')!), saved: Quiz | undefined;
  env.cleanup(async () => { await act(async () => root.unmount()); });
  const source = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0]));
  const mount = async () => { await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(QuizEditor, { initialQuiz: source, categories: ['Storia', ' Scienze ', 'Storia', ''], onSave: q => { saved = q; }, onCancel() {} })))); };
  const wait = async (condition: () => unknown, label: string) => {
    for (let n = 0; n < 150; n++) { let ready; await act(async () => { await delay(10); ready = condition(); }); if (ready) return; }
    assert.fail(label + ': ' + document.body.textContent);
  };
  const click = async (text: string) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().endsWith(text)); assert.ok(b, text); assert.equal(b.disabled, false, text); await act(async () => b.click()); };
  const input = async (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
    await act(async () => { const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  };
  await mount(); await wait(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salva Quiz')?.disabled, 'draft ready');
  const title = document.querySelector('input[id]') as HTMLInputElement;
  assert.equal(document.querySelector(`label[for="${title.id}"]`)?.textContent, 'Titolo del quiz');
  await input(title, 'Il mio quiz video');
  const category = document.querySelector('input[list]') as HTMLInputElement;
  const suggestedCategories = [...document.querySelectorAll('datalist option')].map(option => (option as HTMLOptionElement).value);
  assert.ok(suggestedCategories.includes('Storia')); assert.ok(suggestedCategories.includes('Scienze'));
  assert.equal(suggestedCategories.filter(value => value === 'Storia').length, 1);
  await input(category, '  Astronomia  ');
  const cover = document.querySelector('section[aria-label="Copertina del quiz"]')!;
  assert.equal(cover.closest('details')!.open, true, 'video quiz cover is visible without expanding a panel');
  await input(cover.querySelector('input[type="url"]')!, 'https://example.org/copertina.png');
  assert.equal(cover.querySelector('img')!.src, 'https://example.org/copertina.png');
  const video = document.querySelector('video')!;
  await act(async () => { video.currentTime = 8.4; video.dispatchEvent(new dom.window.Event('loadedmetadata')); video.dispatchEvent(new dom.window.Event('timeupdate')); });
  await click('Aggiungi domanda qui'); await click('Crea nuova domanda qui');
  await input(document.querySelector('textarea[aria-label="Testo della domanda"]')!, 'Domanda creata dal video');
  const createdId = (document.querySelector('select[aria-label="Cambia domanda associata"]') as HTMLSelectElement).value;
  assert.equal((document.querySelector('input[aria-label="Tempo del checkpoint"]') as HTMLInputElement).value, '00:08.4');
  await input(document.querySelector('input[aria-label="Tempo del checkpoint"]')!, '00:09'); await click('Applica tempo');
  // Use capture on an existing question: it moves its checkpoint, never duplicates the question.
  await act(async () => { video.currentTime = 9; video.dispatchEvent(new dom.window.Event('timeupdate')); });
  await click('Aggiungi domanda qui'); await input(document.querySelector('select[aria-label="Domanda esistente da associare"]')!, source.questions[0].id); await click('Associa qui');
  await click('Rimuovi checkpoint');
  assert.match(document.querySelector('[aria-label="Domande non associate"]')!.textContent!, /Pianeta Rosso/);
  const createdCheckpoint = [...document.querySelectorAll('[aria-label="Domande in ordine cronologico"] button')].find(b => b.textContent?.includes('Domanda creata dal video'))!;
  await act(async () => (createdCheckpoint as HTMLButtonElement).click());
  await input(document.querySelector('select[aria-label="Cambia domanda associata"]')!, source.questions[0].id);
  assert.match(document.querySelector('[aria-label="Domande non associate"]')!.textContent!, /Domanda creata dal video/);
  await click('Aggiungi domanda qui'); await input(document.querySelector('select[aria-label="Domanda esistente da associare"]')!, createdId); await click('Associa qui');
  await input(document.querySelector('input[aria-label="Sposta checkpoint selezionato"]')!, '9.1');
  assert.equal((document.querySelector('input[aria-label="Tempo del checkpoint"]') as HTMLInputElement).value, '00:09.1');
  await input(document.querySelector('input[aria-label="Sposta checkpoint selezionato"]')!, '9');
  await click('Aggiungi domanda qui'); await input(document.querySelector('select[aria-label="Domanda esistente da associare"]')!, source.questions[0].id); await click('Associa qui');
  await input(document.querySelector('input[aria-label="Tempo del checkpoint"]')!, '02:00'); await click('Applica tempo');
  await click('Salva Quiz'); assert.equal(Boolean(saved), false); assert.match(document.body.textContent!, /superano la durata/);
  await input(document.querySelector('input[aria-label="Tempo del checkpoint"]')!, '00:09'); await click('Applica tempo');
  await click('Salva Quiz'); assert.ok(saved);
  assert.equal(saved.category, 'Astronomia');
  assert.equal(saved.title, 'Il mio quiz video'); assert.equal(saved.coverImage, 'https://example.org/copertina.png');
  assert.equal(saved.videoConfig!.videoTitle, source.videoConfig!.videoTitle, 'quiz title is distinct from video source title');
  assert.equal(saved.questions.length, 4); assert.equal(saved.videoConfig!.checkpointMode, 'explicit');
  await wait(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Prova attività')?.disabled, 'save finished');
  // Preview uses only local classroom state and preserves the mounted editor's draft.
  await click('Prova attività'); assert.match(document.querySelector('h2')!.textContent!, /Il mio quiz video/);
  const preview = document.querySelector('video')!;
  await act(async () => { preview.currentTime = 9; preview.dispatchEvent(new dom.window.Event('loadedmetadata')); preview.dispatchEvent(new dom.window.Event('timeupdate')); });
  await click('Marte'); await click('Continua Video');
  assert.match(document.body.textContent!, /Domanda creata dal video/); // same timestamp, before playback resumes
  const option = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('▲') && b.closest('.grid'))!;
  await act(async () => option.click()); await click('Continua Video');
  await act(async () => preview.dispatchEvent(new dom.window.Event('ended')));
  for (let n = 0; n < 2; n++) { const b = [...document.querySelectorAll('button')].find(b => b.closest('.grid') && !b.disabled)!; await act(async () => b.click()); await click('Continua Video'); }
  assert.match(document.body.textContent!, /Attività conclusa/);
  await click('Torna all’editor'); assert.match(document.body.textContent!, /Domanda creata dal video/);
  await input(document.querySelector('textarea[aria-label="Testo della domanda"]')!, 'Bozza da recuperare');
  assert.equal(env.requests(), 0);
  await act(async () => { await delay(550); });
  assert.ok(await editorDraft('read'));
  const event = new dom.window.Event('beforeunload', { cancelable: true }); dom.window.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
  await act(async () => root.unmount()); root = createRoot(document.getElementById('app')!); await mount();
  await wait(() => document.body.textContent?.includes('Riprendi bozza'), 'draft offer'); await click('Riprendi bozza');
  assert.equal((document.querySelector('input[list]') as HTMLInputElement).value.trim(), 'Astronomia');
  assert.equal((document.querySelector('input[id]') as HTMLInputElement).value, 'Il mio quiz video');
  assert.equal(document.querySelector('section[aria-label="Copertina del quiz"] img')!.getAttribute('src'), 'https://example.org/copertina.png');
  assert.equal((document.querySelector('textarea[aria-label="Testo della domanda"]') as HTMLTextAreaElement).value, 'Bozza da recuperare');
  assert.match(document.querySelector('[aria-label="Domande in ordine cronologico"]')!.textContent!, /Bozza da recuperare/);
  assert.equal(env.requests(), 0);
});

test('YouTube/Vimeo editor adapters capture provider time and explicitly disclose timeline precision limits', { timeout: 10000 }, async t => {
  const env = browser(t), { dom } = env;
  class Media extends dom.window.HTMLElement {
    currentTime = 0; duration = 60;
    async play() { this.dispatchEvent(new dom.window.Event('play')); }
    pause() { this.dispatchEvent(new dom.window.Event('pause')); }
  }
  dom.window.customElements.define('youtube-video', class extends Media {});
  dom.window.customElements.define('vimeo-video', class extends Media {});
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  const root = createRoot(document.getElementById('app')!);
  env.cleanup(async () => { await act(async () => root.unmount()); });
  for (const [provider, url] of [['youtube', 'https://www.youtube.com/watch?v=M7lc1UVf-VE'], ['vimeo', 'https://vimeo.com/76979871']] as const) {
    const quiz = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0])); quiz.videoConfig = { ...quiz.videoConfig!, videoUrl: url, videoType: provider };
    let saved: Quiz | undefined;
    await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(QuizEditor, { key: provider, initialQuiz: quiz, onSave: q => { saved = q; }, onCancel() {} }))));
    for (let n = 0; n < 100 && !document.querySelector(`${provider}-video`); n++) await act(async () => { await delay(10); });
    const media = document.querySelector(`${provider}-video`)! as Media; assert.ok(media);
    await act(async () => { media.currentTime = 17.3; media.dispatchEvent(new dom.window.Event('loadedmetadata')); media.dispatchEvent(new dom.window.Event('timeupdate')); });
    assert.match(document.body.textContent!, /non è una selezione precisa al fotogramma/);
    const click = async (text: string) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!; assert.ok(b); await act(async () => b.click()); };
    await click('Aggiungi domanda qui');
    const select = document.querySelector('select[aria-label="Domanda esistente da associare"]')! as HTMLSelectElement;
    await act(async () => { select.value = quiz.questions[0].id; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await click('Associa qui'); await click('Salva Quiz');
    for (let n = 0; n < 100 && !saved; n++) await act(async () => { await delay(10); });
    assert.equal(saved!.videoConfig!.checkpoints.find(cp => cp.questionId === quiz.questions[0].id)!.timestamp, 17.3);
    assert.equal(saved!.videoConfig!.videoUrl, url);
    await act(async () => { await delay(30); });
  }
  assert.equal(env.requests(), 0);
});

test('missing local video can be relinked without losing questions/checkpoints; reference remains persistent after reopen', { timeout: 10000 }, async t => {
  const env = browser(t), { dom } = env;
  const { createRoot } = await import('react-dom/client'); const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  let root = createRoot(document.getElementById('app')!), saved: Quiz | undefined;
  env.cleanup(async () => { await act(async () => root.unmount()); });
  const quiz = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0]));
  quiz.videoConfig = { ...quiz.videoConfig!, videoUrl: '', videoAssetId: 'missing-local-asset', videoFileName: 'assente.webm', videoType: 'file' };
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(QuizEditor, { initialQuiz: quiz, onSave: async q => { saved = q; await storeQuizzes([q]); }, onCancel() {} }))));
  for (let n = 0; n < 100 && !document.body.textContent?.includes('Video locale non trovato'); n++) await act(async () => { await delay(10); });
  assert.match(document.body.textContent!, /Video locale non trovato/);
  const file = document.querySelector('input[aria-label="Carica video dal computer"]')!;
  Object.defineProperty(file, 'files', { value: [new File(['replacement-video'], 'ritrovato.webm', { type: 'video/webm' })] });
  await act(async () => file.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
  for (let n = 0; n < 100 && !document.querySelector('video')?.src.startsWith('blob:'); n++) await act(async () => { await delay(10); });
  const save = [...document.querySelectorAll('button')].find(b => b.textContent === 'Salva Quiz')!;
  await act(async () => save.click());
  for (let n = 0; n < 100 && !saved; n++) await act(async () => { await delay(10); });
  assert.ok(saved); assert.notEqual(saved.videoConfig!.videoAssetId, 'missing-local-asset'); assert.equal(saved.videoConfig!.videoUrl, '');
  assert.deepEqual(saved.videoConfig!.checkpoints, quiz.videoConfig.checkpoints); assert.equal(saved.questions.length, quiz.questions.length);
  assert.equal((await inspectVideoAssets()).length, 1);
  await act(async () => { await delay(30); await root.unmount(); }); root = createRoot(document.getElementById('app')!);
  const reopened = (await loadQuizzes())![0];
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(QuizEditor, { initialQuiz: reopened, onSave() {}, onCancel() {} }))));
  for (let n = 0; n < 100 && !document.querySelector('video'); n++) await act(async () => { await delay(10); });
  assert.ok(document.querySelector('video')); assert.equal((await inspectVideoAssets()).length, 1);
});

test('classroom preview completes a checkpoint exactly at duration without relying on a later ended event', async t => {
  const env = browser(t), { dom } = env;
  const { createRoot } = await import('react-dom/client'); const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { VideoQuizPlayer } = await import('../src/components/video/VideoQuizPlayer');
  const root = createRoot(document.getElementById('app')!); env.cleanup(async () => { await act(async () => root.unmount()); });
  let quiz = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0])); quiz.questions = quiz.questions.slice(0, 1); quiz.videoConfig!.checkpoints = [];
  quiz = setQuestionCheckpoint(quiz, quiz.questions[0].id, 60);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(VideoQuizPlayer, { quiz, classroom: true, preview: true }))));
  const video = document.querySelector('video')!;
  await act(async () => { video.currentTime = 60; video.dispatchEvent(new dom.window.Event('timeupdate')); });
  const option = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Marte'))!;
  await act(async () => option.click());
  const resume = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Continua Video'))!;
  await act(async () => resume.click());
  assert.match(document.body.textContent!, /Attività conclusa/); assert.equal(env.requests(), 0);
});


test('editor selects exactly one correct answer in classic/video and true/false questions and rejects inconsistent imports', async t => {
  const env = browser(t), { dom } = env;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  const root = createRoot(document.getElementById('app')!);
  env.cleanup(async () => { await act(async () => root.unmount()); });
  for (const mode of ['classic', 'video', 'true_false']) {
    const quiz = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0]));
    quiz.questions = quiz.questions.slice(0, 1);
    if (mode !== 'video') quiz.videoConfig = undefined;
    else quiz.videoConfig!.checkpoints = quiz.videoConfig!.checkpoints.filter(cp => cp.questionId === quiz.questions[0].id);
    if (mode === 'true_false') { quiz.questions[0].type = 'true_false'; quiz.questions[0].options = quiz.questions[0].options.slice(0, 2); }
    // Older/imported quizzes may have several correct answers; require an explicit choice.
    quiz.questions[0].options.forEach(option => { option.isCorrect = true; });
    let saved: Quiz | undefined;
    await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(QuizEditor, { key: mode, initialQuiz: quiz, onSave: async q => { saved = q; await storeQuizzes([q]); }, onCancel() {} }))));
    const save = () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Salva Quiz')!;
    for (let n = 0; n < 100 && save()?.disabled; n++) await act(async () => { await delay(10); });
    await act(async () => save().click());
    assert.equal(Boolean(saved), false); assert.match(document.body.textContent!, /deve avere una sola risposta corretta/);
    const second = document.querySelector('button[aria-label="Risposta 2 corretta"]') as HTMLButtonElement;
    for (let n = 0; n < 2; n++) {
      await act(async () => second.click());
      assert.equal(document.querySelectorAll('button[aria-label$=" corretta"][aria-pressed="true"]').length, 1);
      assert.equal(second.getAttribute('aria-pressed'), 'true', 'clicking again keeps the answer selected');
    }
    await act(async () => save().click());
    for (let n = 0; n < 100 && save().disabled; n++) await act(async () => { await delay(10); });
    assert.ok(saved); assert.equal(saved.questions[0].options.filter(option => option.isCorrect).length, 1);
    assert.equal(saved.questions[0].options[1].isCorrect, true);
    const stored = (await loadQuizzes())![0]; assert.deepEqual(stored.questions[0].options, saved.questions[0].options);
    assert.equal(quiz.questions[0].options.every(option => option.isCorrect), true, 'source is not mutated');
  }
});
