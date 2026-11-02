// OAuth clients of the installed app (docs/CLOUD_SYNC.md). An empty id hides that service. None of these is a real
// secret (RFC 8252), but secret scanners flag Google's, so CI writes it to the untracked cloudSecrets.cjs.
let secrets = {};
try { secrets = require('./cloudSecrets.cjs'); } catch { /* Not configured in this build. */ }

const CLOUD_CLIENTS = { 'google-drive': '58740605635-46atpjk0ap92fhdkl1657cm7igth83v7.apps.googleusercontent.com', dropbox: 'cgbdtv9h57oqje8', onedrive: 'fa9879a2-acdc-4d25-a94c-8816d7a6d2cc' };
module.exports = { CLOUD_CLIENTS, GOOGLE_DESKTOP_SECRET: secrets.googleDesktopSecret || '' };
