const { BrowserWindow } = require('electron');
const { randomInt } = require('node:crypto');

exports.run = async host => {
  const port=await host.webContents.executeJavaScript('window.quriosoDesktop.serverPort');
  const base=`http://127.0.0.1:${port}`;
  const quiz=await(await fetch(base+'/quizzes/tipi-di-vulcani.json')).json();
  const source=quiz.questions.find(q=>q.options.some(o=>o.text.includes('tsunami'))) || quiz.questions[0];
  for(const count of [2,4,6,12]) {
    const pin=String(randomInt(100000,1000000));
    const token=(await(await fetch(base+'/api/presenter-token',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json()).hostToken;
    const options=Array.from({length:count},(_,i)=>{const {isCorrect,...o}=source.options[i%source.options.length];return {...o,id:'answer-'+i,text:count===12?o.text+' '+o.text:o.text};});
    const session={pin,quizId:quiz.id,quizTitle:quiz.title,mode:'standard',status:'question',currentQuestionIndex:0,currentQuestion:{...source,id:'layout-question',timeLimit:300,options},questionStartTime:Date.now(),timeRemaining:300,players:{},answersForCurrentQuestion:{},totalQuestions:1};
    const create=await fetch(base+'/api/session/create',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({session})});
    if(!create.ok)throw new Error('Answer layout fixture rejected: '+await create.text());
    const phone=new BrowserWindow({show:false,width:390,height:844,webPreferences:{partition:'answers-'+pin,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    phone.setMinimumSize(300,300);
    try {
      await phone.loadURL(base+`/?pin=${pin}&role=player&lang=it`);
      await phone.webContents.executeJavaScript(`(async()=>{const wait=async f=>{for(let n=0;n<200;n++){if(f())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Answer layout join timeout');};await wait(()=>document.querySelector('input[placeholder="Nome o soprannome..."]'));const input=document.querySelector('input[placeholder="Nome o soprannome..."]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Layout test');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));document.querySelector('form').requestSubmit();await wait(()=>document.querySelector('.player-answer-grid'));})()`);
      for(const [width,height] of [[320,480],[390,844],[844,390],[1366,768]]) {
        phone.setContentSize(width,height);
        await phone.webContents.executeJavaScript(`(async()=>{for(let n=0;n<100&&(innerWidth!==${width}||innerHeight!==${height});n++)await new Promise(r=>setTimeout(r,20));await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,100));const answers=[...document.querySelectorAll('.player-answer')];if(answers.length!==${count})throw new Error('Missing answers');for(const answer of answers){const box=answer.querySelector('.player-answer-text'),text=box.firstElementChild,r=answer.getBoundingClientRect();if(getComputedStyle(box).display==='none'||!text.textContent.trim())throw new Error('Full answer text missing');if(text.scrollWidth>box.clientWidth+1||text.scrollHeight>box.clientHeight+1)throw new Error('Answer text overflows: '+innerWidth+'x'+innerHeight+' '+getComputedStyle(text).fontSize+' content='+text.scrollWidth+'x'+text.scrollHeight+' cell='+box.clientWidth+'x'+box.clientHeight+' '+text.textContent);if(r.width<44||r.height<44||r.left<0||r.top<0||r.bottom>innerHeight+1||r.right>innerWidth+1)throw new Error('Answer is outside the usable viewport');}if(document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1)throw new Error('Answer page requires scrolling');})()`);
      }
    } finally {
      phone.destroy();await fetch(base+'/api/session/'+pin,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    }
  }
  console.log('Complete answer text fits: 2/4/6/12 options, long volcano answers, portrait/landscape phones and desktop.');
};
