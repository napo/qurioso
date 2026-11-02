import { BACKUP_LIMITS, portableQuiz } from '../libraryBackup';
import type { SyncDeletion, SyncRecord, SyncSnapshot } from './merge';

/** One JSON file with the whole library: images stay embedded, local video files never travel. */
export const SYNC_FILE_NAME = 'Qurioso-biblioteca.json';
export const SYNC_FILE_MIME = 'application/json';
const MAX_FILE_SIZE = BACKUP_LIMITS.json + BACKUP_LIMITS.images;

/** This version cannot read the file: it must not be overwritten. */
export class SyncFileError extends Error {}

export function writeSyncFile(snapshot: SyncSnapshot, appVersion: string, now = Date.now()): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify({ format: 'qurioso-sync', version: 1, appVersion, updatedAt: now, ...snapshot }));
  if (bytes.byteLength > MAX_FILE_SIZE) throw new SyncFileError('syncTooLarge');
  return bytes;
}

const stamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Reading never trusts the file. A single invalid quiz is left out, since it would otherwise block sync for good. */
export function readSyncFile(bytes: Uint8Array): SyncSnapshot {
  if (bytes.byteLength > MAX_FILE_SIZE) throw new SyncFileError('syncTooLarge');
  let data: any;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SyncFileError('syncInvalid'); }
  if (data?.format !== 'qurioso-sync' || !Array.isArray(data.quizzes) || !Array.isArray(data.deletions)) throw new SyncFileError('syncInvalid');
  if (data.version !== 1) throw new SyncFileError('syncVersion');
  const quizzes: SyncRecord[] = [];
  for (const record of data.quizzes) {
    try {
      if (typeof record?.id !== 'string' || record.quiz?.id !== record.id || !stamp(record.updatedAt)) continue;
      quizzes.push({ id: record.id, updatedAt: record.updatedAt, quiz: portableQuiz(record.quiz) });
    } catch { /* Left out: see above. */ }
  }
  if (data.quizzes.length && !quizzes.length) throw new SyncFileError('syncInvalid');
  const deletions: SyncDeletion[] = data.deletions.filter((d: any) => typeof d?.id === 'string' && stamp(d.deletedAt)).map((d: any) => ({ id: d.id, deletedAt: d.deletedAt }));
  return { quizzes, deletions };
}
