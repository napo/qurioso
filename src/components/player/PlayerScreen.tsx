import { FitAnswerText } from '../common/FitAnswerText';
import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2,
  CheckCircle,
  XCircle,
  Clock,
  Trophy,
  Flame,
  ArrowRight,
  Sparkles,
  Wifi,
  Smartphone,
  Send,
  Zap
} from 'lucide-react';
import { GameSession, Player, Question } from '../../types/quiz';
import { gameSync, type PlayerRecovery } from '../../services/gameSync';
import { sounds } from '../../services/soundEffects';
import { OPTION_COLORS, SHAPE_ICONS, COLOR_KEYS, SHAPE_KEYS } from '../../utils/quizStyles';
import { useLanguage } from '../../context/LanguageContext';
import { gameExperienceTranslations } from '../../i18n/gameExperience';
import { PlayerFinalResult } from './PlayerFinalResult';
import { finalResult, readFinalResult, saveFinalResult, clearFinalResult, type FinalResult } from '../../services/finalResult';
import { QuriosoIcon, BRAND_COLORS } from '../common/QuriosoLogo';

const AVATAR_OPTIONS = ['🦁', '🦊', '⚡', '🚀', '🌟', '🎨', '🐺', '🎮', '🦄', '🐼', '🍕', '🎯'];
const newPlayerId = () => `p-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`;

interface PlayerScreenProps {
  initialPin?: string;
  onExit?: () => void;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ initialPin = '', onExit }) => {
  const { t, language } = useLanguage();
  const gameText = gameExperienceTranslations[language];
  const [completed, setCompleted] = useState<FinalResult | null>(() => readFinalResult(initialPin));
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const complete = (value: GameSession, id: string) => {
    if (completedRef.current || !value.players[id]) return;
    const result = finalResult(value, id); saveFinalResult(result); completedRef.current = result; setCompleted(result);
    void gameSync.leavePlayer(value.pin, id);
  };
  const [pin, setPin] = useState<string>(initialPin);
  const [nickname, setNickname] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('🦊');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>(newPlayerId);
  const [recovering, setRecovering] = useState(true);
  const [recoveryProblem, setRecoveryProblem] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Synchronized session state
  const [session, setSession] = useState<GameSession | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const submittingRef = useRef(false);
  const activeRoundRef = useRef('');
  const ownAnswerRef = useRef<{ roundId?: string; optionId: string } | undefined>(undefined);
  const [answerSubmittedAt, setAnswerSubmittedAt] = useState<number | null>(null);

  const updatePublicUrl = (sessionPin?: string) => {
    const url = new URL(window.location.href);
    if (sessionPin) { url.searchParams.set('role', 'player'); url.searchParams.set('pin', sessionPin); }
    else { url.searchParams.delete('role'); url.searchParams.delete('pin'); }
    window.history.replaceState({}, '', url);
  };
  const applyRecovery = (result: PlayerRecovery) => {
    if (result.status === 'recovered') {
      const { session: restored, player, ownAnswer } = result;
      if (restored.status === 'finished') { complete(restored, player.id); return; }
      setPin(restored.pin); setPlayerId(player.id); setNickname(player.nickname); setAvatar(player.avatar);
      activeRoundRef.current = restored.roundId || String(restored.questionStartTime);
      ownAnswerRef.current = ownAnswer ? { roundId: restored.roundId, optionId: ownAnswer.optionId } : undefined;
      setSelectedOptionId(ownAnswer?.optionId || null); setSession(restored); setIsJoined(true);
      updatePublicUrl(restored.pin);
    } else { setRecoveryProblem(result.message || ''); setCanRetry(result.status === 'unavailable'); }
  };
  const recover = async () => {
    setRecovering(true); setRecoveryProblem('');
    applyRecovery(await gameSync.recoverPlayer(initialPin || undefined));
    setRecovering(false);
  };
  useEffect(() => { if (!completedRef.current) void recover(); else setRecovering(false); return () => gameSync.cancelPlayerRecovery(); }, []);

  const leave = async (goHome = false) => {
    if (leaving) return;
    setLeaving(true);
    await gameSync.leavePlayer(isJoined ? pin : initialPin || undefined, isJoined ? playerId : undefined);
    setIsJoined(false); setSession(null); setSelectedOptionId(null); ownAnswerRef.current = undefined; activeRoundRef.current = '';
    setPlayerId(newPlayerId()); setNickname(''); setAvatar('🦊'); setRecoveryProblem(''); setCanRetry(false); setStorageWarning('');
    updatePublicUrl();
    setJoinError(''); setLeaving(false);
    if (goHome) onExit?.();
  };
  const leaveControl = <div className="py-2 text-center"><button type="button" onClick={() => void leave()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-petrolio">Abbandona partita</button>
    {storageWarning && <p role="status" className="mt-2 text-sm text-muted">{storageWarning}</p>}</div>;

  // Subscribe to room updates
  useEffect(() => {
    if (!isJoined || !pin || completed) return;

    // Register on the server
    gameSync.register(pin, 'player', playerId);

    const unsubscribe = gameSync.subscribe((msg) => {
      if (completedRef.current) return;
      if (msg.type === 'PLAYER_SESSION_ENDED' && msg.pin === pin) {
        setIsJoined(false); setSession(null); setRecoveryProblem(msg.message); setCanRetry(false);
        return;
      }
      if (msg.type === 'SESSION_STATE_UPDATE' && msg.session.pin === pin) {
        if (msg.session.status === 'finished') { complete(msg.session, playerId); return; }
        activeRoundRef.current = msg.session.roundId || String(msg.session.questionStartTime);
        ownAnswerRef.current = msg.ownAnswer ? { roundId: msg.session.roundId, optionId: msg.ownAnswer.optionId } : undefined;
        setSession(msg.session);
        if (msg.ownAnswer && msg.ownAnswer.questionId === msg.session.currentQuestion?.id) {
          setSelectedOptionId(msg.ownAnswer.optionId);
          setAnswerSubmittedAt(Date.now());
        }
      }
    });

    // Subscribe first so an accepted-answer receipt is restored before choices are shown.
    void gameSync.fetchSessionFromServer(pin, true);

    return () => {
      unsubscribe();
      gameSync.unregister(pin);
    };
  }, [isJoined, pin, playerId, completed]);

  // When session question changes, reset selected option
  useEffect(() => {
    const restored = ownAnswerRef.current?.roundId === session?.roundId ? ownAnswerRef.current : undefined;
    setSelectedOptionId(restored?.optionId || null);
    setAnswerSubmittedAt(restored ? Date.now() : null);
    setAnswerError('');
  }, [session?.roundId, session?.questionStartTime]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoining || !pin.trim() || !nickname.trim()) return;

    setIsJoining(true);
    setJoinError('');

    const formattedPin = pin.trim();
    const cleanNick = nickname.trim();

    // A different typed PIN may also have a saved identity. Never replace it with a fresh join.
    const recovery = await gameSync.recoverPlayer(formattedPin);
    if (recovery.status !== 'none') { applyRecovery(recovery); setIsJoining(false); return; }

    const newPlayer: Player = {
      id: playerId,
      nickname: cleanNick,
      name: cleanNick,
      avatar,
      score: 0,
      streak: 0,
      correctAnswersCount: 0,
      totalTimeTakenMs: 0,
      joinedAt: Date.now(),
      connected: true,
    };

    // Join first: only the returned player credential can authenticate a connection.
    const joined = await gameSync.joinSessionOnServer(formattedPin, newPlayer);

    setIsJoining(false);
    if (!joined) {
      setJoinError('Partita non trovata o server non raggiungibile. Controlla il PIN e riprova.');
      return;
    }
    setStorageWarning(gameSync.canRecoverPlayer(formattedPin, playerId) ? '' : 'Questo browser non consente di conservare la credenziale: mantieni aperta la pagina per non perdere l’identità.');
    const joinedSession = await gameSync.fetchSessionFromServer(formattedPin);
    if (joinedSession) {
      activeRoundRef.current = joinedSession.roundId || String(joinedSession.questionStartTime);
      setSession(joinedSession);
    }
    setIsJoined(true);
    updatePublicUrl(formattedPin);
    sounds.playSelect();

    // Vibrate device briefly for tactile confirmation
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  };

  const handleSelectOption = async (optionId: string) => {
    if (selectedOptionId !== null || submittingRef.current || !session?.currentQuestion) return;
    const round = session.roundId || String(session.questionStartTime);
    // Retained for protocol diagnostics only; the server measures the scoring time itself.
    const timeTakenMs = Math.max(0, Date.now() - session.questionStartTime);
    submittingRef.current = true;
    setIsSubmitting(true);
    setAnswerError('');
    const received = await gameSync.submitAnswerOnServer(pin, playerId, optionId, timeTakenMs, session.currentQuestion.id, session.roundId);
    submittingRef.current = false;
    setIsSubmitting(false);
    if (activeRoundRef.current !== round) return;
    if (!received) {
      setAnswerError('Risposta non ricevuta. Controlla la connessione e riprova prima che scada il tempo.');
      return;
    }
    setSelectedOptionId(optionId);
    setAnswerSubmittedAt(Date.now());
    sounds.playSelect();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
  };

  const myPlayer = session?.players ? session.players[playerId] : null;
  const currentQIndex = session?.currentQuestionIndex ?? 0;
  const isQuestionActive = session?.status === 'question';
  const isResults = session?.status === 'question_results';
  const isLeaderboard = session?.status === 'leaderboard';
  const isFinished = session?.status === 'finished';

  if (completed) return <PlayerFinalResult result={completed} onClose={() => { clearFinalResult(completed.pin); void gameSync.leavePlayer(completed.pin, completed.playerId); }} />;

  if (recovering || recoveryProblem || leaving) return <main className="min-h-screen bg-qurioso-canvas p-6 flex flex-col items-center justify-center gap-4 text-center text-petrolio">
    <QuriosoIcon size={44} />
    <p role="status">{leaving ? 'Uscita dalla partita in corso…' : recovering ? 'Recupero della partecipazione in corso…' : recoveryProblem}</p>
    {!recovering && !leaving && <div className="flex flex-wrap justify-center gap-3">
      {canRetry && <button type="button" className="btn-petrolio rounded-xl px-5 py-3" onClick={() => void recover()}>Riprova recupero</button>}
      <button type="button" className="btn-mandarino rounded-xl px-5 py-3" onClick={() => void leave()}>Torna all’ingresso</button>
    </div>}
  </main>;
  if (isJoined && !session) return <main className="min-h-screen bg-qurioso-canvas p-6 flex flex-col items-center justify-center text-petrolio">
    <p role="status">Sincronizzazione della partita in corso…</p>{leaveControl}
  </main>;

  // 1. JOIN FORM VIEW
  if (!isJoined) {
    return (
      <div className="player-join-screen min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-4 md:p-6 select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <QuriosoIcon size={34} variant="contained" />
            <span className="font-black text-lg tracking-tight text-ink">Qurioso</span>
          </div>
          {onExit && (
            <button
              onClick={() => void leave(true)}
              className="px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line cursor-pointer"
            >
              {t.cancelAndReturn || 'Esci'}
            </button>
          )}
        </div>

        {/* Center Card */}
        <div className="w-full max-w-sm mx-auto my-auto">
          <div className="bg-white border-2 border-line rounded-3xl p-6 md:p-8 shadow-lg backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-line mx-auto flex items-center justify-center mb-3 shadow-lg">
                <Smartphone className="w-7 h-7 text-accent-ink" />
              </div>
              <h2 className="text-2xl font-black text-ink tracking-tight">Partecipa al Quiz</h2>
              <p className="text-xs text-muted mt-1">
                Inserisci il codice PIN proiettato sullo schermo
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Codice PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="es. 123456"
                  required
                  className="w-full px-4 py-3 bg-surface-soft border-2 border-line focus:border-mandarino rounded-2xl text-center font-mono font-black text-2xl text-ink tracking-widest placeholder:text-muted focus:outline-none transition shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  Il tuo Nickname
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nome o soprannome..."
                  required
                  className="w-full px-4 py-3 bg-surface-soft border-2 border-line focus:border-mandarino rounded-2xl font-bold text-center text-ink placeholder:text-muted focus:outline-none transition shadow-inner"
                />
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2 text-center">
                  Scegli il tuo Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setAvatar(em)}
                      className={`p-2 rounded-xl text-xl transition active:scale-90 flex items-center justify-center cursor-pointer ${
                        avatar === em
                          ? 'bg-mandarino/25 border-2 border-mandarino scale-105 shadow-md shadow-mandarino/20'
                          : 'bg-white border border-line hover:bg-surface-hover'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {joinError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-600 text-rose-700 text-xs text-center">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-4 rounded-2xl btn-mandarino font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-md shadow-mandarino/25 transition cursor-pointer active:scale-95"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>{isJoining ? 'Connessione...' : 'Entra nel Quiz!'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center py-2 text-[11px] text-muted">
          Qurioso • Connessione HTTP/WebSocket Diretta
        </div>
      </div>
    );
  }

  // 2. LOBBY WAITING VIEW
  if (session?.status === 'lobby') {
    return (
      <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-6 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QuriosoIcon size={34} variant="contained" />
            <span className="font-extrabold text-sm text-ink">{session.quizTitle}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-soft border border-line text-xs font-bold text-petrolio">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Connesso</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center my-auto">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-3xl bg-surface-soft border-2 border-mandarino flex items-center justify-center text-6xl shadow-lg shadow-mandarino/20 animate-bounce">
              {avatar}
            </div>
            <div className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full bg-mandarino text-ink text-[11px] font-black uppercase tracking-wider shadow-md">
              Pronto!
            </div>
          </div>

          <h2 className="text-3xl font-black text-ink mb-2">{nickname}</h2>
          <div className="inline-block px-4 py-1.5 rounded-full bg-petrolio/40 border border-line text-petrolio text-xs font-bold mb-4">
            Stanza PIN: {pin}
          </div>

          <div className="p-4 rounded-2xl bg-white border border-line max-w-xs text-xs text-muted leading-relaxed">
            Sei nella lobby di gioco! Guarda lo schermo del presentatore: il quiz inizierà tra poco.
          </div>
        </div>

        <div className="text-center text-[11px] text-muted">
          Rimani su questa schermata per rispondere alle domande
          {leaveControl}
        </div>
      </div>
    );
  }

  // 3. COUNTDOWN VIEW
  if (session?.status === 'countdown') {
    return (
      <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col items-center justify-center p-6 text-center select-none">
        <span className="text-xs uppercase font-black tracking-widest text-accent-ink mb-4">
          Teniti pronto!
        </span>
        <div className="w-32 h-32 rounded-full bg-surface-soft border-4 border-mandarino flex items-center justify-center text-ink text-5xl font-black shadow-lg animate-pulse">
          ⚡
        </div>
        <p className="text-sm font-bold text-ink mt-6">La domanda sta arrivando sul tuo telefono...</p>
        {leaveControl}
      </div>
    );
  }

  if (session?.status === 'video') {
    return <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col items-center justify-center p-6 text-center">
      <span className="text-4xl mb-4">🎬</span>
      <h2 className="text-2xl font-black text-petrolio">Guarda il video sullo schermo del docente</h2>
      <p role="status" className="mt-4 text-muted">La prossima domanda apparirà qui. Non chiudere questa pagina.</p>
      <p className="mt-6 font-bold">{nickname} · {myPlayer?.score ?? 0} pt</p>
      {leaveControl}
    </div>;
  }

  // 4. ACTIVE QUESTION VIEW (4 Touch Buttons)
  if (isQuestionActive) {
    return (
      <div className="player-question-screen min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-4 md:p-6 select-none">
        {/* Top status */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">{avatar}</span>
            <span className="font-bold text-sm text-ink truncate max-w-[35vw]">{nickname}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-bold text-muted">
              <span>Domanda {currentQIndex + 1}</span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-surface-soft border border-line font-mono font-black text-sm text-accent-ink">
              {myPlayer?.score ?? 0} pt
            </div>
          </div>
        </div>

        {/* Center state: Prompt or Waiting confirmation */}
        {selectedOptionId !== null ? (
          <div className="player-answer-confirmation my-auto flex flex-col items-center justify-center text-center p-6 bg-white border-2 border-line rounded-3xl shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-petrolio border-2 border-mandarino flex items-center justify-center mb-4 shadow-lg animate-pulse">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black text-ink mb-2">Risposta Inviata!</h3>
            <p className="player-confirmation-detail text-xs text-muted max-w-xs">
              Hai risposto con successo. Attendi che scada il tempo sullo schermo principale per scoprire se è corretta!
            </p>
          </div>
        ) : (
          <div className="player-question-choices my-auto flex flex-col gap-3 py-2 w-full mx-auto">
            <div className="player-question-prompt text-center mb-2">
              <p className="player-look-at-teacher hidden text-sm font-bold text-petrolio">{gameText.lookAtTeacher}</p>
              <span className="player-question-text block text-sm font-bold [overflow-wrap:anywhere] text-accent-ink">
                {session.currentQuestion?.text || 'Scegli la risposta:'}
              </span>
            </div>

            {answerError && <p role="alert" className="text-sm text-rose-700">{answerError}</p>}
            {isSubmitting && <p role="status" className="text-sm text-petrolio">Invio della risposta…</p>}
            <div data-answer-count={session.currentQuestion?.options.length} className="player-answer-grid grid grid-cols-2 gap-3 w-full">
              {session.currentQuestion?.options.map((option, idx) => {
                const colorStyle = OPTION_COLORS[option.color];
                const shapeSymbol = SHAPE_ICONS[option.shape];

                return (
                  <button
                    key={option.id}
                    aria-label={`${gameText.answer} ${String.fromCharCode(65 + idx)}: ${option.text}`}
                    disabled={isSubmitting}
                    onClick={() => handleSelectOption(option.id)}
                    className={`player-answer min-w-0 min-h-0 p-3 rounded-2xl border-2 grid items-center justify-items-center gap-2 transition-transform active:scale-95 shadow-md cursor-pointer ${colorStyle.bg} ${colorStyle.border}`}
                  >
                    <div aria-hidden="true" className="player-answer-heading flex items-center justify-center gap-2"><div className={`player-answer-symbol w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-3xl font-black ${colorStyle.badge}`}>
                      {shapeSymbol}
                    </div>
                    <span aria-hidden="true" className="player-answer-letter hidden font-black text-xl">{String.fromCharCode(65 + idx)}</span></div>
                    <FitAnswerText text={option.text} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="player-question-footer pt-2 text-center text-[11px] text-muted">
          <span>Qurioso Live Multi-device</span>
          {leaveControl}
        </div>
      </div>
    );
  }

  // 5. RESULTS & LEADERBOARD VIEW
  if (isResults || isLeaderboard) {
    const isCorrect = myPlayer?.lastAnswer?.questionId === session?.currentQuestion?.id && myPlayer?.lastAnswer?.isCorrect;

    return (
      <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-6 select-none">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <span className="font-extrabold text-sm text-ink">Qurioso</span>
          <span className="font-mono font-black text-sm text-accent-ink">
            {myPlayer?.score ?? 0} pt
          </span>
        </div>

        <div className="my-auto flex flex-col items-center justify-center text-center">
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg border-4 ${
              isCorrect
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : 'bg-rose-50 border-rose-500 text-rose-700'
            }`}
          >
            {isCorrect ? '🎉' : '💡'}
          </div>

          <h2 className="text-3xl font-black text-ink mb-2">
            {isCorrect ? 'Risposta Esatta!' : 'Ops, Non Esatta!'}
          </h2>

          {session?.questionResult && <div className="max-w-sm text-sm text-petrolio mt-3" role="status">
            <p>Risposta corretta: {session.currentQuestion?.options.filter(o => session.questionResult!.correctOptionIds.includes(o.id)).map(o => o.text).join(', ')}</p>
            {session.questionResult.explanation && <p className="mt-2">{session.questionResult.explanation}</p>}
          </div>}

          {isCorrect && myPlayer?.streak && myPlayer.streak > 1 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mandarino/20 border border-mandarino/40 text-accent-ink text-xs font-bold mb-4">
              <Flame className="w-4 h-4 fill-mandarino" />
              <span>Serie attiva: {myPlayer.streak} di fila!</span>
            </div>
          ) : null}

          <div className="p-4 rounded-2xl bg-white border border-line max-w-xs text-xs text-muted mt-2">
            Guarda la classifica sullo schermo del presentatore!
          </div>
        </div>

        <div className="text-center text-[11px] text-muted">
          In attesa della prossima domanda...
          {leaveControl}
        </div>
      </div>
    );
  }

  if (isFinished && session) return <PlayerFinalResult result={finalResult(session, playerId)} onClose={() => { clearFinalResult(pin); void gameSync.leavePlayer(pin, playerId); }} />;
  return <main role="status" className="min-h-screen p-6 text-center text-petrolio">Qurioso</main>;
};
