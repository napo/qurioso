// Real Electron bridge/UI checks; never starts a public tunnel during the standard smoke.
exports.run = async window => {
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  const originalPreference = await window.webContents.executeJavaScript(`localStorage.getItem('qurioso_internet_preference_v1')`);
  await window.webContents.executeJavaScript(`(async () => {
    const wait = async (condition,label) => { for(let n=0;n<150;n++){if(await condition())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Internet sharing UI did not become ready: '+label+' | '+document.body.textContent.slice(0,1400)); };
    if (typeof window.quriosoDesktop.internetSharing?.start !== 'function') throw new Error('Native sharing bridge missing');
    if ((await window.quriosoDesktop.internetSharing.status()).phase !== 'idle') throw new Error('Sharing started without a user action');
    await wait(() => document.querySelector('button[aria-label="Impostazioni"]'),'settings entry');
    document.querySelector('button[aria-label="Impostazioni"]').click();
    await wait(() => document.querySelector('[data-internet-setup]'),'Internet settings');
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Preferisci accesso Internet').click();
    await wait(() => document.body.textContent.includes('Internet · apri i controlli Cloudflare a ogni nuova partita'),'saved preference');
    const selected=document.querySelector('[data-internet-setup] button[aria-pressed="true"]');
    if(!selected?.textContent.includes('Preferisci accesso Internet')||!selected.className.includes('bg-petrolio'))throw new Error('Internet preference has no visible selected feedback');
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Torna ai quiz').click();
    await wait(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Quiz classico in rete' && !b.disabled),'classic quiz');
    document.querySelector('[data-activity-mode="classroom"]').click();
    await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Attività in classe'),'classroom mode');
    if([...document.querySelectorAll('button')].some(b=>b.textContent==='Quiz classico in rete'))throw new Error('Classroom mode retained network card actions');
    document.querySelector('[data-activity-mode="network"]').click();
    await wait(()=>document.querySelector('[data-activity-mode="network"][aria-pressed="true"]'),'network selection');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    window.scrollTo(0,0);
  })()`);
  if (process.env.QURIOSO_WORKSPACE_SCREENSHOT) await require('node:fs/promises').writeFile(process.env.QURIOSO_WORKSPACE_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript(`(async () => {
    const wait=async(condition,label)=>{for(let n=0;n<200;n++){if(condition())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Sharing smoke: '+label);};
    [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Quiz classico in rete').click();
    await wait(() => document.querySelector('button[aria-label="Condividi su Internet"]'),'sharing button');
    document.querySelector('button[aria-label="Condividi su Internet"]').click();
    await wait(() => document.querySelector('[aria-labelledby="internet-sharing-title"]'),'sharing panel');
    const panel=document.querySelector('[aria-labelledby="internet-sharing-title"]'),rect=panel.getBoundingClientRect();
    if(rect.bottom>innerHeight||rect.left<0||rect.right>innerWidth)throw new Error('Sharing panel is outside the viewport');
    if(panel.querySelectorAll('nav a').length!==4)throw new Error('Cloudflare documentation links missing');
    if(!panel.textContent.includes('nomi dei partecipanti e le risposte'))throw new Error('Cloudflare disclosure missing');
    if((await window.quriosoDesktop.internetSharing.status()).phase!=='idle')throw new Error('Opening the panel activated sharing');
    [...panel.querySelectorAll('button')].find(b=>b.textContent==='Chiudi').click();
    [...document.querySelectorAll('header button')].find(b=>b.textContent.trim()==='Esci').click();
    await wait(()=>document.querySelector('[data-qurioso-dashboard]'),'exit to dashboard');
  })()`);
  for (const [language, title] of [['en', 'Settings'], ['de', 'Einstellungen']]) {
    await window.loadURL(`http://qurioso.localhost/?app=classroom&lang=${language}`);
    await window.webContents.executeJavaScript(`(async () => {
      const wait = async condition => { for(let n=0;n<200;n++){if(condition())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Localized settings did not become ready'); };
      await wait(() => document.querySelector('button[aria-label="${title}"]'));
      document.querySelector('button[aria-label="${title}"]').click();
      await wait(() => document.querySelector('[data-qurioso-settings]'));
      if(document.querySelector('h1').textContent !== '${title}')throw new Error('Settings title is not localized');
      if(document.querySelectorAll('[data-internet-setup] nav a').length !== 4)throw new Error('Localized Cloudflare documentation missing');
      if(!document.querySelector('.library-data'))throw new Error('Localized data management missing');
      if(document.documentElement.scrollWidth>innerWidth)throw new Error('Localized settings overflow the viewport');
      if((await window.quriosoDesktop.internetSharing.status()).phase!=='idle')throw new Error('Opening localized settings activated sharing');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    if (language === 'de' && process.env.QURIOSO_SETTINGS_SCREENSHOT) await require('node:fs/promises').writeFile(process.env.QURIOSO_SETTINGS_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  }
  await window.webContents.executeJavaScript(`${originalPreference === null ? "localStorage.removeItem('qurioso_internet_preference_v1')" : "localStorage.setItem('qurioso_internet_preference_v1', " + JSON.stringify(originalPreference) + ")"}`);
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  console.log('Internet sharing Electron smoke passed: native bridge, explicit activation, disclosure, Cloudflare documentation and panel layout.');
};
