import React, { lazy } from 'react';
import { PlayerScreen } from './components/player/PlayerScreen';
import { isPublicWebsite } from './services/appEnvironment';

// The website explains that a PIN belongs to the teacher's server; that page lives in the full app.
const App = lazy(() => import('./App.tsx'));

/** Participants load only the join and game screens, not the library, editor or presenter. */
export default function ParticipantApp() {
  if (isPublicWebsite()) return <App />;
  const pin = new URLSearchParams(window.location.search).get('pin') ?? '';
  // Without parameters the server opens the PIN form on another device, and the landing page on the teacher computer.
  return <div className="h-screen w-screen bg-white flex flex-col">
    <PlayerScreen initialPin={pin} onExit={() => window.location.assign(window.location.pathname)} />
  </div>;
}
