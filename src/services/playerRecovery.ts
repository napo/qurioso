import type { PlayerCredential } from '../types/playerCredential';
const PREFIX = 'qurioso_player_recovery_v1:';
const LAST = 'qurioso_player_recovery_last_v1';

// Only a room-scoped secret: never cache scores, answers, nickname or presenter data.
export function readPlayerCredential(pin?: string): PlayerCredential | null | 'invalid' {
  let target: string | null | undefined, raw: string | null;
  try {
    target = pin || window.localStorage.getItem(LAST);
    if (!target) return null;
    if (!/^\d{6}$/.test(target)) return 'invalid';
    raw = window.localStorage.getItem(PREFIX + target);
    if (!raw) return null;
  } catch { return null; } // Storage blocked is not an invalid identity.
  try {
    const value = JSON.parse(raw);
    if (!value || value.pin !== target || typeof value.playerId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.playerId) ||
        typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token) || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) return 'invalid';
    // Only the server clock decides expiry; a school PC may have a wrong wall clock.
    return { pin: target, playerId: value.playerId, token: value.token, expiresAt: value.expiresAt };
  } catch { return 'invalid'; }
}
export function savePlayerCredential(credential: PlayerCredential): boolean {
  try {
    window.localStorage.setItem(PREFIX + credential.pin, JSON.stringify(credential));
    window.localStorage.setItem(LAST, credential.pin);
    return true;
  } catch { return false; }
}
export function clearPlayerCredential(pin?: string, credential?: PlayerCredential) {
  try {
    const target = pin || window.localStorage.getItem(LAST);
    if (!target) { window.localStorage.removeItem(LAST); return; }
    // An old tab must not erase a different participant's newer credential.
    if (credential) {
      const raw = window.localStorage.getItem(PREFIX + target);
      if (raw) {
        let saved;
        try { saved = JSON.parse(raw); } catch { /* An unreadable record is also removed on explicit leave. */ }
        if (saved && typeof saved.playerId === 'string' && typeof saved.token === 'string' &&
            (saved.playerId !== credential.playerId || saved.token !== credential.token)) return;
      }
    }
    window.localStorage.removeItem(PREFIX + target);
    if (window.localStorage.getItem(LAST) === target) window.localStorage.removeItem(LAST);
  } catch { /* Blocking browser storage must not break ordinary participation. */ }
}
