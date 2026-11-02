/**
 * OAuth clients for the user's cloud service (docs/CLOUD_SYNC.md). None of these is a secret: a page or an installed
 * app cannot keep one (RFC 8252). An empty id hides that service. The desktop ids are in desktop/cloudConfig.cjs.
 */
export const WEB_CLOUD_CLIENTS = { 'google-drive': '58740605635-71ld5frcqbg224fq69q0lgqqe3hakqrb.apps.googleusercontent.com', dropbox: 'cgbdtv9h57oqje8', onedrive: 'fa9879a2-acdc-4d25-a94c-8816d7a6d2cc' };
/** The sign-in returns only to registered addresses, so copies of the site on other hosts do not offer it. */
export const WEB_CLOUD_ORIGINS = ['https://qurioso.it'];
export type CloudProviderId = keyof typeof WEB_CLOUD_CLIENTS;
export const CLOUD_PROVIDER_IDS = Object.keys(WEB_CLOUD_CLIENTS) as CloudProviderId[];
