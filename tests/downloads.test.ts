import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseDownloads, loadDesktopDownloads } from '../src/services/downloads';

test('downloads expose only actual stable desktop installers belonging to this repository', () => {
  const asset = (name: string, url = `https://github.com/napo/qurioso/releases/download/v1/${name}`) => ({ name, browser_download_url: url });
  const assets = [asset('Qurioso.exe'), asset('Qurioso-arm64.dmg'), asset('Qurioso.AppImage'), asset('source.zip'), asset('app.apk'), asset('bad.exe', 'https://example.org/bad.exe'), asset('other.exe', 'https://github.com/other/repo/releases/download/v1/other.exe')];
  assert.deepEqual(releaseDownloads({ assets }).map(item => item.platform), ['Windows', 'macOS', 'Linux']);
  assert.deepEqual(releaseDownloads({ draft: true, assets }), []);
  assert.deepEqual(releaseDownloads({ prerelease: true, assets }), []);
  assert.deepEqual(releaseDownloads(null), []);
  assert.deepEqual(releaseDownloads({ assets: [null, {}] }), []);
});

test('missing releases are represented as unavailable downloads', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  assert.deepEqual(await loadDesktopDownloads(), []);
  globalThis.fetch = async () => new Response('{}', { status: 403 });
  await assert.rejects(loadDesktopDownloads(), /Download non disponibili/);
});
