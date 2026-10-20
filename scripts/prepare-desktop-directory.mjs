import { chmod, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// An unpacked build is owned by the developer, so its helper cannot be a
// root-owned SUID sandbox. Use Chromium's user-namespace sandbox instead.
// Installed packages retain their own installer-managed helper permissions.
if (process.platform === 'linux') {
  const helper = fileURLToPath(new URL('../release-desktop/linux-unpacked/chrome-sandbox', import.meta.url));
  const info = await stat(helper);
  if (info.uid !== process.getuid()) throw new Error('The unpacked sandbox helper must belong to the current build user.');
  await chmod(helper, 0o755);
  console.log('Unpacked Linux build prepared for user-namespace sandboxing.');
}
