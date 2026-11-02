// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/dropbox.js.
import { SYNC_FILE_NAME } from './file';
import { StorageError, bytesBlob, defaultFetch, type CloudFile, type CloudStorage, type SyncFetch } from './types';

/** The "App folder" permission sees only the app's own folder. The file is found by its path: moved or renamed, it counts as deleted. */
const API = 'https://api.dropboxapi.com/2/files';
const CONTENT = 'https://content.dropboxapi.com/2/files';
const PATH = `/${SYNC_FILE_NAME}`;
export const DROPBOX_SCOPE = 'files.content.read files.content.write files.metadata.read';

export class DropboxClient implements CloudStorage {
  constructor(private accessToken: string, private fetchFn: SyncFetch = defaultFetch) {}
  private async request(url: string, init: RequestInit) {
    const response = await this.fetchFn(url, { method: 'POST', ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (response.ok) return response;
    const { error_summary: summary = '' } = await response.json().catch(() => ({}));
    throw new StorageError(response.status, summary);
  }
  private rpc(name: string, args: unknown) {
    return this.request(`${API}/${name}`, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  }
  private async upload(bytes: Uint8Array, mode: unknown): Promise<CloudFile> {
    const response = await this.request(`${CONTENT}/upload`, {
      headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: PATH, mode, autorename: false, mute: true, strict_conflict: true }) },
      body: bytesBlob(bytes),
    });
    return { id: PATH, version: (await response.json()).rev };
  }
  async findArchive() {
    const version = await this.version();
    return version ? { id: PATH, version } : null;
  }
  async version(): Promise<string | null> {
    try { return (await (await this.rpc('get_metadata', { path: PATH })).json()).rev; }
    catch (error) {
      if (error instanceof StorageError && error.status === 409 && error.code.includes('not_found')) return null;
      throw error;
    }
  }
  async download() {
    const response = await this.request(`${CONTENT}/download`, { headers: { 'Dropbox-API-Arg': JSON.stringify({ path: PATH }) } });
    return new Uint8Array(await response.arrayBuffer());
  }
  create(bytes: Uint8Array) { return this.upload(bytes, 'add'); }
  async update(_id: string, bytes: Uint8Array, expected: string) {
    try { return await this.upload(bytes, { '.tag': 'update', update: expected }); }
    catch (error) {
      if (error instanceof StorageError && error.status === 409 && error.code.includes('conflict')) return null;
      throw error;
    }
  }
  /** Dropbox keeps deleted files for a while, and the user can restore them. */
  async trash() { await this.rpc('delete_v2', { path: PATH }); }
}
