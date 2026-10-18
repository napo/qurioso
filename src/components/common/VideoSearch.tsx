import React, { useId, useState } from 'react';

export function VideoSearch({ disabled = false }: { disabled?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const terms = query.trim();
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-bold text-petrolio">Cerca un video</label>
    <input id={id} type="search" value={query} disabled={disabled} maxLength={200}
      onChange={event => setQuery(event.target.value)} placeholder="Es. sistema solare, vulcani…"
      className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
    <div className="flex flex-wrap gap-2">
      {!disabled && <>
        <a href={terms ? `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}` : 'https://www.youtube.com/'} target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm font-bold text-petrolio">Cerca su YouTube ↗</a>
        <a href={terms ? `https://vimeo.com/search?q=${encodeURIComponent(terms)}` : 'https://vimeo.com/'} target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm font-bold text-petrolio">Cerca su Vimeo ↗</a>
      </>}
    </div>
    <p className="text-xs text-muted">La ricerca si apre in una nuova scheda. Copia il link del video scelto, torna qui e incollalo nel campo sotto. Non devi collegare account a Qurioso.</p>
  </div>;
}
