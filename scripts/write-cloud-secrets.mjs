import { writeFile } from 'node:fs/promises';
// Google's desktop client secret is public by nature (RFC 8252) but stays out of the repository. Forks build without it: the service stays hidden.
const googleDesktopSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
if (googleDesktopSecret) await writeFile(new URL('../desktop/cloudSecrets.cjs', import.meta.url), `module.exports = ${JSON.stringify({ googleDesktopSecret })};\n`);
console.log(googleDesktopSecret ? 'Cloud secrets written.' : 'No cloud secrets: Google Drive stays hidden in this build.');
