import { VideoSearch } from './VideoSearch';
import React, { useEffect, useId, useRef, useState } from 'react';
import { parseVideoUrl, videoFileError, DEMO_VIDEO_URL } from '../../utils/videoSource';
import { storeVideo } from '../../services/quizStorage';
import type { VideoSelection } from '../../services/videoQuiz';
import { editorTranslations } from '../../i18n/editor';
import { fill } from '../../i18n/format';
import { useLanguage } from '../../context/LanguageContext';

export function VideoSourcePicker({ value, onChange, onBusyChange }: {
  value?: VideoSelection;
  onChange: (selection: VideoSelection) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { language } = useLanguage(), ed = editorTranslations[language];
  const id = useId();
  const [url, setUrl] = useState(value?.videoAssetId || value?.videoUrl.startsWith('data:') ? '' : value?.videoUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => setUrl(value?.videoAssetId || value?.videoUrl.startsWith('data:') ? '' : value?.videoUrl || ''), [value?.videoUrl, value?.videoAssetId]);
  return <section aria-label={ed.videoSource} className="space-y-3 rounded-2xl border border-line bg-white p-4">
    <VideoSearch disabled={busy} />
    <label htmlFor={`${id}-url`} className="block text-sm font-bold text-petrolio">{ed.pasteLink}</label>
    <div className="flex gap-2">
      <input id={`${id}-url`} type="url" value={url} disabled={busy} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-xs" />
      <button type="button" disabled={busy} className="btn-petrolio rounded-xl px-3 py-2 text-xs font-bold cursor-pointer" onClick={() => {
        try {
          const source = parseVideoUrl(url.trim());
          setError('');
          onChange({ videoUrl: source.url, videoType: source.provider, videoTitle: `${source.provider === 'html5' ? 'Video' : source.provider === 'youtube' ? 'YouTube' : 'Vimeo'}${source.id ? ` — ${source.id}` : ''}`, videoAssetId: undefined, videoFileName: undefined });
        } catch (cause) { setError(cause instanceof Error ? cause.message : ed.invalidLink); }
      }}>{ed.useLink}</button>
    </div>
    <p className="text-xs text-muted">{ed.onlineNote}</p>
    <label htmlFor={`${id}-file`} className="block text-sm font-bold text-petrolio">{ed.orUpload}</label>
    <input id={`${id}-file`} type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={busy} aria-label={ed.uploadVideo}
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
        } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : ed.uploadFailed); }
        finally { if (mounted.current) { setBusy(false); onBusyChange?.(false); } }
      }} />
    <p className="text-xs text-muted">{ed.fileNote}</p>
    {value?.videoTitle && <p className="text-xs font-semibold text-petrolio">{fill(ed.chosenVideo, { title: value.videoTitle })}</p>}
    {busy && <p role="status" className="text-xs text-petrolio">{ed.savingVideo}</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <button type="button" disabled={busy} onClick={() => onChange({ videoUrl: DEMO_VIDEO_URL, videoTitle: ed.demoTitle, videoType: 'sample', videoAssetId: undefined, videoFileName: undefined })} className="text-xs underline text-petrolio cursor-pointer">{ed.demoVideo}</button>
  </section>;
}
