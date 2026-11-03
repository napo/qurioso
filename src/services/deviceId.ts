// A random code for this browser, sent when joining a game. It says nothing about the device: the presenter only
// learns that two participants joined from the same browser. A private window or cleared site data gives a new one.
const KEY = 'qurioso_device_v1';

export function deviceId(): string | undefined {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[a-f0-9]{32}$/.test(saved)) return saved;
    const created = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, created);
    return created;
  } catch { return undefined; }
}
