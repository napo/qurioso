import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import type { Language } from '../../i18n/translations';
import { gameExperienceTranslations } from '../../i18n/gameExperience';
import type { GameSession, Quiz } from '../../types/quiz';
import { nextCheckpoint, quizCheckpoints, type VideoSelection } from '../../services/videoQuiz';
import { resolveVideoSource } from '../../utils/videoSource';
import { VideoSurface } from './VideoSurface';
import { useStoredVideoSource } from './useStoredVideoSource';
import { VideoSourcePicker } from '../common/VideoSourcePicker';

export interface HostVideoControls { resume: () => Promise<void>; pause: () => void }
interface Props {
  quiz: Quiz;
  language?: Language;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  status: GameSession['status'];
  openedQuestions: number;
  initialPlayback?: GameSession['videoState'];
  onSourceChange?: (selection: VideoSelection) => Promise<void>;
  onCheckpoint: (index: number, currentTime: number, ended: boolean) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  onReady: (ready: boolean) => void;
  onPlayback: (currentTime: number, playing: boolean, ended?: boolean, force?: boolean) => void;
}

/** Playback only: all question opening, timing, answers and scoring stay in the LAN session. */
export const HostVideoPlayer = forwardRef<HostVideoControls, Props>(function HostVideoPlayer(
  { quiz, status, openedQuestions, initialPlayback, onSourceChange, onCheckpoint, onFinish, onReady, onPlayback, language = 'it', onToggleFullscreen, isFullscreen = false }, ref) {
  const t = gameExperienceTranslations[language];
  const media = useRef<HTMLVideoElement>(null);
  const [selection, setSelection] = useState<VideoSelection | undefined>(quiz.videoConfig);
  const [url, setUrl] = useState(quiz.videoConfig?.videoAssetId ? '' : resolveVideoSource(quiz.videoConfig?.videoUrl));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(initialPlayback?.currentTime || 0);
  const [playing, setPlaying] = useState(false);
  const [changingSource, setChangingSource] = useState(false);
  const checkpoints = useRef(quizCheckpoints(quiz));
  const completed = useRef(new Set<number>());
  const opening = useRef(false);
  const resumeRequested = useRef(false);
  const ended = useRef(initialPlayback?.ended || false);
  const awaitingResume = useRef(Boolean(initialPlayback));
  const restorePosition = useRef(initialPlayback?.currentTime);
  const latest = useRef({ status, onCheckpoint, onFinish, onPlayback });
  latest.current = { status, onCheckpoint, onFinish, onPlayback };
  useEffect(() => {
    completed.current = new Set(Array.from({ length: openedQuestions }, (_, index) => index));
  }, [openedQuestions]);
  useStoredVideoSource(selection?.videoAssetId, setUrl, setError, setBusy);
  useEffect(() => { onReady(Boolean(url && duration > 0 && !busy && !error)); }, [url, duration, busy, error, onReady]);
  useEffect(() => {
    if (status !== 'video') { media.current?.pause(); setPlaying(false); }
    if (status === 'lobby') { setTime(0); restorePosition.current = undefined; completed.current.clear(); ended.current = false; if (media.current) media.current.currentTime = 0; }
  }, [status]);
  useEffect(() => {
    if (!url || duration > 0) return;
    const timer = setTimeout(() => setError('loadError'), 20000);
    return () => clearTimeout(timer);
  }, [url, duration]);
  const pause = () => { media.current?.pause(); setPlaying(false); };
  const processPosition = async (): Promise<boolean> => {
    const player = media.current;
    if (!player || latest.current.status !== 'video' || opening.current) return true;
    const index = ended.current
      ? checkpoints.current.findIndex((_, index) => !completed.current.has(index))
      : nextCheckpoint(checkpoints.current, completed.current, player.currentTime);
    if (index < 0 && !ended.current) return false;
    opening.current = true; // Lock before pause/timeupdate can dispatch another event.
    pause();
    setError('');
    try {
      const accepted = index >= 0 ? await latest.current.onCheckpoint(index, player.currentTime, ended.current) : await latest.current.onFinish();
      if (accepted && index >= 0) completed.current.add(index);
      if (!accepted) setError('syncError');
    } finally { opening.current = false; }
    return true;
  };
  const resume = async () => {
    resumeRequested.current = true;
    if (latest.current.status !== 'video') return;
    resumeRequested.current = false;
    awaitingResume.current = false;
    if (await processPosition()) return;
    try { await media.current?.play(); }
    catch { setError('playError'); }
  };
  useImperativeHandle(ref, () => ({ resume, pause }));
  useEffect(() => { if (status === 'video' && resumeRequested.current) void resume(); }, [status]);
  const update = () => {
    if (!media.current) return;
    setTime(media.current.currentTime);
    if (awaitingResume.current) return;
    latest.current.onPlayback(media.current.currentTime, playing, ended.current);
    if (latest.current.status === 'video') void processPosition();
    else pause();
  };
  const metadata = () => {
    const value = media.current?.duration;
    if (value && Number.isFinite(value)) {
      setDuration(value); setError('');
      if (restorePosition.current !== undefined && media.current) {
        media.current.currentTime = Math.min(restorePosition.current, value);
        setTime(media.current.currentTime); media.current.pause(); restorePosition.current = undefined;
      }
    }
  };
  return <section className="w-full max-w-5xl mb-6 rounded-2xl border border-line bg-white p-4" aria-label={t.presenterVideo}>
    <div className="presenter-video-heading flex flex-wrap items-center justify-between gap-2 mb-3">
      <span className="font-bold text-petrolio">{t.videoHeading}</span>
      <span role="status" className="text-sm text-muted">{status === 'video' ? (playing ? t.playing : t.paused) : status === 'lobby' ? t.setup : t.checkpointPaused}</span>
    </div>
    <div className={`aspect-video bg-black rounded-xl overflow-hidden ${status !== 'video' && status !== 'lobby' ? 'max-h-56' : ''}`}>
      {url && <VideoSurface key={url} ref={media} src={url} controls={false} playsInline preload="metadata" className="w-full h-full"
        onLoadedMetadata={metadata} onDurationChange={metadata} onTimeUpdate={update}
        onPlay={() => {
          if (latest.current.status !== 'video' || opening.current || awaitingResume.current) { pause(); return; }
          ended.current = false; setPlaying(true); latest.current.onPlayback(media.current?.currentTime || 0, true, false, true);
        }}
        onPause={() => { setPlaying(false); latest.current.onPlayback(media.current?.currentTime || 0, false, ended.current, true); }}
        onEnded={() => { ended.current = true; setPlaying(false); latest.current.onPlayback(media.current?.currentTime || 0, false, true, true); if (!awaitingResume.current) void processPosition(); }}
        onError={() => { pause(); setError('mediaError'); }} />}
    </div>
    <div className="presenter-video-controls flex flex-wrap items-center gap-3 mt-3">
      <button aria-label={playing ? t.pause : t.play} disabled={status !== 'video' || busy || !duration}
        className="btn-mandarino rounded-xl p-3 disabled:opacity-50" onClick={() => playing ? pause() : void resume()}>
        {playing ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <input type="range" aria-label={t.positionVideo} min={0} max={duration || 1} step="0.1" value={Math.min(time, duration)}
        disabled={status !== 'video' || !duration} className="flex-1 accent-petrolio" onChange={event => {
          if (!media.current || opening.current) return;
          const target = Number(event.target.value);
          ended.current = target >= duration; awaitingResume.current = false; media.current.currentTime = target; setTime(target); latest.current.onPlayback(target, false, ended.current, true); void processPosition();
        }} />
      <span className="text-sm text-muted">{Math.floor(time)} / {Math.floor(duration)} s</span>
      {onToggleFullscreen && <button type="button" aria-label={isFullscreen ? t.exitFull : t.full} title={isFullscreen ? t.esc : t.full} onClick={onToggleFullscreen} className="rounded-xl border border-line p-3 text-petrolio">{isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
      {isFullscreen && <span className="text-xs text-muted">{t.esc}</span>}
    </div>
    {status === 'lobby' && <p className="text-sm text-muted mt-2">{checkpoints.current.length} {t.checkpointHint}</p>}
    {busy && <p role="status">{t.loading}</p>}
    {error && <div role="alert" className="text-rose-700 mt-3">{t[error as keyof typeof t] || error} <button className="font-bold underline" onClick={() => {
      setError(''); if (duration && latest.current.status === 'video') void resume(); else media.current?.load?.();
    }}>{t.retry}</button></div>}
    {(status === 'lobby' || error || changingSource) && <button className="text-sm text-petrolio underline mt-3" onClick={() => setChangingSource(!changingSource)}>{t.changeVideo}</button>}
    {changingSource && <VideoSourcePicker value={selection} onBusyChange={setBusy} onChange={value => {
      // Changing the source never resets checkpoint history or the LAN session.
      pause(); ended.current = false; restorePosition.current = undefined; void onSourceChange?.(value); setSelection(value); setUrl(value.videoAssetId ? '' : resolveVideoSource(value.videoUrl)); setDuration(0); setTime(0); setError(''); setChangingSource(false);
    }} />}
  </section>;
});
