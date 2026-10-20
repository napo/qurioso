import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {BlobReader,BlobWriter,TextReader,ZipReader,ZipWriter} from '@zip.js/zip.js';
import {DEFAULT_QUIZZES} from '../src/data/defaultQuizzes';
import type {Quiz} from '../src/types/quiz';
import {BACKUP_LIMITS,backupEstimate,exportLibraryBackup,planBackup,previewLibraryBackup,relinkBackupVideo,restoreLibraryBackup} from '../src/services/libraryBackup';
import {formatAssetSize,loadQuizzes,loadVideo,openLibrary,readLibrarySnapshot,storeQuizzes,storeVideo,editorDraft,presenterQuiz} from '../src/services/quizStorage';

beforeEach(()=>{
  Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});
  const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},configurable:true});
  // Real Blob implementation, bounded FileReader equivalent for Node (browser smoke uses native FileReader).
  Object.defineProperty(globalThis,'FileReader',{configurable:true,value:class {result='';onload?:()=>void;onerror?:()=>void;readAsDataURL(blob:Blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onload?.();}).catch(()=>this.onerror?.());}}});
});
const classic=():Quiz=>{const q=structuredClone(DEFAULT_QUIZZES[0]);delete q.videoConfig;delete q.coverImage;return q;};
async function video(id='video-quiz'){
  const q=classic();q.id=id;q.videoConfig={videoUrl:'',videoTitle:'Lesson',videoType:'file',videoFileName:'lesson.webm',videoAssetId:await storeVideo(new File(['video bytes'],'lesson.webm',{type:'video/webm'})),pauseMode:'defined',checkpointMode:'explicit',checkpoints:[{questionId:q.questions[0].id,timestamp:12}]};return q;
}
const archive=async(q:Quiz[],include=true)=> (await exportLibraryBackup(await planBackup(q,'it'),include))!;
async function contents(blob:Blob){const zip=new ZipReader(new BlobReader(blob),{useWebWorkers:false});const entries=await zip.getEntries();const json=entries.find(e=>e.filename==='manifest.json');assert.ok(json&&'getData'in json);const m=JSON.parse(await (await json.getData(new BlobWriter())).text());await zip.close();return {m,entries};}
async function custom(m:unknown,assets:Record<string,string|Blob>={}){const zip=new ZipWriter(new BlobWriter(),{useWebWorkers:false,level:0});await zip.add('manifest.json',new TextReader(JSON.stringify(m)));for(const [path,data] of Object.entries(assets))await zip.add(path,typeof data==='string'?new TextReader(data):new BlobReader(data));return zip.close();}
const error=(message:string)=>(e:unknown)=>e instanceof Error&&e.message===message;

test('backup without local videos keeps missing descriptors, questions/checkpoints and does not include binary video',async()=>{
  const q=await video(),blob=await archive([q],false),{m,entries}=await contents(blob);
  assert.equal(entries.length,1);assert.equal(m.assets[0].included,false);assert.equal(m.assets[0].size,11);assert.equal(m.quizzes[0].videoConfig.videoUrl,'');assert.deepEqual(m.quizzes[0].videoConfig.checkpoints,q.videoConfig!.checkpoints);
});
test('backup with binary video: no Base64, deduplicates shared IDs and embeds images once',async()=>{
  const q=await video(),copy=structuredClone(q);copy.id='copy';q.coverImage=copy.coverImage='data:image/png;base64,AQID';
  const plan=await planBackup([q,copy]);assert.equal(plan.manifest.assets.length,2);
  const {m,entries}=await contents((await exportLibraryBackup(plan,true))!);
  assert.equal(entries.length,3);assert.equal(m.quizzes[0].videoConfig.videoAssetId,m.quizzes[1].videoConfig.videoAssetId);assert.equal(m.quizzes[0].coverImage,m.quizzes[1].coverImage);
  assert.ok(!JSON.stringify(m).includes('base64'));assert.equal(m.assets.filter((a:any)=>a.kind==='image')[0].size,3);
});
test('size estimates use UTF-8 metadata and actual binary bytes; checkbox updates immediately; TB formatter',async()=>{
  const q=await video();q.title='È una lezione';q.coverImage='data:image/png;base64,AQID';const plan=await planBackup([q]);
  const included=backupEstimate(plan,true),excluded=backupEstimate(plan,false);
  assert.equal(included.images,3);assert.equal(included.videos,11);assert.equal(excluded.videos,0);assert.equal(excluded.excluded,1);
  assert.equal(included.total,included.metadata+3+11);assert.equal(excluded.total,excluded.metadata+3);assert.match(formatAssetSize(1000**4),/TB/);
  const {m}=await contents((await exportLibraryBackup(plan,true))!);assert.equal(included.metadata,new TextEncoder().encode(JSON.stringify(m)).length);
});
test('YouTube and Vimeo links and metadata are preserved without provider downloads',async()=>{
  const youtube=classic(),vimeo=classic();vimeo.id='vimeo';youtube.videoConfig={videoUrl:'https://www.youtube.com/watch?v=abc',videoTitle:'YouTube',videoType:'youtube',pauseMode:'random',checkpoints:[],randomConfig:{frequencySeconds:30,totalCheckpoints:2}};vimeo.videoConfig={...youtube.videoConfig,videoUrl:'https://vimeo.com/123',videoType:'vimeo'};
  const {m,entries}=await contents(await archive([youtube,vimeo]));assert.equal(entries.length,1);assert.deepEqual(m.quizzes.map((q:Quiz)=>q.videoConfig),[youtube.videoConfig,vimeo.videoConfig]);
});
test('restore into an empty library is atomic and survives reload, including an intentionally empty backup',async()=>{
  await storeQuizzes([]);const q=await video(),blob=await archive([q]);const p=await previewLibraryBackup(blob,[]);const restored=await restoreLibraryBackup(p,'all',[],true);
  assert.equal(restored.length,1);assert.equal((await loadVideo(restored[0].videoConfig!.videoAssetId!)).size,11);assert.deepEqual(await loadQuizzes(),restored);
  const empty=await archive([]);await restoreLibraryBackup(await previewLibraryBackup(empty,restored),'all',[],true);assert.deepEqual(await loadQuizzes(),[]);
});
test('preview is read-only, detects conflicts and add never overwrites IDs, including question/checkpoint remapping',async()=>{
  const q=await video();await storeQuizzes([q]);const blob=await archive([q]);const before=JSON.stringify(await loadQuizzes());const p=await previewLibraryBackup(blob,[q]);
  assert.deepEqual(p.conflicts,[q.id]);assert.equal(JSON.stringify(await loadQuizzes()),before);
  const result=await restoreLibraryBackup(p,'add',[],false);assert.equal(result.length,2);assert.deepEqual(result[0],q);assert.notEqual(result[1].id,q.id);
  assert.notEqual(result[1].questions[0].id,q.questions[0].id);assert.equal(result[1].videoConfig!.checkpoints[0].questionId,result[1].questions[0].id);assert.notEqual(result[1].videoConfig!.videoAssetId,q.videoConfig!.videoAssetId);
});
test('selective replacement touches only explicitly selected matching quizzes',async()=>{
  const a=classic(),b=classic();b.id='b';await storeQuizzes([a,b]);const changed={...a,title:'Changed'},p=await previewLibraryBackup(await archive([changed]),[a,b]);
  const r=await restoreLibraryBackup(p,'replace',[a.id],false);assert.equal(r[0].title,'Changed');assert.deepEqual(r[1],b);
});
test('full restore requires explicit confirmation and selection must be a real conflict',async()=>{
  const q=classic();await storeQuizzes([q]);const p=await previewLibraryBackup(await archive([q]),[q]);
  await assert.rejects(restoreLibraryBackup(p,'all',[],false),error('backupConfirm'));await assert.rejects(restoreLibraryBackup(p,'replace',['bad'],false),error('backupSelection'));assert.deepEqual(await loadQuizzes(),[q]);
});
test('excluded shared video can be relinked for every referencing quiz without losing checkpoints',async()=>{
  const q=await video(),copy=structuredClone(q);copy.id='copy';const blob=await archive([q,copy],false);await storeQuizzes([]);
  const restored=await restoreLibraryBackup(await previewLibraryBackup(blob,[]),'all',[],true),id=restored[0].videoConfig!.videoAssetId!;
  assert.equal(id,restored[1].videoConfig!.videoAssetId);assert.equal(restored[0].videoConfig!.missingVideo!.size,11);
  await assert.rejects(relinkBackupVideo(restored,id,new File(['different'],'wrong.webm',{type:'video/webm'})),error('backupMismatch'));
  const r=await relinkBackupVideo(restored,id,new File(['video bytes'],'lesson.webm',{type:'video/webm'}));
  assert.equal(r[0].videoConfig!.missingVideo,undefined);assert.equal(r[1].videoConfig!.missingVideo,undefined);assert.deepEqual(r[0].videoConfig!.checkpoints,q.videoConfig!.checkpoints);assert.equal((await loadVideo(id)).size,11);
});
test('legacy inline video is extracted into a binary asset and implicit checkpoint semantics are preserved',async()=>{
  const q=classic();q.videoConfig={videoUrl:'data:video/webm;base64,AQID',videoTitle:'old',videoType:'html5',pauseMode:'defined',checkpoints:[]};q.questions[0].videoTimestamp=15;
  const {m}=await contents(await archive([q]));assert.equal(m.assets[0].size,3);assert.equal(m.quizzes[0].videoConfig.checkpointMode,undefined);assert.equal(m.quizzes[0].questions[0].videoTimestamp,15);assert.equal(m.quizzes[0].videoConfig.videoUrl,'');
});
test('orphan videos and draft/presenter data are reported but never exported or deleted',async()=>{
  const q=await video();await storeVideo(new Blob(['orphan'],{type:'video/mp4'}));await editorDraft('write',q);await presenterQuiz('123456','write',q);
  const plan=await planBackup([classic()]);assert.equal(plan.orphanCount,2);assert.equal(plan.orphanBytes,17);assert.equal(plan.manifest.assets.length,0);
  assert.equal((await editorDraft('read'))!.quiz.id,q.id);assert.ok(await presenterQuiz('123456','read'));assert.equal((await loadVideo(q.videoConfig!.videoAssetId!)).size,11);
});
test('multiplayer credentials and personal results never enter the manifest, even via unknown legacy fields',async()=>{
  const q:any=classic();q.playerToken='private';q.pin='123456';q.players=[{name:'Student'}];q.settings.presenterToken='host';q.questions[0].session={token:'secret'};q.questions[0].options[0].token='optionsecret';localStorage.setItem('qurioso_player_recovery_v1','sensitive');
  const {m}=await contents(await archive([q]));for(const secret of ['private','123456','Student','host','secret','optionsecret','sensitive'])assert.ok(!JSON.stringify(m).includes(secret));
});
test('malformed ZIP and unknown manifest version are rejected without changing data',async()=>{
  const q=classic();await storeQuizzes([q]);await assert.rejects(previewLibraryBackup(new Blob(['not zip']),[q]));const {m}=await contents(await archive([q]));m.version=999;
  await assert.rejects(previewLibraryBackup(await custom(m),[q]),error('backupVersion'));assert.deepEqual(await loadQuizzes(),[q]);
});
test('missing included binary or wrong declared size is rejected at preview',async()=>{
  const q=await video();const {m}=await contents(await archive([q]));await assert.rejects(previewLibraryBackup(await custom(m),[]),error('backupMissing'));
  await assert.rejects(previewLibraryBackup(await custom(m,{[m.assets[0].path]:'short'}),[]),error('backupMissing'));
});
test('unsafe ZIP paths and unreferenced entries are rejected',async()=>{
  const {m}=await contents(await archive([classic()]));
  for(const path of ['../outside','/absolute','media/../../escape','C:\\escape','media/%2e%2e']) await assert.rejects(previewLibraryBackup(await custom(m,{[path]:'bad'}),[]),error('backupPath'));
});
test('truncated archive is rejected and binary CRC corruption cannot reach the commit',async()=>{
  const q=await video();await storeQuizzes([]);const blob=await archive([q]);await assert.rejects(previewLibraryBackup(blob.slice(0,blob.size-20),[]));
  const bytes=new Uint8Array(await blob.arrayBuffer()),needle=new TextEncoder().encode('video bytes');let offset=-1;
  for(let i=0;i<bytes.length-needle.length;i++)if(needle.every((b,j)=>bytes[i+j]===b)){offset=i;break;}assert.ok(offset>=0);bytes[offset]^=255;
  const p=await previewLibraryBackup(new Blob([bytes]),[]);await assert.rejects(restoreLibraryBackup(p,'all',[],true));assert.deepEqual(await loadQuizzes(),[]);
});
test('changed library and a repeated restore are rejected instead of overwriting',async()=>{
  const q=classic();await storeQuizzes([q]);const blob=await archive([q]),p=await previewLibraryBackup(blob,[q]);await storeQuizzes([{...q,title:'Other tab'}]);
  await assert.rejects(restoreLibraryBackup(p,'add',[],false),error('backupChanged'));assert.equal((await loadQuizzes())![0].title,'Other tab');
  const p2=await previewLibraryBackup(blob,(await loadQuizzes())!);await restoreLibraryBackup(p2,'add',[],false);await assert.rejects(restoreLibraryBackup(p2,'add',[],false),error('backupChanged'));assert.equal((await loadQuizzes())!.length,2);
});
test('injected storage failure rolls back both quiz replacement and already queued binary writes',async()=>{
  const q=classic();await storeQuizzes([q]);const incoming=await video(),second=await video('second-video');const p=await previewLibraryBackup(await archive([incoming,second]),[q]);
  const original=IDBObjectStore.prototype.put;let writes=0;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='videos'&&++writes===2){this.transaction.abort();return undefined as any;}return original.apply(this,args as any);};
  try{await assert.rejects(restoreLibraryBackup(p,'all',[],true),error('backupWrite'));}finally{IDBObjectStore.prototype.put=original;}
  assert.deepEqual(await loadQuizzes(),[q]);const db=await openLibrary();const tx=db.transaction('videos','readonly'),count=tx.objectStore('videos').count();await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});assert.equal(count.result,2);db.close();
});
test('cancellation before restore does not modify storage, nor declare export successful',async()=>{
  const q=await video();await storeQuizzes([]);const plan=await planBackup([q]),p=await previewLibraryBackup((await exportLibraryBackup(plan,true))!,[]),abort=new AbortController();abort.abort();
  await assert.rejects(restoreLibraryBackup(p,'all',[],true,undefined,abort.signal));await assert.rejects(exportLibraryBackup(plan,true,undefined,undefined,abort.signal));assert.deepEqual(await loadQuizzes(),[]);
});
test('large binary video streams sequentially to a sink and round trips (64 MiB)',async()=>{
  const q=await video();const blob=new Blob([new Uint8Array(64*1024**2)],{type:'video/webm'}),id=await storeVideo(blob);q.videoConfig!.videoAssetId=id;
  const plan=await planBackup([q]);assert.equal(plan.videoBytes,blob.size);let count=0,maxChunk=0,closed=false;
  const sink=new WritableStream<Uint8Array>({write(chunk){count+=chunk.byteLength;maxChunk=Math.max(maxChunk,chunk.byteLength);},close(){closed=true;}});
  await exportLibraryBackup(plan,true,sink);assert.ok(closed);assert.ok(count>blob.size);assert.ok(maxChunk<blob.size);
  const zip=(await exportLibraryBackup(plan,true))!;await storeQuizzes([]);const r=await restoreLibraryBackup(await previewLibraryBackup(zip,[]),'all',[],true);assert.equal((await loadVideo(r[0].videoConfig!.videoAssetId!)).size,blob.size);
});
test('resource limits, unsafe transient URLs and malformed checkpoint references fail conservatively',async()=>{
  const q=classic();q.coverImage='blob:temporary';await assert.rejects(planBackup([q]),error('backupFragile'));
  delete q.coverImage;q.videoConfig={videoUrl:'https://vimeo.com/123',videoTitle:'bad',videoType:'vimeo',pauseMode:'defined',checkpoints:[{questionId:'missing',timestamp:1}]};await assert.rejects(planBackup([q]));
  const plan=await planBackup([classic()]);plan.manifest.assets.push({id:'large',kind:'video',size:BACKUP_LIMITS.buffered+1,mime:'video/mp4',included:true});
  await assert.rejects(exportLibraryBackup(plan,true),error('backupLimit'));
});

test('legacy quizzes may omit descriptive metadata without changing scoring settings or timeline',async()=>{
  const q:any=classic();delete q.author;delete q.createdAt;delete q.category;delete q.description;
  q.videoConfig={videoUrl:'https://vimeo.com/123',videoType:'vimeo',pauseMode:'defined',checkpoints:[]};
  const {m}=await contents(await archive([q]));assert.equal(m.quizzes[0].author,'');assert.equal(m.quizzes[0].createdAt,0);assert.equal(m.quizzes[0].videoConfig.videoTitle,'');assert.deepEqual(m.quizzes[0].settings,q.settings);
});
test('failed output sink never closes successfully or reports a completed backup',async()=>{
  const q=await video(),plan=await planBackup([q]);let closed=false;
  const sink=new WritableStream<Uint8Array>({write(){throw new Error('Disk full');},close(){closed=true;}});
  await assert.rejects(exportLibraryBackup(plan,true,sink));assert.equal(closed,false);
});

test('already missing videos have an explicitly unknown size; recovery never reuses an unrelated local ID',async()=>{
  const q=await video();q.videoConfig!.videoAssetId='deleted-local-id';
  const plan=await planBackup([q]);assert.equal(plan.manifest.assets[0].included,false);assert.equal(plan.manifest.assets[0].sizeKnown,false);
  const zip=(await exportLibraryBackup(plan,true))!;await storeQuizzes([]);
  const result=await restoreLibraryBackup(await previewLibraryBackup(zip,[]),'all',[],true);
  assert.equal(result[0].videoConfig!.missingVideo!.sizeKnown,false);assert.notEqual(result[0].videoConfig!.videoAssetId,'deleted-local-id');
});
test('data URL schemes are case insensitive, and unbacked internal placeholders are rejected before export',async()=>{
  const q=classic();q.videoConfig={videoUrl:'DATA:video/webm;base64,AQID',videoTitle:'legacy',videoType:'html5',pauseMode:'defined',checkpoints:[]};
  const {m}=await contents(await archive([q]));assert.equal(m.quizzes[0].videoConfig.videoUrl,'');assert.equal(m.assets[0].size,3);
  delete q.videoConfig;q.coverImage='qurioso-asset:missing';await assert.rejects(planBackup([q]),error('backupFragile'));
});

test('preview does not migrate or rewrite a legacy localStorage library',async()=>{
  const q=classic(),blob=await archive([q]);localStorage.setItem('qurioso_quizzes',JSON.stringify([q]));
  assert.equal(await readLibrarySnapshot(),null);await previewLibraryBackup(blob,[q]);assert.equal(await readLibrarySnapshot(),null);assert.equal(localStorage.getItem('qurioso_quizzes'),JSON.stringify([q]));
});
