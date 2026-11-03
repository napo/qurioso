import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Globe, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { homeworkTranslations } from '../../i18n/homework';
import { lobbyTranslations } from '../../i18n/lobby';
import { sharingTranslations } from '../../i18n/internetSharing';
import { fill } from '../../i18n/format';
import { gameSync, type ServerInfo } from '../../services/gameSync';
import { reportCsv, toCsv } from '../../services/gameReport';
import { isScored } from '../../services/questionTypes';
import { closeHomework, deleteHomework, extendHomework, forgetHomework, homeworkReports, readHomework, removeStudent, type HomeworkState, type SavedHomework } from '../../services/homework';
import { getSessionJoinAddresses } from '../../utils/connectionUrl';
import { JoinInstructions } from '../common/JoinInstructions';
import { QRCodeDisplay } from '../common/QRCodeDisplay';
import { QuestionReportList } from '../leaderboard/QuestionReportList';
import { useInternetSharing } from '../host/useInternetSharing';
import { InternetSharingPanel } from '../host/InternetSharingPanel';
import { deadlineValid, formatDeadline, formatRemaining, fromLocalInput, toLocalInput } from './homeworkTime';

const REFRESH_MS = 5000;

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${name}.csv`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The teacher's page of one homework: how to reach it, who is doing it, how the class is doing. */
export function HomeworkScreen({ homework, onExit }: { homework: SavedHomework; onExit: () => void }) {
  const { language } = useLanguage(), h = homeworkTranslations[language], lobby = lobbyTranslations[language], sharingText = sharingTranslations[language];
  const [saved, setSaved] = useState(homework);
  const [state, setState] = useState<HomeworkState | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [newDeadline, setNewDeadline] = useState(() => toLocalInput(homework.deadline));
  const [busy, setBusy] = useState(false);
  const sharing = useInternetSharing(saved.pin);
  const sharingConsent = useRef(false);
  const [showSharing, setShowSharing] = useState(false);

  useEffect(() => { void gameSync.getServerInfo().then(setServerInfo); }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () => readHomework(saved).then(next => { if (alive) { setState(previous => ({ ...next, quiz: next.quiz ?? previous?.quiz })); setMissing(false); setNow(Date.now()); } })
      .catch(failure => {
        if (!alive) return;
        if ([403, 404].includes((failure as { status?: number }).status ?? 0)) setMissing(true);
        else setError(h.actionFailed);
      });
    void refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [saved]);

  const act = async (action: () => Promise<HomeworkState | void>) => {
    setBusy(true); setError('');
    try { const next = await action(); if (next) setState(previous => ({ ...next, quiz: next.quiz ?? previous?.quiz })); }
    catch { setError(h.actionFailed); }
    finally { setBusy(false); }
  };

  if (missing) return <main className="min-h-screen bg-white p-8 space-y-4 text-ink">
    <p role="alert">{h.loadFailed}</p>
    <button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={() => { forgetHomework(saved.pin); onExit(); }}>{h.back}</button>
  </main>;
  if (!state) return <main className="min-h-screen bg-white p-8 space-y-4 text-petrolio">
    {error ? <p role="alert">{error}</p> : <p role="status">{h.loading}</p>}
    {error && <button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={() => { setError(''); void readHomework(saved).then(setState).catch(() => setError(h.actionFailed)); }}>{h.retry}</button>}
  </main>;

  const assignment = state.session.assignment!, open = state.session.status !== 'finished';
  const status = open ? `${fill(h.openUntil, { date: formatDeadline(assignment.deadline, language) })} · ${fill(h.remaining, { time: formatRemaining(assignment.deadline - now, language) })}`
    : assignment.closed ? h.closed : fill(h.expired, { date: formatDeadline(assignment.deadline, language) });
  const publicUrl = sharing.state.phase === 'active' && sharing.state.pin === saved.pin ? sharing.state.url : undefined;
  const sharingBusy = ['downloading', 'connecting', 'reconnecting', 'stopping'].includes(sharing.state.phase);
  const addresses = getSessionJoinAddresses(window.location.origin, serverInfo, sharing.state, saved.pin);
  const address = publicUrl || (addresses.includes(selectedAddress) ? selectedAddress : addresses[0] || '');
  const quiz = state.quiz, total = state.session.totalQuestions;
  const students = Object.values(state.session.players).map(player => {
    const answers = state.answers[player.id] ?? {}, done = Object.keys(answers).length;
    return { player, done, correct: Object.values(answers).filter(answer => answer.isCorrect).length, score: Object.values(answers).reduce((sum, answer) => sum + answer.pointsEarned, 0) };
  }).sort((a, b) => (a.player.name || a.player.nickname).localeCompare(b.player.name || b.player.nickname, language));
  const stateOf = (done: number) => done >= total ? h.finished : done ? h.inProgress : h.notStarted;
  const reports = quiz ? homeworkReports(quiz, state) : [];
  const fileName = (prefix: string) => `${prefix}_${state.session.quizTitle.toLowerCase().replace(/\s+/g, '_')}`;

  return <main className="homework-screen min-h-screen bg-white text-ink p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <button type="button" onClick={onExit} className="btn-quiet inline-flex items-center gap-1 text-sm"><ArrowLeft className="w-4 h-4" />{h.back}</button>
        <h1 className="text-2xl font-black text-petrolio">{fill(h.title, { title: state.session.quizTitle })}</h1>
        <p role="status" data-homework-status={open ? 'open' : 'closed'} className={`font-bold ${open ? 'text-emerald-800' : 'text-muted'}`}>{status}</p>
      </div>
      {sharing.available && open && <button type="button" role="switch" aria-checked={Boolean(publicUrl)} aria-label={sharingText.title} disabled={sharing.state.phase === 'stopping'} data-sharing-phase={sharing.state.phase}
        onClick={() => { if (publicUrl || sharingBusy) void sharing.stop(); else if (sharingConsent.current && sharing.state.phase === 'idle') void sharing.start(); else setShowSharing(true); }}
        className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 font-bold text-sm ${publicUrl ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-line bg-surface-soft text-petrolio'}`}>
        <Globe size={16} />Cloudflare<span>{publicUrl ? 'ON' : sharingBusy ? '…' : 'OFF'}</span>
      </button>}
    </header>

    {open && <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] items-start rounded-2xl border-2 border-line p-4">
      <div className="space-y-3 min-w-0">
        <JoinInstructions pin={saved.pin} addresses={addresses} address={address} onAddressChange={setSelectedAddress} />
        <p className="text-sm text-muted">{publicUrl || sharingBusy ? h.cloudflareHint : h.lanHint}</p>
      </div>
      {address && <div className="flex justify-center"><QRCodeDisplay pin={saved.pin} baseUrl={address} size={180} showDetails={false} /></div>}
    </section>}

    <section aria-labelledby="homework-students" className="space-y-3">
      <h2 id="homework-students" className="text-xl font-black">{fill(h.students, { count: students.length })}</h2>
      {students.length ? <div className="overflow-x-auto"><table className="homework-students w-full text-sm">
        <thead><tr className="text-left text-muted"><th className="py-1 pr-3">{h.name}</th><th className="pr-3">{h.questions}</th><th className="pr-3">{h.points}</th><th className="pr-3">{h.state}</th><th><span className="sr-only">{h.remove}</span></th></tr></thead>
        <tbody>{students.map(({ player, done, score }) => <tr key={player.id} className="border-t border-line">
          <td className="py-2 pr-3 font-bold"><span aria-hidden="true">{player.avatar} </span>{player.name || player.nickname}</td>
          <td className="pr-3">{done} / {total}</td><td className="pr-3 font-mono">{score.toLocaleString(language)}</td><td className="pr-3">{stateOf(done)}</td>
          <td className="text-right"><button type="button" disabled={busy} onClick={() => void act(async () => { await removeStudent(saved, player.id); return readHomework(saved); })}
            aria-label={fill(h.remove, { name: player.name || player.nickname })} title={fill(h.remove, { name: player.name || player.nickname })}
            className="rounded-lg p-1 text-muted hover:bg-rose-50 hover:text-rose-700"><X className="w-4 h-4" /></button></td>
        </tr>)}</tbody>
      </table></div> : <p className="text-muted">{h.noStudents}</p>}
    </section>

    {reports.some(report => report.answered) && <section aria-labelledby="question-report-title" className="question-report space-y-3">
      <div>
        <h2 id="question-report-title" className="text-xl font-black">{lobby.reportTitle}</h2>
        <p className="text-sm text-muted">{lobby.reportHint}</p>
      </div>
      <QuestionReportList reports={reports} />
    </section>}

    <section className="flex flex-wrap gap-3">
      {students.length > 0 && <button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={() => download(toCsv([h.studentsHeaders.split('|'),
        ...students.map(({ player, done, correct, score }) => [player.name || player.nickname, done, quiz ? `${correct}/${quiz.questions.filter(isScored).length}` : correct, score, done >= total ? h.finished : ''])]), fileName(h.studentsFile))}>{h.studentsCsv}</button>}
      {reports.some(report => report.answered) && <button type="button" className="btn-secondary rounded-xl px-4 py-2" onClick={() => download(reportCsv(reports, lobby.reportHeaders.split('|')), fileName(lobby.reportFile))}>{lobby.reportCsv}</button>}
    </section>

    <section className="rounded-2xl border border-line p-4 space-y-3">
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        const time = fromLocalInput(newDeadline);
        if (!deadlineValid(time)) { setError(h.deadlineInvalid); return; }
        void act(async () => { const next = await extendHomework(saved, time); setSaved({ ...saved, deadline: time }); return next; });
      }}>
        <label className="space-y-1 text-sm font-bold"><span className="block">{h.newDeadline}</span>
          <input type="datetime-local" value={newDeadline} onChange={event => setNewDeadline(event.target.value)} className="rounded-xl border border-line px-3 py-2 font-normal" /></label>
        <button type="submit" disabled={busy} className="btn-secondary rounded-xl px-4 py-2">{h.saveDeadline}</button>
        <p className="w-full text-xs text-muted">{h.reopenHint}</p>
      </form>
      <div className="flex flex-wrap gap-3">
        {open && <button type="button" disabled={busy} className="btn-danger rounded-xl px-4 py-2" onClick={() => { if (window.confirm(h.closeConfirm)) void act(() => closeHomework(saved)); }}>{h.close}</button>}
        <button type="button" disabled={busy} className="btn-danger rounded-xl px-4 py-2" onClick={() => { if (window.confirm(h.deleteConfirm)) void act(async () => { await deleteHomework(saved); onExit(); }); }}>{h.delete}</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </section>

    {showSharing && sharing.available && <InternetSharingPanel state={sharing.state} onStart={() => { sharingConsent.current = true; setShowSharing(false); void sharing.start(); }} onStop={() => void sharing.stop()} onClose={() => setShowSharing(false)} />}
  </main>;
}
