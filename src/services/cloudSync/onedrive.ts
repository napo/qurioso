// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/onedrive.js.
import { SYNC_FILE_NAME } from './file';
import { StorageError, bytesBlob, defaultFetch, type CloudFile, type CloudStorage, type SyncFetch } from './types';

/** Files.ReadWrite.AppFolder sees only the app's folder in 'Apps'. The file is found by its path: moved or renamed, it counts as deleted. */
const ITEM = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${SYNC_FILE_NAME}`;
const CONTENT = `${ITEM}:/content`;
export const ONEDRIVE_SCOPE = 'Files.ReadWrite.AppFolder offline_access';

export class OneDriveClient implements CloudStorage {
  constructor(private accessToken: string, private fetchFn: SyncFetch = defaultFetch) {}
  private async request(url: string, init: RequestInit = {}) {
    const response = await this.fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) {
      const { error } = await response.json().catch(() => ({}));
      throw new StorageError(response.status, error?.code);
    }
    return response;
  }
  private async item() {
    try { return await (await this.request(ITEM)).json(); }
    catch (error) {
      if (error instanceof StorageError && error.status === 404) return null;
      throw error;
    }
  }
  private async upload(url: string, bytes: Uint8Array, headers: Record<string, string> = {}): Promise<CloudFile> {
    const response = await this.request(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', ...headers }, body: bytesBlob(bytes) });
    return { id: SYNC_FILE_NAME, version: (await response.json()).eTag };
  }
  async findArchive() {
    const version = await this.version();
    return version ? { id: SYNC_FILE_NAME, version } : null;
  }
  async version(): Promise<string | null> { return (await this.item())?.eTag ?? null; }
  /** From the short-lived address Graph gives: it needs no token, and browsers cannot follow the redirect of /content. */
  async download() {
    const item = await this.item();
    if (!item) throw new StorageError(404);
    const response = await this.fetchFn(item['@microsoft.graph.downloadUrl']);
    if (!response.ok) throw new StorageError(response.status);
    return new Uint8Array(await response.arrayBuffer());
  }
  create(bytes: Uint8Array) { return this.upload(`${CONTENT}?${new URLSearchParams({ '@microsoft.graph.conflictBehavior': 'fail' })}`, bytes); }
  async update(_id: string, bytes: Uint8Array, expected: string) {
    try { return await this.upload(CONTENT, bytes, { 'If-Match': expected }); }
    catch (error) {
      if (error instanceof StorageError && (error.status === 412 || error.status === 404)) return null;
      throw error;
    }
  }
  /** To the recycle bin of the user's OneDrive. */
  async trash() { await this.request(ITEM, { method: 'DELETE' }); }
}
