import { CLOUD_PROVIDER_IDS, WEB_CLOUD_CLIENTS, WEB_CLOUD_ORIGINS, type CloudProviderId } from './config';
import { DriveClient } from './drive';
import { DROPBOX_SCOPE, DropboxClient } from './dropbox';
import { ONEDRIVE_SCOPE, OneDriveClient } from './onedrive';
import { PkceAuth, type PkceEndpoints } from './pkce';
import type { CloudStorage, SyncAuth } from './types';
import { WebGoogleAuth, loadGoogle, popupSignIn } from './webAuth';

export interface CloudProvider { id: CloudProviderId; label: string; storage(token: string): CloudStorage; createAuth(): SyncAuth; prepare?(): void }
const LABELS: Record<CloudProviderId, string> = { 'google-drive': 'Google Drive', dropbox: 'Dropbox', onedrive: 'OneDrive' };
const STORAGE: Record<CloudProviderId, (token: string) => CloudStorage> = {
  'google-drive': token => new DriveClient(token),
  dropbox: token => new DropboxClient(token),
  onedrive: token => new OneDriveClient(token),
};
// Google signs in through its own script on the web; the desktop endpoints are in desktop/cloudAuth.cjs.
const WEB_ENDPOINTS: Record<Exclude<CloudProviderId, 'google-drive'>, PkceEndpoints> = {
  dropbox: {
    authorize: 'https://www.dropbox.com/oauth2/authorize', token: 'https://api.dropboxapi.com/oauth2/token',
    revoke: 'https://api.dropboxapi.com/2/auth/token/revoke', revokeWithAccessToken: true, scope: DROPBOX_SCOPE,
    extraParams: { token_access_type: 'offline' }, storageKey: 'qurioso.cloud.dropbox.refresh-token',
  },
  // Personal accounts only. Microsoft has no revocation in this flow: the app forgets the token.
  onedrive: {
    authorize: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    scope: ONEDRIVE_SCOPE, storageKey: 'qurioso.cloud.onedrive.refresh-token',
  },
};

class DesktopAuth implements SyncAuth {
  constructor(private id: CloudProviderId) {}
  private get api() { return window.quriosoDesktop!.cloud!; }
  token(interactive: boolean) { return this.api.token(this.id, interactive); }
  invalidate() { void this.api.invalidate(this.id); }
  signOut() { return this.api.signOut(this.id); }
}

function createWebAuth(id: CloudProviderId): SyncAuth {
  if (id === 'google-drive') return new WebGoogleAuth(WEB_CLOUD_CLIENTS[id]);
  return new PkceAuth({ endpoints: WEB_ENDPOINTS[id], clientId: WEB_CLOUD_CLIENTS[id], storage: localStorage, ...popupSignIn() });
}

export function providerById(id: CloudProviderId): CloudProvider {
  const desktop = Boolean(window.quriosoDesktop?.cloud);
  return {
    id, label: LABELS[id], storage: STORAGE[id],
    createAuth: () => desktop ? new DesktopAuth(id) : createWebAuth(id),
    prepare: !desktop && id === 'google-drive' ? () => { loadGoogle().catch(() => {}); } : undefined,
  };
}

/** Services this copy of the app can use. Android and copies on other addresses have no way back from the sign-in yet. */
export async function availableProviders(): Promise<CloudProvider[]> {
  const desktop = window.quriosoDesktop?.cloud;
  const ids: string[] = desktop ? await desktop.providers().catch(() => [])
    : WEB_CLOUD_ORIGINS.includes(window.location.origin) ? CLOUD_PROVIDER_IDS.filter(id => WEB_CLOUD_CLIENTS[id]) : [];
  return CLOUD_PROVIDER_IDS.filter(id => ids.includes(id)).map(providerById);
}
