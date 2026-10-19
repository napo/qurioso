const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { app, Menu } = require('electron');
const { createUpdateController } = require('./updateController.cjs');
const { readSettings } = require('./updates.cjs');

exports.run = async (window, previous) => {
  const menu = Menu.getApplicationMenu();
  for (const id of ['qurioso-check-updates', 'qurioso-auto-updates', 'qurioso-cancel-update', 'qurioso-update-folder']) assert.ok(menu.getMenuItemById(id), id);
  const automatic = menu.getMenuItemById('qurioso-auto-updates');
  assert.equal(automatic.checked, previous === null);
  // Electron's native MenuItem.click toggles checkboxes before invoking the callback.
  if (automatic.checked) automatic.click(automatic);
  for (let attempt = 0; attempt < 100 && (await readSettings(app.getPath('userData'))).enabled; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await readSettings(app.getPath('userData'))).enabled, false);
  assert.equal(await window.webContents.executeJavaScript(`typeof window.quriosoDesktop.checkForUpdates`), 'undefined', 'LAN renderer has no updater privileges');
  const bytes = Buffer.from('Qurioso smoke installer fixture: must never be executed.');
  const name = 'Qurioso-99.0.0-win-x64.exe';
  const asset = { name, size: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, browser_download_url: `https://github.com/napo/qurioso/releases/download/v99.0.0/${name}` };
  let dialogs = 0, downloads = 0;
  const controller = await createUpdateController({
    app: { isPackaged: true, getVersion: () => '1.0.0', getPath: name => app.getPath(name) }, window,
    dialog: { showMessageBox: async () => ({ response: dialogs++ === 0 ? 0 : 1 }) },
    shell: { openPath: async () => { throw new Error('Smoke must not execute installer'); }, showItemInFolder: () => { throw new Error('Smoke must not open file manager'); } },
    platform: 'win32', arch: 'x64', automatic: false, canOpenInstaller: async () => false,
    fetchImpl: async url => { if (url.includes('api.github.com')) return Response.json({ tag_name: 'v99.0.0', assets: [asset] }); downloads++; return new Response(bytes); },
  });
  await controller.check(true); controller.stop();
  assert.equal(dialogs, 2); assert.equal(downloads, 1);
  const folder = path.join(app.getPath('userData'), 'updates');
  const files = await fs.readdir(folder, { recursive: true });
  const fixture = files.find(file => file.endsWith(name));
  assert.ok(fixture); assert.deepEqual(await fs.readFile(path.join(folder, fixture)), bytes);
  console.log('Updater smoke passed: native menu, preference persisted across launches, isolated renderer, confirmed streaming download and SHA256 verification, no installer executed.');
};
