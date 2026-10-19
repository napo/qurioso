import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Play,
  SkipForward,
  RotateCcw,
  Trophy,
  ArrowRight,
  Sparkles,
  Bot,
  ExternalLink,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
  QrCode,
  Radio,
  Wifi,
  Smartphone
} from 'lucide-react';
import { Quiz, GameSession, Player, Question } from '../../types/quiz';
import { gameSync, BOT_PLAYERS, generateBotAnswer, ServerInfo } from '../../services/gameSync';
import { sounds } from '../../services/soundEffects';
import { OPTION_COLORS, SHAPE_ICONS, COLOR_KEYS, SHAPE_KEYS } from '../../utils/quizStyles';
import { QRCodeDisplay } from '../common/QRCodeDisplay';
import { FinalPodium } from '../leaderboard/FinalPodium';
import { applyPlayerAnswer, publicQuestion } from '../../services/sessionState';
import { ImageCredit } from '../common/ImageCredit';
import { useLanguage } from '../../context/LanguageContext';
import { QuriosoIcon, BRAND_COLORS } from '../common/QuriosoLogo';

interface HostScreenProps {
  quiz: Quiz;
  onExit: () => void;
}

export const HostScreen: React.FC<HostScreenProps> = ({ quiz, onExit }) => {
  const { t } = useLanguage();
  // Session initialization
  const [pin] = useState<string>(() => gameSync.generatePin());
  const [status, setStatus] = useState<GameSession['status']>('lobby');
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(20);
  const [currentAnswers, setCurrentAnswers] = useState<GameSession['answersForCurrentQuestion']>({});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  const currentQuestion: Question | undefined = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;

  // Event callbacks always read the current snapshot, independent of React renders.
  const sessionRef = useRef<GameSession>({
    pin, quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'lobby',
    currentQuestionIndex: 0, questionStartTime: 0, timeRemaining: 20,
    players: {}, answersForCurrentQuestion: {}, totalQuestions,
  });
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastCurrentSession = (updatedPartial: Partial<GameSession> = {}) => {
    const next = { ...sessionRef.current, ...updatedPartial };
    sessionRef.current = next;
    setStatus(next.status);
    setPlayers(next.players);
    setCurrentQuestionIndex(next.currentQuestionIndex);
    setQuestionStartTime(next.questionStartTime);
    setCurrentAnswers(next.answersForCurrentQuestion);
    gameSync.createSessionOnServer(next);
  };

  // Fetch server info
  useEffect(() => {
    gameSync.getServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });
  }, []);

  // Register session with backend and subscribe to incoming player events
  useEffect(() => {
    // Register on server
    gameSync.register(pin, 'host');
    broadcastCurrentSession({ status: 'lobby' });

    const unsubscribe = gameSync.subscribe((msg) => {
      if (msg.type === 'PLAYER_JOIN' && msg.pin === pin) {
        if (!sessionRef.current.players[msg.player.id]) {
          broadcastCurrentSession({ players: { ...sessionRef.current.players, [msg.player.id]: msg.player } });
          sounds.playSelect();
        }
      }
      if (msg.type === 'PLAYER_ANSWER' && msg.pin === pin) {
        handlePlayerAnswerReceived(msg.playerId, msg.optionId, msg.timeTakenMs, msg.questionId);
      }
      // Polling recovers joins/answers when the presenter's WebSocket is unavailable.
      if (msg.type === 'SESSION_STATE_UPDATE' && msg.session.pin === pin) {
        const remote = msg.session;
        const missing = Object.fromEntries(Object.entries(remote.players).filter(([id]) => !sessionRef.current.players[id]));
        if (Object.keys(missing).length) {
          broadcastCurrentSession({ players: { ...sessionRef.current.players, ...missing } });
        }
        if (remote.questionStartTime === sessionRef.current.questionStartTime) {
          for (const [id, answer] of Object.entries(remote.answersForCurrentQuestion)) {
            if (answer.isCorrect === undefined) {
              handlePlayerAnswerReceived(id, answer.optionId, answer.timeTakenMs, answer.questionId);
            }
          }
        }
      }

      if (msg.type === 'REQUEST_SESSION_SYNC' && msg.pin === pin) {
        broadcastCurrentSession();
      }
    });

    return () => {
      unsubscribe();
      if (countdownRef.current) clearInterval(countdownRef.current);
      gameSync.removeSession(pin);
    };
  }, [pin]);

  const handlePlayerAnswerReceived = (playerId: string, optionId: string, timeTakenMs: number, questionId?: string) => {
    const current = sessionRef.current;
    const next = applyPlayerAnswer(current, quiz, {
      playerId, optionId, timeTakenMs,
      questionId: questionId || quiz.questions[current.currentQuestionIndex]?.id,
    });
    if (next === current) return;
    sounds.playSelect();
    broadcastCurrentSession(next);
  };

  // Launch Countdown
  const handleStartCountdown = () => {
    sounds.playCountdown();
    setStatus('countdown');
    setCountdownNum(3);
    broadcastCurrentSession({ status: 'countdown' });

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
        sounds.playCountdown();
      } else {
        clearInterval(interval);
        handleStartQuestion(0);
      }
    }, 1000);
    countdownRef.current = interval;
  };

  // Start question
  const handleStartQuestion = (qIndex: number) => {
    const targetQ = quiz.questions[qIndex];
    if (!targetQ) return;

    setCurrentQuestionIndex(qIndex);
    setStatus('question');
    setCurrentAnswers({});
    const now = Date.now();
    setQuestionStartTime(now);
    setTimeRemaining(targetQ.timeLimit);

    sounds.playSelect();

    broadcastCurrentSession({
      status: 'question',
      currentQuestionIndex: qIndex,
      currentQuestion: publicQuestion(quiz, qIndex),
      questionStartTime: now,
      timeRemaining: targetQ.timeLimit,
      answersForCurrentQuestion: {},
    });
  };

  // Timer loop during question
  useEffect(() => {
    if (status !== 'question' || !currentQuestion) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, currentQuestion.timeLimit - Math.floor((Date.now() - sessionRef.current.questionStartTime) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        sounds.playTimesUp();
        handleShowQuestionResults();
      } else if (remaining <= 5) {
        sounds.playTick();
      }
    }, 250);

    return () => clearInterval(timer);
  }, [status, currentQuestionIndex]);

  // Show question results
  const handleShowQuestionResults = () => {
    setStatus('question_results');
    sounds.playCorrect();
    broadcastCurrentSession({ status: 'question_results' });
  };

  // Show leaderboard
  const handleShowLeaderboard = () => {
    setStatus('leaderboard');
    broadcastCurrentSession({ status: 'leaderboard' });
  };

  // Next question or finish
  const handleNextStep = () => {
    if (currentQuestionIndex + 1 < totalQuestions) {
      handleStartQuestion(currentQuestionIndex + 1);
    } else {
      handleFinishQuiz();
    }
  };

  // Finish quiz
  const handleFinishQuiz = () => {
    setStatus('finished');
    broadcastCurrentSession({ status: 'finished' });
  };

  // Add sample bot players for fast live testing
  const handleAddBot = () => {
    const existingCount = Object.keys(players).length;
    const botTemplate = BOT_PLAYERS[existingCount % BOT_PLAYERS.length];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBot: Player = {
      id: botId,
      name: `${botTemplate.name}`,
      nickname: `${botTemplate.name}`,
      avatar: botTemplate.avatar,
      score: 0,
      streak: 0,
      isBot: true,
      connectedAt: Date.now(),
    };

    sounds.playSelect();
    broadcastCurrentSession({ players: { ...sessionRef.current.players, [botId]: newBot } });
  };

  // Automatically answer for bots when a question starts
  useEffect(() => {
    if (status !== 'question' || !currentQuestion) return;

    const botList = Object.values(players).filter((p) => p.isBot);
    const timeouts: any[] = [];

    botList.forEach((bot) => {
      const delay = Math.floor(1500 + Math.random() * ((currentQuestion.timeLimit - 2) * 1000));
      const t = setTimeout(() => {
        const { optionId, timeTakenMs } = generateBotAnswer(currentQuestion, bot);
        handlePlayerAnswerReceived(bot.id, optionId, timeTakenMs);
      }, delay);
      timeouts.push(t);
    });

    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [status, currentQuestionIndex]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const playerCount = Object.keys(players).length;
  const answersCount = Object.keys(currentAnswers).length;

  useEffect(() => {
    if (status === 'question' && playerCount > 0 && answersCount === playerCount) {
      handleShowQuestionResults();
    }
  }, [status, playerCount, answersCount]);

  return (
    <div className="min-h-screen bg-qurioso-canvas text-ink flex flex-col select-none">
      {/* Top Host Bar */}
      <header className="px-6 py-3.5 bg-white backdrop-blur-md border-b border-line flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <QuriosoIcon size={38} variant="contained" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm md:text-base text-ink tracking-tight">
                {quiz.title}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-surface-soft text-petrolio border border-line">
                {status === 'lobby' ? 'Lobby' : `${currentQuestionIndex + 1} / ${totalQuestions}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-accent-ink" />
                <span className="font-bold text-ink">{playerCount}</span> {t.connectedParticipants || 'Partecipanti'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-700 font-medium">Server HTTP/WS Attivo</span>
              </span>
            </div>
          </div>
        </div>

        {/* PIN Banner & Action controls */}
        <div className="flex items-center gap-3">
          <div className="bg-surface-soft px-4 py-1.5 rounded-xl border-2 border-mandarino flex items-center gap-2.5 shadow-lg shadow-mandarino/10">
            <span className="text-[11px] font-bold uppercase text-muted tracking-wider">PIN:</span>
            <span className="font-mono font-black text-xl md:text-2xl text-ink tracking-widest">{pin}</span>
          </div>

          <button
            onClick={() => setShowQRModal(true)}
            className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink border border-line transition cursor-pointer"
            title="Mostra QR Code Ingrandito"
          >
            <QrCode className="w-4 h-4 text-accent-ink" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink border border-line transition cursor-pointer"
            title={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onExit}
            className="px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted transition cursor-pointer border border-line"
          >
            {t.exit || 'Esci'}
          </button>
        </div>
      </header>

      {/* Main Stage View */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
        {/* LOBBY VIEW */}
        {status === 'lobby' && (
          <div className="w-full max-w-6xl flex flex-col items-center">
            {/* Lobby Banner Card */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border-2 border-line rounded-3xl p-6 md:p-10 shadow-lg backdrop-blur-xl relative overflow-hidden mb-8">
              {/* Background ambient glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-petrolio/25 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-mandarino/15 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

              {/* Instructions and Big PIN */}
              <div className="lg:col-span-7 flex flex-col gap-5 z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-petrolio/40 border border-line text-petrolio text-xs font-bold w-fit">
                  <Smartphone className="w-4 h-4 text-accent-ink" />
                  <span>Connessione Diretta Smartphone via Server HTTP</span>
                </div>

                <h2 className="text-3xl md:text-5xl font-black text-ink tracking-tight leading-tight">
                  Entra nel quiz con il tuo telefono!
                </h2>

                <p className="text-sm md:text-base text-muted max-w-xl">
                  Inquadra il <strong className="text-ink">QR Code</strong> con la fotocamera del tuo smartphone oppure apri il browser e digita il codice PIN:
                </p>

                {/* PIN Showcase */}
                <div className="bg-surface-soft border-2 border-mandarino p-4 md:p-6 rounded-2xl flex items-center justify-between gap-4 max-w-md shadow-md shadow-mandarino/15">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-widest text-muted block">
                      Codice Gioco PIN
                    </span>
                    <span className="text-4xl md:text-5xl font-mono font-black text-ink tracking-widest text-shadow">
                      {pin}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-muted">Giocatori collegati:</span>
                    <span className="text-3xl font-black text-accent-ink">{playerCount}</span>
                  </div>
                </div>

                {/* Host Controls */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleStartCountdown}
                    disabled={playerCount === 0}
                    className={`btn-mandarino px-8 py-3.5 rounded-2xl font-black text-base flex items-center gap-2.5 shadow-md transition cursor-pointer ${
                      playerCount === 0 ? 'opacity-50 cursor-not-allowed saturate-50' : 'hover:scale-105 active:scale-95'
                    }`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Inizia il Quiz!</span>
                  </button>

                  <button
                    onClick={handleAddBot}
                    className="btn-petrolio px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                    title="Aggiungi partecipanti simulati per testare subito l'esperienza"
                  >
                    <Bot className="w-4 h-4 text-accent-ink" />
                    <span>+ Aggiungi Bot di Test</span>
                  </button>
                </div>
              </div>

              {/* QR Code Presentation */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center z-10">
                <QRCodeDisplay pin={pin} size={230} showDetails={true} />
              </div>
            </div>

            {/* Players Lobby Wall */}
            <div className="w-full bg-white border border-line rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-ink" />
                  <h3 className="font-bold text-ink text-base">
                    Partecipanti nella Lobby ({playerCount})
                  </h3>
                </div>
                {playerCount === 0 && (
                  <span className="text-xs text-muted animate-pulse">
                    In attesa che i partecipanti inquadrino il QR Code...
                  </span>
                )}
              </div>

              {playerCount === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                  <div className="w-16 h-16 rounded-2xl bg-surface-soft border border-line flex items-center justify-center mb-3">
                    <Smartphone className="w-8 h-8 text-accent-ink animate-bounce" />
                  </div>
                  <p className="font-semibold text-ink">Nessun giocatore ancora connesso</p>
                  <p className="text-xs text-muted mt-1 max-w-sm">
                    Prendi il tuo telefono, inquadra il QR Code in alto e inserisci il tuo nome per entrare nella stanza in tempo reale!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.values(players).map((player) => (
                    <div
                      key={player.id}
                      className="bg-surface-soft hover:bg-surface-hover border border-line p-3 rounded-xl flex items-center gap-2.5 transition transform hover:-translate-y-0.5 shadow-md"
                    >
                      <span className="text-2xl">{player.avatar}</span>
                      <span className="font-bold text-xs text-ink truncate">{player.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COUNTDOWN VIEW */}
        {status === 'countdown' && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <span className="text-sm font-black uppercase tracking-widest text-accent-ink mb-4">
              Preparati! Il quiz sta per iniziare...
            </span>
            <div className="w-48 h-48 rounded-full bg-petrolio/30 border-4 border-mandarino flex items-center justify-center shadow-lg shadow-mandarino/30 animate-pulse">
              <span className="font-mono font-black text-8xl text-ink">
                {countdownNum}
              </span>
            </div>
          </div>
        )}

        {/* ACTIVE QUESTION VIEW */}
        {status === 'question' && currentQuestion && (
          <div className="w-full max-w-5xl flex flex-col gap-6">
            {/* Question Header & Clock */}
            <div className="bg-white border border-line rounded-3xl p-6 md:p-8 shadow-lg backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <span className="text-xs uppercase font-extrabold text-accent-ink tracking-wider mb-2 block">
                  Domanda {currentQuestionIndex + 1} di {totalQuestions}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-ink leading-snug">
                  {currentQuestion.text}
                </h2>
              </div>

              {/* Giant Countdown Clock */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-24 h-24 rounded-2xl border-4 flex flex-col items-center justify-center transition-all shadow-md ${
                    timeRemaining <= 5
                      ? 'border-rose-500 bg-rose-50 text-rose-700 animate-pulse'
                      : 'border-mandarino bg-surface-soft text-ink'
                  }`}
                >
                  <span className="font-mono font-black text-4xl">{timeRemaining}</span>
                  <span className="text-[10px] uppercase font-bold text-muted">sec</span>
                </div>
                <div className="mt-2 text-xs text-muted font-semibold">
                  Risposte: <strong className="text-ink">{answersCount}</strong> / {playerCount}
                </div>
              </div>
            </div>

            {currentQuestion.mediaUrl && (
              <figure className="space-y-2">
                <div className="w-full max-h-64 rounded-2xl overflow-hidden border border-line shadow-lg flex items-center justify-center bg-white">
                  <img src={currentQuestion.mediaUrl} alt="Immagine della domanda" className="max-h-64 w-auto object-contain" />
                </div>
                <figcaption><ImageCredit attribution={currentQuestion.mediaAttribution} /></figcaption>
              </figure>
            )}

            {/* 4 Interactive Answer Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((option, idx) => {
                const colorKey = option.color;
                const colorStyle = OPTION_COLORS[colorKey];
                const shapeKey = option.shape;
                const shapeSymbol = SHAPE_ICONS[shapeKey];

                return (
                  <div
                    key={option.id}
                    className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition shadow-lg ${colorStyle.border} ${colorStyle.bg}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl font-black ${colorStyle.badge}`}>
                      {shapeSymbol}
                    </div>
                    <span className="font-bold text-lg md:text-xl text-ink">
                      {option.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Host Skip Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleShowQuestionResults}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-bold text-muted hover:text-ink border border-line transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4 text-accent-ink" />
                <span>Chiudi tempo e mostra risposte</span>
              </button>
            </div>
          </div>
        )}

        {/* QUESTION RESULTS VIEW */}
        {status === 'question_results' && currentQuestion && (
          <div className="w-full max-w-4xl flex flex-col gap-6">
            <div className="bg-white border border-line rounded-3xl p-6 md:p-8 shadow-lg backdrop-blur-md">
              <span className="text-xs uppercase font-extrabold text-accent-ink tracking-wider mb-2 block">
                Risultati Domanda {currentQuestionIndex + 1}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-ink mb-6">
                {currentQuestion.text}
              </h2>

              {/* Answers Bar Chart */}
              <div className="flex flex-col gap-3">
                {currentQuestion.options.map((option, idx) => {
                  const votes = Object.values(currentAnswers).filter(
                    (a) => a.optionId === option.id
                  ).length;
                  const pct = playerCount > 0 ? Math.round((votes / playerCount) * 100) : 0;
                  const colorKey = option.color;
                  const colorStyle = OPTION_COLORS[colorKey];

                  return (
                    <div
                      key={option.id}
                      className={`p-4 rounded-xl border-2 flex items-center justify-between gap-4 relative overflow-hidden transition ${
                        option.isCorrect
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-line bg-surface-soft opacity-70'
                      }`}
                    >
                      {/* Vote bar fill */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-petrolio/30 transition-all duration-700 pointer-events-none"
                        style={{ width: `${pct}%` }}
                      ></div>

                      <div className="flex items-center gap-3 z-10">
                        {option.isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-emerald-700 shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-muted shrink-0" />
                        )}
                        <span className="font-bold text-ink text-base md:text-lg">
                          {option.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 z-10 font-bold">
                        <span className="text-ink text-sm md:text-base">{votes} voti</span>
                        <span className="text-xs text-muted">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Next Action Button */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleShowLeaderboard}
                  className="btn-mandarino px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <span>Classifica Parziale</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD VIEW */}
        {status === 'leaderboard' && (
          <div className="w-full max-w-3xl flex flex-col gap-6">
            <div className="bg-white border border-line rounded-3xl p-6 md:p-8 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-mandarino/20 border border-mandarino/40 text-accent-ink">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-ink">Classifica Giocatori</h2>
                    <p className="text-xs text-muted">
                      Dopo la domanda {currentQuestionIndex + 1} di {totalQuestions}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleNextStep}
                  className="btn-mandarino px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <span>
                    {currentQuestionIndex + 1 < totalQuestions ? 'Prossima Domanda' : 'Classifica Finale'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Ranked list */}
              <div className="flex flex-col gap-2.5">
                {Object.values(players)
                  .sort((a, b) => b.score - a.score)
                  .map((p, idx) => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition ${
                        idx === 0
                          ? 'bg-mandarino/15 border-mandarino text-ink font-black'
                          : idx === 1
                          ? 'bg-surface-soft border-line text-ink font-bold'
                          : idx === 2
                          ? 'bg-mandarino/15 border-mandarino text-ink font-bold'
                          : 'bg-surface-soft border-line text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 text-center font-black text-sm text-accent-ink">
                          #{idx + 1}
                        </span>
                        <span className="text-2xl">{p.avatar}</span>
                        <span className="font-bold text-base">{p.name}</span>
                        {p.streak > 1 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-mandarino/20 text-accent-ink border border-mandarino/30 font-bold">
                            🔥 {p.streak} di fila
                          </span>
                        )}
                      </div>

                      <span className="font-mono font-black text-lg text-ink">
                        {p.score.toLocaleString()} pt
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* FINISHED PODIUM VIEW */}
        {status === 'finished' && (
          <div className="w-full max-w-4xl">
            <FinalPodium
              players={players}
              onRestart={() => {
                setStatus('lobby');
                setCurrentQuestionIndex(0);
                setCurrentAnswers({});
                broadcastCurrentSession({ status: 'lobby', currentQuestionIndex: 0, currentQuestion: undefined, questionStartTime: 0, answersForCurrentQuestion: {} });
              }}
              onExit={onExit}
            />
          </div>
        )}
      </main>

      {/* Enlarged QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-petrolio/15 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-line rounded-3xl p-6 md:p-8 max-w-md w-full flex flex-col items-center shadow-lg relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-surface-soft text-muted hover:text-ink cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-xl font-black text-ink mb-2">Scansiona con lo smartphone</h3>
            <p className="text-xs text-muted text-center mb-4">
              I partecipanti si collegano istantaneamente al server per giocare
            </p>
            <QRCodeDisplay pin={pin} size={260} showDetails={true} />
          </div>
        </div>
      )}
    </div>
  );
};
