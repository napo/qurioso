/** The public site is a static app; installing its PWA does not create a quiz server. */
export function isPublicWebsite(hostname = window.location.hostname) {
  return ['qurioso.it', 'www.qurioso.it'].includes(hostname.toLowerCase());
}

export const INTERNET_PREFERENCE_KEY = 'qurioso_internet_preference_v1';
export type InternetPreference = 'lan' | 'internet';
export function readInternetPreference(): InternetPreference | null {
  try { const value = localStorage.getItem(INTERNET_PREFERENCE_KEY); return value === 'lan' || value === 'internet' ? value : null; }
  catch { return null; }
}
export function saveInternetPreference(value: InternetPreference) {
  localStorage.setItem(INTERNET_PREFERENCE_KEY, value);
}
