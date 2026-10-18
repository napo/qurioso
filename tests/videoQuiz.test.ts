import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { exportVideoQuiz, nextCheckpoint, prepareVideoQuiz, quizCheckpoints } from '../src/services/videoQuiz';
import { loadVideo, storeVideo, loadQuizzes, storeQuizzes } from '../src/services/quizStorage';

// A controlled media provider exercises the real adapters without network or third-party playback.
test('YouTube and Vimeo quiz checkpoints pause, show feedback, resume, and ignore repeated events', { timeout: 10000 }, async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:39817' });
  dom.window.localStorage.setItem('qurioso_language', 'it');
  const originalFetch = globalThis.fetch;
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, customElements: dom.window.customElements,
    localStorage: dom.window.localStorage, indexedDB: new IDBFactory(),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  class FakeMedia extends dom.window.HTMLElement {
    currentTime = 0; duration = 60; paused = true; muted = false;
    plays = 0; pauses = 0;
    async play() { this.plays++; this.paused = false; this.dispatchEvent(new dom.window.Event('play')); }
    async pause() { this.pauses++; this.paused = true; this.dispatchEvent(new dom.window.Event('pause')); }
  }
  dom.window.customElements.define('youtube-video', class extends FakeMedia {});
  dom.window.customElements.define('vimeo-video', class extends FakeMedia {});
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { VideoQuizPlayer } = await import('../src/components/video/VideoQuizPlayer');
  let root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); globalThis.fetch = originalFetch; });
  const waitFor = async (condition: () => unknown) => {
    for (let count = 0; count < 100; count++) {
      await act(async () => { await delay(20); });
      if (condition()) return;
    }
    assert.fail('Expected media state not reached: ' + document.body.textContent);
  };
  const click = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
    assert.ok(button, text);
    await act(async () => button.click());
  };
  for (const [provider, url] of [['youtube', 'https://www.youtube.com/watch?v=M7lc1UVf-VE'], ['vimeo', 'https://vimeo.com/76979871']] as const) {
    const quiz = structuredClone(DEFAULT_QUIZZES[0]);
    quiz.videoConfig!.videoUrl = url;
    quiz.videoConfig!.videoType = provider;
    await act(async () => root.render(React.createElement(LanguageProvider, null,
      React.createElement(VideoQuizPlayer, { key: provider, quiz }))));
    await waitFor(() => document.querySelector(`${provider}-video`));
    const media = document.querySelector(`${provider}-video`)! as FakeMedia;
    await act(async () => {
      media.dispatchEvent(new dom.window.Event('loadedmetadata'));
      media.currentTime = 5.8;
      media.dispatchEvent(new dom.window.Event('timeupdate'));
      media.dispatchEvent(new dom.window.Event('timeupdate'));
    });
    assert.equal(media.pauses, 1);
    assert.match(document.body.textContent || '', /Pianeta Rosso/);
    await click('Marte');
    assert.match(document.querySelector('[role="status"]')?.textContent || '', /Risposta corretta/);
    assert.match(document.body.textContent || '', /1\/3/);
    await click('Continua Video');
    assert.equal(media.plays, 1);
    assert.equal(media.paused, false);
    await act(async () => {
      media.currentTime = 13.2;
      media.dispatchEvent(new dom.window.Event('timeupdate'));
    });
    assert.equal(media.pauses, 2);
    assert.match(document.body.textContent || '', /velocità/);
    await click('300.000 km/s');
    assert.match(document.body.textContent || '', /2\/3/);
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('app')!);
  }

  // Persist local media as a Blob, and include its bytes in a portable JSON export.
  const assetId = await storeVideo(new Blob(['video-content'], { type: 'video/mp4' }));
  assert.equal(await (await loadVideo(assetId)).text(), 'video-content');
  const localQuiz = structuredClone(DEFAULT_QUIZZES[0]);
  localQuiz.videoConfig = { ...localQuiz.videoConfig!, videoUrl: '', videoType: 'file', videoAssetId: assetId, videoFileName: 'lezione.mp4' };
  await storeQuizzes([localQuiz]);
  assert.equal((await loadQuizzes())![0].videoConfig!.videoAssetId, assetId);
  const originalReader = globalThis.FileReader;
  class Reader {
    result = ''; onload?: () => void;
    async readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
      this.onload?.();
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { value: Reader, configurable: true, writable: true });
  t.after(() => { globalThis.FileReader = originalReader; });
  const exported = await exportVideoQuiz(localQuiz);
  assert.equal(exported.videoConfig!.videoAssetId, undefined);
  assert.equal(exported.videoConfig!.videoUrl, 'data:video/mp4;base64,dmlkZW8tY29udGVudA==');
  assert.deepEqual(JSON.parse(JSON.stringify(exported)).videoConfig, JSON.parse(JSON.stringify(exported.videoConfig)));

  const { QuizEditor } = await import('../src/components/builder/QuizEditor');
  let saved: typeof localQuiz | undefined;
  await act(async () => root.render(React.createElement(LanguageProvider, null,
    React.createElement(QuizEditor, { initialQuiz: DEFAULT_QUIZZES[1], onSave: quiz => { saved = quiz; }, onCancel() {} }))));
  await click('Quiz con video');
  assert.equal(document.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Quiz con video'), true);
  const sourceInput = document.querySelector('section[aria-label="Sorgente video"] input[type="url"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(sourceInput, 'https://youtu.be/M7lc1UVf-VE');
    sourceInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await click('Usa link');
  await click('Salva Quiz');
  assert.equal(saved!.videoConfig!.videoType, 'youtube');
  assert.equal(saved!.videoConfig!.videoUrl, 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
  assert.equal(saved!.videoConfig!.checkpoints.length, saved!.questions.length);
});

test('saved question timestamps override old checkpoints; coarse updates and seeks cannot skip questions', () => {
  const quiz = structuredClone(DEFAULT_QUIZZES[0]);
  quiz.questions[0].videoTimestamp = 7;
  assert.equal(quizCheckpoints(quiz)[0].timestamp, 7);
  assert.equal(prepareVideoQuiz(quiz).videoConfig!.checkpoints[0].timestamp, 7);
  const checkpoints = quizCheckpoints(quiz);
  assert.equal(nextCheckpoint(checkpoints, new Set(), 7.8), 0);
  assert.equal(nextCheckpoint(checkpoints, new Set([0]), 15), 1);
  assert.equal(nextCheckpoint(checkpoints, new Set([0, 1]), 19), -1);
  assert.equal(nextCheckpoint(checkpoints, new Set([0]), 4), -1);
});
