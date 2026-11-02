// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/engine.js.
import { applySyncChanges, librarySnapshot, readSyncMeta, writeSyncMeta } from './archive';
import { readSyncFile, writeSyncFile } from './file';
import { EMPTY_SNAPSHOT, mergeSnapshots, snapshotChanges, snapshotStamps, type SyncBase, type SyncSnapshot } from './merge';
import { StorageError, type CloudFile, type CloudStorage, type SyncAuth } from './types';

export interface SyncResult { done: boolean; received: number; uploaded: boolean; conflicts: number; skipped: number }
/** Rounds tried when another device keeps changing the file. */
const ATTEMPTS = 3;

/**
 * One sync: download the file, merge, write the changes to the library, upload when the merged library differs.
 * When another device changed the file meanwhile the whole round starts again, so nothing it wrote is lost.
 */
export async function synchronise({ auth, storage, appVersion, interactive = false, now = Date.now }: {
  auth: SyncAuth; storage: (token: string) => CloudStorage; appVersion: string; interactive?: boolean; now?: () => number;
}): Promise<SyncResult> {
  for (let retryAuth = true; ; retryAuth = false) {
    const token = await auth.token(interactive);
    if (!token) return { done: false, received: 0, uploaded: false, conflicts: 0, skipped: 0 };
    try { return await round(storage(token), appVersion, now); }
    catch (error) {
      // A token refused before its expiry: get a new one, once.
      if (error instanceof StorageError && error.status === 401 && retryAuth) { auth.invalidate(); continue; }
      throw error;
    }
  }
}

async function round(client: CloudStorage, appVersion: string, now: () => number): Promise<SyncResult> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const meta = await readSyncMeta();
    const knownVersion = meta.fileId ? await client.version(meta.fileId) : null;
    let file: CloudFile | null = meta.fileId && knownVersion ? { id: meta.fileId, version: knownVersion } : await client.findArchive();
    const remote: SyncSnapshot = file ? readSyncFile(await client.download(file.id)) : EMPTY_SNAPSHOT;
    const { skipped, ...local } = await librarySnapshot();
    const at = now();
    const { merged, base, conflicts } = mergeSnapshots(local, remote, meta.base ?? {}, undefined, at);
    const toLocal = snapshotChanges(local, merged);
    const received = toLocal.changed ? await applySyncChanges(toLocal.puts, toLocal.deletions, snapshotStamps(local)) : 0;
    // What just arrived is no local change: if the upload is refused, the next round must not call it a conflict.
    if (toLocal.changed) await writeSyncMeta({ ...meta, base: { ...meta.base, ...Object.fromEntries(snapshotStamps({ quizzes: toLocal.puts, deletions: toLocal.deletions })) as SyncBase } });
    const upload = !file || snapshotChanges(remote, merged).changed;
    if (upload) {
      const bytes = writeSyncFile(merged, appVersion, at);
      if (file) {
        const updated = await client.update(file.id, bytes, file.version);
        if (!updated) continue;
        file = updated;
      } else file = await client.create(bytes);
    }
    await writeSyncMeta({ ...meta, fileId: file!.id, base, lastSyncedAt: at });
    return { done: true, received, uploaded: upload, conflicts, skipped };
  }
  throw new Error('syncBusy');
}

/** The next sync starts again from the file found on the service, if any. */
export const forgetSync = () => writeSyncMeta({});
