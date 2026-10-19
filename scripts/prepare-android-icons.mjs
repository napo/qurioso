import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const res = new URL('android/app/src/main/res/', root);
// Run after Capacitor creates/syncs the native project.
await access(new URL('android/app/src/main/AndroidManifest.xml', root));
await cp(new URL('resources/icons/android/', root), res, { recursive: true });
const adaptive = new URL('mipmap-anydpi-v26/', res);
await mkdir(adaptive, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/white" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(new URL(name, adaptive), xml);
}
console.log(`Qurioso launcher icons installed in ${fileURLToPath(res)}`);
