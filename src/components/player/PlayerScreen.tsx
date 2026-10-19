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
import { gameSync } from '../../services/gameSync';
import { sounds } from '../../services/soundEffects';
import { OPTION_COLORS, SHAPE_ICONS, COLOR_KEYS, SHAPE_KEYS } from '../../utils/quizStyles';
import { useLanguage } from '../../context/LanguageContext';
import { QuriosoIcon, BRAND_COLORS } from '../common/QuriosoLogo';

const AVATAR_OPTIONS = ['🦁', '🦊', '⚡', '🚀', '🌟', '🎨', '🐺', '🎮', '🦄', '🐼', '🍕', '🎯'];

interface PlayerScreenProps {
  initialPin?: string;
  onExit?: () => void;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ initialPin = '', onExit }) => {
  const { t } = useLanguage();
  const [pin, setPin] = useState<string>(initialPin);
  const [nickname, setNickname] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('🦊');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>('');
  const [playerId] = useState<string>(() => `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

  // Synchronized session state
  const [session, setSession] = useState<GameSession | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const submittingRef = useRef(false);
  const activeRoundRef = useRef(0);
  const [answerSubmittedAt, setAnswerSubmittedAt] = useState<number | null>(null);

  // Subscribe to room updates
  useEffect(() => {
    if (!isJoined || !pin) return;

    // Register on the server
    gameSync.register(pin, 'player', playerId);

    // Initial fetch from server
    gameSync.fetchSessionFromServer(pin).then((serverSession) => {
      if (serverSession) {
        setSession(serverSession);
      }
    });

    const unsubscribe = gameSync.subscribe((msg) => {
      if (msg.type === 'SESSION_STATE_UPDATE' && msg.session.pin === pin) {
        activeRoundRef.current = msg.session.questionStartTime;
        setSession(msg.session);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isJoined, pin, playerId]);

  // When session question changes, reset selected option
  useEffect(() => {
    setSelectedOptionId(null);
    setAnswerSubmittedAt(null);
    setAnswerError('');
  }, [session?.questionStartTime]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;

    setIsJoining(true);
    setJoinError('');

    const formattedPin = pin.trim();
    const cleanNick = nickname.trim();

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

    // Register with server & send join
    gameSync.register(formattedPin, 'player', playerId);
    const joined = await gameSync.joinSessionOnServer(formattedPin, newPlayer);

    setIsJoining(false);
    if (!joined) {
      setJoinError('Partita non trovata o server non raggiungibile. Controlla il PIN e riprova.');
      return;
    }
    const joinedSession = await gameSync.fetchSessionFromServer(formattedPin);
    if (joinedSession) {
      activeRoundRef.current = joinedSession.questionStartTime;
      setSession(joinedSession);
    }
    setIsJoined(true);
    sounds.playSelect();

    // Vibrate device briefly for tactile confirmation
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  };

  const handleSelectOption = async (optionId: string) => {
    if (selectedOptionId !== null || submittingRef.current || !session?.currentQuestion) return;
    const round = session.questionStartTime;
    const timeTakenMs = Math.max(0, Date.now() - round);
    submittingRef.current = true;
    setIsSubmitting(true);
    setAnswerError('');
    const received = await gameSync.submitAnswerOnServer(pin, playerId, optionId, timeTakenMs, session.currentQuestion.id);
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

  // 1. JOIN FORM VIEW
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-4 md:p-6 select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <QuriosoIcon size={34} variant="contained" />
            <span className="font-black text-lg tracking-tight text-ink">Qurioso</span>
          </div>
          {onExit && (
            <button
              onClick={onExit}
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
      </div>
    );
  }

  // 4. ACTIVE QUESTION VIEW (4 Touch Buttons)
  if (isQuestionActive) {
    return (
      <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col justify-between p-4 md:p-6 select-none">
        {/* Top status */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{avatar}</span>
            <span className="font-bold text-sm text-ink">{nickname}</span>
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
          <div className="my-auto flex flex-col items-center justify-center text-center p-6 bg-white border-2 border-line rounded-3xl shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-petrolio border-2 border-mandarino flex items-center justify-center mb-4 shadow-lg animate-pulse">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black text-ink mb-2">Risposta Inviata!</h3>
            <p className="text-xs text-muted max-w-xs">
              Hai risposto con successo. Attendi che scada il tempo sullo schermo principale per scoprire se è corretta!
            </p>
          </div>
        ) : (
          <div className="my-auto flex flex-col gap-3 py-2 w-full max-w-md mx-auto">
            <div className="text-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-ink">
                {session.currentQuestion?.text || 'Scegli la risposta:'}
              </span>
            </div>

            {answerError && <p role="alert" className="text-sm text-rose-700">{answerError}</p>}
            {isSubmitting && <p role="status" className="text-sm text-petrolio">Invio della risposta…</p>}
            <div className="grid grid-cols-2 gap-3 w-full">
              {session.currentQuestion?.options.map((option, idx) => {
                const colorStyle = OPTION_COLORS[option.color];
                const shapeSymbol = SHAPE_ICONS[option.shape];

                return (
                  <button
                    key={option.id}
                    disabled={isSubmitting}
                    onClick={() => handleSelectOption(option.id)}
                    className={`h-36 sm:h-44 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-transform active:scale-95 shadow-md cursor-pointer ${colorStyle.bg} ${colorStyle.border}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner text-3xl font-black ${colorStyle.badge}`}>
                      {shapeSymbol}
                    </div>
                    <span className="font-mono font-black text-sm uppercase tracking-wider text-ink">
                      {option.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="pt-2 text-center text-[11px] text-muted">
          Qurioso Live Multi-device
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
        </div>
      </div>
    );
  }

  // 6. FINISHED VIEW
  return (
    <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-24 h-24 rounded-3xl bg-surface-soft border-2 border-mandarino flex items-center justify-center text-5xl mb-4 shadow-lg">
        🏆
      </div>
      <h2 className="text-3xl font-black text-ink mb-2">Quiz Completato!</h2>
      <p className="text-sm text-muted mb-6">Grazie per aver partecipato!</p>

      <div className="bg-white border-2 border-line p-6 rounded-2xl w-full max-w-xs mb-6">
        <div className="text-xs uppercase text-muted font-bold">Punteggio Finale</div>
        <div className="text-4xl font-mono font-black text-accent-ink mt-1">
          {myPlayer?.score ?? 0} pt
        </div>
      </div>

      {onExit && (
        <button
          onClick={onExit}
          className="btn-mandarino px-8 py-3 rounded-2xl font-bold text-sm cursor-pointer shadow-lg"
        >
          Torna alla Home
        </button>
      )}
    </div>
  );
};
