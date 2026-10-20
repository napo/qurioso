import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { settingsTranslations } from '../../i18n/settings';
import { guideNavigation } from '../../i18n/guideNavigation';
import { LibraryData } from '../data/LibraryData';
import type { Quiz } from '../../types/quiz';

export function SettingsScreen({ quizzes, onRestored, onEditor, onQuestions, onCreate, onCreateVideo, onBack, onGuide, environment }: {
  quizzes: Quiz[]; onRestored: (quizzes: Quiz[]) => void; onEditor: (quiz: Quiz) => void; onQuestions: () => void;
  onCreate: () => void; onCreateVideo: () => void; onBack: () => void; onGuide: () => void;
  environment: string;
}) {
  const { language } = useLanguage(), labels = settingsTranslations[language];
  return <div data-qurioso-settings className="min-h-screen bg-qurioso-canvas text-ink p-4 md:p-8"><main className="max-w-5xl mx-auto space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-black text-petrolio">{labels.settings}</h1><LanguageSelector /><button type="button" onClick={onBack} className="rounded-xl border border-line bg-white px-4 py-3 font-bold">{labels.backToQuizzes}</button></header>
    <p className="rounded-xl border border-line bg-white p-4">{environment}</p>
    <LibraryData quizzes={quizzes} onRestored={onRestored} onEditor={onEditor} onQuestions={onQuestions} />
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3"><h2 className="text-xl font-black text-petrolio">{labels.createQuiz}</h2><p>{labels.createHint}</p><div className="flex flex-wrap gap-3"><button type="button" className="btn-mandarino rounded-xl px-4 py-3 font-bold" onClick={onCreate}>{labels.createQuiz}</button><button type="button" className="btn-petrolio rounded-xl px-4 py-3 font-bold" onClick={onCreateVideo}>{labels.createVideoQuiz}</button></div></section>
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3"><h2 className="text-xl font-black text-petrolio">{labels.guideTitle}</h2><a href={`?app=guide&lang=${language}`} className="block underline font-bold text-petrolio">{guideNavigation[language].title}</a><button type="button" className="underline font-bold text-petrolio" onClick={onGuide}>{labels.openGuide}</button></section>
  </main></div>;
}
