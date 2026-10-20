import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Quiz, Question } from '../../types/quiz';
import { useLanguage } from '../../context/LanguageContext';
import { importText, type ImportIssue, type ImportMessageKey } from '../../i18n/questionImport';
import { IMPORT_FIELDS, OPTION_FIELDS, appendImportedQuestions, csvImportSource, detectQuestionSeparator, importId, jsonImportSource, previewQuestionImport, questionCsvTemplate, readQuestionFile, suggestQuestionMapping, QuestionImportError, type ImportConfig, type ImportSource } from '../../services/questionImport';

const EMPTY_QUESTIONS: Question[] = [];
const inputClass = 'w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm';
interface Props { initialQuiz?: Quiz; quizzes?: Quiz[]; onCancel: () => void; onConfirm: (quiz: Quiz) => void | Promise<void> }

export function QuestionImportDialog({ initialQuiz, quizzes = [], onCancel, onConfirm }: Props) {
  const { language } = useLanguage();
  const t = (key: ImportMessageKey, args?: Record<string, string | number>) => importText(language, key, args);
  const [fileData, setFileData] = useState<{ text: string; name: string }>();
  const [source, setSource] = useState<ImportSource>();
  const [separator, setSeparator] = useState(';'), [header, setHeader] = useState(true);
  const [config, setConfig] = useState<ImportConfig>({ mapping: {}, defaultType: 'multiple_choice', correctMode: 'letters' });
  const [step, setStep] = useState<'file' | 'configure' | 'preview'>('file');
  const [issue, setIssue] = useState<ImportIssue>();
  const [reading, setReading] = useState(false), [confirming, setConfirming] = useState(false);
  const [destination, setDestination] = useState(initialQuiz ? 'existing' : 'new');
  const [targetId, setTargetId] = useState(initialQuiz?.id || quizzes[0]?.id || '');
  const [title, setTitle] = useState(''), [video, setVideo] = useState(false);
  const [multiplier, setMultiplier] = useState(1), [explanation, setExplanation] = useState(true), [streak, setStreak] = useState(true);
  const [selected, setSelected] = useState(new Set<number>()), [page, setPage] = useState(0);
  const dialog = useRef<HTMLDivElement>(null), sequence = useRef(0), confirmed = useRef(false);
  const errorBox = useRef<HTMLParagraphElement>(null);
  const cancelRef = useRef(onCancel); cancelRef.current = onCancel;
  const target = initialQuiz || (destination === 'existing' ? quizzes.find(quiz => quiz.id === targetId) : undefined);
  const targetQuestions = target?.questions || EMPTY_QUESTIONS;
  const preview = useMemo(() => {
    if (!source) return { rows: [], issue: undefined };
    try { return { rows: previewQuestionImport(source, config, targetQuestions), issue: undefined }; }
    catch (error) { return { rows: [], issue: error instanceof QuestionImportError ? error.issue : { key: 'failed' as const } }; }
  }, [source, config, targetQuestions]);
  const rows = preview.rows;
  useEffect(() => { setSelected(new Set(rows.filter(row => row.question && !row.duplicate).map(row => row.index))); setPage(0); }, [rows]);
  useEffect(() => { if (issue) { errorBox.current?.focus(); errorBox.current?.scrollIntoView?.({ block: 'nearest' }); } }, [issue]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input, button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { sequence.current++; document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  const errorIssue = (error: unknown) => setIssue(error instanceof QuestionImportError ? error.issue : { key: 'failed' });
  const configureCsv = (text: string, nextSeparator: string, headings: boolean) => {
    setIssue(undefined); setSeparator(nextSeparator); setHeader(headings);
    try { const next = csvImportSource(text, nextSeparator, headings); setSource(next); setConfig(prev => ({ ...prev, mapping: headings ? suggestQuestionMapping(next.columns) : {} })); }
    catch (error) { setSource(undefined); errorIssue(error); }
  };
  const chooseFile = async (file?: File) => {
    if (!file) return;
    const request = ++sequence.current; setReading(true); setIssue(undefined); setSource(undefined); setFileData(undefined); setStep('file');
    try {
      const text = await readQuestionFile(file);
      if (request !== sequence.current) return;
      setFileData({ text, name: file.name });
      setTitle(previous => previous || file.name.replace(/\.(csv|tsv|json)$/i, ''));
      if (/\.json$/i.test(file.name)) {
        const next = jsonImportSource(text); setSource(next); setConfig(prev => ({ ...prev, mapping: suggestQuestionMapping(next.columns, false) })); setStep(next.kind === 'canonical' ? 'preview' : 'configure');
      } else { const delimiter = /\.tsv$/i.test(file.name) ? '\t' : detectQuestionSeparator(text); configureCsv(text, delimiter, true); setStep('configure'); }
    } catch (error) { if (request === sequence.current) errorIssue(error); }
    finally { if (request === sequence.current) setReading(false); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([questionCsvTemplate(language === 'it' ? 'it' : 'en')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'qurioso-domande.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirm = async () => {
    if (confirmed.current) return;
    confirmed.current = true; setConfirming(true); setIssue(undefined);
    try {
      if (preview.issue) throw new QuestionImportError(preview.issue);
      let quiz = target;
      if (!initialQuiz && destination === 'new') {
        if (!title.trim() || title.length > 500) throw new QuestionImportError({ key: 'titleRequired' });
        quiz = { id: importId('quiz'), title: title.trim(), description: '', category: '', author: '', createdAt: Date.now(), questions: [], settings: { pointsMultiplier: multiplier, showExplanation: explanation, streakBonus: streak },
          ...(video ? { videoConfig: { videoUrl: '', videoTitle: '', videoType: 'html5' as const, pauseMode: 'defined' as const, checkpointMode: 'explicit' as const, checkpoints: [] } } : {}) };
      }
      if (!quiz) throw new QuestionImportError({ key: 'targetRequired' });
      const next = appendImportedQuestions(quiz, rows.filter(row => selected.has(row.index)));
      await onConfirm(next);
    } catch (error) { confirmed.current = false; setConfirming(false); errorIssue(error); }
  };
  const fieldLabel = (field: string) => field.startsWith('option') && field !== 'options' ? t('option', { letter: field.slice(-1) }) : t((field === 'text' ? 'questions' : field) as ImportMessageKey);
  const sourceText = (index: number) => {
    if (!source) return '';
    const record = source.records[index] as Record<string, unknown>;
    const value = source.kind === 'canonical' ? record?.text : source.kind === 'csv' ? record[config.mapping.text] : record[config.mapping.text];
    return typeof value === 'string' ? value.slice(0, 200) : '';
  };
  const activeIssue = issue || (step === 'preview' ? preview.issue : undefined);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  return <div className="fixed inset-0 z-[80] bg-petrolio/40 p-2 sm:p-5 flex items-center justify-center">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="question-import-title" className="question-import-dialog flex flex-col w-full max-w-5xl max-h-[94dvh] rounded-2xl bg-white text-ink shadow-xl border border-line overflow-hidden">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="question-import-title" className="font-black text-lg text-petrolio">{t('title')} · {t(step === 'configure' ? 'configure' : step === 'preview' ? 'preview' : 'chooseFile')}</h2>
        <button type="button" onClick={downloadTemplate} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-petrolio">{t('template')}</button>
      </header>
      <div className="min-h-0 overflow-auto p-4 space-y-4">
        <p className="text-sm text-muted">{t('local')}</p>
        <div><label className="block text-sm font-bold text-petrolio mb-1">{t('chooseFile')}<input aria-label={t('chooseFile')} className={inputClass} type="file" accept=".csv,.tsv,.json,text/csv,application/json,text/tab-separated-values" disabled={confirming} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void chooseFile(file); }} /></label><p className="text-xs text-muted">{t('utf8')}</p></div>
        {reading && <p role="status">{t('loading')}</p>}
        {fileData && <p className="text-sm font-bold break-words">{fileData.name}</p>}
        {activeIssue && <p ref={errorBox} tabIndex={-1} role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{t(activeIssue.key, activeIssue.args)}</p>}
        {fileData && /\.(csv|tsv)$/i.test(fileData.name) && step !== 'preview' && <div className="flex flex-wrap gap-4 items-center">
          <label className="text-sm font-bold">{t('separator')}<select aria-label={t('separator')} className={inputClass} value={separator} onChange={event => configureCsv(fileData.text, event.target.value, header)}>{[',',';','\t'].map((value, i) => <option key={value} value={value}>{t((['comma','semicolon','tab'] as const)[i])}</option>)}</select></label>
          <label className="text-sm"><input type="checkbox" checked={header} onChange={event => configureCsv(fileData.text, separator, event.target.checked)} /> {t('header')}</label>
        </div>}
        {source?.fullQuiz && <p className="rounded-xl bg-amber-50 p-3 text-sm">{t('sourceQuiz')} {t('fullQuizHint')}</p>}
        {source?.kind === 'canonical' && <p className="text-sm text-petrolio">{t('sourceQuestions')}</p>}
        {source && source.kind !== 'canonical' && step !== 'preview' && <>
          <div className="overflow-x-auto border border-line rounded-xl"><table className="w-full text-xs"><caption className="text-left p-2 font-bold">{t('sample')}</caption><thead><tr>{source.columns.slice(0,12).map((column,i) => <th key={i} className="p-2 text-left border-b border-line">{source.kind === 'csv' && !header ? t('column',{n:i+1}) : (column || t('column',{n:i+1})).slice(0,120)}</th>)}</tr></thead><tbody>{source.records.slice(0,5).map((record,i) => <tr key={i}>{source.columns.slice(0,12).map((column,j) => <td key={j} className="p-2 border-b border-line max-w-48 whitespace-pre-wrap break-words">{String(source.kind === 'csv' ? (record as string[])[j] ?? '' : (record as Record<string,unknown>)[column] ?? '').slice(0,200)}</td>)}</tr>)}</tbody></table></div>
          <fieldset><legend className="font-bold text-petrolio mb-2">{t('mapping')}</legend><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{IMPORT_FIELDS.filter(field => field !== 'options' || source.kind === 'flat').map(field => <label key={field} className="text-xs font-bold">{fieldLabel(field)}<select aria-label={fieldLabel(field)} className={inputClass} value={config.mapping[field] ?? ''} onChange={event => setConfig(prev => ({ ...prev, mapping: { ...prev.mapping, [field]: event.target.value } }))}><option value="">{t('ignore')}</option>{source.columns.map((column,i) => <option key={i} value={source.kind === 'csv' ? String(i) : column}>{source.kind === 'csv' ? `${i+1} · ` : ''}{source.kind === 'csv' && !header ? t('column',{n:i+1}) : (column || t('column',{n:i+1})).slice(0,120)}</option>)}</select></label>)}</div></fieldset>
          <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">{t('defaultType')}<select aria-label={t('defaultType')} className={inputClass} value={config.defaultType} onChange={event => setConfig(prev => ({ ...prev, defaultType: event.target.value as Question['type'] }))}><option value="multiple_choice">{t('multiple_choice')}</option><option value="true_false">{t('true_false')}</option></select></label><label className="text-sm">{t('correctMode')}<select aria-label={t('correctMode')} className={inputClass} value={config.correctMode} onChange={event => setConfig(prev => ({ ...prev, correctMode: event.target.value as ImportConfig['correctMode'] }))}>{(['letters','numbers','texts'] as const).map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}</select></label></div>
        </>}
        {source && <p className="text-xs text-muted">{t('defaults')} {t('timestamps')}</p>}
        {!initialQuiz && <details open={step !== 'preview'} className="border border-line rounded-xl p-3"><summary className="font-bold text-petrolio cursor-pointer">{t('destination')} · {destination === 'new' ? title || t('newQuiz') : target?.title || t('existing')}</summary><fieldset className="space-y-3 mt-3"><legend className="sr-only">{t('destination')}</legend>
          <label className="block text-sm"><select aria-label={t('destination')} className={inputClass} value={destination} onChange={event => setDestination(event.target.value)}><option value="new">{t('newQuiz')}</option><option value="existing" disabled={!quizzes.length}>{t('existing')}</option></select></label>
          {destination === 'existing' ? <label className="block text-sm">{t('existing')}<select aria-label={t('existing')} className={inputClass} value={targetId} onChange={event => setTargetId(event.target.value)}>{quizzes.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label> : <>
            <label className="block text-sm">{t('quizTitle')}<input aria-label={t('quizTitle')} className={inputClass} value={title} maxLength={500} onChange={event => setTitle(event.target.value)} /></label>
            <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">{t('quizMode')}<select aria-label={t('quizMode')} className={inputClass} value={video ? 'video' : 'classic'} onChange={event => setVideo(event.target.value === 'video')}><option value="classic">{t('classic')}</option><option value="video">{t('video')}</option></select></label><label className="text-sm">{t('multiplier')}<select aria-label={t('multiplier')} className={inputClass} value={multiplier} onChange={event => setMultiplier(Number(event.target.value))}>{[1,2].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div>
            <label className="inline-flex items-center gap-2 mr-4 text-sm"><input type="checkbox" checked={explanation} onChange={event => setExplanation(event.target.checked)} />{t('showExplanation')}</label><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={streak} onChange={event => setStreak(event.target.checked)} />{t('streak')}</label>{video && <p className="text-xs">{t('unknownDuration')}</p>}
          </>}
        </fieldset></details>}
        {initialQuiz && <p className="font-bold text-sm">{t('destination')}: {initialQuiz.title}</p>}
        {step === 'preview' && source && !preview.issue && <section aria-label={t('selection')} className="space-y-3">
          <p role="status" className="font-bold text-petrolio">{t('totals', {total:rows.length, valid:rows.filter(row=>row.question).length, errors:rows.filter(row=>row.errors.length).length, duplicates:rows.filter(row=>row.duplicate).length})}</p>
          <div className="flex flex-wrap gap-2 text-sm"><button type="button" className="rounded-xl border border-line px-3 py-2" onClick={()=>setSelected(new Set(rows.filter(row=>row.question).map(row=>row.index)))}>{t('selectValid')}</button><button type="button" className="rounded-xl border border-line px-3 py-2" onClick={()=>setSelected(prev=>new Set([...prev].filter(index=>!rows[index].duplicate)))}>{t('excludeDuplicates')}</button><span className="p-2">{t('selected',{count:selected.size})}</span></div>
          {rows.slice(page*25,page*25+25).map(row => <article key={row.index} className="rounded-xl border border-line p-3 text-sm space-y-2">
            <label className="flex items-start gap-2 font-bold"><input type="checkbox" aria-label={`${t(source.kind==='csv'?'row':'item',{n:row.line})}: ${row.question?.text || sourceText(row.index)}`} disabled={!row.question} checked={selected.has(row.index)} onChange={event=>setSelected(prev=>{const next=new Set(prev); if(event.target.checked)next.add(row.index);else next.delete(row.index);return next;})} /><span className="min-w-0 break-words">{t(source.kind==='csv'?'row':'item',{n:row.line})} · {row.question ? t(row.question.type) : ''}: {row.question?.text || sourceText(row.index)}</span></label>
            {row.question && <ol className="list-[upper-alpha] pl-9 space-y-1">{row.question.options.map(option=><li className="break-words whitespace-pre-wrap" key={option.id}>{option.text}{option.isCorrect && <strong> ✓ {t('correct')}</strong>}</li>)}</ol>}
            {row.question?.explanation && <p className="whitespace-pre-wrap break-words">{t('explanation')}: {row.question.explanation}</p>}
            {row.question && <p className="text-xs text-muted">{t('points')}: {row.question.points} · {t('timeLimit')}: {row.question.timeLimit}</p>}
            {row.duplicate ? <p className="text-amber-800">{t(row.duplicate.kind)} · {t('duplicateOf',{where:t(row.duplicate.source==='target'?'targetQuestion':'sourceQuestion',{n:row.duplicate.source==='file'?source.lines[row.duplicate.index]:row.duplicate.index+1})})}</p> : row.question && <p className="text-petrolio">{t('fresh')}</p>}
            {row.errors.map((error,i)=><p role="alert" key={i} className="text-rose-800">{t(source.kind==='csv'?'row':'item',{n:row.line})}: {t(error.key,error.args)}</p>)}
            {row.warnings.map((warning,i)=><p key={i} className="text-amber-800">{t(warning.key,warning.args)}</p>)}
          </article>)}
          <nav aria-label={t('preview')} className="flex items-center justify-between gap-3"><button type="button" className="rounded-xl border border-line p-2" disabled={page===0} onClick={()=>setPage(page-1)}>{t('previous')}</button><span>{t('page',{n:page+1,total:pages})}</span><button type="button" className="rounded-xl border border-line p-2" disabled={page+1>=pages} onClick={()=>setPage(page+1)}>{t('following')}</button></nav>
        </section>}
      </div>
      <footer className="shrink-0 border-t border-line px-4 py-3 flex flex-wrap gap-2 justify-end bg-white">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-bold">{t('cancel')}</button>
        {step==='preview' && source?.kind!=='canonical' && <button type="button" className="rounded-xl border border-line px-4 py-2 text-sm font-bold" onClick={()=>{setStep('configure');setIssue(undefined);}}>{t('back')}</button>}
        {step!=='preview' ? <button type="button" disabled={!source || reading} className="btn-petrolio rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" onClick={()=>{if(preview.issue)setIssue(preview.issue);else{setIssue(undefined);setStep('preview');}}}>{t('next')}</button> : <button type="button" disabled={reading || confirming || !selected.size || Boolean(preview.issue)} className="btn-mandarino rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" onClick={()=>void confirm()}>{t(initialQuiz?'confirmEditor':'confirm')}</button>}
      </footer>
    </div>
  </div>;
}
