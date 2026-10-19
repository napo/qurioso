const fs = require('node:fs/promises');

exports.run = async window => {
  window.setContentSize(1366, 768); window.webContents.setZoomFactor(1);
  const prefix = `const wait = async (condition, label) => {
    for (let n = 0; n < 300; n++) { if (await condition()) return; await new Promise(r => setTimeout(r, 30)); }
    throw new Error('Video editor smoke timeout: ' + label + ' | ' + document.body.textContent.slice(0, 1200));
  };
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  const set = (input, value) => { const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const editVideo = async () => {
    await wait(() => [...document.querySelectorAll('.group')].some(card => card.textContent.includes('Collaudo video del docente')), 'video library card');
    const card = [...document.querySelectorAll('.group')].find(card => card.textContent.includes('Collaudo video del docente'));
    [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Modifica').click();
  };
  const library = async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('qurioso-library', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction(['library', 'videos'], 'readonly'), q = tx.objectStore('library').get('quizzes'), count = tx.objectStore('videos').count();
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    return { quiz: q.result.find(q => q.id === 'presenter-layout-video'), assets: count.result };
  };`;
  const execute = script => window.webContents.executeJavaScript(`(async () => { ${prefix} ${script} })()`, true);
  await window.loadURL('http://qurioso.localhost/?app=classroom&lang=it');
  const initialAssets = await execute(`
    await editVideo(); await wait(() => document.querySelector('video')?.duration > 0 && !button('Salva Quiz').disabled, 'video metadata');
    const assetCountBeforeUpload = (await library()).assets;
    // Relink the tiny local WebM fixture through the real source picker.
    const blob = await (await fetch(document.querySelector('video').src)).blob();
    const file = new File([blob], 'editor-smoke.webm', { type: 'video/webm' });
    const data = new DataTransfer(); data.items.add(file);
    const input = document.querySelector('input[aria-label="Carica video dal computer"]'); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(() => document.querySelector('video')?.src.startsWith('blob:') && document.querySelector('video').duration > 0 && !button('Salva Quiz').disabled, 'stored local asset');
    document.querySelector('.video-editor-workspace details').open = false;
    for (const selector of ['.editor-video-surface', '.timeline-markers', 'textarea[aria-label="Testo della domanda"]', '.editor-question-list']) {
      const el = document.querySelector(selector), rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.left < 0 || rect.top < 0 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) throw new Error('Editor layout outside viewport: ' + selector + ' ' + JSON.stringify(rect.toJSON()));
    }
    for (const text of ['Prova attività', 'Salva Quiz']) { const rect = button(text).getBoundingClientRect(); if (rect.bottom > innerHeight || rect.right > innerWidth) throw new Error('Editor action outside viewport'); }
    if (document.documentElement.scrollWidth > innerWidth) throw new Error('Editor horizontal overflow');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return assetCountBeforeUpload;
  `);
  if (process.env.QURIOSO_EDITOR_SCREENSHOT) await fs.writeFile(process.env.QURIOSO_EDITOR_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  const asset = await execute(`
    const media = document.querySelector('video'); media.pause(); media.currentTime = .6;
    await wait(() => !media.seeking, 'seek');
    button('Aggiungi domanda qui').click(); await wait(() => button('Crea nuova domanda qui'), 'capture chooser'); button('Crea nuova domanda qui').click();
    await wait(() => document.querySelector('textarea[aria-label="Testo della domanda"]').value === '', 'new question');
    set(document.querySelector('textarea[aria-label="Testo della domanda"]'), 'Seconda domanda allo stesso istante: verifica che il video resti fermo fino alla conclusione della discussione.');
    await new Promise(r => setTimeout(r, 0));
    button('Aggiungi domanda qui').click(); await wait(() => document.querySelector('select[aria-label="Domanda esistente da associare"]'), 'existing chooser');
    set(document.querySelector('select[aria-label="Domanda esistente da associare"]'), 'layout-question'); await new Promise(r => setTimeout(r, 0)); button('Associa qui').click();
    await wait(() => !button('Salva Quiz').disabled, 'save ready'); button('Salva Quiz').click();
    await wait(() => !document.querySelector('.quiz-editor'), 'saved library');
    const stored = await library();
    if (stored.assets !== ${initialAssets + 1} || !stored.quiz.videoConfig.videoAssetId || stored.quiz.videoConfig.videoUrl.startsWith('blob:')) throw new Error('Persistent video reference invalid');
    const cps = stored.quiz.videoConfig.checkpoints;
    if (cps.length !== 2 || cps[0].timestamp !== cps[1].timestamp || Math.abs(cps[0].timestamp - .6) > .02) throw new Error('Captured timestamp or simultaneous questions lost');
    await editVideo(); await wait(() => document.querySelector('video')?.duration > 0 && !button('Prova attività').disabled, 'reopened editor');
    button('Prova attività').click(); await wait(() => document.querySelector('video')?.duration > 0 && button('Torna all’editor'), 'classroom preview');
    document.querySelector('video').currentTime = .6;
    await wait(() => document.querySelectorAll('.grid button').length === 6, 'first checkpoint'); document.querySelector('.grid button').click();
    await wait(() => button('Continua Video'), 'first feedback'); button('Continua Video').click();
    await wait(() => document.body.textContent.includes('Seconda domanda allo stesso istante') && document.querySelectorAll('.grid button').length === 4, 'simultaneous checkpoint');
    if (!document.querySelector('video').paused) throw new Error('Video resumed between simultaneous questions');
    document.querySelector('.grid button').click(); await wait(() => button('Continua Video'), 'second feedback'); button('Continua Video').click();
    await wait(() => document.body.textContent.includes('Attività conclusa'), 'preview conclusion'); button('Torna all’editor').click();
    await wait(() => document.querySelector('.quiz-editor'), 'return to unsaved editor');
    if ((await (await fetch('/api/health')).json()).activeSessions !== 0) throw new Error('Preview created a multiplayer room');
    set(document.querySelector('textarea[aria-label="Testo della domanda"]'), 'Bozza recuperata dopo il refresh');
    await new Promise(r => setTimeout(r, 750));
    return stored.quiz.videoConfig.videoAssetId;
  `);
  // Simulate the teacher accepting the browser's leave-page prompt on a refresh.
  window.webContents.once('will-prevent-unload', event => event.preventDefault());
  await window.loadURL('http://qurioso.localhost/?app=classroom&lang=it');
  await execute(`
    await editVideo(); await wait(() => button('Riprendi bozza'), 'draft recovery'); button('Riprendi bozza').click();
    await wait(() => document.querySelector('textarea[aria-label="Testo della domanda"]')?.value === 'Bozza recuperata dopo il refresh', 'draft question');
    button('Salva Quiz').click(); await wait(() => !document.querySelector('.quiz-editor'), 'save recovered draft');
    const stored = await library(); if (stored.assets !== ${initialAssets + 1} || stored.quiz.videoConfig.videoAssetId !== ${JSON.stringify(asset)}) throw new Error('Draft/editor duplicated or changed the video asset');
  `);
  console.log('Video editor smoke passed: 1366x768 at 100%, local WebM, capture/create/associate, stable simultaneous checkpoints, classroom preview/conclusion without rooms, save/reopen, draft refresh and no Blob copies during editing.');
};
