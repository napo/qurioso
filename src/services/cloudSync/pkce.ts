// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/auth-pkce.js and auth.js.
import { defaultFetch, type SyncAuth, type SyncFetch } from './types';

/** Sign-in refused or cancelled by the user, or a code the service did not accept. */
export class SignInError extends Error {}

export class TokenCache {
  private value: { token: string; expires: number } | null = null;
  constructor(private clock = () => Date.now()) {}
  // A minute of margin: a token about to expire would fail during the upload.
  get() { return this.value && this.value.expires - 60_000 > this.clock() ? this.value.token : null; }
  set(token: string, expiresInSeconds: number) { this.value = { token, expires: this.clock() + expiresInSeconds * 1000 }; }
  clear() { this.value = null; }
}

export interface PkceEndpoints { authorize: string; token: string; revoke?: string; revokeWithAccessToken?: boolean; scope: string; extraParams?: Record<string, string>; storageKey: string }
export interface TokenStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface PkceOptions {
  endpoints: PkceEndpoints; clientId: string; clientSecret?: string; fetch?: SyncFetch; storage: TokenStore;
  /** The way back from the service: a popup on the web, a loopback address on the desktop. */
  redirect(): Promise<{ uri: string; wait(): Promise<string> }>;
  openBrowser(url: string): Promise<unknown>;
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (length: number) => base64url(crypto.getRandomValues(new Uint8Array(length)));
export async function pkcePair() {
  const verifier = random(48);
  return { verifier, challenge: base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))) };
}

export class PkceAuth implements SyncAuth {
  private cache = new TokenCache();
  private fetchFn: SyncFetch;
  constructor(private options: PkceOptions) { this.fetchFn = options.fetch ?? defaultFetch; }
  private get refreshKey() { return this.options.endpoints.storageKey; }
  async token(interactive: boolean): Promise<string | null> {
    const cached = this.cache.get();
    if (cached) return cached;
    if (this.options.storage.getItem(this.refreshKey) && await this.refresh()) return this.cache.get();
    return interactive ? this.signIn() : null;
  }
  invalidate() { this.cache.clear(); }
  async signOut() {
    const { storage, endpoints: { revoke, revokeWithAccessToken } } = this.options;
    const token = storage.getItem(this.refreshKey);
    const access = revokeWithAccessToken && token ? this.cache.get() ?? (await this.refresh().catch(() => false) ? this.cache.get() : null) : null;
    storage.removeItem(this.refreshKey);
    this.cache.clear();
    if (!token || !revoke) return;
    const request = revokeWithAccessToken
      ? access && this.fetchFn(revoke, { method: 'POST', headers: { Authorization: `Bearer ${access}` } })
      : this.fetchFn(`${revoke}?${new URLSearchParams({ token })}`, { method: 'POST' });
    await Promise.resolve(request).catch(() => undefined);
  }
  private async tokenRequest(fields: Record<string, string>) {
    const { clientId, clientSecret, endpoints } = this.options;
    const response = await this.fetchFn(endpoints.token, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}), ...fields }).toString(),
    });
    const json = await response.json();
    return { ok: response.ok && Boolean(json.access_token), ...json };
  }
  /** False when the service no longer accepts the refresh token (access revoked). */
  private async refresh(): Promise<boolean> {
    const { storage } = this.options;
    const result = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: storage.getItem(this.refreshKey)! });
    if (!result.ok) {
      if (result.error === 'invalid_grant') storage.removeItem(this.refreshKey);
      return false;
    }
    // Some services hand out a new refresh token at every renewal.
    if (result.refresh_token) storage.setItem(this.refreshKey, result.refresh_token);
    this.cache.set(result.access_token, result.expires_in ?? 3600);
    return true;
  }
  private async signIn(): Promise<string> {
    const redirect = await this.options.redirect();
    const { verifier, challenge } = await pkcePair();
    const state = random(16);
    const { authorize, scope, extraParams } = this.options.endpoints;
    const url = `${authorize}?${new URLSearchParams({ client_id: this.options.clientId, redirect_uri: redirect.uri, response_type: 'code', scope, code_challenge: challenge, code_challenge_method: 'S256', state, ...extraParams })}`;
    const back = redirect.wait();
    await this.options.openBrowser(url);
    const query = new URL(await back, redirect.uri).searchParams;
    if (query.get('state') !== state || !query.get('code')) throw new SignInError(query.get('error') ?? 'no code');
    const result = await this.tokenRequest({ grant_type: 'authorization_code', code: query.get('code')!, code_verifier: verifier, redirect_uri: redirect.uri });
    if (!result.ok) throw new SignInError(result.error ?? 'token');
    if (result.refresh_token) this.options.storage.setItem(this.refreshKey, result.refresh_token);
    this.cache.set(result.access_token, result.expires_in ?? 3600);
    return result.access_token;
  }
}
