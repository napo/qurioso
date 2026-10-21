const { contextBridge, ipcRenderer } = require('electron');
const argument = process.argv.find(value => value.startsWith('--qurioso-server-port='));
const port = Number(argument?.split('=')[1]);
if (Number.isInteger(port) && port > 0 && port < 65536) {
  contextBridge.exposeInMainWorld('quriosoDesktop', Object.freeze({ serverPort: port,
    internetSharing: Object.freeze({
      status: () => ipcRenderer.invoke('qurioso:sharing:status'),
      start: pin => ipcRenderer.invoke('qurioso:sharing:start', pin),
      stop: () => ipcRenderer.invoke('qurioso:sharing:stop'),
      onChange: callback => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, state) => callback(state);
        ipcRenderer.on('qurioso:sharing:changed', listener);
        return () => ipcRenderer.removeListener('qurioso:sharing:changed', listener);
      },
    }),
    // Native File/Help menu commands; items are enabled only while the library is visible.
    menu: Object.freeze({
      onCommand: callback => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, command) => callback(command);
        ipcRenderer.on('qurioso:menu:command', listener);
        return () => ipcRenderer.removeListener('qurioso:menu:command', listener);
      },
      setLibraryVisible: visible => ipcRenderer.send('qurioso:menu:state', visible === true),
    }),
  }));
}
