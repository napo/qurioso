import React from 'react';
import type { ImageAttribution } from '../../types/quiz';
import { safeHttpUrl } from '../../services/images';

export function ImageCredit({ attribution }: { attribution?: ImageAttribution }) {
  if (!attribution) return null;
  return (
    <p className="text-[11px] text-muted leading-relaxed break-words">
      <a href={safeHttpUrl(attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.title}</a>
      {' — '}{attribution.creator}{' — '}
      <a href={safeHttpUrl(attribution.licenseUrl || attribution.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">{attribution.license}</a>
    </p>
  );
}
