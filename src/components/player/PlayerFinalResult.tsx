import React, { useEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { gameExperienceTranslations } from '../../i18n/gameExperience';
import { resultImage, type FinalResult } from '../../services/finalResult';

export function PlayerFinalResult({ result, onClose }: { result: FinalResult; onClose: () => void }) {
  const { language } = useLanguage(), t = gameExperienceTranslations[language];
  const [image, setImage] = useState<{ url: string; file: File }>();
  const [imageFailed, setImageFailed] = useState(false), [notice, setNotice] = useState<'shareError' | 'downloaded' | 'closeHelp'>(), [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const downloadOnly = useRef(false);
  const player = result.players.find(p => p.id === result.playerId)!, rank = result.players.findIndex(p => p.id === result.playerId) + 1;
  useEffect(() => {
    let alive = true, url = '';
    setImage(undefined); setImageFailed(false);
    void resultImage(result, language).then(blob => {
      if (!alive) return;
      url = URL.createObjectURL(blob); setImage({ url, file: new File([blob], 'qurioso-result.png', { type: 'image/png' }) });
    }).catch(() => { if (alive) setImageFailed(true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [result, language, attempt]);
  const share = async () => {
    if (!image || sharing) return;
    setNotice(undefined); setSharing(true);
    try {
      if (!downloadOnly.current && navigator.share && navigator.canShare?.({ files: [image.file] })) {
        // The image is prepared before the click, preserving the browser's user activation.
        await navigator.share({ files: [image.file], title: result.title });
      } else {
        const a = document.createElement('a'); a.href = image.url; a.download = image.file.name; document.body.append(a); a.click(); a.remove(); setNotice('downloaded');
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) { downloadOnly.current = true; setNotice('shareError'); }
    } finally { setSharing(false); }
  };
  const close = () => {
    onClose();
    window.close();
    setNotice('closeHelp');
  };
  const summary = `${result.title} · ${player.nickname} · ${t.score}: ${player.score} · ${t.position} ${rank} ${t.of} ${result.players.length}`;
  return <main data-player-final className="min-h-screen bg-qurioso-canvas text-ink p-3 sm:p-6 space-y-4 w-full mx-auto">
    <h1 className="text-2xl font-black text-petrolio text-center">{t.finished}</h1>
    <section aria-label={t.score} className="rounded-2xl border border-line bg-white overflow-hidden">
      {image ? <img src={image.url} alt={summary} className="w-full mx-auto" /> : <div className="p-6 text-center space-y-3"><h2 className="font-bold [overflow-wrap:anywhere]">{result.title}</h2><p className="[overflow-wrap:anywhere]">{player.avatar} {player.nickname}</p><p className="text-3xl font-black">{player.score} {t.points}</p><p>{t.position} {rank} {t.of} {result.players.length}</p></div>}
    </section>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button type="button" disabled={(!image && !imageFailed) || sharing} onClick={() => imageFailed ? setAttempt(value => value + 1) : void share()} className="btn-mandarino rounded-xl p-4 font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Share2 size={20} />{imageFailed ? t.retry : t.share}</button>
      <button type="button" onClick={close} className="rounded-xl p-4 font-bold border border-line bg-white flex items-center justify-center gap-2"><X size={20} />{t.close}</button>
    </div>
    {(!image || notice) && <p role="status" className="text-sm text-petrolio">{notice ? t[notice] : imageFailed ? t.imageError : t.preparing}</p>}
    <p className="text-sm text-muted">{t.shareHint}</p>
    <section aria-label={t.ranking} className={image ? "sr-only" : "rounded-2xl border border-line bg-white p-4"}><h2 className="text-xl font-black text-petrolio mb-3">{t.ranking}</h2><ol className="space-y-2">{result.players.map((p, index) => <li key={p.id} aria-current={p.id === result.playerId ? 'true' : undefined} className={`flex items-start gap-3 p-3 rounded-xl ${p.id === result.playerId ? 'bg-mandarino/20 font-bold' : 'bg-surface-soft'}`}><span className="shrink-0">#{index + 1}</span><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.avatar} {p.nickname}</span><span className="shrink-0">{new Intl.NumberFormat(language).format(p.score)}</span></li>)}</ol></section>
  </main>;
}
