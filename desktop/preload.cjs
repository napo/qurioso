const { contextBridge } = require('electron');
const argument = process.argv.find(value => value.startsWith('--qurioso-server-port='));
const port = Number(argument?.split('=')[1]);
if (Number.isInteger(port) && port > 0 && port < 65536) {
  contextBridge.exposeInMainWorld('quriosoDesktop', Object.freeze({ serverPort: port }));
}
