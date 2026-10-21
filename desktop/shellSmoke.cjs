const { Menu } = require('electron');

// Desktop workspace shell: compact toolbar, native File/Help menu and the open quiz in the window title.
exports.run = async window => {
  const execute = source => window.webContents.executeJavaScript(`(async()=>{const wait=async(f,label)=>{for(let n=0;n<200;n++){if(await f())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Shell smoke: '+label+' | '+document.body.textContent.slice(0,800));};${source}})()`);
  const menu = Menu.getApplicationMenu();
  const item = name => { const found = menu.getMenuItemById(`qurioso-${name}`); if (!found) throw new Error(`Missing menu item ${name}`); return found; };
  const commands = ['new-quiz', 'new-video-quiz', 'import-questions', 'backup', 'guide', 'about'];
  const until = async (condition, label) => { for (let n = 0; n < 200; n++) { if (condition()) return; await new Promise(r => setTimeout(r, 25)); } throw new Error(`Shell smoke: ${label}`); };
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  await execute(`await wait(()=>document.querySelector('[data-shell="desktop"] [data-server-badge="lan"]'),'desktop toolbar');
    if(document.querySelector('footer')||document.querySelector('a[href="./"]'))throw new Error('Website frame in desktop');
    if(document.querySelectorAll('header button').length!==2)throw new Error('Toolbar must hold only New quiz and Settings');
    if(!document.querySelector('[data-activity-mode="network"][aria-pressed="true"]'))throw new Error('Segmented mode control missing');`);
  await until(() => commands.every(name => item(name).enabled), 'menu enabled in the library');
  if (window.getTitle() !== 'Qurioso') throw new Error(`Unexpected library title ${window.getTitle()}`);
  item('about').click();
  await execute(`await wait(()=>document.activeElement?.closest('[data-settings-about]'),'about section');`);
  item('import-questions').click();
  await execute(`await wait(()=>document.querySelector('.question-import-dialog'),'import dialog');`);
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  await execute(`await wait(()=>document.querySelector('[data-shell="desktop"]'),'library again');
    const volcano=document.querySelector('[data-quiz-id="quiz-1792489106413"]');[...volcano.querySelectorAll('button')].find(b=>b.textContent.trim()==='Modifica').click();
    await wait(()=>document.querySelector('.quiz-editor'),'editor');`);
  await until(() => window.getTitle() === 'Tipi di vulcani con geopop — Qurioso', 'window title names the open quiz');
  await until(() => commands.every(name => !item(name).enabled), 'menu disabled in the editor');
  await window.loadURL('http://qurioso.localhost/?app=network&lang=it');
  await execute(`await wait(()=>document.querySelector('[data-shell="desktop"]'),'library restored');`);
};
