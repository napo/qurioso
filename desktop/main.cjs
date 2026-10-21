const { app, BrowserWindow, dialog, net, session, shell, utilityProcess, Menu, ipcMain } = require('electron');
const { randomBytes } = require('node:crypto');
const { MENU_TEXT, menuLanguage } = require('./menuText.cjs');
const path = require('node:path');
const fs = require('node:fs');
const ORIGIN = 'http://qurioso.localhost';
const smoke = process.env.QURIOSO_DESKTOP_SMOKE === '1';
const captureGuide = process.env.QURIOSO_GUIDE_CAPTURE;
if (captureGuide && !process.env.QURIOSO_TEST_USER_DATA) throw new Error('Guide capture requires an isolated profile. Use npm run desktop:guide-screenshots.');
let window;
let backend;
let quitting = false;
let backendPort;
let updater;
let sharing;
// Menu and default interface language: the system language when supported, English otherwise.
let menuLanguageCode;
const sharingToken = randomBytes(32).toString('hex');

app.setName('Qurioso');
if ((smoke || captureGuide) && process.env.QURIOSO_TEST_USER_DATA) app.setPath('userData', process.env.QURIOSO_TEST_USER_DATA);

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
  sharing?.shutdown();
  if (!smoke && !captureGuide) dialog.showErrorBox('Qurioso', `Impossibile avviare Qurioso.\n${error.message || error}`);
  app.exit(1);
}

async function start() {
  menuLanguageCode = menuLanguage(app.getPreferredSystemLanguages?.()[0] || app.getLocale());
  const root = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const serverFile = app.isPackaged ? path.join(root, 'server.mjs') : path.join(root, 'build/desktop/server.mjs');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  backend = utilityProcess.fork(serverFile, [], {
    cwd: app.getPath('userData'),
    env: { ...process.env, NODE_ENV: 'production', PORT: '0', QURIOSO_DIST_PATH: path.join(root, 'dist'), QURIOSO_PUBLIC_TUNNEL_TOKEN: sharingToken },
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
      additionalArguments: [`--qurioso-server-port=${backendPort}`, `--qurioso-language=${menuLanguageCode}`],
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
  window.once('ready-to-show', () => { if (!smoke && !captureGuide) window.show(); });
  window.on('closed', () => { window = null; });
  let configuration = Promise.resolve();
  sharing = require('./internetSharing.cjs').createInternetSharing({
    directory: path.join(app.getPath('userData'), 'components'), port: backendPort,
    hostHeader: `qurioso-public-${sharingToken}.localhost`,
    configure: share => {
      const next = configuration.catch(() => {}).then(async () => {
        const response = await fetch(`http://127.0.0.1:${backendPort}/api/desktop/internet-sharing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sharingToken}` },
          body: JSON.stringify({ share }), signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Local sharing configuration failed');
      });
      configuration = next; return next;
    },
    onChange: state => { if (window && !window.isDestroyed()) window.webContents.send('qurioso:sharing:changed', state); },
  });
  const trustedCaller = event => event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame && new URL(event.senderFrame.url).origin === ORIGIN;
  for (const action of ['status', 'start', 'stop', 'release']) ipcMain.handle(`qurioso:sharing:${action}`, (event, pin) => {
    if (!trustedCaller(event)) throw new Error('Native sharing unavailable');
    return action === 'status' ? sharing.snapshot() : action === 'start' ? sharing.start(typeof pin === 'string' ? pin : '') : action === 'release' ? sharing.release() : sharing.stop();
  });
  window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => { if (isMainFrame && !isInPlace && sharing.hasConnector()) void sharing.stop(); });
  window.webContents.on('render-process-gone', () => sharing.shutdown());
  updater = await require('./updateController.cjs').createUpdateController({ app, dialog, shell, window, automatic: app.isPackaged && !smoke,
    canOpenInstaller: async () => {
      if (!window || window.isDestroyed()) return false;
      try {
        const health = await fetch(`http://127.0.0.1:${backendPort}/api/health`, { signal: AbortSignal.timeout(2000) }).then(response => response.json());
        return health.activeSessions === 0 && await window.webContents.executeJavaScript(`location.origin === 'http://qurioso.localhost' && Boolean(document.querySelector('[data-qurioso-dashboard]'))`);
      } catch { return false; }
    },
  });
  // File and Help commands are handled by the renderer; they stay disabled until the library reports it is visible.
  // Labels follow menuLanguage (system language at start, then the language chosen in the app).
  const libraryCommands = ['new-quiz', 'new-video-quiz', 'import-questions', 'backup', 'guide', 'about'];
  let libraryVisible = false;
  const buildMenu = () => {
    const text = MENU_TEXT[menuLanguageCode];
    const command = (name, label, accelerator) => ({ id: `qurioso-${name}`, label, accelerator, enabled: libraryVisible,
      click: () => { if (window && !window.isDestroyed()) window.webContents.send('qurioso:menu:command', name); } });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'Qurioso', submenu: [
        { label: text.networkQuiz, click: () => window?.loadURL(`${ORIGIN}/?app=network`) },
        { label: text.classroom, click: () => window?.loadURL(`${ORIGIN}/?app=classroom`) },
        { type: 'separator' }, ...updater.menuItems(text),
        { type: 'separator' }, { role: 'quit', label: text.quit },
      ] },
      { id: 'qurioso-file-menu', label: text.file, submenu: [
        command('new-quiz', text.newQuiz, 'CmdOrCtrl+N'),
        command('new-video-quiz', text.newVideoQuiz, 'CmdOrCtrl+Shift+N'),
        { type: 'separator' },
        command('import-questions', text.importQuestions),
        command('backup', text.backup),
      ] },
      { label: text.edit, submenu: [
        { role: 'undo', label: text.undo }, { role: 'redo', label: text.redo }, { type: 'separator' },
        { role: 'cut', label: text.cut }, { role: 'copy', label: text.copy }, { role: 'paste', label: text.paste }, { role: 'selectAll', label: text.selectAll },
      ] },
      { label: text.view, submenu: [
        { role: 'reload', label: text.reload }, { role: 'forceReload', label: text.forceReload }, { role: 'toggleDevTools', label: text.toggleDevTools }, { type: 'separator' },
        { role: 'resetZoom', label: text.resetZoom }, { role: 'zoomIn', label: text.zoomIn }, { role: 'zoomOut', label: text.zoomOut }, { type: 'separator' },
        { role: 'togglefullscreen', label: text.toggleFullscreen },
      ] },
      { label: text.help, role: 'help', submenu: [
        command('guide', text.guide, 'F1'),
        command('about', text.about),
      ] },
    ]));
  };
  buildMenu();
  const setLibraryVisible = visible => {
    libraryVisible = visible;
    const menu = Menu.getApplicationMenu();
    for (const name of libraryCommands) { const item = menu?.getMenuItemById(`qurioso-${name}`); if (item) item.enabled = libraryVisible; }
  };
  ipcMain.on('qurioso:menu:state', (event, visible) => { if (trustedCaller(event)) setLibraryVisible(visible === true); });
  // A new page starts with the commands disabled until its library reports it is ready.
  window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => { if (isMainFrame && !isInPlace) setLibraryVisible(false); });
  ipcMain.on('qurioso:menu:language', (event, language) => {
    if (!trustedCaller(event) || typeof language !== 'string' || !Object.hasOwn(MENU_TEXT, language) || language === menuLanguageCode) return;
    menuLanguageCode = language;
    buildMenu();
  });
  if (captureGuide) {
    window.webContents.setBackgroundThrottling(false);
  }
  // Smoke fixtures use Italian labels independently of the operating system locale.
  await window.loadURL(`${ORIGIN}/?app=network${smoke ? '&lang=it' : ''}`);
  if (!captureGuide) updater.start();
  if (captureGuide) {
    await require('./captureGuide.cjs').run(window, backendPort, captureGuide);
    app.quit();
  } else if (smoke) {
    const result = await require('./smoke.cjs').run(window, backendPort);
    console.log(`QURIOSO_SMOKE_RESULT=${JSON.stringify(result)}`);
    app.quit();
  }
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; sharing?.shutdown(); updater?.stop(); window?.destroy(); backend?.kill(); });
app.on('will-quit', () => { sharing?.shutdown(); backend?.kill(); });
