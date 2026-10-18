import {createRoot} from 'react-dom/client';
import React, { lazy, Suspense } from 'react';
const App = lazy(() => import('./App.tsx'));
const LandingPage = lazy(() => import('./components/site/LandingPage.tsx').then(module => ({ default: module.LandingPage })));
const params = new URLSearchParams(window.location.search);
const appMode = params.get('app');
const showApp = appMode === 'classroom' || appMode === 'network' || params.has('pin') || params.get('role') === 'player';
import { LanguageProvider } from './context/LanguageContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Suspense fallback={<p role="status" className="p-8 text-petrolio">Caricamento di Qurioso…</p>}>
      {showApp ? <App classroomOnly={appMode === 'classroom'} /> : <LandingPage />}
    </Suspense>
  </LanguageProvider>
);
