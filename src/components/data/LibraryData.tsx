import React, { useEffect, useRef, useState } from 'react';
import type { Quiz } from '../../types/quiz';
import { useLanguage } from '../../context/LanguageContext';
import { backupError, backupText, type BackupMessage } from '../../i18n/libraryBackup';
import { BACKUP_LIMITS, backupImageCount, backupEstimate, exportLibraryBackup, planBackup, previewLibraryBackup, relinkBackupVideo, restoreLibraryBackup, type BackupPlan, type BackupPreview, type Progress, type RestoreMode } from '../../services/libraryBackup';
import { formatAssetSize } from '../../services/quizStorage';

export function LibraryData({quizzes,onRestored,onEditor,onQuestions}:{quizzes:Quiz[];onRestored:(q:Quiz[])=>void;onEditor:(q:Quiz)=>void;onQuestions:()=>void}) {
  const {language}=useLanguage(), t=(key:BackupMessage)=>backupText(language,key);
  const [dialog,setDialog]=useState<'export'|'import'>(), [quizId,setQuizId]=useState(quizzes[0]?.id || '');
  const selected=quizzes.find(q=>q.id===quizId)||quizzes[0];
  const missing=[...new Map(quizzes.filter(q=>q.videoConfig?.missingVideo).map(q=>[q.videoConfig!.videoAssetId!,q])).values()];
  const [error,setError]=useState(''), [relinking,setRelinking]=useState(false); const lock=useRef(false);
  const relink=async(id:string,file?:File)=> {
    if(!file||lock.current)return;lock.current=true;setRelinking(true);setError('');
    try {
      let result:Quiz[];
      try { result=await relinkBackupVideo(quizzes,id,file); }
      catch(e) { if(e instanceof Error && e.message==='backupMismatch' && window.confirm(t('mismatch'))) result=await relinkBackupVideo(quizzes,id,file,true); else throw e; }
      onRestored(result);
    }catch(e){setError(backupError(language,e));}finally{lock.current=false;setRelinking(false);}
  };
  return <section className="library-data rounded-2xl border border-line bg-white p-4 space-y-3" aria-label={t('data')}>
    <h2 className="text-xl font-black text-petrolio">{t('data')}</h2><p className="text-sm text-muted">{t('singleHint')}</p>
    <div className="flex flex-wrap gap-2 items-center">
      <select aria-label={t('chooseQuiz')} value={selected?.id || ''} onChange={e=>setQuizId(e.target.value)} className="min-w-0 max-w-full rounded-xl border border-line p-2">{quizzes.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}</select>
      <button disabled={!selected} onClick={()=>onEditor(selected)} className="btn-petrolio rounded-xl px-3 py-2">{t('exportQuiz')}</button>
      <button disabled={!selected} onClick={()=>onEditor(selected)} className="btn-petrolio rounded-xl px-3 py-2">{t('importQuiz')}</button>
      <button onClick={onQuestions} className="btn-petrolio rounded-xl px-3 py-2">{t('importQuestions')}</button>
      <button onClick={()=>setDialog('export')} className="btn-mandarino rounded-xl px-3 py-2 font-bold">{t('exportBackup')}</button>
      <button onClick={()=>setDialog('import')} className="btn-petrolio rounded-xl px-3 py-2 font-bold">{t('importBackup')}</button>
    </div>
    {!!missing.length && <div className="space-y-2"><p className="font-bold text-petrolio">{t('missing')}</p>{missing.map(q=>{
      const v=q.videoConfig!,m=v.missingVideo!;
      return <label key={v.videoAssetId} className="block text-sm break-words">{q.title} · {m.name||v.videoFileName} · {(m.sizeKnown===false?'—':formatAssetSize(m.size))} · {m.mime}<br/>{t('relink')} <input disabled={relinking||!!dialog} type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void relink(v.videoAssetId!,file);}} /></label>;
    })}</div>}
    {error&&<p role="alert">{error}</p>}
    {dialog&&<BackupDialog mode={dialog} quizzes={quizzes} onClose={()=>setDialog(undefined)} onRestored={onRestored}/>}
  </section>;
}
function BackupDialog({mode,quizzes,onClose,onRestored}:{mode:'export'|'import';quizzes:Quiz[];onClose:()=>void;onRestored:(q:Quiz[])=>void}) {
  const {language,setLanguage}=useLanguage(),t=(key:BackupMessage)=>backupText(language,key);
  const [plan,setPlan]=useState<BackupPlan>(),[preview,setPreview]=useState<BackupPreview>(),[include,setInclude]=useState(true);
  const [busy,setBusy]=useState(mode==='export'),[error,setError]=useState(''),[report,setReport]=useState('');
  const [restoreMode,setRestoreMode]=useState<RestoreMode>('add'),[selected,setSelected]=useState<string[]>([]),[confirmed,setConfirmed]=useState(false),[restoreLanguage,setRestoreLanguage]=useState(false);
  const [progress,setProgress]=useState<{phase:'export'|'verify'|'restore';done:number;total:number}>();
  const root=useRef<HTMLDivElement>(null),lock=useRef(false),abort=useRef<AbortController>(undefined),busyRef=useRef(busy),finished=useRef(false);
  busyRef.current=busy;
  const streaming=typeof (window as any).showSaveFilePicker==='function';
  const [direct,setDirect]=useState(streaming);
  useEffect(()=>{
    if(mode!=='export')return;
    let active=true;planBackup(quizzes,language).then(p=>{if(active){setPlan(p);setInclude(p.videoBytes<=BACKUP_LIMITS.buffered);}}).catch(e=>{if(active)setError(backupError(language,e));}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';root.current?.focus();
    const trap=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();if(!busyRef.current)onClose();return;}
      if(event.key!=='Tab')return;
      const elements=[...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')],first=elements[0],last=elements.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current||!root.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!root.current?.contains(document.activeElement)||document.activeElement===root.current)){event.preventDefault();first?.focus();}
    };
    const unload=(event:BeforeUnloadEvent)=>{if(busyRef.current){event.preventDefault();event.returnValue='';}};
    document.addEventListener('keydown',trap);window.addEventListener('beforeunload',unload);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',trap);window.removeEventListener('beforeunload',unload);previous?.focus();};
  },[]);
  const update:Progress=(phase,done,total)=>setProgress({phase,done,total});
  const run=async(action:()=>Promise<void>)=>{
    if(lock.current||finished.current)return;lock.current=true;setBusy(true);setError('');setReport('');abort.current=new AbortController();
    try{await action();}catch(e){setError(backupError(language,e));}finally{setBusy(false);lock.current=false;setProgress(undefined);}
  };
  const exportFile=()=>run(async()=>{
    if(!plan)return;
    const filename=`qurioso-backup-${new Date().toISOString().slice(0,10)}.zip`;
    // Request picker before other async work so the browser retains the user gesture.
    let handle:any;
    if(direct)try{handle=await (window as any).showSaveFilePicker({suggestedName:filename,types:[{description:'Qurioso ZIP',accept:{'application/zip':['.zip']}}]});}
    catch(error){if(error instanceof Error && ['SecurityError','NotAllowedError','NotSupportedError'].includes(error.name)){setDirect(false);throw new Error('backupDirectUnavailable');}throw error;}
    const sink=handle?await handle.createWritable():undefined;
    try{
      const blob=await exportLibraryBackup(plan,include,sink,update,abort.current?.signal);
      if(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setReport(t('downloaded'));}
      else setReport(t('saved'));
    }catch(e){try{await sink?.abort(e);}catch{}throw e;}
  });
  const restore=()=>run(async()=>{
    if(!preview)return;
    const updated=await restoreLibraryBackup(preview,restoreMode,selected,confirmed,update,abort.current?.signal);
    finished.current=true;onRestored(updated);setReport(t('done'));
    if(restoreLanguage&&preview.manifest.settings.language)setLanguage(preview.manifest.settings.language);
  });
  const estimate=plan?backupEstimate(plan,include):undefined, m=preview?.manifest;
  const stats=(items:[string,string|number][])=> <dl className="backup-stats">{items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
  return <div className="backup-overlay"><div ref={root} tabIndex={-1} className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
    <header><h2 id="backup-title">{t(mode==='export'?'exportBackup':'importBackup')}</h2><button disabled={busy} onClick={onClose}>{t('close')}</button></header>
    <div className="backup-body space-y-4">
      <p className="text-sm text-muted">{t('limits')}</p>
      {mode==='export'&&plan&&estimate&&<>
        {stats([[t('quizzes'),plan.manifest.quizzes.length],[t('questions'),plan.manifest.quizzes.reduce((n,q)=>n+q.questions.length,0)],[t('images'),backupImageCount(plan.manifest)],[t('videos'),plan.manifest.assets.filter(a=>a.kind==='video').length],[t('quizSize'),formatAssetSize(estimate.metadata)],[t('imageSize'),formatAssetSize(estimate.images)],[t('videoSize'),formatAssetSize(plan.videoBytes)],[t('includedSize'),formatAssetSize(estimate.videos)],[t('excluded'),estimate.excluded],[t('total'),formatAssetSize(estimate.total)]])}
        {streaming&&<label className="block font-bold">{t('method')} <select disabled={busy} value={direct?'direct':'browser'} onChange={e=>setDirect(e.target.value==='direct')}><option value="direct">{t('direct')}</option><option value="browser">{t('browser')}</option></select></label>}
        <label className="flex gap-2 items-center font-bold"><input type="checkbox" checked={include} disabled={busy} onChange={e=>setInclude(e.target.checked)}/>{t('include')}</label>
        <p className="text-sm">{t('sizeHint')}</p>
        {!!plan.orphanCount&&<p className="text-sm">{t('orphans')}: {plan.orphanCount} · {formatAssetSize(plan.orphanBytes)} · video</p>}
        {!!plan.warnings.length&&<p className="text-sm">{t('backupExternal')}</p>}
      </>}
      {mode==='import'&&<label className="block font-bold">{t('file')}<input className="block max-w-full mt-2" type="file" accept=".zip,application/zip" disabled={busy||finished.current} onChange={e=>{
        const file=e.target.files?.[0];e.target.value='';if(!file)return;setPreview(undefined);setConfirmed(false);setSelected([]);void run(async()=>{const p=await previewLibraryBackup(file,quizzes);abort.current?.signal.throwIfAborted();setPreview(p);});
      }}/></label>}
      {preview&&m&&<>
        <h3 className="font-bold">{t('preview')}</h3>
        {stats([[t('quizzes'),m.quizzes.length],[t('questions'),m.quizzes.reduce((n,q)=>n+q.questions.length,0)],[t('images'),backupImageCount(m)],[t('videos'),m.assets.filter(a=>a.kind==='video'&&a.included).length],[t('excluded'),m.assets.filter(a=>a.kind==='video'&&!a.included).length],[t('total'),formatAssetSize(preview.total)],[t('conflicts'),preview.conflicts.length]])}
        <ul className="text-sm max-h-28 overflow-auto">{m.quizzes.map(q=><li key={q.id}>{q.title} · {q.id} {preview.conflicts.includes(q.id)?'⚠':''}</li>)}</ul>
        <fieldset disabled={busy||finished.current} className="space-y-2">
          {(['add','replace','all'] as const).map(value=><label key={value} className="block"><input type="radio" name="restore-mode" checked={restoreMode===value} onChange={()=>{setRestoreMode(value);setConfirmed(false);}}/> {t(value)}</label>)}
          {restoreMode==='replace'&&<div><p className="font-bold">{t('select')}</p>{preview.conflicts.map(id=><label key={id} className="block"><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(v=>v!==id))}/> {m.quizzes.find(q=>q.id===id)?.title} · {id}</label>)}</div>}
          {restoreMode==='all'&&<label className="block rounded-xl border-2 border-mandarino p-3 font-bold"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> {t('confirmAll')}</label>}
          <label className="block text-sm"><input type="checkbox" checked={restoreLanguage} onChange={e=>setRestoreLanguage(e.target.checked)}/> {t('language')} ({m.settings.language||'—'})</label>
        </fieldset>
        {!!m.assets.filter(a=>a.kind==='video'&&!a.included).length&&<p className="text-sm">{t('missing')} {m.assets.filter(a=>a.kind==='video'&&!a.included).map(a=>`${a.name||a.id} (${a.sizeKnown===false?'—':formatAssetSize(a.size)})`).join(', ')}</p>}
      </>}
      {busy&&<div role="status">{progress?t(progress.phase==='export'?'exportProgress':progress.phase==='verify'?'verifyProgress':'restoreProgress'):t('loading')}{progress&&<progress className="block w-full" max={progress.total||1} value={progress.done}/>}</div>}
      {error&&<p role="alert" className="text-rose-700 font-bold">{error}</p>}{report&&<p role="status" className="font-bold text-petrolio">{report}</p>}
    </div>
    <footer>
      {busy&&abort.current&&<button disabled={progress?.phase==='restore'} onClick={()=>abort.current?.abort()}>{t('cancel')}</button>}
      {mode==='export'&&<button className="btn-mandarino" disabled={busy||!estimate||estimate.total>(direct?BACKUP_LIMITS.total:BACKUP_LIMITS.buffered)} onClick={()=>void exportFile()}>{t('export')}</button>}
      {mode==='import'&&<button className="btn-mandarino" disabled={busy||!preview||finished.current||(restoreMode==='all'&&!confirmed)||(restoreMode==='replace'&&!selected.length)} onClick={()=>void restore()}>{t('confirm')}</button>}
      <button disabled={busy} onClick={onClose}>{t('close')}</button>
    </footer>
  </div></div>;
}
