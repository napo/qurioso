import React, { useState } from 'react';
import { Layers } from 'lucide-react';

export function ImagePlaceholder({ className = '', label }: { className?: string; label?: string }) {
  return (
    <div role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={`flex items-center justify-center bg-gradient-to-tr from-surface-soft to-surface-soft text-petrolio ${className}`}>
      <Layers className="w-12 h-12" />
    </div>
  );
}

/** Shows the placeholder instead of a broken image, so alt text never covers the layout (offline, filtered networks). */
export function FallbackImage({ src, alt, className, placeholderClassName }: { src: string; alt: string; className?: string; placeholderClassName?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (failedSrc === src) return <ImagePlaceholder className={placeholderClassName} label={alt} />;
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
