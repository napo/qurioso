import React, { useId, useState } from 'react';
import { editorTranslations } from '../../i18n/editor';
import { useLanguage } from '../../context/LanguageContext';

export function VideoSearch({ disabled = false }: { disabled?: boolean }) {
  const { language } = useLanguage(), ed = editorTranslations[language];
  const id = useId();
  const [query, setQuery] = useState('');
  const terms = query.trim();
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-bold text-petrolio">{ed.searchVideo}</label>
    <input id={id} type="search" value={query} disabled={disabled} maxLength={200}
      onChange={event => setQuery(event.target.value)} placeholder={ed.searchVideoPlaceholder}
      className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
    <div className="flex flex-wrap gap-2">
      {!disabled && <>
        <a href={terms ? `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}` : 'https://www.youtube.com/'} target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm font-bold text-petrolio">{ed.onYouTube}</a>
        <a href={terms ? `https://vimeo.com/search?q=${encodeURIComponent(terms)}` : 'https://vimeo.com/'} target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm font-bold text-petrolio">{ed.onVimeo}</a>
      </>}
    </div>
    <p className="text-xs text-muted">{ed.searchNote}</p>
  </div>;
}
