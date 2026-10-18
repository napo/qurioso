import {createRoot} from 'react-dom/client';
import React, { lazy, Suspense } from 'react';
const App = lazy(() => import('./App.tsx'));
const LandingPage = lazy(() => import('./components/site/LandingPage.tsx').then(module => ({ default: module.LandingPage })));
const params = new URLSearchParams(window.location.search);
const appMode = params.get('app');
const showApp = appMode === 'classroom' || appMode === 'network' || params.has('pin') || params.get('role') === 'player';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import './index.css';

function Loading() {
  const { language } = useLanguage();
  return <p role="status" className="p-8 text-petrolio">{{ it: 'Caricamento di Qurioso…', en: 'Loading Qurioso…', de: 'Qurioso wird geladen…' }[language]}</p>;
}

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Suspense fallback={<Loading />}>
      {showApp ? <App classroomOnly={appMode === 'classroom'} /> : <LandingPage />}
    </Suspense>
  </LanguageProvider>
);
