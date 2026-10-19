const { app, BrowserWindow, dialog, net, session, shell, utilityProcess, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const ORIGIN = 'http://qurioso.localhost';
const smoke = process.env.QURIOSO_DESKTOP_SMOKE === '1';
let window;
let backend;
let quitting = false;
let backendPort;

app.setName('Qurioso');
if (smoke && process.env.QURIOSO_TEST_USER_DATA) app.setPath('userData', process.env.QURIOSO_TEST_USER_DATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(fail);
}

function fail(error) {
  console.error('Qurioso desktop:', error);
  quitting = true;
  backend?.kill();
  if (!smoke) dialog.showErrorBox('Qurioso', `Impossibile avviare Qurioso.\n${error.message || error}`);
  app.exit(1);
}

async function start() {
  const root = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const serverFile = app.isPackaged ? path.join(root, 'server.mjs') : path.join(root, 'build/desktop/server.mjs');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  backend = utilityProcess.fork(serverFile, [], {
    cwd: app.getPath('userData'),
    env: { ...process.env, NODE_ENV: 'production', PORT: '0', QURIOSO_DIST_PATH: path.join(root, 'dist') },
    stdio: 'pipe',
    serviceName: 'Qurioso local quiz server',
  });
  backend.stdout?.on('data', data => console.log(String(data).trim()));
  backend.stderr?.on('data', data => console.error(String(data).trim()));
  backendPort = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Il server locale non risponde.')), 20000);
    backend.once('message', message => {
      if (message?.type === 'ready' && Number.isInteger(message.port) && message.port > 0 && message.port < 65536) {
        clearTimeout(timer); resolve(message.port);
      }
    });
    backend.once('exit', code => { clearTimeout(timer); reject(new Error(`Server locale terminato (${code}).`)); });
  });
  backend.on('exit', code => { if (!quitting) fail(new Error(`Il server locale si è fermato (${code}). Riavvia Qurioso.`)); });

  // A fixed browser origin preserves IndexedDB while the LAN server gets a new free port.
  const browserSession = session.fromPartition('persist:qurioso');
  await browserSession.protocol.handle('http', async request => {
    if (quitting) return new Response(null, { status: 503 });
    const url = new URL(request.url);
    if (url.origin === ORIGIN) {
      url.hostname = '127.0.0.1';
      url.port = String(backendPort);
      try { return await net.fetch(new Request(url.href, request), { bypassCustomProtocolHandlers: true }); }
      catch (error) { if (quitting) return new Response(null, { status: 503 }); throw error; }
    }
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });
  window = new BrowserWindow({
    width: 1280, height: 850, minWidth: 720, minHeight: 540,
    title: 'Qurioso', backgroundColor: '#ffffff', show: false,
    icon: path.join(root, app.isPackaged ? 'dist/icon-512.png' : 'public/icon-512.png'),
    webPreferences: {
      session: browserSession,
      preload: path.join(app.getAppPath(), 'desktop/preload.cjs'),
      additionalArguments: [`--qurioso-server-port=${backendPort}`],
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  const openExternal = url => {
    try { if (['https:', 'http:'].includes(new URL(url).protocol)) shell.openExternal(url).catch(console.error); } catch {}
  };
  window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== ORIGIN) { event.preventDefault(); openExternal(url); }
  });
  browserSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(Boolean(contents?.getURL().startsWith(ORIGIN + '/') && ['clipboard-sanitized-write', 'fullscreen'].includes(permission)));
  });
  window.once('ready-to-show', () => { if (!smoke) window.show(); });
  window.on('closed', () => { window = null; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Qurioso', submenu: [
      { label: 'Quiz in Rete', click: () => window?.loadURL(`${ORIGIN}/?app=network`) },
      { label: 'Attività in classe', click: () => window?.loadURL(`${ORIGIN}/?app=classroom`) },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' },
  ]));
  await window.loadURL(`${ORIGIN}/?app=network`);
  if (smoke) {
    const result = await require('./smoke.cjs').run(window, backendPort);
    console.log(`QURIOSO_SMOKE_RESULT=${JSON.stringify(result)}`);
    app.quit();
  }
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; window?.destroy(); backend?.kill(); });
app.on('will-quit', () => { backend?.kill(); });
