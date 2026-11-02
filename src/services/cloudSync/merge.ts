// Adapted from napo/analisirefertogara (AGPL-3.0-or-later), webapp/src/sync/merge.js.
import type { Quiz } from '../../types/quiz';

/**
 * A deleted quiz leaves a dated deletion, so it reaches the other devices instead of coming back.
 * The base holds the stamp of every quiz at the last sync: a side whose stamp differs has changed since.
 * - Changed on one side only: that side wins.
 * - Changed on both sides: the latest change wins, the other version stays as a copy with a new id.
 * - Edited on one side, deleted on the other: the edit wins.
 * Stamps only grow on the device that writes them, so a remote stamp older than the base is not a change: it is a file
 * that another device overwrote on a service without conditional writes, and the local version repairs it.
 */
export interface SyncRecord { id: string; updatedAt: number; quiz: Quiz }
export interface SyncDeletion { id: string; deletedAt: number }
export interface SyncSnapshot { quizzes: SyncRecord[]; deletions: SyncDeletion[] }
export type SyncBase = Record<string, number>;
interface Entry { id: string; quiz: Quiz | null; stamp: number }

export const EMPTY_SNAPSHOT: SyncSnapshot = { quizzes: [], deletions: [] };
/** Older deletions are forgotten: a device offline for longer may bring the quiz back. */
export const DELETION_KEPT_DAYS = 400;
export const newSyncId = () => `quiz-${crypto.randomUUID()}`;

function entries(snapshot: SyncSnapshot): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const { id, quiz, updatedAt } of snapshot.quizzes) map.set(id, { id, quiz, stamp: updatedAt });
  // A deletion hides a quiz of the same snapshot only when it is later.
  for (const { id, deletedAt } of snapshot.deletions) {
    const present = map.get(id);
    if (!present || present.stamp < deletedAt) map.set(id, { id, quiz: null, stamp: deletedAt });
  }
  return map;
}

const same = (a: Entry, b: Entry) => (a.quiz === null) === (b.quiz === null) && (a.quiz === null || JSON.stringify(a.quiz) === JSON.stringify(b.quiz));
// On the same stamp the local version wins.
const latest = (local: Entry, remote: Entry) => remote.stamp > local.stamp ? remote : local;

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot, base: SyncBase, createId = newSyncId, now = Date.now()) {
  const l = entries(local), r = entries(remote), out = new Map<string, Entry>();
  let conflicts = 0;
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id), b = r.get(id);
    if (!a || !b) { out.set(id, (a ?? b)!); continue; }
    if (same(a, b)) { out.set(id, a); continue; }
    const known = base[id];
    if (known !== undefined && b.stamp <= known) { out.set(id, a); continue; }
    if (known !== undefined && a.stamp === known) { out.set(id, b); continue; }
    if (!a.quiz !== !b.quiz) { out.set(id, a.quiz ? a : b); continue; }
    const winner = latest(a, b), loser = winner === a ? b : a;
    out.set(id, winner);
    if (winner.quiz && loser.quiz) {
      const copy = createId();
      out.set(copy, { id: copy, quiz: { ...loser.quiz, id: copy }, stamp: loser.stamp });
      conflicts++;
    }
  }
  const oldest = now - DELETION_KEPT_DAYS * 86_400_000;
  const kept = [...out.values()].filter(entry => entry.quiz !== null || entry.stamp >= oldest);
  const merged: SyncSnapshot = {
    quizzes: kept.filter(entry => entry.quiz).map(entry => ({ id: entry.id, updatedAt: entry.stamp, quiz: entry.quiz! })),
    deletions: kept.filter(entry => !entry.quiz).map(entry => ({ id: entry.id, deletedAt: entry.stamp })),
  };
  return { merged, base: Object.fromEntries(kept.map(entry => [entry.id, entry.stamp])) as SyncBase, conflicts };
}

/** Nothing changed on this device since the last sync: every entry still has the stamp the base recorded. */
export function matchesBase(snapshot: SyncSnapshot, base: SyncBase, now = Date.now()) {
  const oldest = now - DELETION_KEPT_DAYS * 86_400_000, seen = new Set<string>();
  for (const [id, entry] of entries(snapshot)) {
    // Expired deletions leave the base but may stay on the device.
    if (!entry.quiz && entry.stamp < oldest && base[id] === undefined) continue;
    if (base[id] !== entry.stamp) return false;
    seen.add(id);
  }
  return Object.keys(base).every(id => seen.has(id));
}

/** The quizzes to write and delete to turn `from` into `to`. */
export function snapshotChanges(from: SyncSnapshot, to: SyncSnapshot) {
  const before = entries(from), puts: SyncRecord[] = [], deletions: SyncDeletion[] = [];
  for (const [id, entry] of entries(to)) {
    const old = before.get(id);
    if (old && same(old, entry) && old.stamp === entry.stamp) continue;
    if (entry.quiz) puts.push({ id, updatedAt: entry.stamp, quiz: entry.quiz });
    else deletions.push({ id, deletedAt: entry.stamp });
  }
  return { puts, deletions, changed: puts.length > 0 || deletions.length > 0 };
}

/** What the local archive held when it was read, to spot changes made during a sync. */
export const snapshotStamps = (snapshot: SyncSnapshot) => new Map([...entries(snapshot)].map(([id, entry]) => [id, entry.stamp]));
