import React from 'react';
import type { CloudProviderId } from '../../services/cloudSync/config';

// Drawings from Tabler Icons 3.34.1 (MIT licence, https://github.com/tabler/tabler-icons), inline so that no remote request is made.
// Google Drive is a trademark of Google LLC, Dropbox of Dropbox, Inc., OneDrive of Microsoft Corporation.
const PATHS: Record<CloudProviderId, string[]> = {
  'google-drive': ['M12 10l-6 10l-3 -5l6 -10z', 'M9 15h12l-3 5h-12', 'M15 15l-6 -10h6l6 10z'],
  dropbox: ['M7.5 10.625l-4.5 -2.813l4.5 -2.812l4.5 2.813m-4.5 2.812l4.5 -2.813m-4.5 2.813l-4.5 2.823l4.5 2.802m0 -5.625l4.5 2.823m0 -5.636l4.5 2.791l4.5 -2.812l-4.5 -2.791l-4.5 2.813zm-4.5 8.438l4.5 -2.802m-4.5 2.802v1.123l4.5 2.627l4.5 -2.627v-1.123m-4.5 -2.802l4.5 -2.823l4.5 2.823l-4.5 2.802m-4.5 -2.802l4.5 2.802'],
  onedrive: ['M18.456 10.45a6.45 6.45 0 0 0 -12 -2.151a4.857 4.857 0 0 0 -4.44 5.241a4.856 4.856 0 0 0 5.236 4.444h10.751a3.771 3.771 0 0 0 3.99 -3.54a3.772 3.772 0 0 0 -3.538 -3.992z'],
};

export function CloudServiceIcon({ id, className = 'w-5 h-5 shrink-0' }: { id: CloudProviderId; className?: string }) {
  return <svg data-cloud-icon={id} aria-hidden="true" focusable="false" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {PATHS[id].map(path => <path key={path} d={path} />)}
  </svg>;
}
