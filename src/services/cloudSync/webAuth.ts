// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/auth-popup.js and auth-web.js.
import { DRIVE_SCOPE } from './drive';
import { SignInError, TokenCache, type PkceOptions } from './pkce';
import type { SyncAuth } from './types';

const CHANNEL = 'qurioso-oauth';
const TIMEOUT_MS = 5 * 60_000;

/** PKCE in a window that comes back to public/oauth-callback.html. It opens first, as browsers block a window far from the tap. */
export function popupSignIn(): Pick<PkceOptions, 'redirect' | 'openBrowser'> {
  let popup: Window | null = null;
  return {
    async redirect() {
      popup = window.open('about:blank', CHANNEL, 'popup,width=520,height=720');
      if (!popup) throw new SignInError('popup blocked');
      return {
        uri: new URL('oauth-callback.html', document.baseURI).href,
        wait: () => new Promise<string>((resolve, reject) => {
          const channel = new BroadcastChannel(CHANNEL);
          const timer = setTimeout(() => { channel.close(); reject(new SignInError('timeout')); }, TIMEOUT_MS);
          channel.onmessage = event => { clearTimeout(timer); channel.close(); resolve(String(event.data)); };
        }),
      };
    },
    async openBrowser(url) { popup!.location.href = url; },
  };
}

interface GoogleTokenResponse { access_token?: string; expires_in?: number; error?: string }
interface GoogleOAuth {
  initTokenClient(config: { client_id: string; scope: string; callback(response: GoogleTokenResponse): void; error_callback(error: { type: string }): void }): { requestAccessToken(options: { prompt: string }): void };
  revoke(token: string): void;
}
const googleOAuth = () => (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth } } }).google?.accounts?.oauth2;
const STORED = 'qurioso.cloud.google-drive.web-token';
const CONSENTED = 'qurioso.cloud.google-drive.consented';
let loading: Promise<GoogleOAuth> | null = null;

/** Google's script is requested only when the user is about to connect, never for someone who does not use sync. */
export function loadGoogle(): Promise<GoogleOAuth> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { const oauth = googleOAuth(); if (oauth) resolve(oauth); else { loading = null; reject(new Error('gsi')); } };
    script.onerror = () => { loading = null; reject(new Error('gsi')); };
    document.head.append(script);
  });
  return loading;
}

/** Without a server there is no refresh token: an access token lasts an hour and a new one needs a tap. */
export class WebGoogleAuth implements SyncAuth {
  private cache = new TokenCache();
  constructor(private clientId: string) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORED) ?? 'null');
      if (stored) this.cache.set(stored.token, (stored.expires - Date.now()) / 1000);
    } catch { /* Sign in again. */ }
  }
  async token(interactive: boolean): Promise<string | null> {
    const cached = this.cache.get();
    if (cached || !interactive) return cached;
    const oauth = await loadGoogle();
    const response = await new Promise<GoogleTokenResponse>(resolve => {
      oauth.initTokenClient({ client_id: this.clientId, scope: DRIVE_SCOPE, callback: resolve, error_callback: error => resolve({ error: error.type }) })
        .requestAccessToken({ prompt: localStorage.getItem(CONSENTED) ? '' : 'consent' });
    });
    if (!response.access_token) return null;
    const expiresIn = response.expires_in ?? 3600;
    this.cache.set(response.access_token, expiresIn);
    try {
      localStorage.setItem(CONSENTED, '1');
      localStorage.setItem(STORED, JSON.stringify({ token: response.access_token, expires: Date.now() + expiresIn * 1000 }));
    } catch { /* It stays valid for this session. */ }
    return response.access_token;
  }
  invalidate() {
    this.cache.clear();
    try { localStorage.removeItem(STORED); } catch { /* Nothing stored. */ }
  }
  async signOut() {
    const token = this.cache.get();
    this.invalidate();
    try { localStorage.removeItem(CONSENTED); } catch { /* Nothing stored. */ }
    if (token) googleOAuth()?.revoke(token);
  }
}
