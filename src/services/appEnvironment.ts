/** The public site is a static app; installing its PWA does not create a quiz server. */
export function isPublicWebsite(hostname = window.location.hostname) {
  return ['qurioso.it', 'www.qurioso.it'].includes(hostname.toLowerCase());
}
