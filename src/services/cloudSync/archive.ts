import { DEFAULT_QUIZZES } from '../../data/defaultQuizzes';
import type { Quiz } from '../../types/quiz';
import { portableQuiz } from '../libraryBackup';
import { OFFICIAL_QUIZZES } from '../officialQuizzes';
import { MissingVideoError, SYNC_STATE_KEY, announceLibraryChange, openLibrary, videoAssetInfo, type LibrarySyncState } from '../quizStorage';
import type { SyncBase, SyncDeletion, SyncRecord, SyncSnapshot } from './merge';

/** `version` is the file version this device last read or wrote. */
export interface SyncMeta { provider?: string; fileId?: string; version?: string; base?: SyncBase; lastSyncedAt?: number }
const META_KEY = 'sync:meta';
const EMPTY_STATE: LibrarySyncState = { stamps: {}, deletions: {} };
const builtIn = new Map([...DEFAULT_QUIZZES, ...OFFICIAL_QUIZZES].map(quiz => [quiz.id, quiz]));

/** Quizzes shipped with the app exist everywhere, with a creation time that differs by device: only edited copies travel. */
function untouchedBuiltIn(quiz: Quiz): boolean {
  const original = builtIn.get(quiz.id);
  return Boolean(original) && JSON.stringify({ ...quiz, createdAt: 0 }) === JSON.stringify({ ...original, createdAt: 0 });
}

/** Video files stay on their device. The record carries a description, so an id of this device never reaches another one. */
async function portableRecord(stored: Quiz): Promise<Quiz> {
  const quiz = portableQuiz(stored), video = quiz.videoConfig;
  if (!video?.videoAssetId) return quiz;
  try {
    const info = await videoAssetInfo(video.videoAssetId);
    video.missingVideo = { name: video.videoFileName || info.name, size: info.size, sizeKnown: true, mime: info.mime };
  } catch (error) {
    if (!(error instanceof MissingVideoError)) throw error;
    video.missingVideo ??= { name: video.videoFileName, size: 0, sizeKnown: false, mime: 'application/octet-stream' };
  }
  delete video.videoAssetId;
  video.videoUrl = '';
  return portableQuiz(quiz);
}

/** Back from the portable form: a video already on this device stays linked, otherwise it shows as missing and can be relinked. */
async function localRecord(incoming: Quiz, current: Quiz | undefined): Promise<Quiz> {
  const quiz = structuredClone(incoming), video = quiz.videoConfig;
  if (!video?.missingVideo) return quiz;
  video.videoAssetId = current?.videoConfig?.videoAssetId ?? crypto.randomUUID();
  try {
    await videoAssetInfo(video.videoAssetId);
    delete video.missingVideo;
  } catch (error) {
    if (!(error instanceof MissingVideoError)) throw error;
  }
  return quiz;
}

async function readLibrary(): Promise<{ quizzes: Quiz[]; state: LibrarySyncState }> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readonly'), store = tx.objectStore('library');
    const quizzes = store.get('quizzes'), state = store.get(SYNC_STATE_KEY);
    tx.oncomplete = () => { database.close(); resolve({ quizzes: quizzes.result ?? [], state: state.result ?? EMPTY_STATE }); };
    tx.onabort = () => { database.close(); reject(new Error('syncStorage')); };
  });
}

/** Quizzes never edited since stamps exist fall back to their creation time, which does not change. */
const stampOf = (quiz: Quiz, state: LibrarySyncState) => state.stamps[quiz.id] ?? quiz.createdAt ?? 0;

export async function librarySnapshot(): Promise<SyncSnapshot & { skipped: number }> {
  const { quizzes, state } = await readLibrary();
  const records: SyncRecord[] = [];
  let skipped = 0;
  for (const quiz of quizzes) {
    if (untouchedBuiltIn(quiz)) continue;
    // A legacy quiz the backup format refuses stays on this device, untouched.
    try { records.push({ id: quiz.id, updatedAt: stampOf(quiz, state), quiz: await portableRecord(quiz) }); }
    catch { skipped++; }
  }
  return { quizzes: records, deletions: Object.entries(state.deletions).map(([id, deletedAt]) => ({ id, deletedAt })), skipped };
}

/** Applies received changes in one transaction. A quiz edited while the sync ran is left alone: the next round merges it. */
export async function applySyncChanges(puts: SyncRecord[], deletions: SyncDeletion[], read: Map<string, number>): Promise<number> {
  const current = new Map((await readLibrary()).quizzes.map(quiz => [quiz.id, quiz]));
  const prepared = await Promise.all(puts.map(async put => ({ ...put, quiz: await localRecord(put.quiz, current.get(put.id)) })));
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readwrite'), store = tx.objectStore('library');
    const quizzes = store.get('quizzes'), stateRequest = store.get(SYNC_STATE_KEY);
    let applied = 0;
    stateRequest.onsuccess = () => {
      const state: LibrarySyncState = { stamps: { ...stateRequest.result?.stamps }, deletions: { ...stateRequest.result?.deletions } };
      const library: Quiz[] = [...(quizzes.result ?? [])];
      const unchanged = (id: string) => {
        const quiz = library.find(item => item.id === id);
        const stamp = quiz && !untouchedBuiltIn(quiz) ? stampOf(quiz, state) : quiz ? undefined : state.deletions[id];
        return stamp === read.get(id);
      };
      for (const put of prepared) {
        if (!unchanged(put.id)) continue;
        const index = library.findIndex(item => item.id === put.id);
        if (index >= 0) library[index] = put.quiz; else library.unshift(put.quiz);
        state.stamps[put.id] = put.updatedAt;
        delete state.deletions[put.id];
        applied++;
      }
      for (const { id, deletedAt } of deletions) {
        if (!unchanged(id)) continue;
        const index = library.findIndex(item => item.id === id);
        if (index >= 0) library.splice(index, 1);
        state.deletions[id] = deletedAt;
        delete state.stamps[id];
        applied++;
      }
      store.put(library, 'quizzes');
      store.put(state, SYNC_STATE_KEY);
    };
    tx.oncomplete = () => { database.close(); announceLibraryChange(); resolve(applied); };
    tx.onabort = () => { database.close(); reject(new Error('syncStorage')); };
  });
}

export async function readSyncMeta(): Promise<SyncMeta> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readonly'), request = tx.objectStore('library').get(META_KEY);
    tx.oncomplete = () => { database.close(); resolve(request.result ?? {}); };
    tx.onabort = () => { database.close(); reject(new Error('syncStorage')); };
  });
}

export async function writeSyncMeta(meta: SyncMeta): Promise<void> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readwrite');
    tx.objectStore('library').put(meta, META_KEY);
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onabort = () => { database.close(); reject(new Error('syncStorage')); };
  });
}
