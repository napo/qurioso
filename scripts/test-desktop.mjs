import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const binary = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
const args = process.argv[2] ? [] : ['.'];
if (process.platform === 'linux') args.push('--ozone-platform=headless');
const userData = await mkdtemp(path.join(tmpdir(), 'qurioso-desktop-test-'));
const environment = { ...process.env, QURIOSO_DESKTOP_SMOKE: '1', QURIOSO_TEST_USER_DATA: userData };
delete environment.ELECTRON_RUN_AS_NODE;
const run = () => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const timer = setTimeout(() => { child.kill(); reject(new Error('Desktop smoke timed out')); }, 120000);
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => {
    clearTimeout(timer);
    const result = output.match(/QURIOSO_SMOKE_RESULT=(.*)/);
    if (code !== 0 || !result) reject(new Error(output));
    else resolve(JSON.parse(result[1]));
  });
});
let blocker;
try {
  const first = await run();
  assert.equal(first.previous, null);
  // The server must stop when the application exits.
  await assert.rejects(fetch(`http://127.0.0.1:${first.port}/api/health`, { signal: AbortSignal.timeout(2000) }));
  blocker = createServer();
  await new Promise((resolve, reject) => { blocker.once('error', reject); blocker.listen(first.port, '0.0.0.0', resolve); });
  const second = await run();
  assert.equal(second.previous, 'saved');
  assert.notEqual(first.port, second.port);
  assert.equal(second.origin, first.origin);
  console.log(`Desktop smoke passed: rendered app, local server, WebSocket, base URL + PIN and direct QR entry, 24 presenter layout checks at 100% (1280x720, 1366x768, 1920x1080), video editor/timeline at 1366x768, local WebM and draft recovery, mobile participant, student recovery after refresh/tab close in classic and video games, host session recovered after reload, explicit credential cleanup, updater menu/preferences/verified download, CSV/JSON question import with preview/duplicates/new and video quizzes at 1366x768, library ZIP backup/preview/add/full restore at 1366x768 with double-confirm protection, storage retained across ports ${first.port}/${second.port}, and server shutdown.`);
} finally {
  if (blocker?.listening) await new Promise(resolve => blocker.close(resolve));
  await rm(userData, { recursive: true, force: true });
}
