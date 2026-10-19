import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import type { GameSession } from '../src/types/quiz';

test('YouTube and Vimeo host adapters pause once per checkpoint and keep playback locked during questions', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:39817' });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, customElements: dom.window.customElements,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  class Media extends dom.window.HTMLElement {
    currentTime = 0; duration = 60; paused = true;
    async play() { this.paused = false; this.dispatchEvent(new dom.window.Event('play')); }
    pause() { if (this.paused) return; this.paused = true; this.dispatchEvent(new dom.window.Event('pause')); }
  }
  dom.window.customElements.define('youtube-video', class extends Media {});
  dom.window.customElements.define('vimeo-video', class extends Media {});
  const { createRoot } = await import('react-dom/client');
  const { HostVideoPlayer } = await import('../src/components/video/HostVideoPlayer');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); });
  for (const [provider, url] of [['youtube', 'https://www.youtube.com/watch?v=M7lc1UVf-VE'], ['vimeo', 'https://vimeo.com/76979871']] as const) {
    const quiz = structuredClone(DEFAULT_QUIZZES[0]); quiz.videoConfig!.videoUrl = url;
    let opened = 0;
    const ref = React.createRef<{ resume: () => Promise<void> }>();
    const render = async (status: GameSession['status']) => act(async () => root.render(React.createElement(HostVideoPlayer, {
      key: provider, ref, quiz, status, openedQuestions: opened,
      onReady() {}, onPlayback() {}, onFinish: async () => true,
      onCheckpoint: async index => { assert.equal(index, opened); opened++; return true; },
    })));
    await render('video');
    for (let n = 0; n < 100 && !document.querySelector(`${provider}-video`); n++) await act(async () => { await delay(20); });
    const media = document.querySelector(`${provider}-video`)! as Media;
    assert.ok(media);
    await act(async () => { media.dispatchEvent(new dom.window.Event('loadedmetadata')); await ref.current!.resume(); });
    assert.equal(media.paused, false);
    await act(async () => {
      media.currentTime = 6;
      media.dispatchEvent(new dom.window.Event('timeupdate'));
      media.dispatchEvent(new dom.window.Event('timeupdate'));
    });
    assert.equal(opened, 1); assert.equal(media.paused, true);
    await render('question');
    await act(async () => media.play());
    assert.equal(media.paused, true, 'teacher cannot resume while the LAN question is open');
    await render('video');
    await act(async () => { media.currentTime = 1; await ref.current!.resume(); });
    await act(async () => { media.currentTime = 6; media.dispatchEvent(new dom.window.Event('timeupdate')); });
    assert.equal(opened, 1, 'backward seek never reopens the answered question');
    assert.equal(media.paused, false);
  }
});
