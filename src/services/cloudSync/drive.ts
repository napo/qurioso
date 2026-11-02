// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/drive.js.
import { SYNC_FILE_MIME, SYNC_FILE_NAME } from './file';
import { StorageError, bytesBlob, defaultFetch, type CloudFile, type CloudStorage, type SyncFetch } from './types';

/**
 * The drive.file scope sees only the files the app created: a 'Qurioso' folder and the file inside it, both visible
 * in the user's Drive. They are found by a property of the app, so the user may rename or move them.
 */
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PROPERTY = 'qurioso';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export class DriveClient implements CloudStorage {
  constructor(private accessToken: string, private fetchFn: SyncFetch = defaultFetch) {}
  private async request(url: string, init: RequestInit = {}) {
    const response = await this.fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) throw new StorageError(response.status);
    return response;
  }
  private async find(value: string, extra = ''): Promise<CloudFile | null> {
    const q = `appProperties has { key='${PROPERTY}' and value='${value}' } and trashed=false${extra}`;
    const response = await this.request(`${API}?${new URLSearchParams({ q, spaces: 'drive', fields: 'files(id,version)', orderBy: 'modifiedTime desc' })}`);
    return (await response.json()).files?.[0] ?? null;
  }
  findArchive() { return this.find('archive'); }
  async version(id: string) {
    try {
      const file = await (await this.request(`${API}/${id}?fields=version,trashed`)).json();
      return file.trashed ? null : file.version;
    } catch (error) {
      if (error instanceof StorageError && error.status === 404) return null;
      throw error;
    }
  }
  async download(id: string) { return new Uint8Array(await (await this.request(`${API}/${id}?alt=media`)).arrayBuffer()); }
  private async folder(): Promise<string> {
    const found = await this.find('folder', ` and mimeType='${FOLDER_MIME}'`);
    if (found) return found.id;
    const response = await this.request(`${API}?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Qurioso', mimeType: FOLDER_MIME, appProperties: { [PROPERTY]: 'folder' } }),
    });
    return (await response.json()).id;
  }
  async create(bytes: Uint8Array): Promise<CloudFile> {
    const metadata = { name: SYNC_FILE_NAME, parents: [await this.folder()], mimeType: SYNC_FILE_MIME, appProperties: { [PROPERTY]: 'archive' } };
    const boundary = `qurioso${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${SYNC_FILE_MIME}\r\n\r\n`, bytesBlob(bytes), `\r\n--${boundary}--`,
    ]);
    const response = await this.request(`${UPLOAD}?uploadType=multipart&fields=id,version`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return response.json();
  }
  /** Drive has no conditional write: the version is checked just before writing. */
  async update(id: string, bytes: Uint8Array, expected: string): Promise<CloudFile | null> {
    if (await this.version(id) !== expected) return null;
    const response = await this.request(`${UPLOAD}/${id}?uploadType=media&fields=id,version`, { method: 'PATCH', headers: { 'Content-Type': SYNC_FILE_MIME }, body: bytesBlob(bytes) });
    return response.json();
  }
  /** To the bin of the user's Drive, where it can still be restored for 30 days. */
  async trash(id: string) {
    await this.request(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }
}
