import React from 'react';

export const AUTHOR_URL = 'https://github.com/napo';

export function AuthorLink({ className = 'underline' }: { className?: string }) {
  return <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" className={className}>Maurizio Napolitano</a>;
}
