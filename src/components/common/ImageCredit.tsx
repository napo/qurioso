import React from 'react';
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
