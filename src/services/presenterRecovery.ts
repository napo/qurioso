const KEY = 'qurioso_presenter_recovery_v1';
export interface PresenterCredential { pin: string; token: string }

// Per-tab, same-origin lifetime: no localStorage, URL, quiz export or participant state.
export function readPresenterCredential(): PresenterCredential | null | 'invalid' {
  let raw: string | null;
  try { raw = window.sessionStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.pin !== 'string' || typeof value.token !== 'string' || !/^\d{6}$/.test(value.pin) || !/^[a-f0-9]{64}$/.test(value.token)) return 'invalid';
    return { pin: value.pin, token: value.token };
  } catch { return 'invalid'; }
}
export function savePresenterCredential(pin: string, token: string): boolean {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ pin, token })); return true; }
  catch { return false; }
}
export function clearPresenterCredential(pin?: string) {
  try {
    const stored = readPresenterCredential();
    if (!pin || stored === 'invalid' || stored?.pin === pin) window.sessionStorage.removeItem(KEY);
  } catch { /* Storage can be unavailable without affecting the running quiz. */ }
}
