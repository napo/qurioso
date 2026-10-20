const { BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const MEDIA = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAQEEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggPu7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjIuMy4xMDBXQYxMYXZmNjIuMy4xMDBEiYhAr0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIMSTYA5lZUAacgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4QL68IA4JCwgaC6gVqagQJVsIRVuYEBElTDZ/tzc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYyLjMuMTAwc3PWY8CLY8WIMSTYA5lZUAZnyKFFo4dFTkNPREVSRIeUTGF2YzYyLjExLjEwMCBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjA0LjAwMDAwMDAwMAAfQ7Z1QkXngQCj1IEAAIDwBQCdASqgAFoAAEcIhYWIhYSIAgICdaoD+AIGmhPghqqTXcQ6qk13EOqpNdxDqqTXcQ6qk13EGAD+/g0P/8s+fw2dTn/5HH8jj+Rx/8hkAKOYgQDIABECAAEQEAAYABhYL/QACICBAAAAo5iBAZAAEQIAARAQABgAGFgv9AAIgIEAAACjmIECWAARAgABEBAAGAAYWC/0AAiAgQAAAKOYgQMgABECAAEQEAAYABhYL/QACICBAAAAo5iBA+gAEQIAARAQABgAGFgv9AAIgIEAAACjmIEEsAARAgABEBAAGAAYWC/0AAiAgQAAAKOXgQV4APEBAAEQEBRgAGFgv9AAIgIEAACjmIEGQAARAgABEBAAGAAYWC/0AAiAgQAAAKOYgQcIABECAAEQEAAYABhYL/QACICBAAAAo5iBB9AAEQIAARAQABgAGFgv9AAIgIEAAACjmIEImAARAgABEBAAGAAYWC/0AAiAgQAAAKOYgQlgABECAAEQEAAYABhYL/QACICBAAAAo5iBCigAEQIAARAQABgAGFgv9AAIgIEAAACjmIEK8AARAgABEBAAGAAYWC/0AAiAgQAAAKOYgQu4ABECAAEQEAAYABhYL/QACICBAAAAo5iBDIAAEQIAARAQABgAGFgv9AAIgIEAAACjmIENSAARAgABEBAAGAAYWC/0AAiAgQAAAKOXgQ4QAPEBAAEQEBRgAGFgv9AAIgIEAACjmIEO2AARAgABEBAAGAAYWC/0AAiAgQAAABxTu2uRu4+zgQC3iveBAfGCAaPwgQM=';

// Runs only in the existing smoke profile, never in the teacher's library.
exports.run = async (host, port) => {
  const prefix = `const wait = async (condition, label) => {
    for (let n = 0; n < 200; n++) { if (await condition()) return; await new Promise(r => setTimeout(r, 30)); }
    throw new Error('Presenter smoke timeout: ' + label + ' | ' + document.body.textContent.slice(0, 1200));
  };
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  const phase = () => document.querySelector('.host-screen')?.dataset.phase;`;
  const execute = (target, script) => target.webContents.executeJavaScript(`(async () => { ${prefix} ${script} })()`, true);
  const sizes = [[1280, 720], [1366, 768], [1920, 1080]];
  const layoutChecks = [];
  const check = async (label, selectors, dimensions = sizes) => {
    for (const [width, height] of dimensions) {
      host.setContentSize(width, height);
      host.webContents.setZoomFactor(1);
      const metrics = await execute(host, `
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        document.querySelector('.host-stage').scrollTop = 0;
        const selectors = ${JSON.stringify(selectors)};
        for (const selector of selectors) {
          const elements = [...document.querySelectorAll(selector)];
          if (!elements.length) throw new Error('Missing layout target: ' + selector);
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.top < -1 || rect.left < -1 || rect.bottom > innerHeight + 1 || rect.right > innerWidth + 1)
              throw new Error(${JSON.stringify(label)} + ' ' + innerWidth + 'x' + innerHeight + ' outside viewport: ' + selector + ' ' + JSON.stringify(rect.toJSON()));
            if (el.scrollWidth > el.clientWidth + 2) throw new Error('Horizontal clipping: ' + selector);
          }
        }
        if (document.documentElement.scrollWidth > innerWidth) throw new Error('Page overflows horizontally');
        return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio };
      `);
      if (metrics.width !== width || metrics.height !== height) throw new Error('Viewport size differs from requested size');
      layoutChecks.push(`${label}:${width}x${height}`);
      if (process.env.QURIOSO_LAYOUT_OUTPUT) {
        await fs.mkdir(process.env.QURIOSO_LAYOUT_OUTPUT, { recursive: true });
        await fs.writeFile(path.join(process.env.QURIOSO_LAYOUT_OUTPUT, `${label}-${width}x${height}.png`), (await host.webContents.capturePage()).toPNG());
      }
    }
  };
  host.setMinimumSize(320, 400);
  const participants = [];
  try {
    await host.loadURL('http://qurioso.localhost/?app=network&lang=it');
    await execute(host, `
      await wait(() => button('Crea Nuovo Quiz'), 'library');
      const options = ['Risposta corretta con un testo leggibile', 'Seconda risposta di lunghezza ordinaria', 'Terza risposta della domanda', 'Quarta risposta della domanda', 'Quinta opzione da visualizzare', 'Sesta opzione da visualizzare'].map((text, index) => ({
        id: 'option-' + index, text, isCorrect: index === 0, color: ['red','blue','yellow','green','purple','orange'][index], shape: ['triangle','diamond','circle','square','star','hexagon'][index]
      }));
      const quiz = { id: 'presenter-layout-classic', title: 'Collaudo docente: domanda con immagine e sei risposte', description: 'Fixture smoke', category: 'Test', createdAt: 1,
        settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: true },
        questions: [{ id: 'layout-question', type: 'multiple_choice', text: 'Quale risposta scegliamo dopo aver osservato questa immagine e discusso insieme i risultati?', timeLimit: 300, points: 1000,
          mediaUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#075e63"/><circle cx="200" cy="120" r="70" fill="#ff963b"/></svg>'),
          explanation: 'La spiegazione deve restare leggibile insieme ai risultati e al comando per continuare.', options }] };
      const video = { ...quiz, id: 'presenter-layout-video', title: 'Collaudo video del docente',
        videoConfig: { videoUrl: ${JSON.stringify(MEDIA)}, videoType: 'html5', pauseMode: 'defined', checkpoints: [{ timestamp: 0, questionId: 'layout-question' }] } };
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('qurioso-library', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const tx = db.transaction('library', 'readwrite'); tx.objectStore('library').put([quiz, video], 'quizzes');
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    `);
    await host.loadURL('http://qurioso.localhost/?app=network&lang=it');
    await execute(host, `await wait(() => button('Quiz classico in rete') && !button('Quiz classico in rete').disabled, 'classic fixture'); button('Quiz classico in rete').click(); await wait(() => phase() === 'lobby' && document.querySelector('[data-testid="join-address"]'), 'lobby address');`);
    await check('classic-lobby', ['.host-header', '.join-address', '[data-testid="join-pin"]', '.host-lobby-banner button', '.host-lobby-qr canvas']);
    await check('mobile-host-lobby', ['.host-header', '.join-address', '[data-testid="join-pin"]'], [[390, 844]]);
    host.setContentSize(1280, 720);
    const entry = await execute(host, `
      const pin = document.querySelector('[data-testid="join-pin"]').textContent;
      const base = document.querySelector('[data-testid="join-address"]').textContent;
      if (new URL(base).search || new URL(base).pathname !== '/') throw new Error('Address contains query or path');
      if ([...document.querySelectorAll('header span')].filter(el => /^\\d{6}$/.test(el.textContent)).some(el => el.textContent !== pin)) throw new Error('Header PIN differs');
      if (!(await (await fetch('/api/session/' + pin)).json()).session) throw new Error('Displayed PIN has no session');
      button('Copia indirizzo').click();
      await wait(() => document.body.textContent.includes('Indirizzo copiato.'), 'copy address');
      return { base, pin };
    `);
    if (new URL(entry.base).port !== String(port)) throw new Error('LAN address lost the dynamic port');
    for (const direct of [false, true]) {
      const player = new BrowserWindow({ show: false, width: 1024, height: 768,
        webPreferences: { partition: `presenter-smoke-${Date.now()}-${direct}`, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
      participants.push(player);
      await player.loadURL(direct ? `${entry.base}/?pin=${entry.pin}&role=player` : entry.base);
      if (!direct) {
        const navigated = new Promise(resolve => player.webContents.once('did-finish-load', resolve));
        await execute(player, `
          if (location.search) throw new Error('Base entry has query parameters');
          await wait(() => [...document.querySelectorAll('a')].some(a => a.getAttribute('href')?.startsWith('?role=player')), 'root PIN entry');
          [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith('?role=player')).click();
        `);
        await navigated;
      }
      await execute(player, `
        await wait(() => document.querySelector('form input'), 'player form');
        const inputs = document.querySelectorAll('form input');
        if (inputs[0].value !== ${JSON.stringify(direct ? entry.pin : '')}) throw new Error('Wrong initial PIN');
        const set = (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
        set(inputs[0], ${JSON.stringify(entry.pin)}); set(inputs[1], ${JSON.stringify(direct ? 'QR smoke' : 'PIN smoke')});
        await new Promise(r => setTimeout(r, 0));
        button('Entra nel Quiz!').click();
        await wait(() => document.body.textContent.includes('Sei nella lobby di gioco!'), 'credentialed participant joins');
        if (sessionStorage.getItem('qurioso_presenter_recovery_v1') || window.quriosoDesktop) throw new Error('Participant has presenter context');
      `);
    }
    // A separate participant renderer also exercises the smartphone breakpoint.
    participants[0].setContentSize(390, 844);
    await execute(participants[0], `await new Promise(r => requestAnimationFrame(r)); if (document.documentElement.scrollWidth > innerWidth) throw new Error('Mobile participant horizontal overflow');`);
    await execute(host, `await wait(() => !button('Inizia il Quiz!').disabled, 'participants'); button('Inizia il Quiz!').click(); await wait(() => phase() === 'question', 'classic question');`);
    await execute(participants[0], `await wait(() => document.querySelectorAll('.grid button').length === 6, 'mobile question options'); if (document.documentElement.scrollWidth > innerWidth) throw new Error('Mobile question horizontal overflow');`);
    await check('classic-question', ['.host-header', '.host-question-heading', '.host-question-image', '.host-option', '.host-actions button']);
    await execute(host, `button('Chiudi tempo e mostra risposte').click(); await wait(() => phase() === 'question_results', 'classic results');`);
    await check('classic-results', ['.host-header', '.host-results h2', '.host-results .host-actions button']);
    await execute(host, `button('Classifica Parziale').click(); await wait(() => phase() === 'leaderboard', 'classic leaderboard');`);
    await check('classic-leaderboard', ['.host-header', '.host-leaderboard-heading', '.host-ranking']);
    await execute(host, `button('Classifica Finale').click(); await wait(() => phase() === 'finished', 'classic final'); [...document.querySelectorAll('header button')].find(b => b.textContent.trim() === 'Esci').click(); await wait(() => button('Quiz video in rete'), 'library after exit'); button('Quiz video in rete').click(); await wait(() => phase() === 'lobby' && document.querySelector('video')?.duration > 0, 'local video metadata');`);
    await check('video-lobby', ['.host-header', '.join-address', '[data-testid="join-pin"]', '.host-lobby-banner button', '.host-lobby-qr canvas', '.host-video']);
    await execute(host, `button('+ Aggiungi Bot di Test').click(); await wait(() => !button('Inizia il quiz video!').disabled, 'video ready'); button('Inizia il quiz video!').click(); await wait(() => phase() === 'question', 'video checkpoint');
      if(!document.fullscreenElement)throw new Error('Video competition did not request fullscreen from the start click');
      await document.exitFullscreen();await wait(()=>!document.fullscreenElement,'leaving fullscreen');`);
    await check('video-question', ['.host-header', '.host-question-heading', '.host-question-image', '.host-option', '.host-actions button']);
    await execute(host, `button('Chiudi tempo e mostra risposte').click(); await wait(() => phase() === 'question_results', 'video results');`);
    await check('video-results', ['.host-header', '.host-results h2', '.host-results .host-actions button']);
    await execute(host, `button('Classifica Parziale').click(); await wait(() => phase() === 'leaderboard', 'video leaderboard');`);
    await check('video-leaderboard', ['.host-header', '.host-leaderboard-heading', '.host-ranking']);
    await execute(host, `button('Riprendi video').click();await wait(()=>phase()==='video','video playback');
      document.querySelector('.host-video button[aria-label="Video a schermo intero"]').click();await wait(()=>Boolean(document.fullscreenElement),'video fullscreen');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const media=document.querySelector('.host-video .aspect-video').getBoundingClientRect();
      if(media.height<innerHeight*.7||media.width<innerWidth*.8)throw new Error('Fullscreen video is still constrained to a small frame');
    `);
    if(process.env.QURIOSO_VIDEO_FULLSCREEN_SCREENSHOT)await fs.writeFile(process.env.QURIOSO_VIDEO_FULLSCREEN_SCREENSHOT,(await host.webContents.capturePage()).toPNG());
    host.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});host.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
    await execute(host, `await wait(()=>!document.fullscreenElement,'Escape exits fullscreen');`);
    await execute(host, `[...document.querySelectorAll('header button')].find(b => b.textContent.trim() === 'Esci').click(); await wait(() => button('Quiz classico in rete'), 'final exit');`);
    console.log('Presenter smoke passed: base URL + PIN and direct QR URL in isolated LAN renderers, clipboard, PIN/session consistency, mobile participant, layouts at 100%: ' + layoutChecks.join(', '));
  } finally { for (const player of participants) if (!player.isDestroyed()) player.destroy(); }
};
