import {createRoot} from 'react-dom/client';
import React, { lazy, Suspense } from 'react';
const App = lazy(() => import('./App.tsx'));
const LandingPage = lazy(() => import('./components/site/LandingPage.tsx').then(module => ({ default: module.LandingPage })));
const TutorialGuide = lazy(() => import('./components/guide/TutorialGuide.tsx').then(module => ({ default: module.TutorialGuide })));
const params = new URLSearchParams(window.location.search);
const appMode = params.get('app');
const showApp = Boolean(window.quriosoDesktop) || appMode === 'classroom' || appMode === 'network' || params.has('pin') || params.get('role') === 'player';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import './index.css';

function Loading() {
  const { language } = useLanguage();
  return <p role="status" className="p-8 text-petrolio">{{ it: 'Caricamento di Qurioso…', en: 'Loading Qurioso…', de: 'Qurioso wird geladen…' }[language]}</p>;
}

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Suspense fallback={<Loading />}>
      {appMode === 'guide' ? <TutorialGuide /> : showApp ? <App classroomOnly={appMode === 'classroom'} /> : <LandingPage />}
    </Suspense>
  </LanguageProvider>
);
