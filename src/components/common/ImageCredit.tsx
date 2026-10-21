import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { ImageAttribution } from '../../types/quiz';
import { safeHttpUrl } from '../../services/images';
import { useLanguage } from '../../context/LanguageContext';
import { workspaceTranslations } from '../../i18n/workspace';

export function ImageCredit({ attribution }: { attribution?: ImageAttribution }) {
  const { language } = useLanguage(), w = workspaceTranslations[language];
  if (!attribution) return null;
  return (
    <p className="text-[11px] text-muted leading-relaxed break-words">
      {w.creditSource}: <a href={safeHttpUrl(attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.title}</a>
      {' — '}{attribution.creator}{` · ${w.creditLicense}: `}
      <a href={safeHttpUrl(attribution.licenseUrl || attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.license}</a>
      {attribution.attributionText && <span className="block">{attribution.attributionText}</span>}
      {attribution.credit && attribution.credit !== attribution.attributionText && attribution.credit !== attribution.creator && <span className="block">{w.creditCredit}: {attribution.credit}</span>}
    </p>
  );
}

/** Compact ⓘ disclosure for cards; the popover opens above the nearest positioned ancestor and closes on Escape or an outside click. */
export function ImageCreditDetails({ attribution, label }: { attribution?: ImageAttribution; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (root.current && !root.current.contains(event.target as Node)) root.current.open = false; };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (!attribution) return null;
  return (
    // The element's own open state is authoritative; React state only tracks it to listen for outside clicks.
    <details ref={root} data-image-credits
      onToggle={event => setOpen(event.currentTarget.open)}
      onKeyDown={event => { if (event.key === 'Escape' && root.current?.open) { event.stopPropagation(); root.current.open = false; root.current.querySelector('summary')?.focus(); } }}>
      <summary aria-label={label} title={label} className="list-none [&::-webkit-details-marker]:hidden p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-ink cursor-pointer"><Info className="w-3.5 h-3.5" /></summary>
      <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-xl border border-line bg-white p-3 shadow-lg text-left"><ImageCredit attribution={attribution} /></div>
    </details>
  );
}
