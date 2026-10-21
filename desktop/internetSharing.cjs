// Native-only component manager. IPC never accepts executable paths, URLs or arguments.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { spawn } = require('node:child_process');
const { VERSION, ASSETS } = require('./cloudflareAssets.cjs');
const BASE = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/`;

class SharingError extends Error {
  constructor(code, detail = '') { super(code); this.code = code; this.detail = detail; }
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function allowedDownload(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'github.com' && url.pathname.startsWith(`/cloudflare/cloudflared/releases/download/${VERSION}/`) ||
       ['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname));
  } catch { return false; }
}
function unpack(bytes, name) {
  if (!name.endsWith('.tgz')) return bytes;
  const tar = gunzipSync(bytes, { maxOutputLength: 150 * 1024 ** 2 });
  // Extract only the regular cloudflared binary into a chosen filename, never archive paths.
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const file = header.subarray(0, 100).toString().split('\0')[0];
    const sizeText = header.subarray(124, 136).toString().replace(/\0/g, '').trim();
    if (!/^[0-7]+$/.test(sizeText)) throw new SharingError('integrity');
    const size = parseInt(sizeText, 8), start = offset + 512;
    if (start + size > tar.length) throw new SharingError('integrity');
    if (['cloudflared', './cloudflared'].includes(file) && [0, 48].includes(header[156])) return tar.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new SharingError('integrity');
}
async function ensureBinary(directory, asset, { fetchImpl = fetch, signal, onProgress = () => {} } = {}) {
  const [name, size, sha] = asset;
  const folder = path.join(directory, `cloudflared-${VERSION}`);
  const archive = path.join(folder, name), executable = path.join(folder, name.endsWith('.exe') ? 'cloudflared.exe' : 'cloudflared');
  await fs.mkdir(folder, { recursive: true, mode: 0o700 });
  await fs.copyFile(path.join(__dirname, 'cloudflared-LICENSE.txt'), path.join(folder, 'LICENSE.txt'));
  let bytes;
  try { const cached = await fs.readFile(archive); if (cached.length === size && digest(cached) === sha) bytes = cached; } catch {}
  if (!bytes) {
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(180000)].filter(Boolean));
    let url = BASE + name, response;
    for (let count = 0; count <= 5; count++) {
      if (!allowedDownload(url)) throw new SharingError('download');
      response = await fetchImpl(url, { redirect: 'manual', signal: timeout, credentials: 'omit', headers: { 'User-Agent': 'Qurioso-Cloudflare-component' } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location || count === 5) throw new SharingError('download');
      url = new URL(location, url).href;
    }
    if (!response?.ok || !response.body) throw new SharingError([404, 410].includes(response?.status) ? 'download_unavailable' : 'download', `HTTP ${response?.status || 0}`);
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== size) throw new SharingError('integrity');
    const chunks = []; let received = 0, previous = -1;
    for await (const chunk of response.body) {
      timeout.throwIfAborted(); received += chunk.length;
      if (received > size) throw new SharingError('integrity');
      chunks.push(Buffer.from(chunk));
      const percent = Math.floor(received * 100 / size);
      if (percent !== previous) { previous = percent; onProgress(percent); }
    }
    bytes = Buffer.concat(chunks);
    if (bytes.length !== size || digest(bytes) !== sha) throw new SharingError('integrity');
    timeout.throwIfAborted();
    const partial = archive + '.partial';
    try { await fs.writeFile(partial, bytes, { mode: 0o600 }); timeout.throwIfAborted(); await fs.rename(partial, archive); }
    finally { await fs.rm(partial, { force: true }); }
  }
  signal?.throwIfAborted();
  let binary;
  try { binary = unpack(bytes, name); } catch (error) { throw error instanceof SharingError ? error : new SharingError('integrity'); }
  // Rebuild from the verified archive on every activation, including cached downloads.
  const partial = executable + '.partial';
  try { await fs.writeFile(partial, binary, { mode: 0o700 }); signal?.throwIfAborted(); await fs.rename(partial, executable); await fs.chmod(executable, 0o700); }
  finally { await fs.rm(partial, { force: true }); }
  return executable;
}

function createInternetSharing({ directory, port, hostHeader, configure, onChange = () => {}, platform = process.platform, arch = process.arch,
  fetchImpl = fetch, spawnImpl = spawn, asset = ASSETS[`${platform}-${arch}`], connectionTimeout = 60000, healthInterval = 3000 }) {
  let state = { phase: 'idle', version: VERSION }, operation, generation = 0, stopping;
  const publish = update => { state = { phase: 'idle', version: VERSION, ...update }; onChange({ ...state }); };
  const snapshot = () => ({ ...state });
  const detach = async current => {
    current?.abort.abort();
    clearInterval(current?.healthTimer);
    if (current?.child && current.child.exitCode === null) {
      const child = current.child;
      // Await termination before enabling another start (Windows locks running executables).
      await new Promise(resolve => {
        let timer, lastTimer;
        const done = () => { clearTimeout(timer); clearTimeout(lastTimer); resolve(); };
        child.once('exit', done); child.once('error', done);
        timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3000); timer.unref();
        lastTimer = setTimeout(done, 5000); lastTimer.unref();
        child.kill();
      });
    }
    await configure(null).catch(() => {});
  };
  const stop = async () => {
    const current = operation; operation = undefined; const id = ++generation;
    publish({ phase: 'stopping' });
    const closing = detach(current); stopping = closing;
    try { await closing; } finally { if (stopping === closing) stopping = undefined; }
    if (id === generation) publish({ phase: 'idle' });
    return snapshot();
  };
  const start = async pin => {
    if (!/^\d{6}$/.test(pin)) { if (!operation) publish({ phase: 'error', error: 'local' }); return snapshot(); }
    // At most one connector: a tunnel still closing finishes first, and a tunnel for another game is
    // closed (its process has exited) before the new one starts. The same game keeps its tunnel.
    if (stopping) await stopping;
    if (operation?.pin === pin) return snapshot();
    // One tunnel serves consecutive games: an open, healthy connector is pointed at the new PIN.
    if (operation?.ready && ['active', 'idle'].includes(state.phase)) {
      const current = operation;
      try { await configure({ origin: current.url, pin }); }
      catch { if (operation === current) { operation = undefined; await detach(current); publish({ phase: 'error', error: 'local' }); } return snapshot(); }
      if (operation === current) { current.pin = pin; publish({ phase: 'active', url: current.url, pin }); }
      return snapshot();
    }
    if (operation) await stop();
    if (operation || stopping) return snapshot();
    if (!asset) { publish({ phase: 'error', error: 'unsupported' }); return snapshot(); }
    const current = { abort: new AbortController(), id: ++generation, child: null, pin }; operation = current;
    const active = () => operation === current && current.id === generation && !current.abort.signal.aborted;
    try {
      publish({ phase: 'downloading', progress: 0, pin });
      const executable = await ensureBinary(directory, asset, { fetchImpl, signal: current.abort.signal,
        onProgress: progress => { if (active()) publish({ phase: 'downloading', progress, pin }); } });
      if (!active()) return snapshot();
      publish({ phase: 'connecting', pin });
      await new Promise((resolve, reject) => {
        let url = '', connected = false, completing = false, ready = false, tail = '', metrics = '', failures = 0, checking = false;
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('TUNNEL_')));
        const child = spawnImpl(executable, ['tunnel', '--config', platform === 'win32' ? 'NUL' : '/dev/null', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`,
          '--http-host-header', hostHeader, '--metrics', '127.0.0.1:0', '--output', 'json', '--loglevel', 'info', '--grace-period', '1s'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false, env });
        current.child = child;
        const timer = setTimeout(() => reject(new SharingError('network')), connectionTimeout); timer.unref();
        const aborted = () => { clearTimeout(timer); reject(new SharingError('cancelled')); };
        current.abort.signal.addEventListener('abort', aborted, { once: true });
        const finish = async () => {
          if (!url || !connected || !metrics || completing || !active()) return;
          completing = true;
          try {
            await configure({ origin: url, pin: current.pin });
            if (!active()) return;
            ready = true; current.ready = true; current.url = url; clearTimeout(timer); current.abort.signal.removeEventListener('abort', aborted);
            current.healthTimer = setInterval(async () => {
              if (!active() || !metrics || checking) return;
              checking = true;
              try {
                const response = await fetchImpl(`http://${metrics}/ready`, { signal: AbortSignal.any([current.abort.signal, AbortSignal.timeout(2000)]), cache: 'no-store' });
                await response.body?.cancel();
                if (!response.ok) throw new Error('not ready');
                failures = 0;
                if (active() && current.pin && state.phase === 'reconnecting') publish({ phase: 'active', url, pin: current.pin });
              } catch {
                if (!active() || ++failures < 2) return;
                // Nothing is shared between games: a broken idle tunnel is simply closed.
                if (!current.pin) { operation = undefined; void detach(current); return; }
                if (state.phase !== 'reconnecting') publish({ phase: 'reconnecting', pin: current.pin, error: 'interrupted' });
              } finally { checking = false; }
            }, healthInterval); current.healthTimer.unref();
            publish({ phase: 'active', url, pin: current.pin }); resolve();
          } catch { reject(new SharingError('local')); }
        };
        const read = data => {
          // Never retain or expose cloudflared logs, request URLs or connection credentials.
          tail = (tail + String(data)).slice(-8192);
          const match = tail.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/);
          if (match) url = match[0];
          const metricsMatch = tail.match(/Starting metrics server on (127\.0\.0\.1:\d+)\/metrics/);
          if (metricsMatch) metrics = metricsMatch[1];
          if (/Registered tunnel connection/.test(tail)) connected = true;
          void finish();
        };
        child.stdout.on('data', read); child.stderr.on('data', read);
        child.once('error', () => { clearTimeout(timer); reject(new SharingError('launch')); });
        child.once('exit', code => {
          clearInterval(current.healthTimer);
          clearTimeout(timer); current.abort.signal.removeEventListener('abort', aborted);
          if (ready && active()) {
            operation = undefined;
            const shared = Boolean(current.pin);
            void configure(null).catch(() => {}).then(() => { if (shared && current.id === generation) publish({ phase: 'error', error: 'interrupted', detail: `exit=${Number.isInteger(code) ? code : 'signal'}` }); });
          } else reject(new SharingError(/Incorrect Usage|flag provided but not defined/.test(tail) ? 'launch' : 'network', `exit=${Number.isInteger(code) ? code : 'signal'}`));
        });
      });
    } catch (error) {
      if (active()) {
        operation = undefined; await detach(current);
        if (current.id === generation) publish({ phase: 'error', error: error instanceof SharingError ? error.code : state.phase === 'downloading' ? 'download' : 'network', detail: error instanceof SharingError ? error.detail : '' });
      }
    }
    return snapshot();
  };
  // The game ends: stop sharing it but keep a connected tunnel open for the next game.
  const release = async () => {
    const current = operation;
    if (!current) return snapshot();
    if (!current.ready) return stop();
    current.pin = undefined;
    await configure(null).catch(() => {});
    if (operation === current) publish({ phase: 'idle' });
    return snapshot();
  };
  const hasConnector = () => Boolean(operation);
  return { start, stop, release, snapshot, hasConnector, shutdown() { generation++; const current = operation; operation = undefined; current?.abort.abort(); clearInterval(current?.healthTimer); current?.child?.kill(); publish({ phase: 'idle' }); void configure(null).catch(() => {}); } };
}
module.exports = { createInternetSharing, ensureBinary, unpack, allowedDownload, SharingError };
