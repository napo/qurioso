import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { startLanServer, round } from './helpers/lanServer';
const require = createRequire(import.meta.url);
const { ensureBinary, createInternetSharing, allowedDownload, unpack } = require('../desktop/internetSharing.cjs');
const bytes = Buffer.from('verified test component — never executed');
const asset = ['cloudflared-linux-amd64', bytes.length, createHash('sha256').update(bytes).digest('hex')];
const wait = async (condition: () => boolean) => { for (let n = 0; n < 150; n++) { if (condition()) return; await delay(10); } assert.fail('Condition timed out'); };
async function directory(t: any) { const folder = await mkdtemp(path.join(tmpdir(), 'qurioso-sharing-test-')); t.after(() => rm(folder, { recursive: true, force: true })); return folder; }

test('Cloudflare component download is bounded, verified, cached, repaired and restricted to official hosts', async t => {
  const folder = await directory(t); let downloads = 0;
  const fetchImpl = async () => { downloads++; return new Response(bytes, { headers: { 'content-length': String(bytes.length) } }); };
  const executable = await ensureBinary(folder, asset, { fetchImpl });
  assert.deepEqual(await readFile(executable), bytes);
  await writeFile(executable, 'tampered executable');
  assert.equal(await ensureBinary(folder, asset, { fetchImpl }), executable);
  assert.deepEqual(await readFile(executable), bytes); assert.equal(downloads, 1);
  assert.match(await readFile(path.join(path.dirname(executable), 'LICENSE.txt'), 'utf8'), /Apache License/);
  for (const [response, code] of [[new Response('gone', { status: 410 }), 'download_unavailable'], [new Response('broken'), 'integrity'], [new Response(bytes, { headers: { 'content-length': '999' } }), 'integrity']] as const) {
    const other = await directory(t);
    await assert.rejects(ensureBinary(other, asset, { fetchImpl: async () => response }), (e: any) => e.code === code);
    assert.equal((await readdir(other, { recursive: true })).some(name => name.endsWith('.partial')), false);
  }
  await assert.rejects(ensureBinary(await directory(t), asset, { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://attacker.test/file' } }) }), (e: any) => e.code === 'download');
  assert.equal(allowedDownload('http://github.com/cloudflare/cloudflared/releases/download/2026.10.2/file'), false);
  assert.equal(allowedDownload('https://github.com/attacker/other/releases/download/2026.10.2/file'), false);
  assert.throws(() => unpack(Buffer.from('not gzip'), 'cloudflared-darwin-arm64.tgz'));
});

test('cancelling a component download prevents installation', async t => {
  const folder = await directory(t), abort = new AbortController();
  await assert.rejects(ensureBinary(folder, asset, { signal: abort.signal, fetchImpl: async () => {
    abort.abort(); return new Response(bytes);
  } }));
  assert.equal((await readdir(folder, { recursive: true })).some(name => name === 'cloudflared' || name.endsWith('.partial')), false);
});

class Child extends EventEmitter {
  stdout = new PassThrough(); stderr = new PassThrough(); exitCode: number | null = null; killed = false;
  kill() { this.killed = true; this.exitCode = 0; this.emit('exit', 0); return true; }
}
test('native sharing waits for connectivity, detects outages, recovers, stops and reports failures without logs or credentials', async t => {
  const folder = await directory(t), states: any[] = [], configurations: any[] = [];
  let child: Child, command: any[], ready = true, failDisable = false;
  const controller = createInternetSharing({ directory: folder, port: 4444, hostHeader: 'secret-native-header', asset, healthInterval: 10,
    onChange: (state: any) => states.push(state), configure: async (share: any) => { if (share === null && failDisable) throw new Error('Local server stopped'); configurations.push(share); },
    fetchImpl: async (url: string) => url.startsWith('http:') ? new Response('', { status: ready ? 200 : 503 }) : new Response(bytes),
    spawnImpl: (...args: any[]) => { command = args; child = new Child(); return child; },
  });
  t.after(() => controller.shutdown());
  const starting = controller.start('123456');
  await wait(() => Boolean(child));
  child!.stderr.write('https://nice-quiz.trycloudflare.com\nStarting metrics server on 127.0.0.1:4445/metrics\n');
  assert.equal(controller.snapshot().phase, 'connecting', 'an assigned URL alone is not a working tunnel');
  child!.stderr.write('Registered tunnel connection\n');
  await starting;
  assert.equal(controller.snapshot().url, 'https://nice-quiz.trycloudflare.com');
  assert.equal(command![2].shell, false); assert.ok(command![1].includes('--no-autoupdate'));
  assert.ok(command![1].includes('http://127.0.0.1:4444')); assert.ok(command![1].includes('secret-native-header'));
  assert.deepEqual(configurations.at(-1), { origin: 'https://nice-quiz.trycloudflare.com', pin: '123456' });
  ready = false; await wait(() => controller.snapshot().phase === 'reconnecting');
  assert.equal(controller.snapshot().url, undefined, 'an unavailable public URL is withdrawn from QR/address selection');
  ready = true; await wait(() => controller.snapshot().phase === 'active');
  failDisable = true;
  child!.exitCode = 1; child!.emit('exit', 1);
  await wait(() => controller.snapshot().phase === 'error');
  assert.equal(controller.snapshot().error, 'interrupted');
  failDisable = false;
  await controller.stop(); assert.equal(configurations.at(-1), null); assert.equal(controller.snapshot().phase, 'idle');
  assert.equal(JSON.stringify(states).includes('secret-native-header'), false);
  assert.equal(JSON.stringify(states).includes('Registered tunnel connection'), false);
  const retry = controller.start('123456'); await wait(() => controller.snapshot().phase === 'connecting');
  await controller.stop(); await retry;
  assert.equal(child!.killed, true); assert.equal(controller.snapshot().phase, 'idle');
  assert.equal((await controller.start('bad;command')).error, 'local');
});

test('Cloudflare connection timeout produces a retriable network error and closes the connector', async t => {
  let child: Child;
  const controller = createInternetSharing({ directory: await directory(t), port: 4444, hostHeader: 'secret', asset, connectionTimeout: 30,
    configure: async () => {}, fetchImpl: async () => new Response(bytes), spawnImpl: () => { child = new Child(); return child; } });
  t.after(() => controller.shutdown());
  const running = controller.start('123456');
  // The mocked connector has no process handle to keep Node alive. Poll the
  // outcome while the controller's intentionally unref'ed timeout is pending.
  await wait(() => controller.snapshot().phase === 'error');
  await running;
  assert.equal(controller.snapshot().error, 'network'); assert.ok(child!.killed);
});

test('public Cloudflare ingress supports participant HTTP/WS while blocking teacher control, other sessions and foreign origins', { timeout: 15000 }, async t => {
  const secret = 'f'.repeat(64), origin = 'https://test-quiz.trycloudflare.com';
  const { base, request, mint } = await startLanServer(t, false, { QURIOSO_PUBLIC_TUNNEL_TOKEN: secret });
  const initial = round(), hostToken = await mint(), roomPath = '/api/session/' + initial.pin;
  assert.equal((await request('/api/session/create', 'POST', { session: initial }, hostToken)).status, 200);
  const configure = (share: unknown) => request('/api/desktop/internet-sharing', 'POST', { share }, secret);
  assert.equal((await configure({ origin, pin: initial.pin })).status, 200);
  // Node fetch normalizes Host; use HTTP directly to model cloudflared's explicit Host override.
  const external = (url: string, method = 'GET', body?: unknown, token?: string, requestOrigin = origin) => new Promise<Response>((resolve, reject) => {
    const request = httpRequest(new URL(base + url), { method,
      headers: { Host: `qurioso-public-${secret}.localhost`, Origin: requestOrigin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, response => {
      const chunks: Buffer[] = []; response.on('data', data => chunks.push(data));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers as Record<string, string> })));
      response.on('error', reject);
    });
    request.on('error', reject); request.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const entry = await external('/');
  assert.equal(entry.status, 302, await entry.clone().text());
  assert.equal(entry.headers.get('location'), '/?role=player&pin=123456');
  assert.equal((await external(roomPath, 'GET', undefined, undefined, 'https://evil.example')).status, 403);
  for (const [url, method] of [['/api/presenter-token', 'POST'], ['/api/session/create', 'POST'], [roomPath + '/presenter', 'GET'], [roomPath + '/state', 'POST'], [roomPath, 'DELETE'], ['/api/server-info', 'GET'], ['/api/session/999999', 'GET'], ['/api/desktop/internet-sharing', 'POST']]) {
    assert.equal((await external(url, method, method === 'POST' ? {} : undefined, hostToken)).status, 403, url);
  }
  assert.equal((await external(roomPath, 'GET', undefined, hostToken)).status, 403, 'even a teacher credential cannot expose teacher state publicly');
  assert.equal((await external('/API/SERVER-INFO')).status, 403);
  assert.equal((await external(`/API/session/${initial.pin}/presenter`, 'GET', undefined, hostToken)).status, 403);
  const joined = await external(roomPath + '/join', 'POST', { player: { id: 'remote', nickname: 'Remote', avatar: '🦊', score: 0, streak: 0 } });
  assert.equal(joined.status, 200); const playerToken = (await joined.json()).playerToken;
  assert.equal((await external(roomPath + '/player/remote', 'GET', undefined, playerToken)).status, 200);
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { Host: `qurioso-public-${secret}.localhost`, Origin: origin } });
  t.after(() => ws.terminate()); await once(ws, 'open');
  const next = (data: unknown) => new Promise<any>(resolve => {
    const listener = (bytes: Buffer) => { const message = JSON.parse(bytes.toString()); if (message.type !== 'PING') { ws.off('message', listener); resolve(message); } };
    ws.on('message', listener); ws.send(JSON.stringify(data));
  });
  const registered = await next({ type: 'REGISTER', role: 'player', pin: initial.pin, playerId: 'remote', token: playerToken });
  assert.equal(registered.type, 'SESSION_STATE_UPDATE');
  assert.equal(registered.session.currentQuestion.options.some((option: any) => 'isCorrect' in option), false);
  const answer = { type: 'PLAYER_ANSWER', pin: initial.pin, playerId: 'remote', questionId: registered.session.currentQuestion.id, optionId: registered.session.currentQuestion.options[0].id, roundId: registered.session.roundId, timeTakenMs: 0 };
  assert.equal((await next(answer)).type, 'SESSION_STATE_UPDATE');
  assert.equal((await external(roomPath + '/answer', 'POST', answer, playerToken)).status, 200, 'HTTP fallback accepts a retried answer');
  assert.equal((await next({ type: 'SESSION_STATE_UPDATE', pin: initial.pin, session: initial })).status, 403);
  assert.equal((await next({ type: 'REGISTER', role: 'host', pin: initial.pin, token: hostToken })).status, 403);
  assert.equal((await next({ type: 'REGISTER', role: 'player', pin: '999999', playerId: 'remote', token: playerToken })).type, 'ERROR');
  const closed = once(ws, 'close'); await configure(null); await closed;
  assert.equal((await external(roomPath)).status, 403);
  assert.equal((await request(roomPath, 'GET', undefined, hostToken)).status, 200, 'local teacher remains functional after Internet sharing stops');
});

test('a new game closes the previous Cloudflare connector before starting its own; the same game keeps its tunnel', async t => {
  const events: string[] = [], children: Child[] = [], configurations: any[] = [];
  let slowExit = false;
  class TrackedChild extends Child {
    constructor(readonly n: number) { super(); }
    kill() {
      this.killed = true; events.push(`kill ${this.n}`);
      // A slow connector exits only after a while, like a real process honouring its grace period.
      const exit = () => { this.exitCode = 0; events.push(`exit ${this.n}`); this.emit('exit', 0); };
      if (slowExit) setTimeout(exit, 40); else exit();
      return true;
    }
  }
  const controller = createInternetSharing({ directory: await directory(t), port: 4444, hostHeader: 'secret', asset, healthInterval: 10_000,
    configure: async (share: any) => { configurations.push(share); },
    fetchImpl: async (url: string) => url.startsWith('http:') ? new Response('', { status: 200 }) : new Response(bytes),
    spawnImpl: () => { const child = new TrackedChild(children.length + 1); children.push(child); events.push(`spawn ${child.n}`); return child; },
  });
  t.after(() => controller.shutdown());
  const connect = async (pin: string) => {
    const running = controller.start(pin), before = children.length;
    await wait(() => children.length > before);
    children.at(-1)!.stderr.write(`https://game-${pin}.trycloudflare.com\nStarting metrics server on 127.0.0.1:4445/metrics\nRegistered tunnel connection\n`);
    return running;
  };

  await connect('111111');
  assert.equal(controller.snapshot().pin, '111111');
  assert.equal((await controller.start('111111')).url, 'https://game-111111.trycloudflare.com', 'the same game reuses its tunnel');
  assert.equal(children.length, 1);
  assert.equal((await controller.start('bad')).phase, 'active', 'an invalid request never closes a working tunnel');

  await connect('222222');
  assert.deepEqual(events, ['spawn 1', 'kill 1', 'exit 1', 'spawn 2'], 'the previous process has exited before the next one starts');
  assert.deepEqual(configurations, [{ origin: 'https://game-111111.trycloudflare.com', pin: '111111' }, null, { origin: 'https://game-222222.trycloudflare.com', pin: '222222' }]);
  assert.equal(controller.snapshot().pin, '222222'); assert.equal(children.filter(child => child.exitCode === null).length, 1);

  // Starting while the previous connector is still closing waits for it instead of being ignored.
  slowExit = true;
  const closing = controller.stop();
  const next = connect('333333');
  await closing; await next;
  assert.deepEqual(events.slice(-3), ['kill 2', 'exit 2', 'spawn 3']);
  assert.equal(controller.snapshot().phase, 'active'); assert.equal(controller.snapshot().pin, '333333');
  assert.equal(children.filter(child => child.exitCode === null).length, 1, 'never more than one connector');
});
