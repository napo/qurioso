const fs = require('node:fs/promises');

exports.run = async window => {
  window.setContentSize(1366, 768); window.webContents.setZoomFactor(1);
  const prefix = `const wait = async (condition, label) => {
    for (let i=0;i<300;i++) { if(await condition()) return; await new Promise(resolve=>setTimeout(resolve,30)); }
    throw new Error('Question import smoke: '+label+' | '+document.body.textContent.slice(0,1500));
  };
  const button = text => [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
  const set = (element,value) => {Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
  const upload = (text,name) => { const data=new DataTransfer();data.items.add(new File([text],name,{type:name.endsWith('.json')?'application/json':'text/csv'}));const input=document.querySelector('.question-import-dialog input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true})); };
  const library = async () => { const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('qurioso-library',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('library','readonly'),request=tx.objectStore('library').get('quizzes');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();return request.result; };
  const layout = () => { const dialog=document.querySelector('.question-import-dialog'),rect=dialog.getBoundingClientRect();if(rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight||document.documentElement.scrollWidth>innerWidth)throw new Error('Import dialog outside viewport');for(const b of dialog.querySelectorAll('footer button')){const r=b.getBoundingClientRect();if(r.bottom>innerHeight||r.right>innerWidth)throw new Error('Import action outside viewport');}};`;
  const execute = code => window.webContents.executeJavaScript(`(async()=>{${prefix}${code}})()`,true);
  await window.loadURL('http://qurioso.localhost/?app=classroom&lang=it');
  const csv = '\uFEFFdomanda,risposta_A,risposta_B,corretta,tipo\r\n"Domanda CSV, con virgola\nsu due righe",Uno,Due,A,multiple_choice\r\nRisposta errata,Uno,Due,D,multiple_choice\r\n"Domanda CSV, con virgola\nsu due righe",Uno,Due,A,multiple_choice\r\n';
  const before = await execute(`
    await wait(()=>button('Importa domande'),'dashboard');const before=JSON.stringify(await library());button('Importa domande').click();
    await wait(()=>document.querySelector('.question-import-dialog'),'dialog');upload(${JSON.stringify(csv)},'native-import.csv');
    await wait(()=>document.querySelector('select[aria-label="Separatore"]')?.value===','&&button('Anteprima')&&!button('Anteprima').disabled,'CSV mapping');layout();
    set(document.querySelector('input[aria-label="Titolo del quiz"]'),'Collaudo import domande');await new Promise(resolve=>setTimeout(resolve,0));button('Anteprima').click();
    await wait(()=>document.body.textContent.includes('3 elementi · 2 validi · 1 con errori · 1 possibili duplicati'),'preview counts');layout();
    if(JSON.stringify(await library())!==before)throw new Error('Preview wrote the library');
    button('Seleziona tutte le valide').click();await new Promise(resolve=>setTimeout(resolve,0));button('Escludi duplicati').click();await new Promise(resolve=>setTimeout(resolve,0));
    if(!document.body.textContent.includes('1 selezionate'))throw new Error('Duplicate exclusion failed');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return before;
  `);
  if(process.env.QURIOSO_IMPORT_SCREENSHOT)await fs.writeFile(process.env.QURIOSO_IMPORT_SCREENSHOT,(await window.webContents.capturePage()).toPNG());
  await execute(`
    const confirm=button('Conferma e apri editor');confirm.click();confirm.click();await wait(()=>document.querySelector('.quiz-editor')&&button('Salva Quiz')&&!button('Salva Quiz').disabled,'new quiz editor');
    if(JSON.stringify(await library())!==${JSON.stringify(before)})throw new Error('Import saved before editor confirmation');
    if(document.querySelector('textarea[aria-label="Testo della domanda"]').value!==${JSON.stringify('Domanda CSV, con virgola\nsu due righe')})throw new Error('Multiline question changed');
    button('Salva Quiz').click();await wait(()=>!document.querySelector('.quiz-editor'),'save new quiz');
    const saved=await library(),created=saved.find(q=>q.title==='Collaudo import domande');if(!created||created.questions.length!==1)throw new Error('Partial import or double confirmation failed');
    const card=[...document.querySelectorAll('.group')].find(card=>card.textContent.includes('Collaudo video del docente'));[...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='Modifica').click();
    await wait(()=>button('Importa domande')&&!button('Importa domande').disabled,'video editor');
    set(document.querySelector('textarea[aria-label="Testo della domanda"]'),'Modifica conservata durante importazione');await new Promise(resolve=>setTimeout(resolve,0));
    await wait(()=>!button('Importa domande').disabled,'import ready after edit');
    button('Importa domande').focus();button('Importa domande').click();await wait(()=>document.querySelector('.question-import-dialog'),'cancel dialog');
    button('Annulla').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    if(document.activeElement!==button('Scarica modello CSV'))throw new Error('Dialog keyboard focus escaped');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await wait(()=>!document.querySelector('.question-import-dialog'),'cancelled');
    if(document.activeElement!==button('Importa domande'))throw new Error('Dialog did not restore keyboard focus');
    if(document.querySelector('textarea[aria-label="Testo della domanda"]').value!=='Modifica conservata durante importazione')throw new Error('Cancel lost editor changes');
    const original=(await library()).find(q=>q.id==='presenter-layout-video');
    // The presenter layout fixture uses an SVG data URL, outside the raster import formats.
    const question={...original.questions[0],text:'Domanda JSON senza checkpoint',videoTimestamp:999,mediaUrl:undefined,mediaType:undefined,mediaAttribution:undefined};
    const source={...original,title:'Do not overwrite',videoConfig:{...original.videoConfig,videoUrl:'blob:missing',checkpoints:[{questionId:question.id,timestamp:999}]},questions:[question]};
    button('Importa domande').click();await wait(()=>document.querySelector('.question-import-dialog'),'JSON dialog');upload(JSON.stringify(source),'quiz-completo.json');
    await wait(()=>document.body.textContent.includes('Il file è un quiz Qurioso completo')&&button('Aggiungi le domande selezionate')&&!button('Aggiungi le domande selezionate').disabled,'full quiz extraction');layout();
    const appendConfirm=button('Aggiungi le domande selezionate');appendConfirm.click();appendConfirm.click();await wait(()=>!document.querySelector('.question-import-dialog'),'append to video');
    button('Salva Quiz').click();await wait(()=>!document.querySelector('.quiz-editor'),'save video');
    const updated=(await library()).find(q=>q.id===original.id);
    if(updated.questions.length!==original.questions.length+1||JSON.stringify(updated.videoConfig)!==JSON.stringify(original.videoConfig)||updated.title!==original.title)throw new Error('Import changed video metadata or duplicated questions');
    const added=updated.questions.at(-1);if(added.id===question.id||added.videoTimestamp!==undefined||updated.videoConfig.checkpoints.some(cp=>cp.questionId===added.id))throw new Error('Imported question was automatically associated');
    if(updated.questions[0].text!=='Modifica conservata durante importazione')throw new Error('Append lost unsaved edits');
    // Delete only this smoke's generated quiz; the next launch uses the same profile.
    // Cleanup uses the library transaction to avoid interacting with the native confirm dialog.
    const items=await library();const db=await new Promise(resolve=>{const r=indexedDB.open('qurioso-library',2);r.onsuccess=()=>resolve(r.result);});const tx=db.transaction('library','readwrite');tx.objectStore('library').put(items.filter(q=>q.id!==created.id),'quizzes');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  `);
  console.log('Question import smoke passed: CSV/BOM/multiline/mapping, invalid rows and duplicates, partial double-confirm protection, no early library write, new quiz save, cancel preserves edits, JSON extraction into video preserves assets/checkpoints, 1366x768 at 100%.');
};
