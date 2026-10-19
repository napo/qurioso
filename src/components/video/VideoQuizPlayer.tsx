import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Shuffle,
  ListOrdered,
  Plus,
  CheckCircle,
  XCircle,
  Award,
  Video,
  Settings,
  HelpCircle
} from 'lucide-react';
import { Quiz, Question, VideoQuizConfig } from '../../types/quiz';
import { sounds } from '../../services/soundEffects';
import { OPTION_COLORS, SHAPE_ICONS } from '../../utils/quizStyles';
import { resolveVideoSource, videoProvider } from '../../utils/videoSource';
import { VideoSourcePicker } from '../common/VideoSourcePicker';
import { useStoredVideoSource } from './useStoredVideoSource';
import { quizCheckpoints, nextCheckpoint, type VideoSelection } from '../../services/videoQuiz';
import { VideoSurface } from './VideoSurface';
import confetti from 'canvas-confetti';
import { useLanguage } from '../../context/LanguageContext';
import { ImageCredit } from '../common/ImageCredit';
import { QuriosoIcon } from '../common/QuriosoLogo';

interface VideoQuizPlayerProps {
  quiz: Quiz;
  classroom?: boolean;
  preview?: boolean;
  onFinish?: (finalScore: number) => void;
  onExit?: () => void;
}

export const VideoQuizPlayer: React.FC<VideoQuizPlayerProps> = ({
  quiz,
  onFinish,
  classroom = false,
  preview = false,
  onExit,
}) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const answerLockedRef = useRef(false);
  const endedRef = useRef(false);
  const [completed, setCompleted] = useState(false);

  // Video settings & state
  const [videoUrl, setVideoUrl] = useState<string>(
    quiz.videoConfig?.videoAssetId ? '' : resolveVideoSource(quiz.videoConfig?.videoUrl)
  );
  const [videoError, setVideoError] = useState('');
  const [videoSelection, setVideoSelection] = useState<VideoSelection | undefined>(quiz.videoConfig);
  const [sourceBusy, setSourceBusy] = useState(false);
  const activeQuestionRef = useRef(false);
  const triggeredRef = useRef(new Set<number>());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Pause Mode: 'defined' vs 'random'
  const [pauseMode, setPauseMode] = useState<'defined' | 'random'>(
    quiz.videoConfig?.pauseMode || 'defined'
  );

  // Checkpoints: list of timestamps in seconds mapped to questions
  const [checkpoints, setCheckpoints] = useState(() => quizCheckpoints(quiz));

  // Track which checkpoint indices have already been triggered in this run
  const [triggeredCheckpoints, setTriggeredCheckpoints] = useState<Set<number>>(new Set());

  // Active quiz pause modal state
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [questionTimer, setQuestionTimer] = useState<number>(15);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  // Scoring
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [answeredCount, setAnsweredCount] = useState<number>(0);

  // Custom modal for editing checkpoints or loading custom video
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);


  const loadVideo = (selection: VideoSelection) => {
    endedRef.current = false; setCompleted(false);
    setVideoSelection(selection);
    setVideoUrl(selection.videoAssetId ? '' : resolveVideoSource(selection.videoUrl));
    setVideoError('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    triggeredRef.current = new Set();
    setTriggeredCheckpoints(new Set());
    activeQuestionRef.current = false;
    setActiveQuestion(null);
    setShowExplanation(false);
    setSelectedOptionId(null);
    setIsAnswerCorrect(null);
    answerLockedRef.current = false;
    setScore(0);
    setStreak(0);
    setAnsweredCount(0);
    setShowConfigModal(false);
  };

  useStoredVideoSource(videoSelection?.videoAssetId, setVideoUrl, setVideoError, setSourceBusy);

  const reportPlaybackError = () => {
    setIsPlaying(false);
    setVideoError('Impossibile riprodurre il video. Controlla la connessione e che il video consenta la riproduzione incorporata. Per i file locali verifica che il formato MP4/WebM sia supportato dal browser.');
  };

  useEffect(() => {
    if (!videoUrl || videoProvider(videoUrl) === 'html5' || duration > 0) return;
    const timer = setTimeout(reportPlaybackError, 20000);
    return () => clearTimeout(timer);
  }, [videoUrl, duration]);

  const playVideo = () => {
    if (!videoRef.current) return;
    setVideoError('');
    const player = videoRef.current;
    player.play().then(() => { if (videoRef.current === player) setIsPlaying(true); }).catch(() => { if (videoRef.current === player) reportPlaybackError(); });
  };

  // Handle Video Time Update and Checkpoint Triggering
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const now = videoRef.current.currentTime;
    setCurrentTime(now);

    if (!videoRef.current.duration || isNaN(videoRef.current.duration)) return;
    if (Number.isFinite(videoRef.current.duration) && now >= videoRef.current.duration) endedRef.current = true;
    if (duration !== videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }

    if (activeQuestionRef.current) return;
    const index = nextCheckpoint(checkpoints, triggeredRef.current, now);
    if (index >= 0) triggerQuestionAtCheckpoint(checkpoints[index], index);
  };

  const triggerQuestionAtCheckpoint = (
    cp: { timestamp: number; questionId: string },
    index: number
  ) => {
    if (!videoRef.current || activeQuestionRef.current) return;
    activeQuestionRef.current = true;
    Promise.resolve(videoRef.current.pause()).catch(reportPlaybackError);
    setIsPlaying(false);
    if (videoRef.current.currentTime > cp.timestamp + 0.75) videoRef.current.currentTime = cp.timestamp;
    triggeredRef.current = new Set([...triggeredRef.current, index]);
    setTriggeredCheckpoints(new Set(triggeredRef.current));

    // Find the question
    const q = quiz.questions.find((item) => item.id === cp.questionId) || quiz.questions[index % quiz.questions.length];
    if (q) {
      sounds.playVideoPauseAlert();
      answerLockedRef.current = false;
      setActiveQuestion(q);
      setQuestionTimer(q.timeLimit || 15);
      setSelectedOptionId(null);
      setShowExplanation(false);
      setIsAnswerCorrect(null);
    }
  };

  // Timer countdown when active question is showing
  useEffect(() => {
    if (!activeQuestion || showExplanation || classroom) return;

    if (questionTimer <= 0) {
      // Time up! Count as wrong
      handleOptionSubmit(null);
      return;
    }

    const timer = setInterval(() => {
      setQuestionTimer((t) => {
        if (t <= 5 && t > 1) {
          sounds.playTick();
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeQuestion, questionTimer, showExplanation, classroom]);

  const handleOptionSubmit = (optionId: string | null) => {
    if (!activeQuestion || showExplanation || answerLockedRef.current) return;
    answerLockedRef.current = true;

    setSelectedOptionId(optionId);
    setShowExplanation(true);
    setAnsweredCount((c) => c + 1);

    const selectedOption = activeQuestion.options.find((o) => o.id === optionId);
    const correct = selectedOption ? selectedOption.isCorrect : false;

    setIsAnswerCorrect(correct);

    if (correct) {
      sounds.playCorrect();
      const points = Math.round(1000 * (questionTimer / (activeQuestion.timeLimit || 15))) + (streak * 100);
      setScore((s) => s + Math.max(points, 250));
      setStreak((st) => st + 1);
    } else {
      sounds.playWrong();
      setStreak(0);
    }
  };

  const resumeVideo = () => {
    activeQuestionRef.current = false;
    setActiveQuestion(null);
    setShowExplanation(false);
    setSelectedOptionId(null);
    setIsAnswerCorrect(null);

    // Drain simultaneous/crossed checkpoints before restarting playback.
    const pending = endedRef.current ? checkpoints.findIndex((_, i) => !triggeredRef.current.has(i))
      : nextCheckpoint(checkpoints, triggeredRef.current, videoRef.current?.currentTime || 0);
    if (pending >= 0) { triggerQuestionAtCheckpoint(checkpoints[pending], pending); return; }
    if (endedRef.current) { setCompleted(true); onFinish?.(score); return; }

    // Check if this was the last checkpoint
    if (!preview && triggeredCheckpoints.size >= checkpoints.length) {
      // Completed all questions!
      sounds.playPodiumFanfare();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }

    if (videoRef.current) {
      playVideo();
    }
  };

  // Switch to Random Checkpoints mode
  const applyRandomCheckpoints = () => {
    if (duration <= 10) return;
    const count = Math.min(quiz.questions.length, 5);
    const step = (duration - 8) / (count + 1);
    const newCheckpoints = quiz.questions.slice(0, count).map((q, idx) => {
      // Add slight jitter +/- 3 seconds
      const jitter = (Math.random() - 0.5) * 4;
      const t = Math.max(4, Math.min(duration - 4, Math.round((idx + 1) * step + jitter)));
      return { timestamp: t, questionId: q.id };
    }).sort((a, b) => a.timestamp - b.timestamp);

    setCheckpoints(newCheckpoints);
    triggeredRef.current = new Set();
    setTriggeredCheckpoints(new Set());
    setPauseMode('random');
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      Promise.resolve(videoRef.current.pause()).catch(reportPlaybackError);
      setIsPlaying(false);
    } else {
      playVideo();
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    endedRef.current = false; setCompleted(false);
    videoRef.current.currentTime = 0;
    triggeredRef.current = new Set();
    activeQuestionRef.current = false;
    setTriggeredCheckpoints(new Set());
    setActiveQuestion(null);
    setScore(0);
    setStreak(0);
    setAnsweredCount(0);
    playVideo();
  };

  if (completed) return <main className="h-full overflow-auto bg-white text-petrolio flex flex-col items-center justify-center gap-4 p-6 text-center">
    <QuriosoIcon size={48} /><h2 className="text-3xl font-black">Attività conclusa</h2>
    <p>Domande svolte: {answeredCount} su {checkpoints.length}.</p>
    <button className="btn-mandarino rounded-xl px-5 py-3 font-bold" onClick={() => { endedRef.current = false; setCompleted(false); triggeredRef.current = new Set(); activeQuestionRef.current = false; setTriggeredCheckpoints(new Set()); setActiveQuestion(null); setScore(0); setStreak(0); setAnsweredCount(0); setCurrentTime(0); }}>Ricomincia attività</button>
    {onExit && <button className="btn-petrolio rounded-xl px-5 py-3 font-bold" onClick={onExit}>{preview ? 'Torna all’editor' : 'Esci'}</button>}
  </main>;

  return (
    <div className="flex flex-col h-full w-full bg-white text-ink select-none">
      {/* Top Bar with Qurioso Branding */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-line">
        <div className="flex items-center gap-3">
          <QuriosoIcon size={32} variant="rounded" />
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              {quiz.title}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-mandarino/20 text-accent-ink border border-mandarino/30">
                {classroom ? 'Attività in classe con video' : t.videoQuizMode}
              </span>
            </h2>
            <p className="text-xs text-muted">
              {pauseMode === 'defined' ? t.definedSequence : t.randomSequence} • {checkpoints.length} checkpoint
            </p>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 bg-surface-soft px-3.5 py-1.5 rounded-xl border border-line text-xs">
            <div className="flex items-center gap-1.5 text-accent-ink font-bold">
              <Award className="w-4 h-4" />
              <span>{score} pts</span>
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-1 text-orange-700 font-semibold animate-pulse">
                <span>🔥 x{streak}</span>
              </div>
            )}
            <div className="text-muted">
              {t.questionsSidebarTitle}: <span className="text-ink font-medium">{answeredCount}/{checkpoints.length}</span>
            </div>
          </div>

          {!preview && <button
            onClick={() => { if (videoRef.current) Promise.resolve(videoRef.current.pause()).catch(reportPlaybackError); setShowConfigModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-medium text-muted border border-line transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-petrolio" />
            <span>{t.configureVideo}</span>
          </button>}

          {onExit && (
            <button
              onClick={onExit}
              className="px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-medium text-muted hover:text-ink transition cursor-pointer"
            >
              {preview ? 'Torna all’editor' : t.exit}
            </button>
          )}
        </div>
      </div>

      {/* Main Video Viewport & Overlay */}
      <div className="relative flex-1 bg-white flex items-center justify-center overflow-hidden">
        {videoUrl && <VideoSurface
          key={videoUrl}
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          onError={reportPlaybackError}
          onPlay={() => { if (activeQuestionRef.current) { if (videoRef.current) Promise.resolve(videoRef.current.pause()).catch(reportPlaybackError); return; } setVideoError(''); setIsPlaying(true); }}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={() => { if (videoRef.current && Number.isFinite(videoRef.current.duration)) setDuration(videoRef.current.duration); }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              if (Number.isFinite(videoRef.current.duration)) setDuration(videoRef.current.duration);
            }
          }}
          onEnded={() => {
            endedRef.current = true;
            setIsPlaying(false);
            if (activeQuestionRef.current) return;
            const pending = checkpoints.findIndex((_, index) => !triggeredRef.current.has(index));
            if (pending >= 0) { triggerQuestionAtCheckpoint(checkpoints[pending], pending); return; }
            setCompleted(true); onFinish?.(score);
            if (!preview && answeredCount >= checkpoints.length) {
              sounds.playPodiumFanfare();
              confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
            }
          }}
          onClick={videoProvider(videoUrl) === 'html5' ? togglePlay : undefined}
          className="w-full h-full object-contain cursor-pointer"
        />}
        {sourceBusy && <p role="status" className="absolute top-4 text-sm text-petrolio bg-white p-3 rounded-xl">Caricamento video locale…</p>}

        {/* Video Watermark / Prompt */}
        {videoError && !activeQuestion && (
          <div role="alert" className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center gap-4">
            <p className="max-w-lg text-sm text-rose-700">{videoError}</p>
            <button onClick={() => setShowConfigModal(true)} className="btn-petrolio px-5 py-3 rounded-xl font-bold cursor-pointer">Scegli un altro video</button>
          </div>
        )}
        {!isPlaying && !activeQuestion && !videoError && !sourceBusy && videoProvider(videoUrl) === 'html5' && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-full bg-petrolio/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-petrolio transition">
              <Play className="w-10 h-10 ml-1 fill-current" />
            </div>
            <p className="mt-4 text-sm font-semibold text-muted bg-white px-4 py-1.5 rounded-full border border-line">
              {t.clickToStartVideo}
            </p>
          </div>
        )}

        {/* ACTIVE QUESTION OVERLAY (POPS UP ON VIDEO PAUSE) */}
        {activeQuestion && (
          <div className="absolute inset-0 bg-white backdrop-blur-md flex items-center justify-center p-4 z-40 animate-in fade-in zoom-in duration-200">
            <div className="w-full max-w-2xl max-h-full overflow-y-auto bg-white border-2 border-petrolio/50 rounded-3xl p-6 shadow-lg flex flex-col">
              {/* Header with Countdown & Alert */}
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-petrolio">
                    {t.videoPausedAlert}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      questionTimer <= 5
                        ? 'bg-rose-500/20 text-rose-700 border border-rose-500/40 animate-pulse'
                        : 'bg-petrolio/20 text-petrolio border border-petrolio/30'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{classroom ? 'Discussione senza limite di tempo' : `${questionTimer}s`}</span>
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div className="my-5 text-center">
                <h3 className="text-xl md:text-2xl font-black text-ink leading-snug">
                  {activeQuestion.text}
                </h3>
              </div>

              {activeQuestion.mediaUrl && <figure className="mb-3 space-y-2">
                <img src={activeQuestion.mediaUrl} alt="Immagine della domanda" className="max-h-40 w-full object-contain" />
                <figcaption><ImageCredit attribution={activeQuestion.mediaAttribution} /></figcaption>
              </figure>}
              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-2">
                {activeQuestion.options.map((option) => {
                  const style = OPTION_COLORS[option.color] || OPTION_COLORS.blue;
                  const isSelected = selectedOptionId === option.id;
                  const isCorrect = option.isCorrect;

                  let cardState = style.bg;
                  if (showExplanation) {
                    if (isCorrect) {
                      cardState = 'bg-emerald-100 ring-4 ring-emerald-400 scale-[1.02] shadow-lg';
                    } else if (isSelected && !isCorrect) {
                      cardState = 'bg-rose-100 opacity-80';
                    } else {
                      cardState = 'bg-surface-soft opacity-40';
                    }
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSubmit(option.id)}
                      disabled={showExplanation}
                      className={`relative flex items-center gap-3 p-4 rounded-2xl text-left transition duration-150 cursor-pointer ${cardState} ${
                        !showExplanation ? 'hover:scale-[1.02] active:scale-95' : ''
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg ${style.badge}`}>
                        {SHAPE_ICONS[option.shape] || '▲'}
                      </span>
                      <span className="flex-1 font-bold text-ink text-base">
                        {option.text}
                      </span>
                      {showExplanation && isCorrect && (
                        <CheckCircle className="w-6 h-6 text-ink shrink-0" />
                      )}
                      {showExplanation && isSelected && !isCorrect && (
                        <XCircle className="w-6 h-6 text-ink shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Continue Button */}
              {showExplanation && (
                <div role="status" aria-live="polite" className="mt-5 p-4 rounded-2xl bg-surface-soft border border-line animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 mb-2">
                    {isAnswerCorrect ? (
                      <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-sm">
                        <CheckCircle className="w-4 h-4" /> {t.greatJobCorrect}
                      </span>
                    ) : (
                      <span className="text-rose-700 font-extrabold flex items-center gap-1 text-sm">
                        <XCircle className="w-4 h-4" /> {t.tooBadWrong}
                      </span>
                    )}
                  </div>
                  {quiz.settings.showExplanation && activeQuestion.explanation && (
                    <p className="text-xs text-muted mb-3 leading-relaxed">
                      {activeQuestion.explanation}
                    </p>
                  )}
                  <button
                    onClick={resumeVideo}
                    className="w-full py-3 rounded-xl btn-petrolio font-bold text-sm shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{t.continueVideo}</span>
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {duration > 0 && checkpoints.some(cp => cp.timestamp >= duration) && <p className="bg-surface-soft px-4 py-2 text-xs text-accent-ink">Alcune domande sono alla fine o oltre la durata del video. Controlla i checkpoint nell’editor.</p>}
      {/* Video Interactive Progress & Controls Bar */}
      <div className="bg-white border-t border-line px-4 py-3 flex flex-col gap-2">
        {/* Timeline with Checkpoint Markers */}
        <div className="relative w-full flex items-center py-2">
          {/* Track Bar */}
          <div
            onClick={(e) => {
              if (!videoRef.current || duration <= 0 || activeQuestionRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              videoRef.current.currentTime = pos * duration;
            }}
            className="relative w-full h-3 bg-surface-soft rounded-full cursor-pointer overflow-visible group"
          >
            {/* Played Bar */}
            <div
              className="h-full bg-petrolio rounded-full"
              style={{ width: `${(currentTime / Math.max(duration, 1)) * 100}%` }}
            />

            {/* Checkpoint Markers on the timeline */}
            {checkpoints.map((cp, idx) => {
              const pct = (cp.timestamp / Math.max(duration, 1)) * 100;
              const isTriggered = triggeredCheckpoints.has(idx);

              return (
                <div
                  key={idx}
                  title={`Checkpoint ${idx + 1} a ${formatSeconds(cp.timestamp)}`}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${
                    isTriggered
                      ? 'bg-emerald-500 border-white'
                      : 'bg-mandarino border-line shadow-md animate-pulse'
                  }`}
                  style={{ left: `${pct}%` }}
                >
                  <span className="text-[8px] font-black text-muted">?</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lower Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-petrolio hover:bg-petrolio text-white transition cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button
              onClick={restartVideo}
              className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
              title="Ricomincia Video e Quiz"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-700" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="text-xs text-muted font-mono">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          </div>

          {/* Mode Switchers */}
          {!preview && <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeQuestionRef.current) return;
                setPauseMode('defined');
                setCheckpoints(quizCheckpoints(quiz));
                triggeredRef.current = new Set();
                setTriggeredCheckpoints(new Set());
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                pauseMode === 'defined'
                  ? 'bg-petrolio text-white shadow-sm'
                  : 'bg-surface-soft text-muted hover:text-muted'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Sequenza Definita</span>
            </button>

            <button
              disabled={!!activeQuestion || duration <= 10}
              onClick={applyRandomCheckpoints}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                pauseMode === 'random'
                  ? 'bg-mandarino text-ink shadow-sm'
                  : 'bg-surface-soft text-muted hover:text-muted'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Sequenza Casuale</span>
            </button>
          </div>}
        </div>
      </div>

      {/* Configuration / Video Selector Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-petrolio/15 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-line p-6 shadow-lg">
            <h3 className="text-lg font-bold text-ink mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-petrolio" />
              Configurazione Video Quiz
            </h3>
            <p className="text-xs text-muted mb-4">Scegli YouTube, Vimeo, un link diretto o un file locale. Le domande restano collegate ai checkpoint del quiz. Per conservare la scelta tra le sessioni, impostala nell’editor e salva il quiz.</p>
            <VideoSourcePicker value={videoSelection} onBusyChange={setSourceBusy} onChange={loadVideo} />

            {/* Checkpoints Overview */}
            <div className="mb-5 p-3 rounded-xl bg-surface-soft border border-line text-xs">
              <div className="font-semibold text-muted mb-1 flex items-center justify-between">
                <span>Checkpoint Attuali:</span>
                <span className="text-petrolio">{checkpoints.length} pause previste</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {checkpoints.map((cp, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-surface-soft text-muted text-[11px] font-mono"
                  >
                    #{i + 1}: {formatSeconds(cp.timestamp)}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowConfigModal(false)}
              className="w-full py-2.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-ink transition cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
