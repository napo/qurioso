import React, { useEffect, useRef, useState } from 'react';
import type { Quiz } from '../../types/quiz';
import { VideoSurface } from '../video/VideoSurface';
import { useStoredVideoSource } from '../video/useStoredVideoSource';
import { VideoSourcePicker } from '../common/VideoSourcePicker';
import { checkpointProblems, formatVideoTime, parseVideoTime, quizCheckpoints, setQuestionCheckpoint } from '../../services/videoQuiz';
import { resolveVideoSource, videoProvider } from '../../utils/videoSource';
import { formatAssetSize, videoAssetInfo, type VideoAssetInfo } from '../../services/quizStorage';
import { editorTranslations } from '../../i18n/editor';
import { fill } from '../../i18n/format';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  quiz: Quiz; selectedQuestionId?: string; onChange: (quiz: Quiz) => void;
  onSelect: (id: string) => void; onCreateAt: (seconds: number) => void;
  onDuration: (duration: number) => void; onBusy: (busy: boolean) => void; onPending: (pending: boolean) => void;
}

export function VideoTimelineEditor({ quiz, selectedQuestionId, onChange, onSelect, onCreateAt, onDuration, onBusy, onPending }: Props) {
  const { language } = useLanguage(), ed = editorTranslations[language];
  const config = quiz.videoConfig!;
  const media = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(config.videoAssetId ? '' : config.videoUrl ? resolveVideoSource(config.videoUrl) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [hasPosition, setHasPosition] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [capture, setCapture] = useState<number>();
  const [existingId, setExistingId] = useState('');
  const [asset, setAsset] = useState<VideoAssetInfo>();
  const [timeDraft, setTimeDraft] = useState('');
  const [timeError, setTimeError] = useState('');
  const checkpoints = quizCheckpoints(quiz);
  const selected = checkpoints.find(cp => cp.questionId === selectedQuestionId);
  const pendingTime = Boolean(selected && timeDraft !== formatVideoTime(selected.timestamp));
  const problems = checkpointProblems(quiz, duration);
  const unassigned = quiz.questions.filter(q => !checkpoints.some(cp => cp.questionId === q.id));
  const groups = [...new Set(checkpoints.filter(cp => Number.isFinite(cp.timestamp) && cp.timestamp >= 0).map(cp => cp.timestamp))];
  const timelineEnd = Math.max(duration, ...checkpoints.filter(cp => Number.isFinite(cp.timestamp)).map(cp => cp.timestamp), 1);
  useEffect(() => {
    setUrl(config.videoAssetId ? '' : config.videoUrl ? resolveVideoSource(config.videoUrl) : '');
    setError(''); setTime(0); setDuration(0); setPlaying(false); setHasPosition(false); setCapture(undefined); setAsset(undefined); onDuration(0);
    let cancelled = false;
    if (config.videoAssetId) videoAssetInfo(config.videoAssetId).then(info => { if (!cancelled) setAsset(info); }).catch(() => {});
    return () => { cancelled = true; };
  }, [config.videoAssetId, config.videoUrl, onDuration]);
  useStoredVideoSource(config.videoAssetId, setUrl, setError, setBusy);
  useEffect(() => {
    if (!url || duration || error) return;
    const timer = setTimeout(() => setError(ed.durationUnavailable), 20000);
    return () => clearTimeout(timer);
  }, [url, duration, error]);
  useEffect(() => { setTimeDraft(selected ? formatVideoTime(selected.timestamp) : ''); setTimeError(''); onPending(false); }, [selectedQuestionId, selected?.timestamp, onPending]);
  const readPosition = () => {
    if (!media.current) return;
    const current = media.current.currentTime, total = media.current.duration;
    if (Number.isFinite(current) && current >= 0) { setTime(current); setHasPosition(true); }
    if (Number.isFinite(total) && total > 0) { setDuration(total); onDuration(total); setError(''); }
  };
  const seek = (seconds: number) => {
    if (!media.current || !Number.isFinite(seconds) || seconds < 0) return;
    if (duration && seconds > duration) { setTimeError(ed.checkpointBeyond); return; }
    try { media.current.pause(); media.current.currentTime = seconds; setTime(seconds); }
    catch { setError(ed.seekBlocked); }
  };
  const select = (id: string) => { media.current?.pause(); onSelect(id); };
  const attach = (id: string, seconds: number) => { onChange(setQuestionCheckpoint(quiz, id, seconds)); onSelect(id); setCapture(undefined); setTimeError(''); onPending(false); };
  const commitTime = () => {
    if (!selectedQuestionId) return;
    try { attach(selectedQuestionId, parseVideoTime(timeDraft)); }
    catch (cause) { setTimeError(cause instanceof Error ? cause.message : ed.invalidTime); }
  };
  return <section aria-label={ed.timelineEditor} className="video-editor-workspace space-y-3">
    <details className="rounded-xl border border-line bg-white p-2" open={!config.videoUrl && !config.videoAssetId}>
      <summary className="cursor-pointer text-sm font-bold text-petrolio">{fill(ed.sourceSummary, { title: config.videoTitle || ed.chooseAVideo })}</summary>
      <div className="mt-2"><VideoSourcePicker value={config} onBusyChange={onBusy} onChange={selection => onChange({ ...quiz, videoConfig: { ...config, ...selection, missingVideo: undefined } })} /></div>
    </details>
    <div className="editor-video-surface aspect-video rounded-xl overflow-hidden bg-black">
      {url ? <VideoSurface key={url} ref={media} src={url} controls playsInline preload="metadata" className="h-full w-full object-contain"
        onLoadedMetadata={readPosition} onDurationChange={readPosition} onTimeUpdate={readPosition}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setHasPosition(false); setError(ed.videoUnavailable); }} />
        : <p className="p-6 text-center text-white">{ed.chooseVideo}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span aria-live="off">{ed.position} <strong data-testid="editor-video-time">{formatVideoTime(time)}</strong> / {duration ? formatVideoTime(duration) : ed.durationPending}</span>
      <button type="button" disabled={!url || busy} className="btn-petrolio rounded-lg px-3 py-2" onClick={() => {
        if (!media.current) return;
        if (playing) media.current.pause(); else Promise.resolve(media.current.play()).catch(() => setError(ed.playFailed));
      }}>{playing ? ed.pauseVideo : ed.playVideo}</button>
    </div>
    {busy && <p role="status" className="text-sm">{ed.loadingLocal}</p>}
    {asset && <p className="text-xs text-muted">{config.videoFileName || asset.name || ed.localVideo} · {formatAssetSize(asset.size)} · {asset.mime || ed.mimeUnavailable}</p>}
    {error && <div role="alert" className="text-sm text-rose-700">{error} <button type="button" className="underline font-bold" onClick={() => { setError(''); try { media.current?.load?.(); } catch { setError(ed.reopenSource); } }}>{ed.retryLoad}</button></div>}
    {url && videoProvider(url) !== 'html5' && <p className="text-xs text-muted">{ed.providerTiming}</p>}
    {!duration && <p className="text-xs text-muted">{ed.durationUnknown}</p>}
    <button type="button" disabled={!hasPosition || busy || Boolean(error) || pendingTime} className="btn-mandarino w-full rounded-xl px-4 py-2 font-bold disabled:opacity-50" onClick={() => {
      const position = media.current?.currentTime;
      if (!Number.isFinite(position) || position! < 0) { setError(ed.noPosition); return; }
      media.current?.pause(); setCapture(position); setExistingId('');
    }}>{ed.addHere}</button>
    {capture !== undefined && <div className="space-y-2 rounded-xl border-2 border-mandarino p-3" aria-label={ed.addToVideo}>
      <p className="font-bold text-sm">Domanda a {formatVideoTime(capture)}</p>
      <button type="button" className="btn-petrolio rounded-lg px-3 py-2 text-sm" onClick={() => { onCreateAt(capture); setCapture(undefined); }}>{ed.createHere}</button>
      <label className="block text-sm">Oppure seleziona una domanda esistente
        <select aria-label={ed.existingQuestion} value={existingId} onChange={event => setExistingId(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-line p-2">
          <option value="">{ed.chooseQuestion}</option>
          {quiz.questions.map((q, i) => <option key={q.id} value={q.id}>{i + 1}. {q.text || ed.untitledQuestion}{checkpoints.some(cp => cp.questionId === q.id) ? ed.moveExisting : ''}</option>)}
        </select>
      </label>
      <div className="flex gap-2"><button type="button" disabled={!existingId} className="btn-mandarino rounded-lg px-3 py-2 text-sm disabled:opacity-50" onClick={() => attach(existingId, capture)}>{ed.linkHere}</button>
        <button type="button" className="underline text-sm" onClick={() => setCapture(undefined)}>{ed.cancel}</button></div>
    </div>}
    <div aria-label={ed.timeline} className="timeline-markers relative h-12 rounded-xl bg-surface-soft border border-line mx-3">
      {groups.map(timestamp => {
        const group = checkpoints.filter(cp => cp.timestamp === timestamp);
        return <button key={timestamp} type="button" aria-label={fill(ed.checkpointGroup, { time: formatVideoTime(timestamp), count: group.length })} title={group.map(cp => quiz.questions.find(q => q.id === cp.questionId)?.text || ed.untitledQuestion).join(' / ')}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-6 h-8 rounded-lg bg-mandarino border border-accent-ink text-ink font-bold text-xs"
          style={{ left: `${timestamp / timelineEnd * 100}%` }} onClick={() => select(group[0].questionId)}>{group.length > 1 ? group.length : '●'}</button>;
      })}
    </div>
    {selected && <div className="rounded-xl border border-line p-3 space-y-2" aria-label={ed.editCheckpoint}>
      <label className="block text-sm font-bold">{ed.checkpointTimeLabel}
        <input aria-label={ed.checkpointTime} value={timeDraft} onChange={event => { setTimeDraft(event.target.value); onPending(true); setTimeError(ed.applyHint); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitTime(); } }} className="mt-1 w-full rounded-lg border border-line p-2 font-mono" />
      </label>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-petrolio rounded-lg px-3 py-2 text-sm" onClick={commitTime}>{ed.applyTime}</button>
        <button type="button" disabled={!hasPosition || Boolean(duration && selected.timestamp > duration)} className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50" onClick={() => seek(selected.timestamp)}>{ed.goToCheckpoint}</button>
        <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => onChange(setQuestionCheckpoint(quiz, selected.questionId))}>{ed.removeCheckpoint}</button></div>
      {duration > 0 && <label className="block text-sm">Sposta checkpoint · frecce: 0,1 secondi
        <input type="range" aria-label={ed.moveCheckpoint} aria-valuetext={formatVideoTime(selected.timestamp)} min={0} max={duration} step={0.1} value={Math.min(selected.timestamp, duration)} className="w-full accent-petrolio"
          onChange={event => attach(selected.questionId, Number(event.target.value))} />
      </label>}
      <label className="block text-sm">Domanda associata
        <select aria-label={ed.changeQuestion} disabled={pendingTime} value={selected.questionId} className="mt-1 w-full min-w-0 rounded-lg border border-line p-2" onChange={event => {
          if (checkpoints.some(cp => cp.questionId === event.target.value && cp.questionId !== selected.questionId)) { setTimeError(ed.alreadyLinked); return; }
          const detached = setQuestionCheckpoint(quiz, selected.questionId); onChange(setQuestionCheckpoint(detached, event.target.value, selected.timestamp)); onSelect(event.target.value);
        }}>{quiz.questions.map((q, i) => <option key={q.id} value={q.id} disabled={q.id !== selected.questionId && checkpoints.some(cp => cp.questionId === q.id)}>{i + 1}. {q.text || ed.untitledQuestion}</option>)}</select>
      </label>
    </div>}
    {timeError && <p role="alert" className="text-sm text-rose-700">{timeError}</p>}
    {problems.map(problem => <p key={problem} role="alert" className="text-sm text-rose-700">{problem}</p>)}
    {duration > 0 && checkpoints.filter(cp => cp.timestamp > duration).map(cp => <button key={cp.questionId} type="button" className="text-sm underline text-petrolio" onClick={() => attach(cp.questionId, duration)}>Porta “{quiz.questions.find(q => q.id === cp.questionId)?.text || 'Domanda'}” alla fine ({formatVideoTime(duration)})</button>)}
    {config.checkpoints.filter(cp => !quiz.questions.some(q => q.id === cp.questionId)).map((cp, index) => <button key={index} type="button" className="text-sm underline text-rose-700" onClick={() => onChange({ ...quiz, videoConfig: { ...config, checkpoints: config.checkpoints.filter(item => item.questionId !== cp.questionId) } })}>Rimuovi riferimento alla domanda mancante {cp.questionId}</button>)}
    <section aria-label={ed.chronological}>
      <h3 className="text-sm font-bold text-petrolio">Checkpoint ({checkpoints.length}) · ordine cronologico</h3>
      <ol className="timeline-question-list mt-2 space-y-1 overflow-y-auto">
        {checkpoints.map((cp, index) => <li key={`${cp.questionId}-${index}`}><button type="button" aria-pressed={cp.questionId === selectedQuestionId} className="w-full rounded-lg border border-line p-2 text-left text-sm aria-pressed:border-petrolio aria-pressed:bg-surface-soft break-words" onClick={() => select(cp.questionId)}>
          <span className="font-mono font-bold text-petrolio">{formatVideoTime(cp.timestamp)}</span>{' · '}{quiz.questions.find(q => q.id === cp.questionId)?.text || ed.untitledQuestion}
        </button></li>)}
      </ol>
      {!checkpoints.length && <p className="text-sm text-muted">{ed.noLinked}</p>}
    </section>
    <section aria-label={ed.unlinked}><h3 className="text-sm font-bold text-petrolio">Non associate ({unassigned.length})</h3>
      <div className="max-h-36 overflow-y-auto">{unassigned.map(q => <button key={q.id} type="button" onClick={() => select(q.id)} className="block w-full py-2 text-left text-sm underline break-words">{q.text || ed.untitledQuestion}</button>)}</div>
    </section>
  </section>;
}
