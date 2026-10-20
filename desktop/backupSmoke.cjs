const fs = require('node:fs/promises');
exports.run = async window => {
  window.setContentSize(1366,768);window.webContents.setZoomFactor(1);
  await window.loadURL('http://qurioso.localhost/?app=classroom&lang=it');
  const prefix=`
    const wait=async(condition,label)=>{for(let i=0;i<350;i++){if(await condition())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Backup smoke: '+label+' | '+document.body.textContent.slice(-2000));};
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    const library=async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('qurioso-library',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction('library','readonly'),r=tx.objectStore('library').get('quizzes');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();return r.result;};
    const canonical=value=>JSON.stringify(value,(key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
    const upload=blob=>{const data=new DataTransfer();data.items.add(new File([blob],'smoke-backup.zip',{type:'application/zip'}));const input=document.querySelector('.backup-dialog input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
    const layout=()=>{const d=document.querySelector('.backup-dialog'),r=d.getBoundingClientRect();if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight||document.documentElement.scrollWidth>innerWidth)throw new Error('Backup outside viewport');for(const b of d.querySelectorAll('footer button')){const r=b.getBoundingClientRect();if(r.bottom>innerHeight||r.right>innerWidth)throw new Error('Backup actions outside viewport');}};
  `;
  const execute=code=>window.webContents.executeJavaScript(`(async()=>{${prefix}${code}})()`,true);
  await execute(`
    await wait(()=>button('Esporta backup'),'dashboard');window.__backupOriginal=JSON.stringify(await library());
    window.showSaveFilePicker=async()=>({createWritable:async()=>{const chunks=[];return new WritableStream({write(chunk){chunks.push(chunk);},close(){window.__backupZip=new Blob(chunks,{type:'application/zip'});}});}});
    button('Esporta backup').click();await wait(()=>button('Crea backup ZIP')&&!button('Crea backup ZIP').disabled,'analysis');layout();
    if(!document.body.textContent.includes('Dimensione stimata dei contenuti'))throw new Error('Missing size inventory');
    const include=document.querySelector('.backup-dialog input[type=checkbox]');if(!include.checked)throw new Error('Small videos not included by default');
    include.click();await new Promise(r=>setTimeout(r,0));include.click();await new Promise(r=>setTimeout(r,0));
    button('Crea backup ZIP').click();await wait(()=>document.body.textContent.includes('ZIP scritto e file chiuso correttamente.'),'stream export');
    if(!window.__backupZip?.size)throw new Error('No ZIP output');if(JSON.stringify(await library())!==window.__backupOriginal)throw new Error('Export changed library');
    [...document.querySelectorAll('.backup-dialog button')].find(b=>b.textContent==='Chiudi').click();await wait(()=>!document.querySelector('.backup-dialog'),'closed');
    button('Importa backup').click();await wait(()=>document.querySelector('.backup-dialog input[type=file]'),'file');upload(window.__backupZip);
    await wait(()=>document.body.textContent.includes('Anteprima del backup'),'preview');layout();
    if(JSON.stringify(await library())!==window.__backupOriginal)throw new Error('Preview changed library');
    const confirm=button('Conferma ripristino');confirm.click();confirm.click();await wait(()=>document.body.textContent.includes('Ripristino completato.'),'add restore');
    if(!button('Conferma ripristino').disabled)throw new Error('Repeated restore still enabled');
    const added=await library(),old=JSON.parse(window.__backupOriginal);if(added.length!==old.length*2)throw new Error('Double import or lost originals');
    for(let i=0;i<old.length;i++)if(added[i].id!==old[i].id||added[i+old.length].id===old[i].id)throw new Error('Quiz ID collision');
    [...document.querySelectorAll('.backup-dialog button')].find(b=>b.textContent==='Chiudi').click();await wait(()=>!document.querySelector('.backup-dialog'),'close added');
    button('Importa backup').click();await wait(()=>document.querySelector('.backup-dialog input[type=file]'),'reopen');upload(window.__backupZip);await wait(()=>document.body.textContent.includes('Anteprima del backup'),'second preview');
    const all=[...document.querySelectorAll('.backup-dialog input[type=radio]')][2];all.click();await new Promise(r=>setTimeout(r,0));
    if(!button('Conferma ripristino').disabled)throw new Error('Full restore lacks explicit confirmation');
    const confirmation=[...document.querySelectorAll('.backup-dialog input[type=checkbox]')].find(e=>e.parentElement.textContent.includes('TUTTI'));confirmation.click();await new Promise(r=>setTimeout(r,0));layout();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  `);
  if(process.env.QURIOSO_BACKUP_SCREENSHOT)await fs.writeFile(process.env.QURIOSO_BACKUP_SCREENSHOT,(await window.webContents.capturePage()).toPNG());
  await execute(`
    button('Conferma ripristino').click();await wait(()=>document.body.textContent.includes('Ripristino completato.'),'full restore');
    const restored=await library(),old=JSON.parse(window.__backupOriginal);if(restored.length!==old.length)throw new Error('Full restore count');
    for(const q of old){const r=restored.find(r=>r.id===q.id);if(!r||canonical(r.questions.map(v=>({...v,mediaUrl:undefined})))!==canonical(q.questions.map(v=>({...v,mediaUrl:undefined}))))throw new Error('Questions changed');for(let i=0;i<q.questions.length;i++){const a=q.questions[i].mediaUrl,b=r.questions[i].mediaUrl;if(a?.startsWith('data:')){const aa=new Uint8Array(await(await fetch(a)).arrayBuffer()),bb=new Uint8Array(await(await fetch(b)).arrayBuffer());if(aa.length!==bb.length||aa.some((v,i)=>v!==bb[i]))throw new Error('Image bytes changed');}else if(a!==b)throw new Error('Media URL changed');}if(q.videoConfig&&canonical(r.videoConfig.checkpoints)!==canonical(q.videoConfig.checkpoints))throw new Error('Timeline changed');}
    [...document.querySelectorAll('.backup-dialog button')].find(b=>b.textContent==='Chiudi').click();await wait(()=>!document.querySelector('.backup-dialog'),'close final');
    delete window.showSaveFilePicker;delete window.__backupZip;delete window.__backupOriginal;
  `);
};
