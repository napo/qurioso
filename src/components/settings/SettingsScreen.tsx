import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { settingsTranslations } from '../../i18n/settings';
import { guideNavigation } from '../../i18n/guideNavigation';
import { LibraryData } from '../data/LibraryData';
import { AppVersion } from '../common/AppVersion';
import { sounds } from '../../services/soundEffects';
import type { Quiz } from '../../types/quiz';

export function SettingsScreen({ quizzes, onRestored, onEditor, onQuestions, onCreate, onCreateVideo, onBack, onGuide, environment, focus }: {
  quizzes: Quiz[]; onRestored: (quizzes: Quiz[]) => void; onEditor: (quiz: Quiz) => void; onQuestions: () => void;
  onCreate: () => void; onCreateVideo: () => void; onBack: () => void; onGuide: () => void;
  environment: string; focus?: 'backup' | 'about';
}) {
  const { language, t } = useLanguage(), labels = settingsTranslations[language];
  const [muted, setMuted] = useState(sounds.getMuted());
  const backup = useRef<HTMLDivElement>(null), about = useRef<HTMLHeadingElement>(null);
  // Native menu commands open Settings on a specific section.
  useEffect(() => {
    const target = focus === 'backup' ? backup.current?.querySelector<HTMLElement>('h2') : focus === 'about' ? about.current : undefined;
    if (!target) return;
    target.tabIndex = -1; target.focus(); target.scrollIntoView?.({ block: 'start' });
  }, [focus]);
  return <div data-qurioso-settings className="min-h-screen bg-qurioso-canvas text-ink p-4 md:p-8"><main className="max-w-5xl mx-auto space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-black text-petrolio">{labels.settings}</h1><LanguageSelector /><button type="button" onClick={onBack} className="rounded-xl border border-line bg-white px-4 py-3 font-bold">{labels.backToQuizzes}</button></header>
    <p className="rounded-xl border border-line bg-white p-4">{environment}</p>
    <div ref={backup}><LibraryData quizzes={quizzes} onRestored={onRestored} onEditor={onEditor} onQuestions={onQuestions} /></div>
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3"><h2 className="text-xl font-black text-petrolio">{labels.createQuiz}</h2><p>{labels.createHint}</p><div className="flex flex-wrap gap-3"><button type="button" className="btn-mandarino rounded-xl px-4 py-3 font-bold" onClick={onCreate}>{labels.createQuiz}</button><button type="button" className="btn-petrolio rounded-xl px-4 py-3 font-bold" onClick={onCreateVideo}>{labels.createVideoQuiz}</button></div></section>
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3"><h2 className="text-xl font-black text-petrolio">{labels.guideTitle}</h2><a href={`?app=guide&lang=${language}`} className="block underline font-bold text-petrolio">{guideNavigation[language].title}</a></section>
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3"><h2 className="text-xl font-black text-petrolio">{labels.audioTitle}</h2><button type="button" aria-pressed={!muted} onClick={() => setMuted(sounds.toggleMute())} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold">{muted ? <VolumeX className="w-4 h-4 text-rose-700" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}{muted ? t.unmuteAudio : t.muteAudio}</button></section>
    <section data-settings-about className="rounded-2xl border border-line bg-white p-5 space-y-2"><h2 ref={about} className="text-xl font-black text-petrolio outline-none">{labels.aboutTitle}</h2><p className="flex items-center gap-2 font-bold">Qurioso <AppVersion /></p><p>{t.authorLabel}</p><p>{t.licenseLabel}</p><p className="flex flex-wrap gap-4"><a href="https://github.com/napo/qurioso" target="_blank" rel="noopener noreferrer" className="underline font-bold text-petrolio">GitHub</a><button type="button" className="underline font-bold text-petrolio" onClick={onGuide}>{t.buildAndGitHub}</button></p></section>
  </main></div>;
}
