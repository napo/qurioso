import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { AssignmentFeedback, AssignmentView } from '../../types/quiz';
import { useLanguage } from '../../context/LanguageContext';
import { homeworkTranslations } from '../../i18n/homework';
import { playerTranslations } from '../../i18n/player';
import { gameExperienceTranslations } from '../../i18n/gameExperience';
import { fill } from '../../i18n/format';
import { answerAssignment, readAssignment } from '../../services/homework';
import { makeChoice, takesSeveral } from '../../services/questionTypes';
import { OPTION_COLORS, SHAPE_ICONS } from '../../utils/quizStyles';
import { FallbackImage } from '../common/FallbackImage';
import { formatDeadline } from './homeworkTime';

/** A participant's homework: one question at a time, at their own pace, on their own device. */
export function HomeworkPlayer({ pin, playerId, token, title, nickname, avatar, sessionStatus, onLeave }: {
  pin: string; playerId: string; token: string; title: string; nickname: string; avatar: string; sessionStatus: string; onLeave: () => void;
}) {
  const { language } = useLanguage(), h = homeworkTranslations[language], p = playerTranslations[language], gameText = gameExperienceTranslations[language];
  const [view, setView] = useState<AssignmentView | null>(null);
  const [feedback, setFeedback] = useState<{ result: AssignmentFeedback; question: NonNullable<AssignmentView['question']>; next: AssignmentView } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = () => { setError(''); readAssignment(pin, token).then(setView).catch(() => setError(h.sendFailed)); };
  useEffect(() => {
    let current = true;
    setError('');
    readAssignment(pin, token).then(assignment => {
      if (current) { setView(assignment); setFeedback(null); setPicked([]); }
    }).catch(() => { if (current) setError(h.sendFailed); });
    return () => { current = false; };
  }, [pin, token, sessionStatus]);
  useEffect(() => {
    if (!view || view.deadline <= Date.now()) return;
    const timer = window.setTimeout(() => {
      readAssignment(pin, token).then(assignment => {
        setView(assignment); setFeedback(null); setPicked([]);
      }).catch(() => setError(h.sendFailed));
    }, view.deadline - Date.now() + 10);
    return () => window.clearTimeout(timer);
  }, [pin, token, view?.deadline]);

  const send = async (ids: string[]) => {
    const question = view?.question;
    if (!question || sending || !ids.length) return;
    setSending(true); setError('');
    try {
      const { feedback: result, assignment } = await answerAssignment(pin, token, playerId, question.id, makeChoice(question, ids));
      setPicked([]);
      setFeedback({ result, question, next: assignment });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
    } catch (failure) {
      // A closed homework is shown as such; anything else can be sent again, the server will not grade it twice.
      if ((failure as { status?: number }).status === 410) load(); else setError(h.sendFailed);
    } finally { setSending(false); }
  };

  const header = view && <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
    <div className="flex items-center gap-2 min-w-0"><span className="text-2xl" aria-hidden="true">{avatar}</span><span className="font-bold truncate">{nickname}</span></div>
    <div className="flex items-center gap-3">
      <div className="text-right text-xs text-muted"><p className="font-bold text-petrolio">{h.student} · {title}</p><p>{fill(h.dueBy, { date: formatDeadline(view.deadline, language) })}</p></div>
      <button type="button" className="btn-quiet rounded-lg px-2 py-1 text-xs" onClick={onLeave}>{h.exitStudent}</button>
    </div>
  </header>;
  const frame = (content: React.ReactNode) => <main className="homework-player min-h-screen bg-qurioso-canvas text-ink p-4 flex flex-col gap-4 max-w-2xl mx-auto">{header}{content}</main>;

  if (!view) return frame(error ? <div role="alert" className="space-y-3"><p>{error}</p><button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={load}>{h.retry}</button></div>
    : <p role="status" className="text-petrolio">{h.loading}</p>);

  if (feedback) {
    const { result, question } = feedback;
    const solution = result.correctOptionIds?.map(id => question.options.find(option => option.id === id)?.text).filter(Boolean).join(question.type === 'ordering' ? ' → ' : ', ');
    return frame(<section aria-live="polite" className="homework-feedback my-auto space-y-4 text-center">
      {result.isCorrect === undefined ? <p className="text-2xl font-black text-petrolio">{question.type === 'poll' ? h.pollRecorded : h.recorded}</p>
        : <p className={`text-2xl font-black flex items-center justify-center gap-2 ${result.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
          {result.isCorrect ? <CheckCircle aria-hidden="true" /> : <XCircle aria-hidden="true" />}{result.isCorrect ? h.correct : h.wrong}</p>}
      {result.pointsEarned > 0 && <p className="font-bold text-accent-ink">{fill(h.earned, { points: result.pointsEarned.toLocaleString(language) })}</p>}
      {solution && !result.isCorrect && <p className="font-bold">{fill(h.solution, { answer: solution })}</p>}
      {result.explanation && <p className="text-petrolio">{result.explanation}</p>}
      <button type="button" autoFocus className="btn-primary rounded-xl px-6 py-3 font-bold" onClick={() => { setView(feedback.next); setFeedback(null); }}>{h.next}</button>
    </section>);
  }

  const question = view.question;
  if (!question) {
    const finished = view.done >= view.total;
    return frame(<section className="homework-end my-auto space-y-3 text-center">
      <h1 className="text-2xl font-black text-petrolio">{finished ? h.finishedTitle : h.closedTitle}</h1>
      {!finished && <p>{h.closedText}</p>}
      <p className="font-bold">{fill(h.finishedScore, { score: view.score.toLocaleString(language), correct: view.correct, scored: view.scored })}</p>
      <button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={onLeave}>{h.exitStudent}</button>
    </section>);
  }

  const several = takesSeveral(question), ordering = question.type === 'ordering';
  const toggle = (id: string) => setPicked(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  return frame(<section className="homework-question space-y-4" aria-labelledby="homework-question-text">
    <div>
      <p className="text-sm font-bold text-muted">{fill(h.progress, { n: view.done + 1, total: view.total })}</p>
      <progress className="w-full" value={view.done} max={view.total} aria-hidden="true" />
    </div>
    <h1 id="homework-question-text" className="text-xl font-black text-ink">{question.text}</h1>
    {question.mediaUrl && <FallbackImage src={question.mediaUrl} alt="" className="max-h-64 w-auto max-w-full mx-auto rounded-xl object-contain" placeholderClassName="h-40 rounded-xl" />}
    {several && <p className="text-sm font-bold text-petrolio">{ordering ? p.pickOrder : p.pickAll}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{question.options.map((option, index) => {
      const position = picked.indexOf(option.id), style = OPTION_COLORS[option.color];
      return <button key={option.id} type="button" disabled={sending} aria-pressed={several ? position >= 0 : undefined}
        aria-label={`${gameText.answer} ${String.fromCharCode(65 + index)}: ${option.text}${ordering && position >= 0 ? ` · ${fill(p.orderPosition, { n: position + 1 })}` : ''}`}
        onClick={() => several ? toggle(option.id) : void send([option.id])}
        className={`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left font-bold ${style.bg} ${position >= 0 ? 'border-petrolio ring-4 ring-petrolio/40' : style.border}`}>
        <span aria-hidden="true" className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-2xl ${style.badge}`}>{SHAPE_ICONS[option.shape]}</span>
        <span className="min-w-0 break-words">{option.text}</span>
        {position >= 0 && <span aria-hidden="true" className="ml-auto w-8 h-8 shrink-0 rounded-full bg-petrolio text-white flex items-center justify-center">{ordering ? position + 1 : '✓'}</span>}
      </button>;
    })}</div>
    {several && <div className="flex justify-center gap-3">
      {ordering && <button type="button" disabled={!picked.length || sending} onClick={() => setPicked([])} className="btn-secondary rounded-xl px-4 py-3 font-bold">{p.restartOrder}</button>}
      <button type="button" disabled={sending || !picked.length || (ordering && picked.length !== question.options.length)} onClick={() => void send(picked)} className="btn-primary rounded-xl px-6 py-3 font-bold">{p.confirmChoice}</button>
    </div>}
    {sending && <p role="status" className="text-sm text-petrolio">{p.sending}</p>}
    {error && <div role="alert" className="text-sm text-rose-700 space-y-2"><p>{error}</p><button type="button" className="btn-secondary rounded-xl px-3 py-1" onClick={() => several ? void send(picked) : load()}>{h.retry}</button></div>}
  </section>);
}
