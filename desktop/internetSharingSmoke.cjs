// Real Electron controls; no component download or public tunnel in the standard smoke.
exports.run = async window => {
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  await window.webContents.executeJavaScript(`(async()=>{
    const wait=async f=>{for(let n=0;n<200;n++){if(await f())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Cloudflare UI timeout');};
    await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Quiz classico in rete'&&!b.disabled));
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Quiz classico in rete').click();
    await wait(()=>document.querySelector('[aria-labelledby="internet-sharing-title"]'));
    const panel=document.querySelector('[aria-labelledby="internet-sharing-title"]');
    if(panel.querySelectorAll('nav a').length!==4)throw new Error('Cloudflare documentation missing');
    if(!panel.textContent.includes('nomi dei partecipanti e le risposte'))throw new Error('Cloudflare disclosure missing');
    if((await window.quriosoDesktop.internetSharing.status()).phase!=='idle')throw new Error('Opening the modal started sharing');
    [...panel.querySelectorAll('button')].find(b=>b.textContent==='Chiudi').click();
    const control=document.querySelector('[role="switch"]');
    if(!control||control.getAttribute('aria-checked')!=='false')throw new Error('Cloudflare switch missing');
    await document.querySelector('.host-screen').requestFullscreen();
    await wait(()=>!document.querySelector('[data-sharing-controls]'));
    await document.exitFullscreen();await wait(()=>document.querySelector('[data-sharing-controls]'));
    document.querySelector('[role="switch"]').click();await wait(()=>document.querySelector('[aria-labelledby="internet-sharing-title"]'));
    [...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Chiudi').click();
    [...document.querySelectorAll('header button')].find(b=>b.textContent.trim()==='Esci').click();await wait(()=>document.querySelector('[data-qurioso-dashboard]'));
  })()`,true);
  for(const [language,title] of [['it','Impostazioni'],['en','Settings'],['de','Einstellungen']]) {
    await window.loadURL(`http://qurioso.localhost/?app=network&lang=${language}`);
    await window.webContents.executeJavaScript(`(async()=>{
      for(let n=0;n<200&&!document.querySelector('button[aria-label="${title}"]');n++)await new Promise(r=>setTimeout(r,30));
      document.querySelector('button[aria-label="${title}"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      if(document.querySelector('[data-internet-setup]'))throw new Error('Obsolete Cloudflare preference still in settings');
      if(!document.querySelector('.library-data'))throw new Error('Library tools missing');
      if(document.documentElement.scrollWidth>innerWidth)throw new Error('Settings overflow');
    })()`);
  }
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
};
