const fs = require('node:fs/promises');
const path = require('node:path');
const { BrowserWindow } = require('electron');

// Capture production UI with the actual included quiz and illustrative participants.
// Called only by the opt-in capture script with an isolated, temporary profile.
exports.run = async (host, port, directory) => {
  const origin = 'http://qurioso.localhost', base = `http://127.0.0.1:${port}`;
  const prefix = `const wait=async(f,label)=>{for(let n=0;n<400;n++){if(await f())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Capture: '+label+' | '+document.body.innerHTML.slice(0,800)+' URL='+location.href+' resources='+performance.getEntriesByType('resource').map(r=>r.name).join(','));};const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);`;
  const execute = (win, code) => win.webContents.executeJavaScript(`(async()=>{${prefix}${code}})()`, true);
  const capture = async (win, name, language) => {
    await execute(win, `await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await document.fonts.ready;`);
    const folder = path.join(directory, language); await fs.mkdir(folder, { recursive: true });
    const picture=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    if(picture.getSize().width<100)throw new Error('Capture produced an empty screenshot: '+name);
    await fs.writeFile(path.join(folder, name + '.png'), picture.toPNG());
  };
  await execute(host, `await wait(()=>document.querySelector('[data-qurioso-dashboard]'),'initial library');`);
  const quiz = await (await fetch(base + '/quizzes/tipi-di-vulcani.json')).json();
  let phone;
  for (const [language, edit, settings, importQuestions, close] of [
    ['it','Modifica','Impostazioni','Importa domande','Chiudi'],
    ['en','Edit','Settings','Import questions','Close'],
    ['de','Bearbeiten','Einstellungen','Fragen importieren','Schließen'],
  ]) {
    host.setContentSize(1366, 900);
    await host.loadURL(`${origin}/?app=network&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('[data-qurioso-dashboard]'),'library');const q=await(await fetch('/quizzes/tipi-di-vulcani.json')).json();const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('qurioso-library',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put([q],'quizzes');tx.objectStore('library').delete('editor:draft');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();`);
    await host.loadURL(`${origin}/?app=network&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('[data-quiz-id="${quiz.id}"]'),'volcano quiz');`);
    await capture(host, 'library', language);
    await execute(host, `const card=document.querySelector('[data-quiz-id="${quiz.id}"]');[...card.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(edit)}).click();await wait(()=>document.querySelector('.quiz-editor'),'editor');`);
    await capture(host, 'editor', language);
    await host.loadURL(`${origin}/?app=classroom&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('[data-quiz-id="${quiz.id}"]'),'classroom quiz');document.querySelector('[data-quiz-id="${quiz.id}"] button').click();await wait(()=>document.querySelector('youtube-video'),'classroom video');`);
    await capture(host, 'classroom', language);
    await host.loadURL(`${origin}/?app=network&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('button[aria-label="${settings}"]'),'settings');document.querySelector('button[aria-label="${settings}"]').click();await wait(()=>document.querySelector('.library-data'),'data tools');`);
    await capture(host, 'settings', language);
    await execute(host, `button(${JSON.stringify(importQuestions)}).click();await wait(()=>document.querySelector('.question-import-dialog'),'import');`);
    await capture(host, 'import', language);
    await host.loadURL(`${origin}/?app=network&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('[data-quiz-id="${quiz.id}"] button:not(:disabled)'),'quiz');const card=document.querySelector('[data-quiz-id="${quiz.id}"]');await wait(()=>!card.querySelector('button').disabled,'server');card.querySelector('button').click();await wait(()=>document.querySelector('[aria-labelledby="internet-sharing-title"]'),'Cloudflare choice');`);
    await capture(host, 'internet', language);
    const credential = await execute(host, `button(${JSON.stringify(close)}).click();await wait(()=>sessionStorage.getItem('qurioso_presenter_recovery_v1'),'room');return JSON.parse(sessionStorage.getItem('qurioso_presenter_recovery_v1'));`);
    const request = async (url, method='GET', body) => {
      const r = await fetch(base+url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential.token}`},...(body?{body:JSON.stringify(body)}:{})});
      if(!r.ok)throw new Error(`Capture API ${url}: ${r.status} ${await r.text()}`);return r.json();
    };
    await capture(host, 'lobby', language);
    let envelope=await request(`/api/session/${credential.pin}`);
    const update = async patch => { envelope=await request(`/api/session/${credential.pin}/state`,'POST',{session:{...envelope.session,...patch},revision:envelope.revision}); };
    await update({status:'countdown'});await update({status:'video'});
    await update({status:'question',currentQuestionIndex:0,questionStartTime:Date.now(),currentQuestion:{...quiz.questions[0],options:quiz.questions[0].options.map(({isCorrect,...option})=>option)}});
    // Reload the real presenter using its normal recovery credential and saved runtime quiz.
    await host.loadURL(`${origin}/?app=network&lang=${language}`);
    await execute(host, `await wait(()=>document.querySelector('.host-screen[data-phase="question"]'),'teacher question');`);
    await capture(host, 'question', language);
    phone=new BrowserWindow({show:false,width:390,height:844,webPreferences:{partition:`guide-phone-${language}`,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    phone.setContentSize(390,844);phone.showInactive();
    await phone.loadURL(`${base}/?pin=${credential.pin}&role=player&lang=${language}`);
    await execute(phone, `await wait(()=>document.querySelector('form input'),'participant');const input=document.querySelector('input[placeholder="Nome o soprannome..."]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Giulia');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));document.querySelector('form').requestSubmit();await wait(()=>document.querySelector('.player-answer-grid'),'answers');`);
    await capture(phone, 'participant', language);
    const result={pin:credential.pin,title:quiz.title,playerId:'giulia',expiresAt:Date.now()+3600000,players:[{id:'giulia',nickname:'Giulia',avatar:'🦊',score:9800},{id:'luca',nickname:'Luca',avatar:'🐼',score:8700},{id:'sara',nickname:'Sara',avatar:'🦁',score:7600}]};
    await execute(phone, `sessionStorage.setItem('qurioso_final_result_v1:${credential.pin}',${JSON.stringify(JSON.stringify(result))});`);
    await phone.loadURL(`${base}/?pin=${credential.pin}&role=player&lang=${language}`);
    await execute(phone, `await wait(()=>document.querySelector('[data-player-final] img'),'result');`);
    await capture(phone, 'results', language);
    const png=await execute(phone,`return Array.from(new Uint8Array(await(await fetch(document.querySelector('[data-player-final] img').src)).arrayBuffer()));`);
    await fs.writeFile(path.join(directory,language,'result-image.png'),Buffer.from(png));
    phone.destroy();phone=null;
    await request(`/api/session/${credential.pin}`,'DELETE');
    await execute(host, `sessionStorage.removeItem('qurioso_presenter_recovery_v1');`);
  }
  console.log('Guide screenshots captured in Italian, English and German.');
};
