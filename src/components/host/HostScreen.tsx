import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Smartphone,
  Globe
} from 'lucide-react';
import { Quiz, GameSession, Player, Question } from '../../types/quiz';
import { gameSync, BOT_PLAYERS, generateBotAnswer, ServerInfo } from '../../services/gameSync';
import { sounds } from '../../services/soundEffects';
import { OPTION_COLORS, SHAPE_ICONS, COLOR_KEYS, SHAPE_KEYS } from '../../utils/quizStyles';
import { QRCodeDisplay } from '../common/QRCodeDisplay';
import { JoinInstructions } from '../common/JoinInstructions';
import { getSessionJoinAddresses } from '../../utils/connectionUrl';
import { FinalPodium } from '../leaderboard/FinalPodium';
import { applyPlayerAnswer, publicQuestion } from '../../services/sessionState';
import { HostVideoPlayer, type HostVideoControls } from '../video/HostVideoPlayer';
import { quizCheckpoints } from '../../services/videoQuiz';
import { ImageCredit } from '../common/ImageCredit';
import { useLanguage } from '../../context/LanguageContext';
import { QuriosoIcon, BRAND_COLORS } from '../common/QuriosoLogo';
import { useInternetSharing } from './useInternetSharing';
import { InternetSharingPanel } from './InternetSharingPanel';
import { gameExperienceTranslations } from '../../i18n/gameExperience';
import { readInternetPreference } from '../../services/appEnvironment';
import { sharingTranslations } from '../../i18n/internetSharing';

interface HostScreenProps {
  quiz: Quiz;
  onExit: () => void;
  recoveredSession?: GameSession;
}

export const HostScreen: React.FC<HostScreenProps> = ({ quiz: sourceQuiz, onExit, recoveredSession }) => {
  const isVideo = Boolean(sourceQuiz.videoConfig);
  // Runtime ordering only: saved quizzes and their question arrays are never changed.
  const quiz = useMemo(() => isVideo ? { ...sourceQuiz, questions: quizCheckpoints(sourceQuiz).map(cp => sourceQuiz.questions.find(q => q.id === cp.questionId)!) } : sourceQuiz, [sourceQuiz, isVideo]);
  const videoControls = useRef<HostVideoControls>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [videoQuestionsOpened, setVideoQuestionsOpened] = useState(recoveredSession?.videoQuestionsOpened || 0);
  const [recoveryWarning, setRecoveryWarning] = useState('');
  const [ending, setEnding] = useState(false);
  const endingRef = useRef(false);
  const lastVideoPublish = useRef(0);
  const writeVersion = useRef(0);
  const { t, language } = useLanguage();
  // Session initialization
  const [pin] = useState<string>(() => recoveredSession?.pin || gameSync.generatePin());
  const [status, setStatus] = useState<GameSession['status']>(recoveredSession?.status || 'lobby');
  const [players, setPlayers] = useState<Record<string, Player>>(recoveredSession?.players || {});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(recoveredSession?.currentQuestionIndex || 0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(recoveredSession?.questionStartTime || 0);
  const [timeRemaining, setTimeRemaining] = useState<number>(recoveredSession?.timeRemaining || 20);
  const [currentAnswers, setCurrentAnswers] = useState<GameSession['answersForCurrentQuestion']>(recoveredSession?.answersForCurrentQuestion || {});
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const screen = useRef<HTMLDivElement>(null);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const element = screen.current;
    const update = () => setIsFullscreen(document.fullscreenElement === element);
    document.addEventListener('fullscreenchange', update);
    return () => { document.removeEventListener('fullscreenchange', update); if (document.fullscreenElement === element) void document.exitFullscreen?.().catch(() => {}); };
  }, []);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const sharing = useInternetSharing(pin);
  const [showSharing, setShowSharing] = useState(() => !recoveredSession && readInternetPreference() === 'internet');
  const sharingText = sharingTranslations[language];
  const publicUrl = sharing.state.phase === 'active' && sharing.state.pin === pin ? sharing.state.url : undefined;
  const joinAddresses = getSessionJoinAddresses(window.location.origin, serverInfo, sharing.state, pin);
  const joinAddress = publicUrl || (joinAddresses.includes(selectedAddress) ? selectedAddress : joinAddresses[0] || '');
  const sharingBusy = ['downloading', 'connecting', 'reconnecting', 'stopping'].includes(sharing.state.phase);
  const sharingFailed = ['error', 'reconnecting'].includes(sharing.state.phase);
  const accessHelp = publicUrl ? sharingText.publicHelp : sharingFailed ? sharingText.failedHelp : sharingBusy ? sharingText.pendingHelp : sharingText.lanHelp;
  const joinInstructions = <JoinInstructions pin={pin} addresses={joinAddresses} address={joinAddress} onAddressChange={setSelectedAddress} />;

  const currentQuestion: Question | undefined = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;

  // Event callbacks always read the current snapshot, independent of React renders.
  const sessionRef = useRef<GameSession>(recoveredSession || {
    pin, quizId: quiz.id, quizTitle: quiz.title, mode: isVideo ? 'video' : 'standard', status: 'lobby',
    currentQuestionIndex: 0, questionStartTime: 0, timeRemaining: 20,
    players: {}, answersForCurrentQuestion: {}, totalQuestions,
  });
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advancingRef = useRef(false);
  const broadcastCurrentSession = async (updatedPartial: Partial<GameSession> = {}) => {
    if (endingRef.current) return false;
    const version = ++writeVersion.current;
    const previous = sessionRef.current;
    const next = { ...previous, ...updatedPartial };
    sessionRef.current = next;
    setStatus(next.status);
    setPlayers(next.players);
    setCurrentQuestionIndex(next.currentQuestionIndex);
    setQuestionStartTime(next.questionStartTime);
    setCurrentAnswers(next.answersForCurrentQuestion);
    const accepted = await gameSync.createSessionOnServer(next, isVideo ? quiz : undefined, quiz);
    if (!accepted && isVideo) {
      const remote = await gameSync.fetchSessionFromServer(pin, true);
      if (version === writeVersion.current) {
        const recovered = remote || previous;
        sessionRef.current = recovered; setStatus(recovered.status); setPlayers(recovered.players);
        setCurrentQuestionIndex(recovered.currentQuestionIndex); setQuestionStartTime(recovered.questionStartTime);
        setCurrentAnswers(recovered.answersForCurrentQuestion);
      }
      setSyncError('Sessione non sincronizzata. Controlla la connessione e riprova.');
    } else if (accepted) setSyncError('');
    if (accepted && !gameSync.canRecoverPresenter(pin)) setRecoveryWarning('Le impostazioni di questo browser impediscono il recupero dopo refresh. Mantieni aperta questa pagina.');
    return accepted;
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
    if (!recoveredSession) broadcastCurrentSession({ status: 'lobby' });

    const unsubscribe = gameSync.subscribe((msg) => {
      if (msg.type === 'PLAYER_JOIN' && msg.pin === pin) {
        if (!sessionRef.current.players[msg.player.id]) {
          broadcastCurrentSession({ players: { ...sessionRef.current.players, [msg.player.id]: msg.player } });
          sounds.playSelect();
        }
      }
      if (msg.type === 'PLAYER_ANSWER' && msg.pin === pin) {
        if (!isVideo) handlePlayerAnswerReceived(msg.playerId, msg.optionId, msg.timeTakenMs, msg.questionId, msg.questionStartTime, msg.roundId);
      }
      // Polling recovers joins/answers when the presenter's WebSocket is unavailable.
      if (msg.type === 'SESSION_STATE_UPDATE' && msg.session.pin === pin) {
        const remote = msg.session;
        const missing = Object.fromEntries(Object.entries(remote.players).filter(([id]) => !sessionRef.current.players[id]));
        if (Object.keys(missing).length) {
          broadcastCurrentSession({ players: { ...sessionRef.current.players, ...missing } });
        }
        if (isVideo) {
          setVideoQuestionsOpened(remote.videoQuestionsOpened || 0);
          if (remote.questionStartTime === sessionRef.current.questionStartTime && remote.currentQuestionIndex === sessionRef.current.currentQuestionIndex) {
            sessionRef.current = { ...sessionRef.current, roundId: remote.roundId, players: remote.players, answersForCurrentQuestion: remote.answersForCurrentQuestion };
            setPlayers(remote.players); setCurrentAnswers(remote.answersForCurrentQuestion);
          }
          return;
        }
        if (remote.questionStartTime === sessionRef.current.questionStartTime) {
          for (const [id, answer] of Object.entries(remote.answersForCurrentQuestion)) {
            if (answer.isCorrect === undefined) {
              handlePlayerAnswerReceived(id, answer.optionId, answer.timeTakenMs, answer.questionId, remote.questionStartTime, remote.roundId);
            }
          }
        }
      }

      if (msg.type === 'REQUEST_SESSION_SYNC' && msg.pin === pin) {
        broadcastCurrentSession();
      }
    });

    if (recoveredSession) void gameSync.fetchSessionFromServer(pin, true);
    return () => {
      unsubscribe();
      if (countdownRef.current) clearInterval(countdownRef.current);
      gameSync.unregister(pin);
    };
  }, [pin]);

  const handlePlayerAnswerReceived = (playerId: string, optionId: string, timeTakenMs: number, questionId?: string, acceptedRound?: number, roundId?: string) => {
    const current = sessionRef.current;
    if ((acceptedRound !== undefined && acceptedRound !== current.questionStartTime) ||
        (roundId !== undefined && roundId !== gameSync.getRoundId(pin))) return;
    // A server-accepted answer can arrive while the presenter was offline or already showing results.
    const scoring = acceptedRound !== undefined && current.status !== 'question' ? { ...current, status: 'question' as const } : current;
    const next = applyPlayerAnswer(scoring, quiz, {
      playerId, optionId, timeTakenMs,
      questionId: questionId || quiz.questions[current.currentQuestionIndex]?.id,
    });
    if (next === scoring) return;
    sounds.playSelect();
    broadcastCurrentSession({ ...next, status: current.status });
  };

  const handleExit = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    videoControls.current?.pause();
    setEnding(true);
    await sharing.stop();
    await gameSync.removeSession(pin);
    onExit();
  };

  // Launch Countdown
  const handleStartCountdown = () => {
    if (countdownRef.current) return;
    if (isVideo && document.fullscreenElement !== screen.current) toggleFullscreen();
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
        countdownRef.current = null;
        if (isVideo) void broadcastCurrentSession({ status: 'video' }).then(ok => { if (ok) void videoControls.current?.resume(); });
        else handleStartQuestion(0);
      }
    }, 1000);
    countdownRef.current = interval;
  };

  // Start question
  const handleStartQuestion = (qIndex: number, videoTime?: number, ended = false) => {
    const targetQ = quiz.questions[qIndex];
    if (!targetQ) return Promise.resolve(false);

    setCurrentQuestionIndex(qIndex);
    setStatus('question');
    setCurrentAnswers({});
    const now = Date.now();
    setQuestionStartTime(now);
    setTimeRemaining(targetQ.timeLimit);

    sounds.playSelect();

    return broadcastCurrentSession({
      status: 'question',
      ...(isVideo ? { videoState: { currentTime: videoTime ?? sessionRef.current.videoState?.currentTime ?? 0, isPlaying: false, activeCheckpointIndex: qIndex, ended } } : {}),
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
      const remaining = gameSync.remainingQuestionSeconds(pin, sessionRef.current.questionStartTime, currentQuestion.timeLimit);
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
  const settleCurrentRound = async () => {
    if (!await gameSync.flushSession()) return false;
    const remote = await gameSync.fetchSessionFromServer(pin, true);
    if (!remote || remote.questionStartTime !== sessionRef.current.questionStartTime) return false;
    // Polling above dispatches all accepted, not-yet-graded answers before the next question can start.
    return gameSync.flushSession();
  };
  const handleNextStep = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (!await settleCurrentRound()) return;
      if (isVideo) {
        if (await broadcastCurrentSession({ status: 'video' })) await videoControls.current?.resume();
      } else if (currentQuestionIndex + 1 < totalQuestions) await handleStartQuestion(currentQuestionIndex + 1);
      else await handleFinishQuiz();
    } finally { advancingRef.current = false; }
  };

  // Finish quiz
  const handleFinishQuiz = () => {
    setStatus('finished');
    return broadcastCurrentSession({ status: 'finished' });
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
        if (isVideo) void gameSync.submitBotAnswer(pin, bot.id, currentQuestion.id, optionId);
        else handlePlayerAnswerReceived(bot.id, optionId, timeTakenMs);
      }, delay);
      timeouts.push(t);
    });

    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [status, currentQuestionIndex]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setFullscreenError(false);
    const request = document.fullscreenElement === screen.current
      ? document.exitFullscreen?.() : screen.current?.requestFullscreen?.();
    if (request) void request.catch(() => setFullscreenError(true));
    else setFullscreenError(true);
  };

  const playerCount = Object.keys(players).length;
  const answersCount = Object.keys(currentAnswers).length;

  useEffect(() => {
    if (status === 'question' && playerCount > 0 && answersCount === playerCount) {
      handleShowQuestionResults();
    }
  }, [status, playerCount, answersCount]);

  return (
    <div ref={screen} className="host-screen bg-qurioso-canvas text-ink flex flex-col select-none" data-phase={status} data-mode={isVideo ? 'video' : 'standard'}>
      {/* Top Host Bar */}
      <header className="host-header px-4 py-2 bg-white backdrop-blur-md border-b border-line flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <QuriosoIcon size={38} variant="contained" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm md:text-base text-ink tracking-tight">
                {quiz.title}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-surface-soft text-petrolio border border-line">
                {status === 'lobby' ? (isVideo ? 'Quiz video in rete · Lobby' : 'Quiz classico in rete · Lobby') : `${status === 'video' ? 'Video · ' : ''}${currentQuestionIndex + 1} / ${totalQuestions}`}
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
          {sharing.available && <button type="button" onClick={() => setShowSharing(true)} aria-label={sharingText.title}
            title={sharingText.openPanel} data-sharing-phase={sharing.state.phase} aria-expanded={showSharing} className={`rounded-xl border-2 p-2 inline-flex items-center gap-1.5 ${publicUrl ? 'border-emerald-600 bg-emerald-600 text-white' : sharingFailed ? 'border-rose-300 bg-rose-50 text-rose-800' : sharingBusy ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-line bg-surface-soft text-petrolio'}`}>
            <Globe className={`w-4 h-4 ${sharingBusy ? 'animate-pulse' : ''}`} /><span className="hidden lg:inline text-xs font-bold">{sharingText[sharing.state.phase]}{sharing.state.phase === 'downloading' && sharing.state.progress !== undefined ? ` · ${sharing.state.progress}%` : ''}</span>
            <span className={`h-2 w-2 rounded-full ${sharing.state.phase === 'active' ? 'bg-white' : sharing.state.phase === 'error' ? 'bg-rose-600' : 'bg-gray-400'}`} aria-hidden="true" />
          </button>}
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
            title={isFullscreen ? gameExperienceTranslations[language].exitFull : gameExperienceTranslations[language].full}
            aria-label={isFullscreen ? gameExperienceTranslations[language].exitFull : gameExperienceTranslations[language].full}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleExit}
            disabled={ending}
            className="px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted transition cursor-pointer border border-line"
          >
            {t.exit || 'Esci'}
          </button>
        </div>
      </header>

      {/* Main Stage View */}
      <main className="host-stage flex-1 flex flex-col items-center p-3 relative">
        {recoveredSession && <p role="status" className="text-petrolio mb-4">Sessione recuperata · PIN {pin}. {isVideo ? 'Il video è in pausa: riprendi quando sei pronto.' : 'La partita continua dalla fase salvata sul server.'}</p>}
        {recoveryWarning && <p role="status" className="text-muted mb-4">{recoveryWarning}</p>}
        {fullscreenError && <p role="status" className="text-petrolio">{gameExperienceTranslations[language].fullError}</p>}
        {syncError && <p role="alert" className="text-rose-700 mb-4">{syncError}</p>}
        {isVideo && <div className={status === 'finished' ? 'hidden' : 'host-video w-full flex justify-center'}>
          <HostVideoPlayer ref={videoControls} language={language} onToggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} quiz={quiz} status={status} openedQuestions={videoQuestionsOpened} initialPlayback={recoveredSession?.videoState} onReady={setVideoReady}
            onCheckpoint={handleStartQuestion} onFinish={async () => { if (!await settleCurrentRound()) return false; return handleFinishQuiz(); }}
            onSourceChange={async selection => {
              if (!await gameSync.savePresenterVideoSource(pin, selection)) setRecoveryWarning('La nuova sorgente non è stata salvata per il recupero. Dopo un refresh potrebbe essere necessario selezionarla di nuovo.');
              await broadcastCurrentSession({ videoState: { currentTime: 0, isPlaying: false, ended: false, activeCheckpointIndex: sessionRef.current.currentQuestionIndex } });
            }}
            onPlayback={(currentTime, isPlaying, ended = false, force = false) => {
              const previous = sessionRef.current.videoState;
              if (sessionRef.current.status !== 'video') return;
              const now = performance.now();
              if (!force && previous?.isPlaying === isPlaying && previous?.ended === ended && now - lastVideoPublish.current < 2000) return;
              lastVideoPublish.current = now;
              void broadcastCurrentSession({ videoState: { currentTime, isPlaying, ended, activeCheckpointIndex: sessionRef.current.currentQuestionIndex } });
            }} />
        </div>}
        {/* LOBBY VIEW */}
        {status === 'lobby' && (
          <div className="w-full max-w-6xl flex flex-col items-center">
            <div className="host-lobby-banner w-full grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center bg-white border-2 border-line rounded-2xl p-4 shadow-lg mb-3">
              <div className="min-w-0 space-y-3">
                <div data-session-access={publicUrl ? 'public' : 'lan'} role="status" aria-live="polite" className={`rounded-xl border px-3 py-2 ${publicUrl ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : sharingFailed ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-line bg-surface-soft text-petrolio'}`}>
                  <p className="font-black">{publicUrl ? sharingText.publicAccess : sharingText.lanAccess}</p>
                  <p className="text-sm">{accessHelp}</p>
                  {sharing.available && <button type="button" className="mt-1 underline font-bold text-sm" onClick={() => setShowSharing(true)}>{sharingText.openPanel}</button>}
                </div>
                {joinInstructions}
                {/* Host Controls */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleStartCountdown}
                    disabled={playerCount === 0 || (isVideo && !videoReady)}
                    className={`btn-mandarino px-8 py-3.5 rounded-2xl font-black text-base flex items-center gap-2.5 shadow-md transition cursor-pointer ${
                      (playerCount === 0 || (isVideo && !videoReady)) ? 'opacity-50 cursor-not-allowed saturate-50' : 'hover:scale-105 active:scale-95'
                    }`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{isVideo ? 'Inizia il quiz video!' : 'Inizia il Quiz!'}</span>
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
              <div className="host-lobby-qr flex flex-col items-center justify-center gap-2">
                <p className="font-bold text-petrolio">Oppure inquadra il QR</p>
                <QRCodeDisplay pin={pin} baseUrl={joinAddress} size={190} showDetails={false} />
                <p className="text-sm text-muted">PIN già compilato</p>
              </div>
            </div>

            {/* Players Lobby Wall */}
            <div className="host-lobby-players w-full bg-white border border-line rounded-2xl p-3">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-ink" />
                  <h3 className="font-bold text-ink text-base">
                    Partecipanti nella Lobby ({playerCount})
                  </h3>
                </div>
                {playerCount === 0 && (
                  <span className="text-xs text-muted animate-pulse">
                    In attesa dei partecipanti…
                  </span>
                )}
              </div>

              {playerCount === 0 ? (
                <div className="py-2 flex flex-col items-center justify-center text-center text-muted">
                  <div className="hidden">
                    <Smartphone className="w-8 h-8 text-accent-ink animate-bounce" />
                  </div>
                  <p className="font-semibold text-ink">Nessun giocatore ancora connesso</p>
                  <p className="text-xs text-muted mt-1 max-w-sm">
                    {accessHelp}
                  </p>
                </div>
              ) : (
                <div className="host-player-list grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
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

        {recoveredSession && status === 'countdown' && <button className="btn-mandarino rounded-xl px-6 py-3" onClick={handleStartCountdown}>Riprendi avvio del quiz</button>}
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
          <div className="host-question w-full max-w-5xl flex flex-col gap-3">
            {/* Question Header & Clock */}
            <div className="host-question-heading bg-white border border-line rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
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
              <figure className="host-question-image space-y-1">
                <div className="w-full max-h-64 rounded-2xl overflow-hidden border border-line shadow-lg flex items-center justify-center bg-white">
                  <img src={currentQuestion.mediaUrl} alt="Immagine della domanda" className="max-h-64 w-auto object-contain" />
                </div>
                <figcaption><ImageCredit attribution={currentQuestion.mediaAttribution} /></figcaption>
              </figure>
            )}

            {/* 4 Interactive Answer Blocks */}
            <div className="host-options grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQuestion.options.map((option, idx) => {
                const colorKey = option.color;
                const colorStyle = OPTION_COLORS[colorKey];
                const shapeKey = option.shape;
                const shapeSymbol = SHAPE_ICONS[shapeKey];

                return (
                  <div
                    key={option.id}
                    className={`host-option p-3 rounded-2xl border-2 flex items-center gap-3 transition shadow-lg ${colorStyle.border} ${colorStyle.bg}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl font-black ${colorStyle.badge}`}>
                      {shapeSymbol}
                    </div>
                    <span className="font-bold text-lg md:text-xl text-ink min-w-0">
                      <span className="font-black">{String.fromCharCode(65 + idx)} · </span>{option.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Host Skip Button */}
            <div className="host-actions flex justify-end pt-2">
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
          <div className="host-results w-full max-w-4xl flex flex-col gap-3">
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

              {quiz.settings.showExplanation && currentQuestion.explanation && <p className="mt-4 text-petrolio">{currentQuestion.explanation}</p>}
              {/* Next Action Button */}
              <div className="host-actions mt-4 flex justify-end">
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
          <div className="host-leaderboard w-full max-w-3xl flex flex-col gap-3">
            <div className="bg-white border border-line rounded-3xl p-6 md:p-8 shadow-lg backdrop-blur-md">
              <div className="host-leaderboard-heading flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-line">
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
                    {isVideo ? 'Riprendi video' : currentQuestionIndex + 1 < totalQuestions ? 'Prossima Domanda' : 'Classifica Finale'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Ranked list */}
              <div className="host-ranking flex flex-col gap-2.5">
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
                broadcastCurrentSession({ status: 'lobby', currentQuestionIndex: 0, currentQuestion: undefined, questionStartTime: 0, answersForCurrentQuestion: {}, ...(isVideo ? { videoState: { currentTime: 0, isPlaying: false, activeCheckpointIndex: 0, ended: false } } : {}) });
              }}
              onExit={handleExit}
            />
          </div>
        )}
      </main>

      {showSharing && sharing.available && <InternetSharingPanel state={sharing.state} onStart={() => void sharing.start()} onStop={() => void sharing.stop()} onClose={() => setShowSharing(false)} />}
      {/* Enlarged QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-petrolio/15 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Come partecipare" className="host-join-modal bg-white border-2 border-line rounded-3xl p-5 max-w-2xl w-full flex flex-col gap-3 shadow-lg relative">
            <button
              aria-label="Chiudi istruzioni di accesso" onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-surface-soft text-muted hover:text-ink cursor-pointer"
            >
              ✕
            </button>
            {joinInstructions}
            <div className="flex justify-center"><QRCodeDisplay pin={pin} baseUrl={joinAddress} size={190} showDetails={false} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
