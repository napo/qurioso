import React, { useState } from 'react';
import type { Quiz } from '../../types/quiz';
import { ImageCredit } from '../common/ImageCredit';
import { QuriosoIcon } from '../common/QuriosoLogo';
import { useLanguage } from '../../context/LanguageContext';
import { classroomTranslations } from '../../i18n/classroom';

export function ClassroomScreen({ quiz, onExit }: { quiz: Quiz; onExit: () => void }) {
  const { language } = useLanguage(), t = classroomTranslations[language];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const question = quiz.questions[index];
  const selected = answers[index];
  const correct = quiz.questions.filter((q, i) => q.options.some(o => o.id === answers[i] && o.isCorrect)).length;
  return <main className="min-h-screen bg-white text-ink p-5 md:p-10 space-y-6">
    <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-3"><QuriosoIcon size={40} /><div><h1 className="text-xl font-bold">{quiz.title}</h1><p className="text-sm text-petrolio">{t.subtitle}</p></div></div>
      <button type="button" onClick={onExit} className="rounded-xl border border-line px-4 py-2">{t.exit}</button>
    </header>
    {finished || !question ? <section className="mx-auto max-w-4xl space-y-5">
      <h2 className="text-3xl font-bold text-petrolio">{t.finished}</h2>
      <p>{t.score.replace('{correct}', String(correct)).replace('{total}', String(quiz.questions.length))}</p>
      {quiz.questions.map((q, i) => <article key={q.id} className="rounded-xl border border-line p-4"><h3 className="font-bold">{q.text}</h3><p>{t.classAnswer.replace('{answer}', q.options.find(o => o.id === answers[i])?.text || t.notCollected)}</p><p className="text-petrolio">{t.solution.replace('{answer}', q.options.filter(o => o.isCorrect).map(o => o.text).join(', '))}</p></article>)}
      <button type="button" onClick={() => { setIndex(0); setAnswers({}); setFinished(false); }} className="btn-petrolio rounded-xl px-5 py-3">{t.restart}</button>
    </section> : <section className="mx-auto max-w-5xl space-y-5">
      <p className="text-sm text-muted">{t.progress.replace('{current}', String(index + 1)).replace('{total}', String(quiz.questions.length))}</p>
      <h2 className="text-2xl md:text-4xl font-bold">{question.text}</h2>
      {question.mediaUrl && <><img src={question.mediaUrl} alt={t.image} className="max-h-72 mx-auto object-contain" /><ImageCredit attribution={question.mediaAttribution} /></>}
      <p className="text-muted">{t.discuss}</p>
      <div className="grid gap-4 sm:grid-cols-2">{question.options.map(option => <button key={option.id} type="button" disabled={selected !== undefined} onClick={() => setAnswers(previous => ({ ...previous, [index]: option.id }))}
        className={`rounded-2xl border-2 p-6 text-left text-xl font-bold ${selected !== undefined && option.isCorrect ? 'border-petrolio bg-petrolio/10' : selected === option.id ? 'border-mandarino bg-mandarino/15' : 'border-line bg-white'}`}>
        {option.text}{selected !== undefined && option.isCorrect ? ' ✓' : ''}
      </button>)}</div>
      {selected !== undefined && <div role="status" className="space-y-4 rounded-2xl bg-surface-soft p-5">
        <p className="font-bold text-petrolio">{question.options.some(o => o.id === selected && o.isCorrect) ? t.correct : t.review}</p>
        {quiz.settings.showExplanation && question.explanation && <p>{question.explanation}</p>}
        <button type="button" onClick={() => index + 1 < quiz.questions.length ? setIndex(index + 1) : setFinished(true)} className="btn-petrolio rounded-xl px-5 py-3">{index + 1 < quiz.questions.length ? t.next : t.summary}</button>
      </div>}
    </section>}
  </main>;
}
