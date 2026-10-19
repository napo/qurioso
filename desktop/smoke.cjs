exports.run = async (window, port) => {
  window.webContents.setBackgroundThrottling(false);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const waitFor = async (condition, label) => {
      for (let n = 0; n < 100; n++) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
      throw new Error('Desktop interface did not become ready: ' + label + ' | ' + document.body.textContent.slice(0, 1800));
    };
    await waitFor(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Quiz classico in rete' && !button.disabled), 'network quiz entry');
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Quiz classico in rete').click();
    await waitFor(async () => (await (await fetch('/api/health')).json()).activeSessions === 1, 'authenticated host creates room');
    const health = await (await fetch('/api/health')).json();
    const info = await (await fetch('/api/server-info')).json();
    const pin = [...document.querySelectorAll('span')].find(el => /^\\d{6}$/.test(el.textContent || '')).textContent;
    const player = { id: 'desktop-smoke-player', nickname: 'Smoke', avatar: '🦊', score: 0, streak: 0 };
    const joined = await fetch('/api/session/' + pin + '/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player }),
    });
    if (!joined.ok) throw new Error('Desktop player could not join');
    const { playerToken } = await joined.json();
    const denied = await fetch('/api/session/' + pin, { method: 'DELETE', headers: { Authorization: 'Bearer ' + playerToken } });
    if (denied.status !== 403) throw new Error('Player was allowed to delete the desktop session');
    const ws = new WebSocket('ws://127.0.0.1:' + window.quriosoDesktop.serverPort + '/ws');
    let received;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Authenticated WebSocket timeout')), 5000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'REGISTER', pin, role: 'player', playerId: player.id, token: playerToken }));
      ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'ERROR') { clearTimeout(timer); reject(new Error(message.error)); }
        if (message.type === 'SESSION_STATE_UPDATE') { received = message.session; clearTimeout(timer); resolve(); }
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket failed')); };
    });
    await waitFor(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Inizia il Quiz') && !button.disabled), 'host receives participant join');
    [...document.querySelectorAll('button')].find(button => button.textContent.includes('Inizia il Quiz')).click();
    await waitFor(() => received?.status === 'question', 'participant receives question');
    if (received.currentQuestion.options.some(option => 'isCorrect' in option)) throw new Error('Desktop exposed the solution key');
    const answered = await fetch('/api/session/' + pin + '/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + playerToken },
      body: JSON.stringify({ playerId: player.id, roundId: received.roundId, questionId: received.currentQuestion.id, optionId: received.currentQuestion.options[0].id, timeTakenMs: 1000 }),
    });
    if (!answered.ok) throw new Error('Desktop rejected an authenticated answer');
    await waitFor(() => received?.status === 'question_results', 'participant receives result');
    if (!received.players[player.id].lastAnswer || !Object.keys(received.answersForCurrentQuestion).length) throw new Error('Desktop result did not arrive');
    ws.close();
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
    return { pin, roundId: received.roundId, score: received.players[player.id].score, origin: location.origin, port: health.port, configuredPort: window.quriosoDesktop.serverPort,
      nodeAccess: typeof window.require, health: health.status, localIps: info.localIps, previous,
      title: document.title };
  })()`);
  // A real renderer reload must recover the private host, without recreating the room.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Desktop reload timed out')), 10000);
    window.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
    window.webContents.reload();
  });
  const recovered = await window.webContents.executeJavaScript(`(async () => {
    const waitFor = async condition => {
      for (let n = 0; n < 150; n++) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
      throw new Error('Presenter did not recover after desktop reload');
    };
    await waitFor(() => document.body.textContent.includes('Sessione recuperata'));
    const pin = [...document.querySelectorAll('span')].find(el => /^\\d{6}$/.test(el.textContent || '')).textContent;
    const state = (await (await fetch('/api/session/' + pin)).json()).session;
    const activeSessions = (await (await fetch('/api/health')).json()).activeSessions;
    const exit = [...document.querySelectorAll('header button')].find(button => ['Esci', 'Exit', 'Beenden'].includes(button.textContent.trim()));
    if (!exit) throw new Error('Recovered host has no exit control');
    exit.click();
    await waitFor(async () => (await (await fetch('/api/health')).json()).activeSessions === 0);
    if (sessionStorage.getItem('qurioso_presenter_recovery_v1')) throw new Error('Explicit exit retained the recovery credential');
    return { pin, roundId: state.roundId, status: state.status, score: state.players['desktop-smoke-player'].score, activeSessions };
  })()`);
  if (recovered.pin !== result.pin || recovered.roundId !== result.roundId || recovered.status !== 'question_results' ||
      recovered.score !== result.score || recovered.activeSessions !== 1) throw new Error('Desktop reload lost the active game');
  if (result.health !== 'ok' || result.port !== port || result.configuredPort !== port || result.nodeAccess !== 'undefined' || result.origin !== 'http://qurioso.localhost') {
    throw new Error(`Desktop smoke failed: ${JSON.stringify(result)}`);
  }
  await require('./presenterSmoke.cjs').run(window, port);
  await require('./studentSmoke.cjs').run(window);
  await require('./editorSmoke.cjs').run(window);
  await require('./updateSmoke.cjs').run(window, result.previous);
  return result;
};
