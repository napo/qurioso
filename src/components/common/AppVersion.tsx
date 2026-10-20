import React from 'react';
import { version } from '../../../package.json';

// Release builds verify that their GitHub tag is exactly v<package.json version>.
export function AppVersion() {
  return <span data-testid="app-version" className="text-[11px] font-bold text-muted whitespace-nowrap" aria-label={`Qurioso v${version}`}>v{version}</span>;
}
