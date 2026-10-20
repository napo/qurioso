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
      for(const [width,height] of [[320,480],[360,640],[390,844],[844,390]]) {
        student.setContentSize(width,height);
        await execute(student, `await wait(()=>document.querySelector('.player-answer'),'mobile answers');
          await wait(()=>innerWidth===${width}&&innerHeight===${height},'mobile viewport ${width}x${height}');
          const grid=document.querySelector('.player-answer-grid'),count=grid.dataset.answerCount;
          const originals=[...grid.querySelectorAll('.player-answer-text')].map(e=>e.textContent),clones=[];
          for(let i=grid.children.length;i<12;i++){const clone=grid.firstElementChild.cloneNode(true);clone.querySelector('.player-answer-letter').textContent=String.fromCharCode(65+i);grid.append(clone);clones.push(clone);}
          grid.dataset.answerCount='12';
          const labels=[...grid.querySelectorAll('.player-answer-text')];
          labels.forEach((e,i)=>e.textContent=i%2?'Supercalifragilistichespiralidoso'.repeat(8):'Una risposta molto lunga con parole e dettagli che devono restare sullo schermo del docente. '.repeat(4));
          await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
          for(const label of labels)if(getComputedStyle(label).display!=='none')throw new Error('Answer text is still visible in compact phone controls');
          for(const answer of grid.querySelectorAll('button')){const r=answer.getBoundingClientRect();if(r.width<44||r.height<44||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth)throw new Error('Answer requires scrolling or is too small to tap');}
          if(document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1)throw new Error('Phone answer screen requires scrolling');
          if(getComputedStyle(document.querySelector('.player-look-at-teacher')).display==='none')throw new Error('Teacher screen instruction missing');
          clones.forEach(e=>e.remove());grid.dataset.answerCount=count;
          [...grid.querySelectorAll('.player-answer-text')].forEach((e,i)=>e.textContent=originals[i]);
        `);
      }
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
      await execute(student, `await wait(() => document.querySelector('[data-player-final] img'), 'final result image');
        if (document.querySelectorAll('[data-player-final] button').length !== 2) throw new Error('Finished player has navigation or replay controls');
        if (!document.querySelector('[data-player-final] ol')) throw new Error('Final ranking missing');`);
      await student.loadURL(url);
      await execute(student, `await wait(() => document.querySelector('[data-player-final] img'), 'read-only final result after refresh');
        if (localStorage.getItem('qurioso_player_recovery_v1:${entry.pin}')) throw new Error('Finished recovery retained the secret');
        const image = document.querySelector('[data-player-final] img');
        const blob = await (await fetch(image.src)).blob(), bitmap = await createImageBitmap(blob);
        if(blob.type !== 'image/png' || bitmap.width !== 1080 || bitmap.height !== 1080)throw new Error('Invalid result PNG');bitmap.close();
        Object.defineProperty(navigator, 'canShare', { configurable:true, value:()=>true });
        Object.defineProperty(navigator, 'share', { configurable:true, value:async data=>{window.__resultShare=data;} });
        button('Condividi risultato').click();await wait(()=>window.__resultShare?.files?.length===1,'PNG share sheet');
        if(window.__resultShare.files[0].type!=='image/png'||window.__resultShare.url)throw new Error('Share leaked session link or omitted the image');`);
      if(process.env.QURIOSO_PLAYER_RESULT_SCREENSHOT){
        const png=await execute(student, `return Array.from(new Uint8Array(await (await fetch(document.querySelector('[data-player-final] img').src)).arrayBuffer()));`);
        await require('node:fs/promises').writeFile(process.env.QURIOSO_PLAYER_RESULT_SCREENSHOT,Buffer.from(png));
      }
      const closed = new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Player close button did not close its window')),5000);student.once('closed',()=>{clearTimeout(timer);resolve();});});
      await execute(student, `setTimeout(()=>button('Chiudi finestra').click(),50);`);
      await closed; student = null;
      await execute(host, `[...document.querySelectorAll('header button')].find(b => b.textContent.trim() === 'Esci').click(); await wait(() => !phase(), 'host exit');`);
    }
    console.log('Student recovery smoke passed: classic/video lobby, unanswered/answered question, real tab close/reopen, results, leaderboard, one identity/score/answer and finished-session cleanup.');
  } finally { if (student && !student.isDestroyed()) student.destroy(); }
};
