import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { sharingLinks, sharingTranslations } from '../../i18n/internetSharing';
import type { InternetSharingState } from '../../types/desktop';
import { copyText } from '../../utils/clipboard';

export function InternetSharingPanel({ state, onStart, onStop, onClose }: {
  state: InternetSharingState; onStart: () => void; onStop: () => void; onClose: () => void;
}) {
  const { language } = useLanguage(), t = sharingTranslations[language];
  const dialog = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus(); return () => previous?.focus();
  }, []);
  const busy = ['downloading', 'connecting', 'reconnecting', 'stopping'].includes(state.phase);
  const error = state.error && (t.errors[state.error as keyof typeof t.errors] || t.errors.local);
  const detail = `Cloudflare cloudflared ${state.version || '—'}\nState: ${state.phase}\nCode: ${state.error || '—'}\n${state.detail || ''}`;
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onKeyDown={event => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const items = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary')].filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && [first, dialog.current].includes(document.activeElement as HTMLElement)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="internet-sharing-title" className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-line bg-white p-5 space-y-4 text-ink">
      <header className="flex items-start justify-between gap-3"><div><h2 id="internet-sharing-title" className="text-xl font-black text-petrolio">{t.title}</h2><p className="text-sm font-bold text-accent-ink">{t.experimental}</p></div><button type="button" onClick={onClose} className="rounded-lg border border-line p-2">{t.close}</button></header>
      <div className={`rounded-xl border-2 p-3 space-y-2 ${state.phase === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : ['error', 'reconnecting'].includes(state.phase) ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-line bg-surface-soft'}`} role="status" aria-live="polite">
        <p>{t.local}: <strong>{t.localActive}</strong></p>
        <p className="font-bold">{t[state.phase]}{state.phase === 'downloading' && state.progress !== undefined ? ` · ${state.progress}%` : ''}</p>
        {state.phase === 'downloading' && <progress aria-label={t.downloading} value={state.progress || 0} max={100} className="w-full" />}
        {state.phase === 'active' && state.url && <><p className="font-bold">{t.qrUpdated}</p><p className="font-mono break-all select-text">{state.url}</p></>}
      </div>
      {['error', 'reconnecting'].includes(state.phase) && <p role="alert" className="text-rose-800">{state.phase === 'reconnecting' ? t.reconnectHelp : error}</p>}
      <div className="flex flex-wrap gap-3">
        {state.phase !== 'active' && <button type="button" disabled={busy} onClick={onStart} className="btn-petrolio px-4 py-3 rounded-xl font-bold disabled:opacity-50">{state.phase === 'error' ? t.retry : t.start}</button>}
        {(busy || state.phase === 'active') && <button type="button" disabled={state.phase === 'stopping'} onClick={onStop} className="rounded-xl border border-line px-4 py-3 font-bold disabled:opacity-50">{t.stop}</button>}
      </div>
      <p>{t.intro}</p><p className="text-sm">{t.disclosure}</p><p className="text-sm">{t.traffic}</p><p className="text-sm text-muted">{t.limits}</p>
      <nav aria-label="Cloudflare" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-petrolio">
        {Object.entries(sharingLinks).map(([key, url]) => <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline">{t[key as keyof typeof sharingLinks]}</a>)}
      </nav>
      {['error', 'reconnecting'].includes(state.phase) && <details className="text-sm"><summary className="cursor-pointer font-bold">{t.details}</summary><pre className="my-2 whitespace-pre-wrap select-text">{detail}</pre><button type="button" onClick={async () => setCopied(await copyText(detail) ? t.copied : t.copyFailed)} className="underline">{t.copy}</button>{copied && <p role="status">{copied}</p>}</details>}
    </div>
  </div>;
}
