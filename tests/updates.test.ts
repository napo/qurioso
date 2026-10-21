import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const u = require('../desktop/updates.cjs');
const { createUpdateController } = require('../desktop/updateController.cjs');
const { MENU_TEXT, menuLanguage } = require('../desktop/menuText.cjs');
const bytes = Buffer.from('test installer bytes: never executed');
const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const asset = (name = 'Qurioso-1.1.0-win-x64.exe', tag = 'v1.1.0') => ({ name, size: bytes.length, digest, browser_download_url: `https://github.com/napo/qurioso/releases/download/${tag}/${name}` });
const release = { tag_name: 'v1.1.0', prerelease: false, draft: false, assets: [asset()] };

test('update versions use SemVer ordering, never downgrade and keep stable/beta channels separate', () => {
  for (const [a, b] of [['v1.1.0', '1.0.9'], ['1.0.0', '1.0.0-beta.99'], ['1.0.0-beta.10', '1.0.0-beta.2'], ['1.0.0-beta.a', '1.0.0-beta.10'], ['1.0.0-beta.1', '1.0.0-beta']]) {
    assert.equal(u.compareVersions(a, b), 1); assert.equal(u.compareVersions(b, a), -1);
  }
  assert.equal(u.compareVersions('1.0.0+new', 'v1.0.0+old'), 0);
  for (const value of ['1.0', 'x1.0.0', '01.0.0', '1.0.0-beta..1', '1.0.0-beta.01', '../1.0.0', '1.0.0-beta.', '1.0.0+build..1']) assert.equal(u.parseVersion(value), null);
  const beta = { ...release, tag_name: 'v2.0.0-beta.1', prerelease: true };
  assert.equal(u.selectRelease([beta, release], '1.0.0'), release);
  assert.equal(u.selectRelease([beta, release], '1.0.0-beta.1'), beta);
  assert.equal(u.selectRelease([{ ...release, draft: true }, beta, { tag_name: 'garbage' }], '1.1.0'), null);
  assert.equal(u.selectRelease([release], '1.1.0'), null);
  assert.equal(u.selectRelease([release], '1.2.0'), null);
});

test('installer selection requires exact OS/CPU/version, trusted repository and SHA256 metadata', () => {
  const assets = ['win-x64.exe', 'win-arm64.exe', 'mac-x64.dmg', 'mac-arm64.dmg', 'linux-x86_64.AppImage', 'linux-amd64.deb', 'linux-x86_64.rpm', 'linux-aarch64.rpm'].map(suffix => asset(`Qurioso-1.1.0-${suffix}`));
  const data = { ...release, assets };
  for (const [os, arch, format, suffix] of [['win32','x64','', 'win-x64.exe'], ['darwin','arm64','', 'mac-arm64.dmg'], ['linux','x64','deb','linux-amd64.deb'], ['linux','x64','rpm','linux-x86_64.rpm'], ['linux','x64','AppImage','linux-x86_64.AppImage'], ['linux','arm64','rpm','linux-aarch64.rpm']]) {
    assert.ok(u.selectInstaller(data, os, arch, format).name.endsWith(suffix));
  }
  assert.equal(u.selectInstaller(data, 'win32', 'ia32'), null);
  assert.equal(u.selectInstaller(data, 'linux', 'arm64', 'deb'), null);
  for (const change of [{ digest: null }, { size: -1 }, { size: '100' }, { browser_download_url: 'https://example.org/a.exe' }, { browser_download_url: asset().browser_download_url.replace('napo/qurioso', 'other/qurioso') }, { browser_download_url: asset().browser_download_url + '?bad=1' }, { name: '../Qurioso-1.1.0-win-x64.exe' }, { name: 'Qurioso-1.0.0-win-x64.exe' }]) {
    assert.equal(u.selectInstaller({ ...release, assets: [{ ...asset(), ...change }] }, 'win32', 'x64'), null);
  }
  assert.equal(u.detectLinuxFormat({ appImage: '/a.AppImage', osRelease: 'ID=ubuntu' }), 'AppImage');
  assert.equal(u.detectLinuxFormat({ appImage: '', osRelease: 'ID_LIKE="debian ubuntu"' }), 'deb');
  assert.equal(u.detectLinuxFormat({ appImage: '', osRelease: 'ID=fedora' }), 'rpm');
  assert.equal(u.detectLinuxFormat({ appImage: '', osRelease: 'ID=arch' }), 'AppImage');
});

test('release checks handle no releases, rate limits, offline and beta selection without sending quiz data', async () => {
  const requests: any[] = [];
  const fetchImpl = async (url: string, options: any) => { requests.push({ url, options }); return Response.json(release); };
  assert.equal((await u.findUpdate('1.0.0', { fetchImpl })).tag_name, 'v1.1.0');
  assert.ok(requests[0].url.endsWith('/releases/latest'));
  assert.equal(requests[0].options.body, undefined);
  assert.equal(requests[0].options.redirect, 'error');
  await u.findUpdate('1.0.0-beta.1', { fetchImpl: async (url: string) => { assert.ok(url.endsWith('?per_page=100')); return Response.json([release]); } });
  assert.equal(await u.findUpdate('1.0.0', { fetchImpl: async () => new Response(null, { status: 404 }) }), null);
  await assert.rejects(u.findUpdate('1.0.0', { fetchImpl: async () => new Response(null, { status: 403 }) }), /limitato/);
  await assert.rejects(u.findUpdate('1.0.0', { fetchImpl: async () => { throw new Error('offline'); } }), /offline/);
});

test('installer streams to disk, validates size/hash, limits redirects and removes partial or cancelled downloads', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qurioso-updates-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const progress: number[] = [];
  const file = await u.downloadInstaller(asset(), dir, { fetchImpl: async (url: string) => url.startsWith('https://github.com/') ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/file?signature=private' } }) : new Response(bytes), onProgress: (value: number) => progress.push(value) });
  assert.deepEqual(await readFile(file), bytes);
  assert.equal(progress.at(-1), 1);
  const initial = (await readdir(dir)).length;
  const fail = async (fetchImpl: any, changed = asset(), signal?: AbortSignal) => {
    await assert.rejects(u.downloadInstaller(changed, dir, { fetchImpl, signal }));
    assert.equal((await readdir(dir)).length, initial, 'failed download must not leave files');
  };
  await fail(async () => new Response(bytes), { ...asset(), digest: 'sha256:' + '0'.repeat(64) });
  await fail(async () => new Response(bytes.subarray(1)));
  await fail(async () => new Response(Buffer.concat([bytes, bytes])));
  await fail(async () => new Response(bytes, { headers: { 'content-length': '1' } }));
  await fail(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/file' } }));
  await fail(async () => new Response(null, { status: 302, headers: { location: 'http://github.com/file' } }));
  await fail(async () => new Response(null, { status: 302, headers: { location: asset().browser_download_url } }));
  const cancel = new AbortController(); cancel.abort();
  await fail(async () => new Response(bytes), asset(), cancel.signal);
  await fail(async () => { throw new Error('disk/network interrupted'); });
  await assert.rejects(u.downloadInstaller({ ...asset(), name: '../escape.exe' }, dir));
  const appImage = await u.downloadInstaller(asset('Qurioso-1.1.0-linux-x64.AppImage'), dir, { fetchImpl: async () => new Response(bytes) });
  if (process.platform !== 'win32') assert.ok((await stat(appImage)).mode & 0o100);
});

test('native updater asks before download, supports postpone/errors/cancel and protects ongoing activities', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qurioso-updater-ui-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const messages: any[] = [], opened: string[] = [], folders: string[] = [], requests: string[] = [], progress: number[] = [];
  let responses: number[] = [], canOpen = false, offline = false;
  const controller = await createUpdateController({
    app: { isPackaged: true, getVersion: () => '1.0.0', getPath: () => dir },
    window: { isDestroyed: () => false, setProgressBar: (value: number) => progress.push(value) },
    dialog: { showMessageBox: async (_: any, options: any) => { messages.push(options); return { response: responses.shift() ?? 1 }; } },
    shell: { openPath: async (file: string) => { opened.push(file); return ''; }, showItemInFolder: (file: string) => folders.push(file), openExternal: async () => {} },
    platform: 'win32', arch: 'x64', canOpenInstaller: async () => canOpen,
    fetchImpl: async (url: string) => { requests.push(url); if (offline) throw new Error('offline'); return url.includes('api.github.com') ? Response.json(release) : new Response(bytes); },
  });
  responses = [1]; await controller.check(true);
  assert.equal(requests.length, 1, 'postponing must not download');
  responses = [0, 0]; await controller.check(true);
  assert.equal(opened.length, 0, 'active activity must not open installer'); assert.equal(folders.length, 1);
  assert.ok(messages.at(-1).detail.includes('Chiudi Qurioso'));
  canOpen = true; responses = [0, 0]; await controller.check(true);
  assert.equal(opened.length, 1); assert.deepEqual(await readFile(opened[0]), bytes);
  assert.equal(progress.at(-1), -1);
  const count = messages.length; offline = true;
  await controller.check(false); assert.equal(messages.length, count, 'automatic offline check stays silent');
  await controller.check(true); assert.equal(messages.at(-1).message, 'Aggiornamento non riuscito.');
  const automaticItem = controller.menuItems(MENU_TEXT.it).find((item: any) => item.id === 'qurioso-auto-updates');
  await automaticItem.click({ checked: false }); assert.equal((await u.readSettings(dir)).enabled, false);
  controller.stop(); const previous = requests.length; await controller.check(true); assert.equal(requests.length, previous);
});

test('no native checks in development; updater preferences survive a new launch', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qurioso-updater-settings-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.deepEqual(await u.readSettings(dir), { enabled: true });
  await u.writeSettings(dir, false);
  const messages: any[] = [];
  const controller = await createUpdateController({ app: { isPackaged: false, getPath: () => dir }, window: { isDestroyed: () => false },
    dialog: { showMessageBox: async (_: any, options: any) => { messages.push(options); return { response: 0 }; } }, shell: {},
    fetchImpl: () => { throw new Error('development must not contact GitHub'); } });
  assert.equal(controller.menuItems(MENU_TEXT.it)[1].checked, false);
  controller.start(); await controller.check(false); assert.equal(messages.length, 0);
  await controller.check(true); assert.ok(messages[0].message.includes('applicazione installata'));
  controller.stop();
});

test('automatic startup check honors preferences and cancellation never leaves a partial installer', { timeout: 10000 }, async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qurioso-updater-cancel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0, downloadStarted = false, dialogs = 0;
  let signalDownloadReady!: () => void;
  const downloadReady = new Promise<void>(resolve => { signalDownloadReady = resolve; });
  const controller = await createUpdateController({
    app: { isPackaged: true, getPath: () => dir, getVersion: () => '1.0.0' },
    window: { isDestroyed: () => false, setProgressBar: () => {} }, shell: {}, platform: 'win32', arch: 'x64',
    dialog: { showMessageBox: async () => { dialogs++; return { response: 0 }; } },
    fetchImpl: async (url: string, options: any) => {
      requests++;
      if (url.includes('api.github.com')) return Response.json(release);
      downloadStarted = true;
      const response = new Response(new ReadableStream({ start(stream) {
        stream.enqueue(bytes.subarray(0, 3));
        options.signal.addEventListener('abort', () => stream.error(new DOMException('Cancelled', 'AbortError')), { once: true });
      } }));
      signalDownloadReady();
      return response;
    },
  });
  controller.start(); t.mock.timers.tick(1999); assert.equal(requests, 0);
  // Turn off automatic checking before its scheduled invocation.
  await controller.menuItems(MENU_TEXT.it)[1].click({ checked: false });
  t.mock.timers.tick(1); assert.equal(requests, 0);
  const running = controller.check(true);
  await downloadReady;
  assert.ok(downloadStarted);
  await controller.check(true); assert.equal(requests, 2, 'concurrent checks must not duplicate downloads');
  controller.menuItems(MENU_TEXT.it).find((item: any) => item.id === 'qurioso-cancel-update').click();
  await running;
  assert.equal(dialogs, 1, 'cancel is not a failure dialog');
  assert.deepEqual(await readdir(path.join(dir, 'updates')), []);
  controller.stop();
  await u.writeSettings(dir, true);
  const enabled = await createUpdateController({ app: { isPackaged: true, getPath: () => dir, getVersion: () => '1.0.0' },
    window: { isDestroyed: () => false, setProgressBar: () => {} }, shell: {}, dialog: { showMessageBox: () => { throw new Error('No dialog without a new release'); } },
    fetchImpl: async () => { requests++; return new Response(null, { status: 404 }); } });
  const before = requests; enabled.start(); t.mock.timers.tick(2000);
  assert.equal(requests, before + 1, 'enabled installed copies must check automatically');
  enabled.stop();
});

test('release build rejects tags that differ from the application version', () => {
  const pkg = require('../package.json');
  const script = new URL('../scripts/check-release-version.mjs', import.meta.url);
  assert.equal(spawnSync(process.execPath, [script.pathname, `v${pkg.version}`]).status, 0);
  const mismatch = spawnSync(process.execPath, [script.pathname, 'v99.0.0'], { encoding: 'utf8' });
  assert.notEqual(mismatch.status, 0); assert.match(mismatch.stderr, /non corrisponde/);
});

test('native menu follows supported system languages, falls back to English and keeps the update preference across rebuilds', async t => {
  assert.equal(menuLanguage('it-IT'), 'it'); assert.equal(menuLanguage('de_AT'), 'de'); assert.equal(menuLanguage('en-GB'), 'en');
  assert.equal(menuLanguage('fr-FR'), 'en'); assert.equal(menuLanguage(''), 'en'); assert.equal(menuLanguage(undefined), 'en');
  const keys = Object.keys(MENU_TEXT.it).sort();
  for (const language of ['en', 'de']) assert.deepEqual(Object.keys(MENU_TEXT[language]).sort(), keys, language);
  const dir = await mkdtemp(path.join(tmpdir(), 'qurioso-menu-language-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const controller = await createUpdateController({ app: { isPackaged: false, getPath: () => dir }, window: { isDestroyed: () => false },
    dialog: { showMessageBox: async () => ({ response: 0 }) }, shell: {}, fetchImpl: () => { throw new Error('no network'); } });
  assert.deepEqual(controller.menuItems(MENU_TEXT.de).map((item: any) => item.label), [MENU_TEXT.de.checkUpdates, MENU_TEXT.de.autoUpdates, MENU_TEXT.de.cancelUpdate, MENU_TEXT.de.updateFolder]);
  await controller.menuItems(MENU_TEXT.de)[1].click({ checked: false });
  assert.equal(controller.menuItems(MENU_TEXT.en)[1].checked, false, 'a rebuilt menu shows the saved preference');
  controller.stop();
});
