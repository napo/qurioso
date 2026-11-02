import type { Quiz } from '../types/quiz';
import { serviceLanguage, serviceText } from '../i18n/serviceMessages';

/** A referenced local video is no longer stored; recognised by type, since the message is localized. */
export class MissingVideoError extends Error {}

export function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('qurioso-library', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('library')) request.result.createObjectStore('library');
      if (!request.result.objectStoreNames.contains('videos')) request.result.createObjectStore('videos');
    };
    request.onerror = () => reject(new Error(serviceText('libraryOpen')));
    request.onsuccess = () => resolve(request.result);
  });
}

/** When each saved quiz last changed and when each was deleted, for cloud sync. Kept beside the quizzes so exports and backups stay unchanged. */
export interface LibrarySyncState { stamps: Record<string, number>; deletions: Record<string, number> }
export const SYNC_STATE_KEY = 'sync:state';

export function stampLibrary(state: LibrarySyncState | undefined, previous: Quiz[] | undefined, next: Quiz[], now: number): LibrarySyncState {
  const stamps = { ...state?.stamps }, deletions = { ...state?.deletions };
  const before = new Map((previous ?? []).map(quiz => [quiz.id, quiz]));
  for (const quiz of next) {
    const old = before.get(quiz.id);
    if (old && JSON.stringify(old) === JSON.stringify(quiz)) continue;
    // Never equal to the last stamp: a change within the same millisecond must still count as one.
    stamps[quiz.id] = Math.max(now, (stamps[quiz.id] ?? 0) + 1);
    delete deletions[quiz.id];
  }
  const kept = new Set(next.map(quiz => quiz.id));
  // Later than the quiz it removes, even with a clock behind the device that last edited it.
  for (const [id, quiz] of before) if (!kept.has(id)) { deletions[id] = Math.max(now, (stamps[id] ?? quiz.createdAt ?? 0) + 1); delete stamps[id]; }
  return { stamps, deletions };
}

const LIBRARY_CHANNEL = 'qurioso-library';
const libraryWriteListeners = new Set<() => void>();
/** Saves made by the user in this tab, which cloud sync follows. */
export function onLibraryWrite(listener: () => void): () => void {
  libraryWriteListeners.add(listener);
  return () => libraryWriteListeners.delete(listener);
}
/** A tab holding an old list would turn every quiz it misses into a deletion that reaches the cloud. */
export function announceLibraryChange(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  channel.postMessage('changed');
  channel.close();
}
export function onLibraryChangedElsewhere(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  channel.onmessage = () => listener();
  return () => channel.close();
}
function libraryWritten(): void {
  announceLibraryChange();
  for (const listener of libraryWriteListeners) listener();
}

function putStamped(store: IDBObjectStore, quizzes: Quiz[]): void {
  const previous = store.get('quizzes'), state = store.get(SYNC_STATE_KEY);
  state.onsuccess = () => {
    store.put(quizzes, 'quizzes');
    store.put(stampLibrary(state.result, previous.result, quizzes, Date.now()), SYNC_STATE_KEY);
  };
}

export async function loadQuizzes(): Promise<Quiz[] | null> {
  if (typeof indexedDB !== 'undefined') {
    const database = await openLibrary();
    const saved = await new Promise<Quiz[] | undefined>((resolve, reject) => {
      const transaction = database.transaction('library', 'readonly');
      const request = transaction.objectStore('library').get('quizzes');
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      transaction.onerror = () => { database.close(); reject(new Error(serviceText('libraryRead'))); };
    });
    if (saved) return saved;
  }
  const legacy = localStorage.getItem('qurioso_quizzes');
  if (!legacy) return null;
  const quizzes = JSON.parse(legacy);
  if (!Array.isArray(quizzes)) throw new Error(serviceText('libraryCorrupt'));
  // Keep the old copy as a migration backup.
  if (typeof indexedDB !== 'undefined') await storeQuizzes(quizzes);
  return quizzes;
}

export async function storeQuizzes(quizzes: Quiz[]): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    try { localStorage.setItem('qurioso_quizzes', JSON.stringify(quizzes)); return; }
    catch { throw new Error(serviceText('storageFull')); }
  }
  const database = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('library', 'readwrite');
    putStamped(transaction.objectStore('library'), quizzes);
    transaction.oncomplete = () => { database.close(); libraryWritten(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error(serviceText('saveFailed'))); };
    transaction.onerror = () => { /* onabort reports failed writes without discarding the draft. */ };
  });
}

/** Store the original video once, without base64 overhead in every quiz save. */
export async function storeVideo(file: Blob): Promise<string> {
  if (typeof indexedDB === 'undefined') throw new Error(serviceText('videoStoreUnavailable'));
  const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const database = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(file, id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error(serviceText('videoNotSaved'))); };
  });
  return id;
}

export async function loadVideo(id: string): Promise<Blob> {
  if (typeof indexedDB === 'undefined') throw new Error(serviceText('videoStoreMissing'));
  const database = await openLibrary();
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction('videos', 'readonly');
    const request = transaction.objectStore('videos').get(id);
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onerror = () => { database.close(); reject(new Error(serviceText('videoRead'))); };
  });
  if (!file) throw new MissingVideoError(serviceText('videoMissing'));
  return file;
}

export interface VideoAssetInfo { id: string; size: number; mime: string; name?: string }
export async function videoAssetInfo(id: string): Promise<VideoAssetInfo> {
  const file = await loadVideo(id);
  return { id, size: file.size, mime: file.type, name: 'name' in file ? String(file.name) : undefined };
}

export function formatAssetSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes, index = 0;
  while (value >= 1000 && index < units.length - 1) { value /= 1000; index++; }
  return `${new Intl.NumberFormat({ it: 'it-IT', en: 'en-GB', de: 'de-DE' }[serviceLanguage()], { maximumFractionDigits: index ? 1 : 0 }).format(value)} ${units[index]}`;
}

/** Audit only: never delete assets that an open editor or a running session may need. */
export async function inspectVideoAssets(): Promise<(VideoAssetInfo & { referenced: boolean })[]> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['library', 'videos'], 'readonly');
    const records = tx.objectStore('library').getAll(), assets: VideoAssetInfo[] = [];
    const cursor = tx.objectStore('videos').openCursor();
    cursor.onsuccess = () => {
      const entry = cursor.result;
      if (!entry) return;
      const blob = entry.value as Blob;
      assets.push({ id: String(entry.key), size: blob.size, mime: blob.type, name: 'name' in blob ? String(blob.name) : undefined }); entry.continue();
    };
    tx.oncomplete = () => {
      database.close();
      const used = new Set<string>();
      for (const record of records.result) {
        const quizzes = Array.isArray(record) ? record : [record?.quiz || record];
        for (const quiz of quizzes) if (quiz?.videoConfig?.videoAssetId) used.add(quiz.videoConfig.videoAssetId);
      }
      resolve(assets.map(asset => ({ ...asset, referenced: used.has(asset.id) })));
    };
    tx.onabort = () => { database.close(); reject(new Error(serviceText('videoStoreCheck'))); };
  });
}

export interface EditorDraft { quiz: Quiz; updatedAt: number }
let draftQueue: Promise<unknown> = Promise.resolve();
/** Serialized so a late autosave cannot resurrect a draft after explicit save/discard. */
export function editorDraft(action: 'read' | 'write' | 'delete', quiz?: Quiz): Promise<EditorDraft | undefined> {
  const operation = draftQueue.catch(() => {}).then(async () => {
    const database = await openLibrary();
    return new Promise<EditorDraft | undefined>((resolve, reject) => {
      const tx = database.transaction('library', action === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('library'), key = 'editor:draft';
      const request = action === 'read' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put({ quiz, updatedAt: Date.now() }, key);
      tx.oncomplete = () => { database.close(); resolve(action === 'read' ? request.result : undefined); };
      tx.onabort = () => { database.close(); reject(new Error(serviceText('draftNotSaved'))); };
    });
  });
  draftQueue = operation;
  return operation;
}

/** Private runtime quiz copy, separate from the saved library and never a session-state fallback. */
export async function presenterQuiz(pin: string, action: 'read' | 'write' | 'delete', quiz?: Quiz): Promise<Quiz | undefined> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('library', action === 'read' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('library'), key = `presenter:${pin}`;
    const request = action === 'read' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(quiz, key);
    transaction.oncomplete = () => { database.close(); resolve(action === 'read' ? request.result : undefined); };
    transaction.onabort = () => { database.close(); reject(new Error(serviceText('presenterStore'))); };
  });
}

/** One transaction publishes a fully verified restore. Existing assets/drafts/runtime copies are retained.
 * Compare inside the transaction, so another tab cannot silently lose a more recent library. */
export async function commitLibraryRestore(expected: Quiz[] | null, quizzes: Quiz[], assets: Map<string, Blob>): Promise<void> {
  if (typeof indexedDB === 'undefined') throw new Error('backupStorage');
  const database = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['library', 'videos'], 'readwrite');
    let conflict = false;
    const request = tx.objectStore('library').get('quizzes');
    request.onsuccess = () => {
      if (JSON.stringify(request.result ?? null) !== JSON.stringify(expected)) { conflict = true; tx.abort(); return; }
      putStamped(tx.objectStore('library'), quizzes);
      for (const [id, blob] of assets) tx.objectStore('videos').put(blob, id);
    };
    tx.oncomplete = () => { database.close(); libraryWritten(); resolve(); };
    tx.onabort = () => { database.close(); reject(new Error(conflict ? 'backupChanged' : 'backupWrite')); };
    tx.onerror = () => {};
  });
}

/** Read-only comparison point for backup preview; never triggers legacy migration. */
export async function readLibrarySnapshot(): Promise<Quiz[] | null> {
  if (typeof indexedDB === 'undefined') throw new Error('backupStorage');
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readonly'), request = tx.objectStore('library').get('quizzes');
    tx.oncomplete = () => { db.close(); resolve(request.result ?? null); };
    tx.onabort = () => { db.close(); reject(new Error('backupStorage')); };
  });
}
