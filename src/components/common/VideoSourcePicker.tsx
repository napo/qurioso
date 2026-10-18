import { VideoSearch } from './VideoSearch';
import React, { useEffect, useId, useRef, useState } from 'react';
import { parseVideoUrl, videoFileError, DEMO_VIDEO_URL } from '../../utils/videoSource';
import { storeVideo } from '../../services/quizStorage';
import type { VideoSelection } from '../../services/videoQuiz';

export function VideoSourcePicker({ value, onChange, onBusyChange }: {
  value?: VideoSelection;
  onChange: (selection: VideoSelection) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [url, setUrl] = useState(value?.videoAssetId || value?.videoUrl.startsWith('data:') ? '' : value?.videoUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => setUrl(value?.videoAssetId || value?.videoUrl.startsWith('data:') ? '' : value?.videoUrl || ''), [value?.videoUrl, value?.videoAssetId]);
  return <section aria-label="Sorgente video" className="space-y-3 rounded-2xl border border-line bg-white p-4">
    <VideoSearch disabled={busy} />
    <label htmlFor={`${id}-url`} className="block text-sm font-bold text-petrolio">Incolla il link del video</label>
    <div className="flex gap-2">
      <input id={`${id}-url`} type="url" value={url} disabled={busy} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-xs" />
      <button type="button" disabled={busy} className="btn-petrolio rounded-xl px-3 py-2 text-xs font-bold cursor-pointer" onClick={() => {
        try {
          const source = parseVideoUrl(url.trim());
          setError('');
          onChange({ videoUrl: source.url, videoType: source.provider, videoTitle: `${source.provider === 'html5' ? 'Video' : source.provider === 'youtube' ? 'YouTube' : 'Vimeo'}${source.id ? ` — ${source.id}` : ''}`, videoAssetId: undefined, videoFileName: undefined });
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Link non valido.'); }
      }}>Usa link</button>
    </div>
    <p className="text-xs text-muted">I video YouTube e Vimeo richiedono Internet e devono consentire la riproduzione incorporata.</p>
    <label htmlFor={`${id}-file`} className="block text-sm font-bold text-petrolio">Oppure carica un video dal computer</label>
    <input id={`${id}-file`} type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={busy} aria-label="Carica video dal computer"
      className="max-w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-petrolio file:text-white file:px-3 file:py-2 file:cursor-pointer"
      onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        const invalid = videoFileError(file);
        if (invalid) { setError(invalid); return; }
        setBusy(true); onBusyChange?.(true); setError('');
        try {
          const videoAssetId = await storeVideo(file);
          if (mounted.current) onChange({ videoUrl: '', videoType: 'file', videoTitle: file.name, videoAssetId, videoFileName: file.name });
        } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Caricamento non riuscito.'); }
        finally { if (mounted.current) { setBusy(false); onBusyChange?.(false); } }
      }} />
    <p className="text-xs text-muted">Il file MP4/WebM viene conservato su questo computer e funziona offline. Nell’esportazione JSON viene incluso anche il video.</p>
    {value?.videoTitle && <p className="text-xs font-semibold text-petrolio">Video scelto: {value.videoTitle}</p>}
    {busy && <p role="status" className="text-xs text-petrolio">Salvataggio del video sul computer…</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <button type="button" disabled={busy} onClick={() => onChange({ videoUrl: DEMO_VIDEO_URL, videoTitle: 'Big Buck Bunny — trailer dimostrativo', videoType: 'sample', videoAssetId: undefined, videoFileName: undefined })} className="text-xs underline text-petrolio cursor-pointer">Usa video dimostrativo Big Buck Bunny</button>
  </section>;
}
