import React, { useEffect, useId, useRef, useState } from 'react';
import type { ImageAttribution } from '../../types/quiz';
import { importImage, searchCommons, importCommonsImage, type CommonsImage } from '../../services/images';
import { ImageCredit } from './ImageCredit';

interface ImagePickerProps {
  label: string;
  value?: string;
  attribution?: ImageAttribution;
  onChange: (url: string | undefined, attribution?: ImageAttribution) => void;
}

export function ImagePicker({ label, value, attribution, onChange }: ImagePickerProps) {
  const id = useId();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommonsImage[]>([]);
  const [searched, setSearched] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => setPreviewError(false), [value]);
  useEffect(() => { if (!isSearching) return; return () => triggerRef.current?.focus(); }, [isSearching]);

  const findImages = async () => {
    if (!query.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(''); setResults([]); setSearched(false);
    try {
      const images = await searchCommons(query, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (mounted.current && !controller.signal.aborted) { setResults(images); setSearched(true); }
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Ricerca non disponibile.');
    } finally { if (mounted.current && request.current === controller) setBusy(false); }
  };

  const selectImage = async (image: CommonsImage) => {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    try {
      const embedded = await importCommonsImage(image, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
      if (mounted.current && !controller.signal.aborted) { onChange(embedded, image.attribution); setIsSearching(false); }
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Impossibile inserire l’immagine.');
    } finally { if (mounted.current) setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4 space-y-3" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`${id}-url`} className="text-xs font-bold text-petrolio">{label}</label>
        {value && <button type="button" disabled={busy} onClick={() => { onChange(undefined); setError(''); }} className="text-xs text-rose-700 cursor-pointer">Rimuovi immagine</button>}
      </div>
      <input id={`${id}-url`} type="url" aria-label={`URL ${label}`} placeholder="Incolla l’URL oppure scegli un file qui sotto" value={value?.startsWith('data:') ? '' : value || ''} disabled={busy}
        onChange={event => { onChange(event.target.value || undefined); setError(''); }}
        className="w-full rounded-xl border border-line p-2 text-xs text-ink focus:border-petrolio" />
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-file`} className="text-xs font-semibold text-ink">Dal computer:</label>
        <input id={`${id}-file`} type="file" aria-label={`Carica ${label}`} accept="image/jpeg,image/png,image/webp" disabled={busy}
          className="max-w-full text-xs text-muted file:rounded-lg file:border-0 file:bg-petrolio file:text-white file:px-3 file:py-2 file:mr-2 file:cursor-pointer"
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setBusy(true); setError('');
            try { const data = await importImage(file); if (mounted.current) onChange(data); }
            catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Impossibile leggere l’immagine.'); }
            finally { if (mounted.current) setBusy(false); }
          }} />
        <button ref={triggerRef} type="button" disabled={busy} onClick={() => { setIsSearching(true); setError(''); }} className="rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs font-bold text-petrolio cursor-pointer">Cerca su Commons</button>
      </div>
      <p className="text-[11px] text-muted">JPG, PNG o WebP, massimo 15 MB. Le immagini caricate vengono incluse nel quiz e nell’esportazione JSON.</p>
      {busy && !isSearching && <p role="status" className="text-xs text-petrolio">Preparazione immagine…</p>}
      {error && !isSearching && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {value && <div className="space-y-2">
        {value.startsWith('data:') && <p className="text-[11px] font-semibold text-petrolio">Immagine salvata in locale e inclusa nel quiz</p>}
        {!previewError ? <img src={value} alt={`Anteprima ${label}`} onError={() => setPreviewError(true)} className="h-36 w-full object-contain rounded-xl bg-surface-soft" />
          : <p role="alert" className="text-xs text-rose-700">L’immagine non può essere visualizzata. Controlla il link o scegli un file.</p>}
        <ImageCredit attribution={attribution} />
      </div>}
      {isSearching && <div className="fixed inset-0 z-50 flex items-center justify-center bg-petrolio/15 p-4" onKeyDown={event => {
        if (event.key === 'Escape') { request.current?.abort(); setBusy(false); setIsSearching(false); }
        if (event.key === 'Tab') {
          const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') || [])];
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Cerca immagini su Wikimedia Commons" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-petrolio">Cerca immagini su Wikimedia Commons</h2>
            <button type="button" onClick={() => { request.current?.abort(); setBusy(false); setIsSearching(false); }} className="text-sm font-bold text-petrolio cursor-pointer">Chiudi</button>
          </div>
          <p className="text-xs text-muted">Cerca, controlla autore e licenza, poi scegli un’immagine. Verrà scaricata e inclusa nel quiz per l’uso offline, insieme alla licenza e al testo dell’attribuzione. La ricerca richiede Internet; prova anche parole in inglese.</p>
          <div className="flex gap-2">
            <input type="search" autoFocus aria-label="Cerca immagini" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); findImages(); } }} placeholder="Es. Marte, Colosseo, vulcano" className="min-w-0 flex-1 rounded-xl border border-line p-3 text-sm" />
            <button type="button" disabled={busy || !query.trim()} onClick={findImages} className="btn-petrolio rounded-xl px-4 text-sm font-bold cursor-pointer disabled:opacity-50">Cerca</button>
          </div>
          {busy && <p role="status" className="text-sm text-petrolio">Caricamento…</p>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {searched && !results.length && !busy && <p className="text-sm text-muted">Nessun risultato con crediti disponibili. Prova altre parole.</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.map(result => <div key={result.id} className="rounded-xl border border-line p-2 space-y-2">
              <img src={result.url} alt={result.attribution.title} loading="lazy" className="h-28 w-full object-contain bg-surface-soft rounded-lg" />
              <ImageCredit attribution={result.attribution} />
              <button type="button" disabled={busy} onClick={() => selectImage(result)} className="w-full btn-mandarino rounded-lg py-2 text-xs font-bold cursor-pointer disabled:opacity-50">Usa questa immagine</button>
            </div>)}
          </div>
        </div>
      </div>}
    </section>
  );
}
