import React, { useEffect, useRef, useState } from 'react';
import type { Quiz } from '../../types/quiz';
import { useLanguage } from '../../context/LanguageContext';
import { homeworkTranslations } from '../../i18n/homework';
import { createHomework, type SavedHomework } from '../../services/homework';
import { gameSync } from '../../services/gameSync';
import { deadlineValid, defaultDeadline, fromLocalInput, toLocalInput } from './homeworkTime';

export function AssignDialog({ quiz, desktop, onCancel, onAssigned }: { quiz: Quiz; desktop: boolean; onCancel: () => void; onAssigned: (homework: SavedHomework) => void }) {
  const { language } = useLanguage(), h = homeworkTranslations[language];
  const [deadline, setDeadline] = useState(() => toLocalInput(defaultDeadline()));
  const [showFeedback, setShowFeedback] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    const time = fromLocalInput(deadline);
    if (!deadlineValid(time)) { setError(h.deadlineInvalid); return; }
    setBusy(true); setError('');
    try { onAssigned(await createHomework(quiz, gameSync.generatePin(), time, showFeedback)); }
    catch { setError(h.createFailed); setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onKeyDown={event => { if (event.key === 'Escape' && !busy) onCancel(); }}>
    <form onSubmit={assign} role="dialog" aria-modal="true" aria-labelledby="assign-title" className="assign-dialog w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border border-line bg-white p-5 space-y-4 text-ink">
      <header>
        <h2 id="assign-title" className="text-xl font-black text-petrolio">{h.dialogTitle}</h2>
        <p className="font-bold">{quiz.title}</p>
      </header>
      <p className="text-sm">{h.dialogIntro}</p>
      {quiz.videoConfig ? <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-900">{h.videoUnsupported}</p> : <>
        <label className="block space-y-1 font-bold text-sm">
          <span>{h.deadline}</span>
          <input ref={first} type="datetime-local" value={deadline} onChange={event => { setDeadline(event.target.value); setError(''); }}
            className="block w-full rounded-xl border border-line px-3 py-2 font-normal text-base" required />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={showFeedback} onChange={event => setShowFeedback(event.target.checked)} className="mt-1" />
          <span>{h.feedback}</span>
        </label>
        <p className="rounded-xl border border-line bg-surface-soft p-3 text-sm text-petrolio">{desktop ? h.awake : h.awakeBrowser}</p>
      </>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary rounded-xl px-4 py-2">{h.cancel}</button>
        {!quiz.videoConfig && <button type="submit" disabled={busy} className="btn-primary rounded-xl px-4 py-2">{h.confirm}</button>}
      </div>
    </form>
  </div>;
}
