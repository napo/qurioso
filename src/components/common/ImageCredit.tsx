import React from 'react';
import { Info } from 'lucide-react';
import type { ImageAttribution } from '../../types/quiz';
import { safeHttpUrl } from '../../services/images';

export function ImageCredit({ attribution }: { attribution?: ImageAttribution }) {
  if (!attribution) return null;
  return (
    <p className="text-[11px] text-muted leading-relaxed break-words">
      Attribuzione: <a href={safeHttpUrl(attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.title}</a>
      {' — '}{attribution.creator}{' · Licenza: '}
      <a href={safeHttpUrl(attribution.licenseUrl || attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.license}</a>
      {attribution.attributionText && <span className="block">{attribution.attributionText}</span>}
      {attribution.credit && attribution.credit !== attribution.attributionText && attribution.credit !== attribution.creator && <span className="block">Crediti: {attribution.credit}</span>}
    </p>
  );
}

/** Compact ⓘ disclosure for cards; the popover opens above the nearest positioned ancestor. */
export function ImageCreditDetails({ attribution, label }: { attribution?: ImageAttribution; label: string }) {
  if (!attribution) return null;
  return (
    <details data-image-credits>
      <summary aria-label={label} title={label} className="list-none [&::-webkit-details-marker]:hidden p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-ink cursor-pointer"><Info className="w-3.5 h-3.5" /></summary>
      <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-xl border border-line bg-white p-3 shadow-lg text-left"><ImageCredit attribution={attribution} /></div>
    </details>
  );
}
