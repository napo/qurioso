// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/auth-pkce.js and src-tauri/src/oauth.rs.
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const config = require('./cloudConfig.cjs');

const TIMEOUT_MS = 5 * 60 * 1000;
const FILE = 'cloud-auth.bin';
const PROVIDERS = {
  'google-drive': {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke',
    scope: 'https://www.googleapis.com/auth/drive.file', extra: { access_type: 'offline', prompt: 'consent' }, host: '127.0.0.1', port: 0,
  },
  // Dropbox accepts only the exact address registered in its console: no free port.
  dropbox: {
    authorize: 'https://www.dropbox.com/oauth2/authorize', token: 'https://api.dropboxapi.com/oauth2/token', revoke: 'https://api.dropboxapi.com/2/auth/token/revoke', revokeWithAccessToken: true,
    scope: 'files.content.read files.content.write files.metadata.read', extra: { token_access_type: 'offline' }, host: 'localhost', port: 53682,
  },
  // Microsoft ignores the port of a localhost address when matching it, and has no revocation in this flow.
  onedrive: {
    authorize: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder offline_access', extra: {}, host: 'localhost', port: 0,
  },
};
const base64url = bytes => Buffer.from(bytes).toString('base64url');

/** Refresh tokens stay here, encrypted by the system. Without a system keyring they last only for this session. */
function createCloudAuth({ directory, safeStorage, openBrowser, fetchImpl = fetch, clients = config.CLOUD_CLIENTS, googleSecret = config.GOOGLE_DESKTOP_SECRET, timeoutMs = TIMEOUT_MS }) {
  const file = path.join(directory, FILE), cache = new Map();
  let refreshTokens = null, pendingSignIn = null;
  const persistent = () => safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  const usable = id => Object.hasOwn(PROVIDERS, id) && Boolean(clients[id]) && (id !== 'google-drive' || Boolean(googleSecret));
  const load = async () => {
    if (refreshTokens) return refreshTokens;
    refreshTokens = {};
    if (persistent()) {
      try { refreshTokens = JSON.parse(safeStorage.decryptString(await fs.readFile(file))); }
      catch { /* Missing or unreadable: sign in again. */ }
    }
    return refreshTokens;
  };
  const save = async () => {
    if (!persistent()) return;
    const temporary = `${file}.tmp`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporary, safeStorage.encryptString(JSON.stringify(refreshTokens)), { mode: 0o600 });
    await fs.rename(temporary, file);
  };
  const setRefresh = async (id, token) => {
    await load();
    if (token) refreshTokens[id] = token; else delete refreshTokens[id];
    await save();
  };
  const cached = id => { const value = cache.get(id); return value && value.expires - 60000 > Date.now() ? value.token : null; };
  const remember = (id, result) => { cache.set(id, { token: result.access_token, expires: Date.now() + (result.expires_in ?? 3600) * 1000 }); return result.access_token; };
  const tokenRequest = async (id, fields) => {
    const body = new URLSearchParams({ client_id: clients[id], ...(id === 'google-drive' ? { client_secret: googleSecret } : {}), ...fields });
    const response = await fetchImpl(PROVIDERS[id].token, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(30000) });
    const json = await response.json().catch(() => ({}));
    return { ok: response.ok && Boolean(json.access_token), ...json };
  };
  const refresh = async id => {
    const stored = (await load())[id];
    if (!stored) return null;
    const result = await tokenRequest(id, { grant_type: 'refresh_token', refresh_token: stored });
    if (!result.ok) {
      if (result.error === 'invalid_grant') await setRefresh(id, null);
      return null;
    }
    // Some services hand out a new refresh token at every renewal.
    if (result.refresh_token) await setRefresh(id, result.refresh_token);
    return remember(id, result);
  };
  // One request is accepted: the one carrying this sign-in's state. Nothing from it is echoed back.
  const listen = ({ host, port }, state) => new Promise((resolve, reject) => {
    let settle;
    const code = new Promise((done, fail) => { settle = { done, fail }; });
    // It may fail while the browser is still opening, before signIn awaits it.
    code.catch(() => {});
    const server = http.createServer((request, response) => {
      const query = new URL(request.url, 'http://localhost').searchParams;
      if (request.method !== 'GET' || query.get('state') !== state) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><meta charset="utf-8"><title>Qurioso</title><body style="font-family:sans-serif;text-align:center;padding:3em"><h1>Qurioso</h1><p>✓</p>');
      if (query.get('code')) settle.done(query.get('code')); else settle.fail(new Error('sign-in refused'));
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      const timer = setTimeout(() => settle.fail(new Error('sign-in timeout')), timeoutMs);
      const close = () => { clearTimeout(timer); server.closeAllConnections?.(); server.close(); };
      resolve({ uri: `http://${host}:${server.address().port}${port ? '/' : ''}`, code, close, cancel: () => settle.fail(new Error('sign-in replaced')) });
    });
  });
  const signIn = async id => {
    pendingSignIn?.();
    const provider = PROVIDERS[id], state = base64url(randomBytes(16)), verifier = base64url(randomBytes(48));
    const back = await listen(provider, state);
    pendingSignIn = back.cancel;
    try {
      const url = `${provider.authorize}?${new URLSearchParams({ client_id: clients[id], redirect_uri: back.uri, response_type: 'code', scope: provider.scope, code_challenge: base64url(createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', state, ...provider.extra })}`;
      await openBrowser(url);
      const code = await back.code;
      const result = await tokenRequest(id, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: back.uri });
      // The service's own reason, never the code or a token, so a wrong registration can be told apart.
      if (!result.ok) throw new Error(`sign-in rejected by ${id}: ${[result.error, result.error_description].filter(value => typeof value === 'string').join(' - ').slice(0, 300) || 'no reason given'}`);
      if (result.refresh_token) await setRefresh(id, result.refresh_token);
      return remember(id, result);
    } finally {
      back.close();
      if (pendingSignIn === back.cancel) pendingSignIn = null;
    }
  };
  return {
    providers: () => Object.keys(PROVIDERS).filter(usable),
    async token(id, interactive) {
      if (!usable(id)) throw new Error('Cloud service unavailable');
      return cached(id) ?? await refresh(id) ?? (interactive === true ? signIn(id) : null);
    },
    invalidate(id) { cache.delete(id); },
    async signOut(id) {
      if (!usable(id)) return;
      const provider = PROVIDERS[id], stored = (await load())[id];
      const access = provider.revokeWithAccessToken && stored ? cached(id) ?? await refresh(id).catch(() => null) : null;
      await setRefresh(id, null);
      cache.delete(id);
      if (!stored || !provider.revoke) return;
      const request = provider.revokeWithAccessToken
        ? access && fetchImpl(provider.revoke, { method: 'POST', headers: { Authorization: `Bearer ${access}` } })
        : fetchImpl(`${provider.revoke}?${new URLSearchParams({ token: stored })}`, { method: 'POST' });
      await Promise.resolve(request).catch(() => {});
    },
  };
}

module.exports = { createCloudAuth };
