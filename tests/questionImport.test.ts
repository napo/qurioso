import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import type { Quiz, Question } from '../src/types/quiz';
import { appendImportedQuestions, csvImportSource, detectQuestionSeparator, IMPORT_LIMITS, jsonImportSource, parseQuestionCsv, previewQuestionImport, QuestionImportError, questionCsvTemplate, readQuestionFile, suggestQuestionMapping, type ImportConfig } from '../src/services/questionImport';
import { quizCheckpoints, editableVideoQuiz } from '../src/services/videoQuiz';
import { editorDraft, loadQuizzes, storeQuizzes } from '../src/services/quizStorage';
const configuration = (mapping = {}): ImportConfig => ({ mapping, defaultType: 'multiple_choice', correctMode: 'letters' });
const classic = (): Quiz => { const quiz = structuredClone(DEFAULT_QUIZZES[0]); delete quiz.videoConfig; return quiz; };
const question = (text = 'Domanda importata'): Question => ({ id: 'source-id', text, type: 'multiple_choice', points: 1000, timeLimit: 20, options: [
  { id: 'a', text: 'Uno', isCorrect: true, color: 'red', shape: 'triangle' }, { id: 'b', text: 'Due', isCorrect: false, color: 'blue', shape: 'diamond' },
] });
const code = (key: string) => (error: unknown) => error instanceof QuestionImportError && error.issue.key === key;
const jsonRows = (items: unknown[], target: Question[] = []) => previewQuestionImport(jsonImportSource(JSON.stringify(items)), configuration(), target);

for (const [separator, name] of [[',','comma'], [';','semicolon'], ['\t','tab']] as const) test(`CSV ${name}: detects delimiter and maps reordered columns without changing the source`, () => {
  const text = [['risposta_B','domanda','corretta','risposta_A','tipo','punti','tempo'], ['Due','Domanda?','A','Uno','multiple_choice','2000','30']].map(row => row.join(separator)).join('\r\n');
  assert.equal(detectQuestionSeparator(text), separator);
  const source = csvImportSource(text, separator, true), rows = previewQuestionImport(source, configuration(suggestQuestionMapping(source.columns)));
  assert.equal(rows[0].errors.length, 0); assert.equal(rows[0].question!.text, 'Domanda?'); assert.equal(rows[0].question!.options[0].text, 'Uno');
  assert.equal(rows[0].question!.points, 2000); assert.equal(rows[0].question!.timeLimit, 30);
});

test('CSV handles BOM, UTF-8, quoted separators, escaped quotes, multiline fields and physical line numbers', async () => {
  const text = '\uFEFFdomanda;risposta_A;risposta_B;corretta\r\n"Com’è?;\r\nDice ""ciao""";"Sì; certo";No;A\r\n';
  const source = csvImportSource(text, ';', true), rows = previewQuestionImport(source, configuration(suggestQuestionMapping(source.columns)));
  assert.equal(rows[0].question!.text, 'Com’è?;\nDice "ciao"'); assert.equal(rows[0].line, 2); assert.equal(rows[0].question!.options[0].text, 'Sì; certo');
  assert.equal(await readQuestionFile(new File([text], 'lezione.csv')), text.replace(/^\uFEFF/, ''));
  assert.throws(() => parseQuestionCsv('a,b\n"not closed', ','), code('csvQuote'));
  assert.throws(() => parseQuestionCsv('a,b\n"yes"bad,no', ','), code('csvQuote'));
});

test('CSV without headings uses explicit position mapping and reports invalid rows individually', () => {
  const source = csvImportSource('Uno?;A;B;A\nDue?;A;B;D\nTre?;A;B;A;extra', ';', false);
  const rows = previewQuestionImport(source, configuration({ text:'0',optionA:'1',optionB:'2',correct:'3' }));
  assert.equal(rows.filter(row => row.question).length, 1);
  assert.equal(rows[1].errors[0].key, 'correctReference'); assert.deepEqual(rows[1].errors[0].args, {value:'D',count:2});
  assert.equal(rows[2].errors[0].key, 'csvColumns');
  assert.throws(()=>previewQuestionImport(source,configuration()),code('fieldRequired'));
  assert.throws(()=>previewQuestionImport(source,configuration({text:'0',optionA:'1',optionB:'1',correct:'3'})),code('repeatedColumn'));
  const line12 = csvImportSource('domanda;risposta_A;risposta_B;corretta'+'\n'.repeat(11)+'Domanda;Uno;Due;D',';',true);
  assert.equal(previewQuestionImport(line12,configuration(suggestQuestionMapping(line12.columns)))[0].line,12);
});

test('CSV template round trips all supported types and an explicit multiple-correct answer', () => {
  const source = csvImportSource(questionCsvTemplate(),detectQuestionSeparator(questionCsvTemplate()),true);
  const rows = previewQuestionImport(source,configuration(suggestQuestionMapping(source.columns)));
  assert.equal(rows.length,3); assert.ok(rows.every(row=>row.question && !row.errors.length));
  assert.equal(rows[1].question!.type,'true_false'); assert.equal(rows[1].question!.options.length,2);
  assert.equal(rows[2].question!.options.filter(option=>option.isCorrect).length,2);
});

test('JSON canonical questions preserve supported media/credits and never import source timestamps', () => {
  const q = {...question(),videoTimestamp:45,mediaUrl:'https://example.org/image.png',mediaType:'image',explanation:'Spiegazione',mediaAttribution:{title:'Image',creator:'Creator',license:'CC BY',sourceUrl:'https://example.org/source',attributionText:'Photo by Creator',credit:'Archive'}};
  const rows = jsonRows([q]); assert.equal(rows[0].errors.length,0); assert.equal(rows[0].warnings[0].key,'externalAsset');
  assert.equal(rows[0].question!.videoTimestamp,undefined); assert.equal(rows[0].question!.mediaAttribution!.creator,'Creator');
  assert.equal(rows[0].question!.mediaAttribution!.attributionText,'Photo by Creator'); assert.equal(rows[0].question!.mediaAttribution!.credit,'Archive');
});

test('JSON full-quiz extraction is distinct from complete import and preserves destination metadata/checkpoints', () => {
  const sourceQuiz = {...classic(),title:'Not the destination',questions:[question()],videoConfig:{videoUrl:'file:///missing.mp4',checkpoints:[{questionId:'source-id',timestamp:12}]}};
  const source = jsonImportSource(JSON.stringify(sourceQuiz)); assert.equal(source.fullQuiz,true);
  const target = editableVideoQuiz(structuredClone(DEFAULT_QUIZZES[0])), before = JSON.stringify(target);
  const next = appendImportedQuestions(target,previewQuestionImport(source,configuration(),target.questions));
  assert.equal(next.title,target.title); assert.deepEqual(next.settings,target.settings); assert.deepEqual(next.videoConfig,target.videoConfig);
  assert.equal(next.questions.length,target.questions.length+1); assert.equal(quizCheckpoints(next).length,quizCheckpoints(target).length);
  assert.equal(JSON.stringify(target),before);
});

test('flat JSON is mapped explicitly, including option arrays and unambiguous answer notation', () => {
  const source = jsonImportSource(JSON.stringify([{prompt:'Domanda',answers:['Uno','Due'],right:2}])); assert.equal(source.kind,'flat');
  const cfg = {...configuration({text:'prompt',options:'answers',correct:'right'}),correctMode:'numbers' as const};
  assert.equal(previewQuestionImport(source,cfg)[0].question!.options[1].isCorrect,true);
  assert.equal(previewQuestionImport(source,{...cfg,correctMode:'letters'})[0].errors[0].key,'correctReference');
  const textSource = jsonImportSource(JSON.stringify({questions:[{prompt:'Domanda',answers:['Uno','Due'],right:'Due'}]}));
  assert.equal(previewQuestionImport(textSource,{...cfg,correctMode:'texts'})[0].question!.options[1].isCorrect,true);
  const ambiguous = jsonImportSource(JSON.stringify([{prompt:'Domanda',answers:['Due','Due'],right:'Due'}]));
  assert.equal(previewQuestionImport(ambiguous,{...cfg,correctMode:'texts'})[0].errors[0].key,'correctAmbiguous');
});

test('mapped media type is explicit, empty optional types are valid, and canonical question types are required', () => {
  const text='domanda;risposta_A;risposta_B;corretta;mediaUrl;mediaType\nVideo?;Uno;Due;A;https://example.org/lesson.mp4;video\nImmagine?;Uno;Due;A;https://example.org/image.png;';
  const source=csvImportSource(text,';',true), rows=previewQuestionImport(source,configuration(suggestQuestionMapping(source.columns)));
  assert.equal(rows[0].question!.mediaType,'video'); assert.equal(rows[1].question!.mediaType,'image');
  const q=question() as any; delete q.type; assert.equal(jsonRows([q])[0].errors[0].key,'invalidType');
  const template=csvImportSource(questionCsvTemplate('en'),';',true);
  assert.ok(previewQuestionImport(template,configuration(suggestQuestionMapping(template.columns))).every(row=>row.question));
});

test('malformed/unknown JSON, empty files and bounded files fail without interpreting arbitrary structures', async () => {
  assert.throws(()=>jsonImportSource('{bad'),code('jsonSyntax'));
  assert.throws(()=>jsonImportSource('{"nested":{"questions":[]}}'),code('jsonStructure'));
  assert.throws(()=>jsonImportSource('[{"nested":{"text":"No"}}]'),code('jsonStructure'));
  assert.throws(()=>jsonImportSource('[]'),code('empty')); assert.throws(()=>csvImportSource('',';',true),code('empty'));
  assert.throws(()=>jsonImportSource(' '.repeat(IMPORT_LIMITS.bytes+1)),code('tooLarge'));
  assert.throws(()=>jsonImportSource(JSON.stringify(Array.from({length:1001},()=>question()))),code('tooMany'));
  assert.throws(()=>parseQuestionCsv(Array(65).fill('col').join(';'),';'),code('tooMany'));
  await assert.rejects(readQuestionFile(new File([new Uint8Array([0xff,0xfe])],'bad.csv')),code('encoding'));
  await assert.rejects(readQuestionFile(new File(['x'],'bad.xlsx')),code('fileType'));
  await assert.rejects(readQuestionFile({name:'huge.csv',size:IMPORT_LIMITS.bytes+1} as File),code('tooLarge'));
});

test('validations reject unsupported types, invalid correctness, numbers, optional fields and missing local assets', () => {
  const invalid: [Partial<Question>, string][] = [
    [{text:''},'invalidText'],[{type:'open' as any},'invalidType'],[{points:-1},'numberRange'],[{points:Infinity},'numberRange'],[{timeLimit:0},'numberRange'],[{timeLimit:86401},'numberRange'],[{explanation:3 as any},'optionalType'],
    [{mediaUrl:'file:///lesson.png'},'asset'],[{mediaUrl:'blob:missing'},'asset'],[{mediaUrl:'images/missing.png'},'asset'],[{mediaUrl:'javascript:alert(1)'},'asset'],[{mediaAttribution:{} as any},'attribution'],
    [{options:question().options.map(option=>({...option,isCorrect:false}))},'correctMissing'],[{options:question().options.map(option=>({...option,id:'same'}))},'optionIds'],
    [{options:[...question().options,{...question().options[0],id:'third'}],type:'true_false'},'optionCount'],
  ];
  for(const [change,error] of invalid) {
    // Infinity cannot be represented in JSON; direct source validation must still reject it.
    const source = jsonImportSource(JSON.stringify([question()])); source.records=[{...question(),...change}];
    assert.equal(previewQuestionImport(source,configuration())[0].errors[0]?.key,error,JSON.stringify(change));
  }
  const valid = jsonRows([{...question(),points:0,timeLimit:86400}]); assert.equal(valid[0].errors.length,0);
});

test('duplicates compare content rather than IDs, distinguish similar questions, and warn about repeated source IDs', () => {
  const target = question();
  const same = {...question(),id:'a different ID',options:[...question().options].reverse()};
  const similar = {...question(),points:2000};
  const rows = jsonRows([same,similar,question('Nuova'),question('Nuova')],[target]);
  assert.equal(rows[0].duplicate!.kind,'identical'); assert.equal(rows[1].duplicate!.kind,'similar'); assert.equal(rows[2].duplicate,undefined);
  assert.equal(rows[3].duplicate!.source,'file'); assert.ok(rows[3].warnings.some(issue=>issue.key==='sourceIds'));
});

test('partial append is atomic, regenerates all IDs, never overwrites and rejects repeated selection', () => {
  const target = classic(), before = JSON.stringify(target), rows = jsonRows([question(),{...question('Bad'),type:'open'}]);
  assert.throws(()=>appendImportedQuestions(target,rows),code('nothingSelected')); assert.equal(JSON.stringify(target),before);
  const next = appendImportedQuestions(target,rows.filter(row=>row.question));
  assert.equal(next.questions.length,target.questions.length+1); assert.deepEqual(next.questions.slice(0,target.questions.length),target.questions);
  assert.notEqual(next.questions.at(-1)!.id,'source-id'); assert.notEqual(next.questions.at(-1)!.options[0].id,'a');
  assert.throws(()=>appendImportedQuestions(target,[rows[0],rows[0]]),code('nothingSelected'));
  assert.equal(JSON.stringify(target),before);
});

test('legacy video checkpoints materialize before append, while new questions remain unassigned', () => {
  const target = structuredClone(DEFAULT_QUIZZES[0]); delete target.videoConfig!.checkpointMode;
  const expected = quizCheckpoints(target), next = appendImportedQuestions(target,jsonRows([question()]));
  assert.equal(next.videoConfig!.checkpointMode,'explicit'); assert.deepEqual(quizCheckpoints(next),expected);
  assert.equal(next.questions.at(-1)!.videoTimestamp,undefined);
});

function browser(t: any, lang = 'it') {
  const dom = new JSDOM('<div id="app"></div>',{url:`http://localhost:39911/?app=classroom&lang=${lang}`});
  const saved = new Map<string,PropertyDescriptor|undefined>(); let requests=0;
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,FileReader:dom.window.FileReader,indexedDB:new IDBFactory(),IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>{requests++;throw new Error('Importer must stay local');}})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  dom.window.confirm=()=>false;
  let cleanup=async()=>{};
  t.after(async()=>{await cleanup(); dom.window.close();for(const[key,value]of saved){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
  const wait=async(condition:()=>unknown)=>{for(let n=0;n<200;n++){let ready;await act(async()=>{await delay(10);ready=condition();});if(ready)return;}assert.fail(document.body.textContent!);};
  const click=async(text:string)=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);assert.ok(button,text);assert.equal(button.disabled,false,text);await act(async()=>button.click());};
  const input=async(element:HTMLElement,value:string)=>{await act(async()=>{const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
  const upload=async(file:File)=>{const element=document.querySelector('.question-import-dialog input[type=file]')!;Object.defineProperty(element,'files',{value:[file],configurable:true});await act(async()=>element.dispatchEvent(new dom.window.Event('change',{bubbles:true})));await wait(()=>!document.body.textContent!.includes('Lettura del file…')&&!document.body.textContent!.includes('Reading file…'));};
  return {dom,wait,click,input,upload,requests:()=>requests,cleanup(fn:()=>Promise<void>){cleanup=fn;}};
}

test('wizard previews mixed CSV, retains mappings on Back and confirms only selected valid rows once', async t => {
  const env=browser(t),{createRoot}=await import('react-dom/client'),{LanguageProvider}=await import('../src/context/LanguageContext'),{QuestionImportDialog}=await import('../src/components/builder/QuestionImportDialog');
  const root=createRoot(document.getElementById('app')!);env.cleanup(async()=>{await act(async()=>root.unmount());});
  let calls=0,result:Quiz|undefined;
  await act(async()=>root.render(React.createElement(LanguageProvider,null,React.createElement(QuestionImportDialog,{initialQuiz:classic(),onCancel(){},onConfirm:async q=>{calls++;result=q;await delay(5);}}))));
  await env.upload(new File(['domanda;risposta_A;risposta_B;corretta\nNuova;Uno;Due;A\nErrore;Uno;Due;D\nDa escludere;Uno;Due;A'],'misto.csv'));
  await env.click('Anteprima');assert.match(document.body.textContent!,/3 elementi · 2 validi · 1 con errori/);
  assert.ok(document.querySelector('input[aria-label="Riga 3: Errore"]'));
  await env.click('Indietro');assert.equal((document.querySelector('select[aria-label="Domanda"]') as HTMLSelectElement).value,'0');await env.click('Anteprima');
  const unwanted=document.querySelector('input[aria-label^="Riga 4:"]') as HTMLInputElement;await act(async()=>unwanted.click());
  const confirm=[...document.querySelectorAll('button')].find(b=>b.textContent==='Aggiungi le domande selezionate')!;
  await act(async()=>{confirm.click();confirm.click();await delay(10);});assert.equal(calls,1);assert.equal(result!.questions.length,classic().questions.length+1);assert.equal(result!.questions.at(-1)!.text,'Nuova');assert.equal(env.requests(),0);
});

test('wizard creates a new video quiz in English with chosen settings and no library writes', async t => {
  const env=browser(t,'en'),{createRoot}=await import('react-dom/client'),{LanguageProvider}=await import('../src/context/LanguageContext'),{QuestionImportDialog}=await import('../src/components/builder/QuestionImportDialog');
  const root=createRoot(document.getElementById('app')!);env.cleanup(async()=>{await act(async()=>root.unmount());});let result:Quiz|undefined;
  await act(async()=>root.render(React.createElement(LanguageProvider,null,React.createElement(QuestionImportDialog,{quizzes:[classic()],onCancel(){},onConfirm:q=>{result=q;}}))));
  await env.input(document.querySelector('input[aria-label="Quiz title"]')!,'Imported video lesson');await env.input(document.querySelector('select[aria-label="Quiz mode"]')!,'video');await env.input(document.querySelector('select[aria-label="Points multiplier"]')!,'2');
  await env.upload(new File([JSON.stringify([question()])],'questions.json'));assert.match(document.body.textContent!,/Recognized Qurioso/);
  await env.click('Confirm and open editor');assert.equal(result!.title,'Imported video lesson');assert.equal(result!.settings.pointsMultiplier,2);assert.equal(result!.questions.length,1);assert.deepEqual(result!.videoConfig!.checkpoints,[]);assert.equal(await loadQuizzes(),null);assert.equal(await editorDraft('read'),undefined);assert.equal(env.requests(),0);
});

test('editor cancellation preserves unsaved text; confirmed append is saved only through Save quiz', async t => {
  const env=browser(t),{createRoot}=await import('react-dom/client'),{LanguageProvider}=await import('../src/context/LanguageContext'),{QuizEditor}=await import('../src/components/builder/QuizEditor');
  const initial=classic();await storeQuizzes([initial]);const before=JSON.stringify(await loadQuizzes());
  const root=createRoot(document.getElementById('app')!);env.cleanup(async()=>{await act(async()=>root.unmount());});
  await act(async()=>root.render(React.createElement(LanguageProvider,null,React.createElement(QuizEditor,{initialQuiz:initial,onCancel(){},onSave:async q=>{await storeQuizzes([q]);}}))));
  await env.wait(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Importa domande')?.disabled);
  await env.input(document.querySelector('textarea[aria-label="Testo della domanda"]')!,'Modifica locale da conservare');
  await env.click('Importa domande');await env.upload(new File([JSON.stringify([question()])],'domande.json'));
  assert.equal(JSON.stringify(await loadQuizzes()),before);await env.click('Annulla');assert.equal((document.querySelector('textarea[aria-label="Testo della domanda"]') as HTMLTextAreaElement).value,'Modifica locale da conservare');
  await env.click('Importa domande');await env.upload(new File([JSON.stringify([question()])],'domande.json'));await env.click('Aggiungi le domande selezionate');
  assert.equal(JSON.stringify(await loadQuizzes()),before);await env.click('Salva Quiz');
  const saved=(await loadQuizzes())![0];assert.equal(saved.questions.length,initial.questions.length+1);assert.equal(saved.questions[0].text,'Modifica locale da conservare');assert.equal(saved.questions.at(-1)!.text,'Domanda importata');assert.equal(env.requests(),0);
});

test('settings destination selection opens the existing quiz in the editor without overwriting the library', async t => {
  const env=browser(t),{createRoot}=await import('react-dom/client'),{LanguageProvider}=await import('../src/context/LanguageContext'),{default:App}=await import('../src/App');
  const initial=classic();await storeQuizzes([initial]);const before=JSON.stringify(await loadQuizzes());
  const root=createRoot(document.getElementById('app')!);env.cleanup(async()=>{await act(async()=>root.unmount());});
  await act(async()=>root.render(React.createElement(LanguageProvider,null,React.createElement(App,{classroomOnly:true}))));
  await env.wait(()=>document.querySelector('[data-qurioso-dashboard]'));await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="Impostazioni"]')!.click());await env.wait(()=>document.querySelector('[data-qurioso-settings]'));await env.click('Importa domande');await env.input(document.querySelector('select[aria-label="Destinazione"]')!,'existing');
  await env.upload(new File([JSON.stringify([question()])],'domande.json'));await env.click('Conferma e apri editor');
  await env.wait(()=>document.querySelector('.quiz-editor'));assert.match(document.body.textContent!,/4 domande create/);assert.equal(JSON.stringify(await loadQuizzes()),before);
  assert.equal(env.requests(),0);
});
