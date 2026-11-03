import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { Question, Quiz } from '../../types/quiz';
import { FallbackImage } from '../common/FallbackImage';
import { ImageCredit } from '../common/ImageCredit';
import { QuriosoIcon } from '../common/QuriosoLogo';
import { useLanguage } from '../../context/LanguageContext';
import { classroomTranslations } from '../../i18n/classroom';
import { choiceCorrect, displayOrder, isScored, makeChoice, takesSeveral } from '../../services/questionTypes';

type Text = typeof classroomTranslations['it'];
/** True/false options are stored as [true, false]; other questions use A, B, C… */
const answerLetters = (question: Question, t: Text) => question.type === 'true_false' && question.options.length === 2
  ? [t.trueLetter, t.falseLetter] : question.options.map((_, i) => String.fromCharCode(65 + i));

export function ClassroomScreen({ quiz, onExit }: { quiz: Quiz; onExit: () => void }) {
  const { language } = useLanguage(), t = classroomTranslations[language];
  const [index, setIndex] = useState(0);
  // The class's choice for each question: one option, or several in the order picked.
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [choice, setChoice] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const screen = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), confirmButton = useRef<HTMLButtonElement>(null), nextButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<'question' | 'confirm' | 'next' | undefined>(undefined);
  const question = quiz.questions[index];
  const selected = answers[index];
  const confirmed = selected !== undefined;
  const letters = question ? answerLetters(question, t) : [];
  const shown = question ? displayOrder(question, question.options) : [];
  const several = Boolean(question && takesSeveral(question)), ordering = question?.type === 'ordering';
  const right = (q: Question, ids?: string[]) => Boolean(ids?.length) && choiceCorrect(q, makeChoice(q, ids!)) === true;
  const correct = quiz.questions.filter((q, i) => right(q, answers[i])).length;
  const scoredTotal = quiz.questions.filter(isScored).length;
  const ready = choice.length > 0 && (!ordering || choice.length === question!.options.length);

  const choose = (optionId: string) => {
    if (confirmed) return;
    setChoice(previous => !several ? [optionId] : previous.includes(optionId) ? previous.filter(id => id !== optionId) : [...previous, optionId]);
    focusNext.current = 'confirm';
  };
  const confirm = () => { if (confirmed || !ready) return; setAnswers(previous => ({ ...previous, [index]: choice })); focusNext.current = 'next'; };
  const advance = () => {
    if (!confirmed) return;
    setChoice([]);
    if (index + 1 < quiz.questions.length) { setIndex(index + 1); focusNext.current = 'question'; } else setFinished(true);
  };
  const restart = () => { setIndex(0); setAnswers({}); setChoice([]); setFinished(false); focusNext.current = 'question'; };

  // Move focus to the next control so Enter/Space also work natively on the focused button.
  // Focusing "Confirm" never scrolls, so the question stays visible on small screens.
  useEffect(() => {
    const target = focusNext.current; focusNext.current = undefined;
    ({ question: heading, confirm: confirmButton, next: nextButton })[target!]?.current?.focus({ preventScroll: target === 'confirm' });
  });

  const onKey = useRef<(event: KeyboardEvent) => void>(() => {});
  onKey.current = event => {
    if (finished || !question || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as Element | null;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    // Escape is left to the browser: it only leaves fullscreen, never the activity.
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    const position = /^[1-9]$/.test(key) ? Number(key) - 1 : letters.indexOf(key);
    if (position >= 0 && position < shown.length) { event.preventDefault(); choose(shown[position].id); return; }
    const native = Boolean(target?.closest?.('button, a'));
    if ((key === 'Enter' || key === ' ') && native) return;
    if (key === 'Enter' && !confirmed && ready) { event.preventDefault(); confirm(); }
    else if ((key === 'Enter' || key === ' ' || key === 'ArrowRight') && confirmed) { event.preventDefault(); advance(); }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    const element = screen.current;
    const update = () => setIsFullscreen(document.fullscreenElement === element);
    document.addEventListener('fullscreenchange', update);
    return () => { document.removeEventListener('fullscreenchange', update); if (document.fullscreenElement === element) void document.exitFullscreen?.().catch(() => {}); };
  }, []);
  const toggleFullscreen = () => {
    setFullscreenError(false);
    const request = document.fullscreenElement === screen.current
      ? document.exitFullscreen?.() : screen.current?.requestFullscreen?.();
    if (request) void request.catch(() => setFullscreenError(true));
    else setFullscreenError(true);
  };

  const highlighted = confirmed ? selected : choice;
  const texts = (q: Question, ids: string[]) => ids.map(id => q.options.find(o => o.id === id)?.text).filter(Boolean).join(q.type === 'ordering' ? ' → ' : ', ');
  const solutionOf = (q: Question) => q.type === 'ordering' ? texts(q, q.options.map(o => o.id)) : texts(q, q.options.filter(o => o.isCorrect).map(o => o.id));
  const range = letters.length < 2 ? letters.join('') : question?.type === 'true_false' ? letters.join('/') : `${letters[0]}–${letters[letters.length - 1]}`;
  const shortcuts = t.shortcuts.replace('{numbers}', `1–${Math.min(letters.length, 9)}`).replace('{letters}', range);
  return <main ref={screen} className="min-h-screen overflow-y-auto bg-white text-ink p-5 md:p-8 2xl:p-10 space-y-6">
    <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-3"><QuriosoIcon size={40} /><div><h1 className="text-xl font-bold">{quiz.title}</h1><p className="text-sm text-petrolio">{t.subtitle}</p></div></div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen} title={isFullscreen ? t.exitFullscreen : t.fullscreen} aria-pressed={isFullscreen}
          className="rounded-xl border border-line p-2.5 text-petrolio">{isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        <button type="button" onClick={onExit} className="rounded-xl border border-line px-4 py-2">{t.exit}</button>
      </div>
    </header>
    {fullscreenError && <p role="status" className="text-petrolio">{t.fullscreenError}</p>}
    {finished || !question ? <section className="mx-auto max-w-4xl space-y-5">
      <h2 ref={heading} tabIndex={-1} className="text-3xl font-bold text-petrolio outline-none">{t.finished}</h2>
      <p>{t.score.replace('{correct}', String(correct)).replace('{total}', String(scoredTotal))}</p>
      {quiz.questions.map((q, i) => <article key={q.id} className="rounded-xl border border-line p-4"><h3 className="font-bold">{q.text}</h3><p>{t.classAnswer.replace('{answer}', texts(q, answers[i] ?? []) || t.notCollected)}</p><p className="text-petrolio">{isScored(q) ? t.solution.replace('{answer}', solutionOf(q)) : t.poll}</p></article>)}
      <button type="button" onClick={restart} className="btn-primary rounded-xl px-5 py-3">{t.restart}</button>
    </section> : <section className="mx-auto max-w-[110rem] space-y-[clamp(1rem,2.2vh,2rem)]">
      <p className="text-[clamp(0.875rem,1.1vw,1.25rem)] text-muted">{t.progress.replace('{current}', String(index + 1)).replace('{total}', String(quiz.questions.length))}</p>
      <h2 ref={heading} tabIndex={-1} className="text-[clamp(1.75rem,3.2vw,3.75rem)] leading-tight font-bold outline-none">{question.text}</h2>
      {/* With an image, wide screens place it beside the answers so both stay above the fold. */}
      <div className={question.mediaUrl ? 'grid gap-[clamp(1rem,2vw,2.5rem)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start' : ''}>
      {question.mediaUrl && <figure className="space-y-1">
        <FallbackImage src={question.mediaUrl} alt={t.image} className="max-h-[clamp(12rem,38vh,36rem)] lg:max-h-[clamp(14rem,50vh,44rem)] w-auto max-w-full mx-auto object-contain rounded-xl" placeholderClassName="h-48 max-w-md mx-auto rounded-2xl" />
        <figcaption><ImageCredit attribution={question.mediaAttribution} /></figcaption>
      </figure>}
      <div className="space-y-[clamp(0.75rem,1.6vh,1.5rem)]">
      <p className="text-[clamp(1rem,1.3vw,1.5rem)] text-muted">{ordering ? t.pickOrder : several ? t.pickAll : question.type === 'poll' ? t.poll : t.discuss}</p>
      <div className={`grid gap-[clamp(0.75rem,1.4vw,1.5rem)] sm:grid-cols-2 ${question.mediaUrl ? 'lg:grid-cols-1' : ''}`}>{shown.map((option, i) => {
        // Revealed: the correct options, or each item's place in the correct order.
        const place = question.options.findIndex(o => o.id === option.id) + 1;
        const reveal = confirmed && isScored(question) && (ordering || option.isCorrect), position = highlighted.indexOf(option.id), chosen = position >= 0;
        return <button key={option.id} type="button" disabled={confirmed} aria-pressed={chosen} aria-keyshortcuts={i < 9 ? `${i + 1} ${letters[i]}` : letters[i]} onClick={() => choose(option.id)}
          className={`flex items-center gap-[clamp(0.75rem,1.2vw,1.5rem)] rounded-2xl border-2 px-[clamp(1rem,1.6vw,2rem)] py-[clamp(0.75rem,1.6vh,1.75rem)] text-left text-[clamp(1.25rem,2.2vw,2.5rem)] leading-snug font-bold motion-safe:transition-colors motion-safe:duration-200 ${reveal ? 'border-petrolio bg-petrolio/10' : chosen ? 'border-mandarino bg-mandarino/15' : 'border-line bg-white'}`}>
          <span className={`shrink-0 grid place-items-center rounded-xl w-[1.8em] h-[1.8em] font-black ${reveal ? 'bg-petrolio text-white' : chosen ? 'bg-mandarino text-ink' : 'bg-surface-soft text-petrolio'}`}>{letters[i]}</span>
          <span className="min-w-0 break-words">{option.text}{ordering && chosen && !confirmed ? ` · ${position + 1}` : ''}{reveal ? (ordering ? ` ✓ ${place}` : ' ✓') : ''}</span>
        </button>;
      })}</div>
      </div>
      </div>
      {!confirmed && <div className="flex flex-wrap gap-3">
        <button ref={confirmButton} type="button" disabled={!ready} onClick={confirm}
          className="btn-primary rounded-xl px-6 py-3 text-[clamp(1rem,1.3vw,1.5rem)]">{t.confirm}</button>
        {ordering && <button type="button" disabled={!choice.length} onClick={() => setChoice([])} className="rounded-xl border border-line px-5 py-3">{t.restartOrder}</button>}
      </div>}
      {/* Only the outcome and explanation are announced; the "Next" control stays outside the live region. */}
      <div className={confirmed ? 'space-y-4 rounded-2xl bg-surface-soft p-5 text-[clamp(1rem,1.4vw,1.75rem)]' : ''}>
        <div role="status" aria-live="polite" className="space-y-4">
          {confirmed ? <>
            <p className="font-bold text-petrolio">{!isScored(question) ? t.pollDone : right(question, selected) ? t.correct : t.review}</p>
            {isScored(question) && !right(question, selected) && several && <p>{t.solution.replace('{answer}', solutionOf(question))}</p>}
            {quiz.settings.showExplanation && question.explanation && <p>{question.explanation}</p>}
          </> : choice.length > 0 && <p className="sr-only">{t.selected.replace('{letter}', choice.map(id => letters[shown.findIndex(o => o.id === id)]).join(', '))}</p>}
        </div>
        {confirmed && <button ref={nextButton} type="button" onClick={advance} className="mt-4 btn-primary rounded-xl px-5 py-3">{index + 1 < quiz.questions.length ? t.next : t.summary}</button>}
      </div>
      <p className="text-xs text-muted">{shortcuts}</p>
    </section>}
  </main>;
}
