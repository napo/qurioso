import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import type { Quiz } from '../src/types/quiz';
import { loadQuizzes, onLibraryChangedElsewhere, storeQuizzes } from '../src/services/quizStorage';
import { readSyncMeta, writeSyncMeta } from '../src/services/cloudSync/archive';
import { CloudSyncController } from '../src/services/cloudSync/controller';
import { SyncFileError, readSyncFile, writeSyncFile } from '../src/services/cloudSync/file';
import { StorageError, type CloudStorage, type SyncAuth } from '../src/services/cloudSync/types';
import type { CloudProvider } from '../src/services/cloudSync/providers';
const require = createRequire(import.meta.url);
const { createCloudAuth } = require('../desktop/cloudAuth.cjs');

beforeEach(() => { Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true }); });
const quiz = (id: string, title = id): Quiz => { const q = structuredClone(DEFAULT_QUIZZES.find(item => !item.videoConfig)!); delete q.coverImage; delete q.coverAttribution; return { ...q, id, title, createdAt: 1000 }; };

function fakeProvider(overrides: Partial<CloudStorage> = {}, token: string | null = 'token') {
  const calls = { signOut: 0, trashed: [] as string[], tokens: [] as boolean[] };
  let bytes: Uint8Array | null = null, revision = 0;
  const storage: CloudStorage = {
    findArchive: async () => bytes ? { id: 'file', version: String(revision) } : null,
    version: async () => bytes ? String(revision) : null,
    download: async () => bytes!,
    create: async data => { bytes = data; revision++; return { id: 'file', version: String(revision) }; },
    update: async (_id, data) => { bytes = data; revision++; return { id: 'file', version: String(revision) }; },
    trash: async id => { calls.trashed.push(id); },
    ...overrides,
  };
  const auth: SyncAuth = { token: async interactive => { calls.tokens.push(interactive); return token; }, invalidate() {}, signOut: async () => { calls.signOut++; } };
  const provider: CloudProvider = { id: 'dropbox', label: 'Dropbox', storage: () => storage, createAuth: () => auth };
  return { provider, calls, file: () => bytes, put(data: Uint8Array) { bytes = data; revision++; } };
}

test('controller: nothing runs until a service is connected, then it syncs, reports received quizzes and disconnects keeping them', async t => {
  const { provider, calls, file, put } = fakeProvider();
  const controller = new CloudSyncController(async () => [provider], '1.3.3');
  t.after(() => controller.dispose());
  await controller.init();
  assert.equal(controller.status.state, 'off');
  assert.deepEqual(calls.tokens, []);
  await storeQuizzes([quiz('a')]);
  assert.equal(file(), null, 'a save alone contacts nothing');
  let received = 0;
  controller.onReceived(() => { received++; });
  assert.equal(await controller.connect(provider), true);
  assert.equal(controller.status.provider, 'dropbox');
  assert.ok(calls.tokens.every(Boolean));
  assert.deepEqual(readSyncFile(file()!).quizzes.map(r => r.id), ['a']);
  assert.ok(controller.status.lastSyncedAt);
  assert.equal(received, 0);
  put(writeSyncFile({ quizzes: [...readSyncFile(file()!).quizzes, { id: 'b', updatedAt: 5000, quiz: quiz('b') }], deletions: [] }, '1.3.3'));
  await controller.syncNow();
  assert.equal(received, 1);
  assert.deepEqual((await loadQuizzes())!.map(q => q.id).sort(), ['a', 'b']);
  assert.equal((await readSyncMeta()).provider, 'dropbox', 'the choice survives a sync');
  await controller.disconnect(true);
  assert.deepEqual(calls.trashed, ['file']);
  assert.equal(calls.signOut, 1);
  assert.equal(controller.status.state, 'off');
  assert.deepEqual(await readSyncMeta(), {});
  assert.deepEqual((await loadQuizzes())!.map(q => q.id).sort(), ['a', 'b']);
});

test('controller: a later session resumes without showing a sign-in, and problems are reported without losing quizzes', async t => {
  const { provider, calls } = fakeProvider();
  await writeSyncMeta({ provider: 'dropbox' });
  await storeQuizzes([quiz('a')]);
  const resumed = new CloudSyncController(async () => [provider], '1.3.3');
  t.after(() => resumed.dispose());
  await resumed.init();
  assert.equal(resumed.status.provider, 'dropbox');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(calls.tokens, [false]);
  resumed.dispose();

  const gone = new CloudSyncController(async () => [], '1.3.3');
  await gone.init();
  assert.equal(gone.status.state, 'off', 'a service no longer offered stays quiet');

  const paused = fakeProvider({}, null);
  const cancelled = new CloudSyncController(async () => [paused.provider], '1.3.3');
  assert.equal(await cancelled.connect(paused.provider), false);
  assert.equal(cancelled.status.problem, 'sign-in');
  assert.equal(cancelled.status.provider, null);

  for (const [error, problem] of [[new StorageError(403), 'storage'], [new TypeError('network'), 'offline'], [new SyncFileError('syncVersion'), 'file'], [new SyncFileError('syncTooLarge'), 'too-large']] as const) {
    const failing = fakeProvider({ findArchive: async () => { throw error; } });
    const controller = new CloudSyncController(async () => [failing.provider], '1.3.3');
    await controller.connect(failing.provider);
    assert.equal(controller.status.state, 'error');
    assert.equal(controller.status.problem, problem);
    controller.dispose();
  }
  assert.deepEqual((await loadQuizzes())!.map(q => q.id), ['a']);
});

test('another tab hears about a saved library', async t => {
  const heard = new Promise<void>(resolve => { const stop = onLibraryChangedElsewhere(() => { stop(); resolve(); }); });
  await storeQuizzes([quiz('a')]);
  await Promise.race([heard, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('not announced')), 2000); t.after(() => clearTimeout(timer)); })]);
});

async function withPage(t: test.TestContext, url: string, desktop?: unknown) {
  const dom = new JSDOM('<div id="app"></div>', { url });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  if (desktop) Object.defineProperty(dom.window, 'quriosoDesktop', { value: desktop });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { CloudSyncCard } = await import('../src/components/data/CloudSyncCard');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; } });
  await act(async () => { root.render(React.createElement(LanguageProvider, null, React.createElement(CloudSyncCard))); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
}

test('the card stays hidden while no service is configured, on the site and on the desktop', async t => {
  await withPage(t, 'https://qurioso.it/?lang=it', { cloud: { providers: async () => [] } });
  assert.equal(document.querySelector('[data-cloud-sync]'), null);
});

test('the card explains what travels and offers only configured services, in the chosen language', async t => {
  await withPage(t, 'http://qurioso.localhost/?lang=it', { cloud: { providers: async () => ['onedrive', 'nonsense'] } });
  const card = document.querySelector('[data-cloud-sync]');
  assert.ok(card);
  assert.match(card.textContent!, /Non si sincronizzano i file video locali/);
  assert.deepEqual([...card.querySelectorAll('button')].map(b => b.textContent), ['Collega OneDrive']);
  const icon = card.querySelector('button svg');
  assert.equal(icon?.getAttribute('data-cloud-icon'), 'onedrive');
  assert.equal(icon?.getAttribute('aria-hidden'), 'true');
});

test('the web version offers nothing on an address the sign-in cannot return to', async t => {
  await withPage(t, 'https://napo.github.io/qurioso/?lang=it');
  assert.equal(document.querySelector('[data-cloud-sync]'), null);
});

test('the sign-in return page survives the service worker and hands over the code on its own channel', async () => {
  assert.match(await readFile('vite.config.ts', 'utf8'), /navigateFallbackDenylist: \[\/oauth-callback/);
  const page = await readFile('public/oauth-callback.html', 'utf8');
  assert.match(page, /new BroadcastChannel\('qurioso-oauth'\)/);
  assert.match(page, /no-referrer/);
  assert.match(page, /history\.replaceState/);
  assert.match(await readFile('src/services/cloudSync/webAuth.ts', 'utf8'), /const CHANNEL = 'qurioso-oauth'/);
});

const clients = { 'google-drive': 'google-id', dropbox: 'dropbox-id', onedrive: 'onedrive-id' };
const encryption = (available = true) => ({
  isEncryptionAvailable: () => available, getSelectedStorageBackend: () => available ? 'gnome_libsecret' : 'basic_text',
  encryptString: (text: string) => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`),
  decryptString: (data: Buffer) => { const text = data.toString(); assert.ok(text.startsWith('enc:')); return Buffer.from(text.slice(4), 'base64').toString(); },
});
async function desktop(t: test.TestContext, options: Record<string, unknown> = {}, callback = (url: URL) => `${url.searchParams.get('redirect_uri')}?code=the-code&state=${url.searchParams.get('state')}`) {
  const directory = await mkdtemp(path.join(tmpdir(), 'qurioso-cloud-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const requests: { url: string; body: URLSearchParams }[] = [], opened: URL[] = [];
  let pages: Response[] = [];
  const make = (extra: Record<string, unknown> = {}) => createCloudAuth({
    directory, safeStorage: encryption(), clients, googleSecret: 'secret',
    fetchImpl: async (url: string, init: RequestInit) => { requests.push({ url, body: new URLSearchParams(String(init.body ?? '')) }); return Response.json({ access_token: `access-${requests.length}`, refresh_token: 'refresh-token', expires_in: 3600 }); },
    openBrowser: async (href: string) => { const url = new URL(href); opened.push(url); pages.push(await fetch(`${url.searchParams.get('redirect_uri')}?state=forged&code=stolen`)); pages.push(await fetch(callback(url))); },
    ...options, ...extra,
  });
  return { make, requests, opened, directory, pages };
}

test('desktop sign-in: browser and loopback, PKCE, forged returns ignored, refresh token encrypted and never handed out', async t => {
  const { make, requests, opened, directory, pages } = await desktop(t);
  const auth = make();
  assert.deepEqual(auth.providers(), ['google-drive', 'dropbox', 'onedrive']);
  assert.equal(await auth.token('google-drive', false), null);
  assert.equal(opened.length, 0, 'a background sync never opens the browser');
  const token = await auth.token('google-drive', true);
  assert.equal(token, 'access-1');
  assert.equal(pages[0].status, 404, 'a request without the state of this sign-in is ignored');
  assert.equal(pages[1].status, 200);
  assert.equal((await pages[1].text()).includes('the-code'), false);
  const url = opened[0];
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.match(url.searchParams.get('redirect_uri')!, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(requests[0].body.get('code'), 'the-code');
  assert.ok(requests[0].body.get('code_verifier'));
  assert.equal(requests[0].body.get('client_secret'), 'secret');
  await assert.rejects(fetch(url.searchParams.get('redirect_uri')!), 'the listener is closed after use');
  assert.equal(await auth.token('google-drive', false), 'access-1', 'the access token is cached');
  const onDisk = await readFile(path.join(directory, 'cloud-auth.bin'));
  assert.equal(onDisk.includes('refresh-token'), false);
  if (process.platform !== 'win32') assert.equal((await stat(path.join(directory, 'cloud-auth.bin'))).mode & 0o077, 0);
  assert.equal(await make().token('google-drive', false), 'access-2', 'a later session renews silently');
  assert.equal(requests[1].body.get('grant_type'), 'refresh_token');
});

test('desktop sign-in: each service gets its registered address, refusals and timeouts fail, sign-out forgets', async t => {
  const { make, opened, requests } = await desktop(t);
  const auth = make();
  await auth.token('dropbox', true);
  assert.equal(opened.at(-1)!.searchParams.get('redirect_uri'), 'http://localhost:53682/');
  assert.equal(opened.at(-1)!.searchParams.get('token_access_type'), 'offline');
  await auth.token('onedrive', true);
  assert.match(opened.at(-1)!.searchParams.get('redirect_uri')!, /^http:\/\/localhost:\d+$/);
  assert.equal(requests.at(-1)!.body.has('client_secret'), false);
  await auth.signOut('dropbox');
  assert.ok(requests.at(-1)!.url.includes('/auth/token/revoke'));
  assert.equal(await auth.token('dropbox', false), null);
  assert.equal(await auth.token('onedrive', false) !== null, true, 'other services are untouched');
  await assert.rejects(auth.token('../evil', true), /unavailable/);
  await assert.rejects(auth.token('toString', true), /unavailable/);

  const refused = await desktop(t, {}, url => `${url.searchParams.get('redirect_uri')}?error=access_denied&state=${url.searchParams.get('state')}`);
  await assert.rejects(refused.make().token('onedrive', true), /refused/);
  const rejected = await desktop(t, { fetchImpl: async () => Response.json({ error: 'invalid_request', error_description: 'AADSTS9002327: redirect mismatch' }, { status: 400 }) });
  await assert.rejects(rejected.make().token('onedrive', true), (error: Error) => error.message === 'sign-in rejected by onedrive: invalid_request - AADSTS9002327: redirect mismatch' && !error.message.includes('the-code'));
  const silent = await desktop(t, { timeoutMs: 20, openBrowser: async () => {} });
  await assert.rejects(silent.make().token('onedrive', true), /timeout/);
});

test('desktop sign-in: no keyring means nothing on disk, and no client means no service', async t => {
  const { make, directory } = await desktop(t, { safeStorage: encryption(false) });
  const auth = make();
  assert.equal(await auth.token('dropbox', true), 'access-1');
  await assert.rejects(stat(path.join(directory, 'cloud-auth.bin')));
  assert.equal(await make().token('dropbox', false), null);
  const unconfigured = await desktop(t, { clients: { 'google-drive': 'id', dropbox: '', onedrive: '' }, googleSecret: '' });
  assert.deepEqual(unconfigured.make().providers(), []);
  const registered = createCloudAuth({ directory, safeStorage: encryption(), openBrowser: async () => {} }).providers();
  assert.ok(registered.includes('dropbox') && registered.includes('onedrive'), 'the services registered in this repository are offered');
  assert.deepEqual(createCloudAuth({ directory, safeStorage: encryption(), openBrowser: async () => {}, googleSecret: '' }).providers(), ['dropbox', 'onedrive'], 'Google needs its secret too');
});
