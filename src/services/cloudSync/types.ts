/** A request refused by the service; status 401 means the access token is no longer valid. */
export class StorageError extends Error {
  constructor(readonly status: number, readonly code = '') { super(`storage: ${status} ${code}`); }
}
export type SyncFetch = (input: string, init?: RequestInit) => Promise<Response>;
export interface CloudFile { id: string; version: string }
export interface CloudStorage {
  findArchive(): Promise<CloudFile | null>;
  version(id: string): Promise<string | null>;
  download(id: string): Promise<Uint8Array>;
  /** Null when another device created the file first: the next round uses that one. */
  create(bytes: Uint8Array): Promise<CloudFile | null>;
  /** Null when the file changed after `expected` was read. */
  update(id: string, bytes: Uint8Array, expected: string): Promise<CloudFile | null>;
  trash(id: string): Promise<void>;
}
export interface SyncAuth {
  token(interactive: boolean): Promise<string | null>;
  invalidate(): void;
  signOut(): Promise<void>;
}
export const defaultFetch: SyncFetch = (input, init) => fetch(input, init);
/** Copies into an ArrayBuffer-backed view, which Blob accepts on every TypeScript lib target. */
export const bytesBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)]);
