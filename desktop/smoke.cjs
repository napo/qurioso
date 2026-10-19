exports.run = async (window, port) => {
  const result = await window.webContents.executeJavaScript(`(async () => {
    const waitFor = async condition => {
      for (let n = 0; n < 100; n++) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
      throw new Error('Desktop interface did not become ready');
    };
    await waitFor(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Quiz in Rete' && !button.disabled));
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Quiz in Rete').click();
    await waitFor(async () => (await (await fetch('/api/health')).json()).activeSessions === 1);
    const health = await (await fetch('/api/health')).json();
    const info = await (await fetch('/api/server-info')).json();
    const ws = new WebSocket('ws://127.0.0.1:' + window.quriosoDesktop.serverPort + '/ws');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket failed')); };
    });
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('qurioso-desktop-smoke', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('test');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction('test', 'readwrite');
    const store = tx.objectStore('test');
    const previous = await new Promise((resolve, reject) => {
      const request = store.get('marker'); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
    });
    store.put('saved', 'marker');
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    database.close();
    return { origin: location.origin, port: health.port, configuredPort: window.quriosoDesktop.serverPort,
      nodeAccess: typeof window.require, health: health.status, localIps: info.localIps, previous,
      title: document.title };
  })()`);
  if (result.health !== 'ok' || result.port !== port || result.configuredPort !== port || result.nodeAccess !== 'undefined' || result.origin !== 'http://qurioso.localhost') {
    throw new Error(`Desktop smoke failed: ${JSON.stringify(result)}`);
  }
  return result;
};
