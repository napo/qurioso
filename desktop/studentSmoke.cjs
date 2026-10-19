const { BrowserWindow } = require('electron');

// Real Chromium reload/close/reopen against the LAN backend; temporary smoke profile only.
exports.run = async host => {
  const prefix = `const wait = async (condition, label) => {
    for (let n = 0; n < 300; n++) { if (await condition()) return; await new Promise(r => setTimeout(r, 30)); }
    throw new Error('Student smoke timeout: ' + label + ' | ' + document.body.textContent.slice(0, 1000));
  }; const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  const phase = () => document.querySelector('.host-screen')?.dataset.phase;`;
  const execute = (target, script) => target.webContents.executeJavaScript(`(async () => { ${prefix} ${script} })()`, true);
  let student;
  const open = () => new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: {
    partition: 'persist:student-recovery-smoke', contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
  } });
  try {
    for (const mode of ['classic', 'video']) {
      await host.loadURL('http://qurioso.localhost/?app=network&lang=it');
      const start = mode === 'classic' ? 'Quiz classico in rete' : 'Quiz video in rete';
      await execute(host, `await wait(() => button(${JSON.stringify(start)}) && !button(${JSON.stringify(start)}).disabled, 'quiz card'); button(${JSON.stringify(start)}).click(); await wait(() => phase() === 'lobby' && document.querySelector('[data-testid="join-address"]'), 'host lobby');`);
      const entry = await execute(host, `return { pin: document.querySelector('[data-testid="join-pin"]').textContent, base: document.querySelector('[data-testid="join-address"]').textContent };`);
      const url = `${entry.base}/?pin=${entry.pin}&role=player&lang=it`;
      student = open(); await student.loadURL(url);
      await execute(student, `
        await wait(() => document.querySelector('form input'), 'fresh entry');
        const input = document.querySelector('input[placeholder="Nome o soprannome..."]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Studente smoke'); input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 0)); button('Entra nel Quiz!').click();
        await wait(() => document.body.textContent.includes('Sei nella lobby di gioco!'), 'joined');
        await fetch('/api/session/${entry.pin}/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: { id: 'holding-student', nickname: 'Attesa', avatar: '🦊' } }) });
      `);
      const id = await execute(student, `return JSON.parse(localStorage.getItem('qurioso_player_recovery_v1:${entry.pin}')).playerId;`);
      const refresh = async (text, close = false) => {
        if (close) { student.destroy(); student = open(); }
        await student.loadURL(url);
        await execute(student, `
          await wait(() => document.body.textContent.includes(${JSON.stringify(text)}), 'recovered ${mode}');
          if (document.querySelector('form')) throw new Error('Recovery requested a new nickname');
          const stored = JSON.parse(localStorage.getItem('qurioso_player_recovery_v1:${entry.pin}'));
          if (stored.playerId !== ${JSON.stringify(id)}) throw new Error('Recovery changed student ID');
          const state = (await (await fetch('/api/session/${entry.pin}')).json()).session;
          if (Object.keys(state.players).length !== 2) throw new Error('Recovery duplicated a participant');
          if (state.players[stored.playerId].nickname !== 'Studente smoke') throw new Error('Recovery changed nickname');
          if (sessionStorage.getItem('qurioso_presenter_recovery_v1')) throw new Error('Student acquired presenter context');
        `);
      };
      console.log('Student smoke: ' + mode + ' joined');
      await refresh('Sei nella lobby di gioco!');
      const startGame = mode === 'classic' ? 'Inizia il Quiz!' : 'Inizia il quiz video!';
      await execute(host, `await wait(() => button(${JSON.stringify(startGame)}) && !button(${JSON.stringify(startGame)}).disabled, 'start ready'); button(${JSON.stringify(startGame)}).click(); await wait(() => phase() === 'question', 'question');`);
      await refresh('Quale risposta scegliamo');
      await execute(student, `await wait(() => document.querySelectorAll('.grid button').length === 6, 'options'); document.querySelector('.grid button').click(); await wait(() => document.body.textContent.includes('Risposta Inviata!'), 'accepted');`);
      await refresh('Risposta Inviata!');
      await refresh('Risposta Inviata!', true);
      console.log('Student smoke: ' + mode + ' reopened');
      await execute(student, `if (document.querySelectorAll('.grid button').length) throw new Error('Answered question is editable after reopen');`);
      await execute(host, `button('Chiudi tempo e mostra risposte').click(); await wait(() => phase() === 'question_results', 'results');`);
      await refresh('Risposta Esatta!');
      const score = await execute(student, `const s = (await (await fetch('/api/session/${entry.pin}')).json()).session;
        if (Object.keys(s.answersForCurrentQuestion).length !== 1) throw new Error('Answer count changed after reopen'); return s.players[${JSON.stringify(id)}].score;`);
      if (!(score > 0)) throw new Error('Recovered student lost the score');
      await execute(host, `button('Classifica Parziale').click(); await wait(() => phase() === 'leaderboard', 'leaderboard');`);
      await refresh('Guarda la classifica');
      console.log('Student smoke: ' + mode + ' leaderboard');
      await execute(student, `const s = (await (await fetch('/api/session/${entry.pin}')).json()).session;
        if (s.players[${JSON.stringify(id)}].score !== ${score}) throw new Error('Duplicate grading after recovery');`);
      await execute(host, `button(${JSON.stringify(mode === 'classic' ? 'Classifica Finale' : 'Riprendi video')}).click(); await wait(() => phase() === 'finished', 'final summary');`);
      await student.loadURL(url);
      await execute(student, `await wait(() => document.body.textContent.includes('Partita terminata'), 'finished recovery message'); button('Torna all’ingresso').click(); await wait(() => document.querySelector('form'), 'new entry');
        if (localStorage.getItem('qurioso_player_recovery_v1:${entry.pin}')) throw new Error('Finished recovery retained the secret');`);
      student.destroy(); student = null;
      await execute(host, `[...document.querySelectorAll('header button')].find(b => b.textContent.trim() === 'Esci').click(); await wait(() => !phase(), 'host exit');`);
    }
    console.log('Student recovery smoke passed: classic/video lobby, unanswered/answered question, real tab close/reopen, results, leaderboard, one identity/score/answer and finished-session cleanup.');
  } finally { if (student && !student.isDestroyed()) student.destroy(); }
};
