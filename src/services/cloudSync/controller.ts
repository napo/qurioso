// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/controller.js.
import packageInfo from '../../../package.json';
import { onLibraryWrite } from '../quizStorage';
import { readSyncMeta, writeSyncMeta } from './archive';
import { CLOUD_PROVIDER_IDS, type CloudProviderId } from './config';
import { forgetSync, synchronise } from './engine';
import { SyncFileError } from './file';
import { availableProviders, type CloudProvider } from './providers';
import { StorageError, type SyncAuth } from './types';

export type CloudSyncProblem = 'sign-in' | 'file' | 'too-large' | 'storage' | 'offline';
export interface CloudSyncStatus {
  state: 'off' | 'ok' | 'syncing' | 'paused' | 'error'; provider: CloudProviderId | null;
  lastSyncedAt: number | null; conflicts: number; skipped: number; problem: CloudSyncProblem | null;
}
const OFF: CloudSyncStatus = { state: 'off', provider: null, lastSyncedAt: null, conflicts: 0, skipped: 0, problem: null };
const AFTER_CHANGE_MS = 4000;
const EVERY_MS = 5 * 60_000;
/** Coming back to the app syncs only if the last round is older than this. */
const ON_RETURN_MS = 30_000;

/**
 * When to sync, and the state shown to the user. It runs only after the user connected a service on this device:
 * at start, a few seconds after a change, on returning to the app, every few minutes and when the network comes back.
 * One round at a time; a change during a round asks for another one.
 */
export class CloudSyncController {
  private current = OFF;
  private provider: CloudProvider | null = null;
  private auth: SyncAuth | null = null;
  private listeners = new Set<(status: CloudSyncStatus) => void>();
  private receivers = new Set<() => void>();
  private stops: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private lastAttempt = 0;
  private generation = 0;
  constructor(private providers: () => Promise<CloudProvider[]> = availableProviders, private appVersion = packageInfo.version) {}
  get status() { return this.current; }
  subscribe(listener: (status: CloudSyncStatus) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onReceived(listener: () => void) { this.receivers.add(listener); return () => { this.receivers.delete(listener); }; }
  private set(change: Partial<CloudSyncStatus>) {
    this.current = { ...this.current, ...change };
    for (const listener of this.listeners) listener(this.current);
  }
  /** Resumes the service chosen on this device in an earlier session. Contacts nothing when none was chosen. */
  async init(): Promise<void> {
    if (this.provider || typeof indexedDB === 'undefined') return;
    const generation = this.generation;
    try {
      const meta = await readSyncMeta();
      if (!meta.provider || !CLOUD_PROVIDER_IDS.includes(meta.provider as CloudProviderId)) return;
      const provider = (await this.providers()).find(item => item.id === meta.provider);
      if (!provider || generation !== this.generation) return;
      this.provider = provider;
      this.auth = provider.createAuth();
      this.set({ state: 'ok', provider: provider.id, lastSyncedAt: meta.lastSyncedAt ?? null });
      this.watch();
      this.schedule(0);
    } catch { /* The library works without sync. */ }
  }
  /** Call it from the user's tap: on the web the sign-in window needs it. */
  async connect(provider: CloudProvider): Promise<boolean> {
    const auth = provider.createAuth();
    let token: string | null = null;
    try { token = await auth.token(true); } catch { token = null; }
    if (!token) { this.set({ problem: 'sign-in' }); return false; }
    this.generation++;
    this.provider = provider;
    this.auth = auth;
    await forgetSync();
    await writeSyncMeta({ provider: provider.id });
    this.set({ state: 'ok', provider: provider.id, problem: null });
    this.watch();
    await this.syncNow(true);
    return true;
  }
  /** Quizzes stay on this device. With `removeFile` the file goes to the bin of the service. */
  async disconnect(removeFile = false): Promise<void> {
    this.generation++;
    this.unwatch();
    await this.running?.catch(() => {});
    const auth = this.auth, provider = this.provider;
    this.auth = this.provider = null;
    let failed = false;
    if (removeFile && auth && provider) {
      try {
        const token = await auth.token(true), id = (await readSyncMeta()).fileId;
        if (token && id) await provider.storage(token).trash(id);
        else if (id) failed = true;
      } catch { failed = true; }
    }
    await auth?.signOut().catch(() => {});
    await forgetSync();
    this.set({ ...OFF, problem: failed ? 'storage' : null });
  }
  /** `interactive` (a tap of the user) may show the sign-in again. */
  async syncNow(interactive = false): Promise<void> {
    if (!this.auth) return;
    if (this.running) { this.again = true; return this.running; }
    this.running = this.round(interactive).finally(() => {
      this.running = null;
      if (this.again && this.auth) { this.again = false; this.schedule(0); }
    });
    return this.running;
  }
  private async round(interactive: boolean): Promise<void> {
    const { auth, provider } = this;
    if (!auth || !provider) return;
    this.lastAttempt = Date.now();
    this.set({ state: 'syncing' });
    try {
      const outcome = await synchronise({ auth, storage: provider.storage, appVersion: this.appVersion, interactive });
      if (!this.auth) return;
      if (!outcome.done) { this.set({ state: 'paused', problem: 'sign-in' }); return; }
      if (outcome.received) for (const receiver of this.receivers) receiver();
      this.set({ state: 'ok', problem: null, conflicts: outcome.conflicts, skipped: outcome.skipped, lastSyncedAt: (await readSyncMeta()).lastSyncedAt ?? null });
    } catch (error) {
      const problem: CloudSyncProblem = error instanceof SyncFileError ? error.message === 'syncTooLarge' ? 'too-large' : 'file' : error instanceof StorageError ? 'storage' : 'offline';
      this.set({ state: 'error', problem });
    }
  }
  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.syncNow(); }, delay);
  }
  private watch() {
    if (this.stops.length) return;
    this.stops.push(onLibraryWrite(() => this.schedule(AFTER_CHANGE_MS)));
    if (typeof document === 'undefined') return;
    const onReturn = () => { if (document.visibilityState === 'visible' && Date.now() - this.lastAttempt > ON_RETURN_MS) this.schedule(0); };
    const onOnline = () => this.schedule(0);
    const every = setInterval(() => { if (document.visibilityState === 'visible') this.schedule(0); }, EVERY_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('online', onOnline);
    this.stops.push(() => document.removeEventListener('visibilitychange', onReturn), () => window.removeEventListener('online', onOnline), () => clearInterval(every));
  }
  private unwatch() {
    for (const stop of this.stops.splice(0)) stop();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  /** The next init resumes from what is stored. */
  dispose() {
    this.generation++;
    this.unwatch();
    this.auth = this.provider = null;
    this.current = OFF;
  }
}

export const cloudSync = new CloudSyncController();
