const fs = require('node:fs/promises');
const path = require('node:path');
const updates = require('./updates.cjs');

// Native dialogs/menu keep update privileges completely outside the LAN renderer.
async function createUpdateController({ app, dialog, shell, window, canOpenInstaller = async () => false,
  platform = process.platform, arch = process.arch, fetchImpl = fetch, automatic = app.isPackaged }) {
  const directory = app.getPath('userData');
  const settings = await updates.readSettings(directory);
  let busy = false, stopped = false, abort, timer, settingBusy = false;
  const ask = options => stopped || window.isDestroyed() ? Promise.resolve({ response: -1 }) : dialog.showMessageBox(window, { title: 'Aggiornamenti Qurioso', noLink: true, ...options });
  const originalTitle = window.getTitle?.() || 'Qurioso';
  let percent = -1;
  const progress = value => {
    if (window.isDestroyed()) return;
    window.setProgressBar(value);
    const next = value < 0 ? -1 : Math.floor(value * 100);
    if (next !== percent) { percent = next; window.setTitle?.(next < 0 ? originalTitle : `Scaricamento aggiornamento: ${next}% — Qurioso`); }
  };
  const checkItem = { id: 'qurioso-check-updates', label: 'Verifica aggiornamenti…', click: () => check(true) };
  const automaticItem = { id: 'qurioso-auto-updates', label: 'Controlla aggiornamenti all’avvio', type: 'checkbox', checked: settings.enabled, click: async item => {
    if (settingBusy) { item.checked = settings.enabled; return; }
    settingBusy = true;
    try { await updates.writeSettings(directory, item.checked); settings.enabled = item.checked; automaticItem.checked = item.checked; }
    catch { item.checked = settings.enabled; await ask({ type: 'error', message: 'Impossibile salvare la preferenza degli aggiornamenti.' }); }
    finally { settingBusy = false; }
  } };
  const cancelItem = { id: 'qurioso-cancel-update', label: 'Annulla controllo o download aggiornamento', click: () => abort?.abort() };
  const folderItem = { id: 'qurioso-update-folder', label: 'Apri cartella aggiornamenti scaricati', click: async () => {
    try { const folder = path.join(directory, 'updates'); await fs.mkdir(folder, { recursive: true, mode: 0o700 }); const error = await shell.openPath(folder); if (error) throw new Error(error); }
    catch { await ask({ type: 'error', message: 'Impossibile aprire la cartella degli aggiornamenti.' }); }
  } };

  async function check(manual = false) {
    if (busy || stopped) return;
    if (!app.isPackaged) {
      if (manual) await ask({ message: 'Gli aggiornamenti sono disponibili nell’applicazione installata.', detail: 'Questa copia viene eseguita dall’ambiente di sviluppo.' });
      return;
    }
    busy = true;
    abort = new AbortController();
    let downloadStarted = false;
    try {
      const release = await updates.findUpdate(app.getVersion(), { fetchImpl, signal: abort.signal });
      if (stopped || abort.signal.aborted) return;
      if (!release) {
        if (manual) await ask({ message: 'Nessun aggiornamento disponibile.', detail: `Versione installata: ${app.getVersion()}. Le versioni stabili ricevono solo aggiornamenti stabili.` });
        return;
      }
      let osRelease = '';
      if (platform === 'linux') { try { osRelease = await fs.readFile('/etc/os-release', 'utf8'); } catch {} }
      const format = updates.detectLinuxFormat({ osRelease });
      const asset = updates.selectInstaller(release, platform, arch, format);
      if (!asset) {
        const { response } = await ask({ message: `È disponibile Qurioso ${release.tag_name}.`, detail: 'Non è disponibile un installer verificabile compatibile con questa installazione. Puoi consultare la pagina delle versioni.', buttons: ['Apri pagina delle versioni', 'Più tardi'], defaultId: 1, cancelId: 1 });
        if (response === 0) await shell.openExternal(updates.RELEASE_PAGE);
        return;
      }
      const size = new Intl.NumberFormat('it', { maximumFractionDigits: 1 }).format(asset.size / 1000000);
      const { response } = await ask({ type: 'info', message: `È disponibile una nuova versione di Qurioso: ${release.tag_name}.`,
        detail: `Versione installata: ${app.getVersion()}.\nScarica ${asset.name} (${size} MB).\nIl file sarà scaricato e verificato automaticamente. L’installazione resta una tua scelta e l’app non verrà riavviata.`,
        buttons: ['Scarica aggiornamento', 'Più tardi'], defaultId: 0, cancelId: 1 });
      if (response !== 0 || stopped || abort.signal.aborted) return;
      downloadStarted = true;
      progress(0);
      const file = await updates.downloadInstaller(asset, path.join(directory, 'updates'), { fetchImpl, signal: abort.signal, onProgress: progress });
      progress(-1);
      if (stopped || abort.signal.aborted) return;
      // Recheck after the dialog as the teacher can navigate while downloading.
      const canOpen = !file.endsWith('.AppImage') && await canOpenInstaller();
      const completed = await ask({ message: `Qurioso ${release.tag_name}: download completato e verificato.`,
        detail: `${file}\n\n${canOpen ? 'Apri il programma di installazione e segui le istruzioni del sistema.' : 'Salva il lavoro e termina le attività. Chiudi Qurioso prima di installare o avviare la nuova versione.'}\nLa biblioteca rimane nel profilo locale di Qurioso.`,
        buttons: canOpen ? ['Apri installer', 'Mostra file', 'Più tardi'] : ['Mostra file', 'Più tardi'], defaultId: canOpen ? 1 : 0, cancelId: canOpen ? 2 : 1 });
      if (canOpen && completed.response === 0) {
        if (await canOpenInstaller()) {
          const error = await shell.openPath(file);
          if (error) throw new Error('Impossibile aprire il programma di installazione. Il file verificato resta nella cartella updates del profilo locale.');
        } else { shell.showItemInFolder(file); }
      } else if (completed.response === (canOpen ? 1 : 0)) shell.showItemInFolder(file);
    } catch (error) {
      if ((manual || downloadStarted) && !stopped && !abort.signal.aborted) await ask({ type: 'error', message: 'Aggiornamento non riuscito.', detail: `${error.message}\nLa versione attuale resta utilizzabile. Riprova da Qurioso → Verifica aggiornamenti.`, buttons: ['OK'] });
    } finally {
      progress(-1);
      busy = false;
    }
  }

  return {
    menuItems: [checkItem, automaticItem, cancelItem, folderItem], check,
    start() { if (automatic && settings.enabled && !stopped) { timer = setTimeout(() => { if (settings.enabled) void check(false); }, 2000); timer.unref?.(); } },
    stop() { stopped = true; clearTimeout(timer); abort?.abort(); },
  };
}

module.exports = { createUpdateController };
