const fs = require('node:fs/promises');

// Read-only guide checks in the temporary smoke profile. No service is activated.
exports.run = async window => {
  window.setMinimumSize(320, 400);
  for (const [language, title, next] of [
    ['it', 'Guida passo passo', 'Avanti'], ['en', 'Step-by-step guide', 'Next'], ['de', 'Schritt-für-Schritt-Anleitung', 'Weiter'],
  ]) {
    await window.loadURL(`http://qurioso.localhost/?app=guide&topic=internet&step=2&lang=${language}`);
    for (const [width, height] of [[1366, 768], [360, 780]]) {
      window.setContentSize(width, height);
      await window.webContents.executeJavaScript(`(async () => {
        const wait = async condition => {for(let n=0;n<200;n++){if(condition())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Guide layout did not become ready');};
        await wait(()=>document.querySelector('[data-tutorial-guide]')&&innerWidth===${width}&&innerHeight===${height});
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        if(document.querySelector('h1').textContent!==${JSON.stringify(title)})throw new Error('Guide locale mismatch');
        if(document.querySelector('progress').value!==2)throw new Error('Direct guide step was not restored');
        if(document.documentElement.scrollWidth>innerWidth)throw new Error('Guide overflows horizontally');
        const article=document.querySelector('article'),r=article.getBoundingClientRect();
        if(r.left<0||r.right>innerWidth)throw new Error('Tutorial card is outside the viewport');
        if(!document.querySelector('a[href="https://www.cloudflarestatus.com/"]'))throw new Error('Cloudflare help link missing');
        if((await window.quriosoDesktop.internetSharing.status()).phase!=='idle')throw new Error('Guide activated a public tunnel');
      })()`);
      if (process.env.QURIOSO_GUIDE_SCREENSHOT && language === 'it' && width === 1366) await fs.writeFile(process.env.QURIOSO_GUIDE_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
    }
    await window.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(next)}).click();
      for(let n=0;n<100;n++){if(document.querySelector('progress').value===3)break;await new Promise(r=>setTimeout(r,20));}
      if(new URL(location.href).searchParams.get('step')!=='3')throw new Error('Guide next step URL missing');
    })()`);
  }
  window.setMinimumSize(720, 540); window.setContentSize(1280, 850);
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  console.log('Tutorial guide smoke passed: real route, three languages, direct steps, next navigation, phone/desktop layout and no sharing activation.');
};
