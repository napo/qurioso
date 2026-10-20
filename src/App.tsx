import { LibraryData } from './components/data/LibraryData';
import { loadQuizzes, storeQuizzes } from './services/quizStorage';
import { ImageCredit } from './components/common/ImageCredit';
/**
 * Qurioso ⚡ — Interactive Multiplayer & Video Quiz Studio
 * @author Maurizio Napolitano <maurizio.napolitano@gmail.com>
 * @license AGPL-3.0-or-later
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Video,
  Plus,
  Users,
  Trophy,
  Copy,
  Trash2,
  Edit3,
  Sparkles,
  QrCode,
  Flame,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  Layers,
  Radio,
  Wifi,
  Smartphone
} from 'lucide-react';
import { Quiz, GameSession } from './types/quiz';
import { DEFAULT_QUIZZES } from './data/defaultQuizzes';
import { Header } from './components/common/Header';
import { QuriosoIcon } from './components/common/QuriosoLogo';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ClassroomScreen } from './components/classroom/ClassroomScreen';
import { HostScreen } from './components/host/HostScreen';
import { PlayerScreen } from './components/player/PlayerScreen';
import { VideoQuizPlayer } from './components/video/VideoQuizPlayer';
import { QuizEditor } from './components/builder/QuizEditor';
import { MultiplatformGuide } from './components/guide/MultiplatformGuide';
import { useLanguage } from './context/LanguageContext';
import { gameSync, ServerInfo } from './services/gameSync';
import { checkpointProblems, quizCheckpoints } from './services/videoQuiz';
import { QuestionImportDialog } from './components/builder/QuestionImportDialog';
import { importText } from './i18n/questionImport';

export default function App({ classroomOnly = false }: { classroomOnly?: boolean }) {
  const { t, language } = useLanguage();
  const [importingQuestions, setImportingQuestions] = useState(false);
  // Navigation View State
  const [view, setView] = useState<'dashboard' | 'classroom' | 'host' | 'video_player' | 'player' | 'editor'>('dashboard');

  const [quizzes, setQuizzes] = useState<Quiz[]>(DEFAULT_QUIZZES);
  const [libraryReady, setLibraryReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    let mounted = true;
    loadQuizzes().then(saved => { if (mounted && saved !== null) setQuizzes(saved); })
      .catch(error => { if (mounted) setStorageError(error.message); })
      .finally(() => { if (mounted) setLibraryReady(true); });
    return () => { mounted = false; };
  }, []);

  // Selected quiz for playing / hosting / editing
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz>(DEFAULT_QUIZZES[0]);

  const [recoveredSession, setRecoveredSession] = useState<GameSession>();
  const recoveryAllowed = !classroomOnly && !new URLSearchParams(window.location.search).has('pin') && new URLSearchParams(window.location.search).get('role') !== 'player';
  const [checkingRecovery, setCheckingRecovery] = useState(recoveryAllowed);
  const [recoveryProblem, setRecoveryProblem] = useState<{ status: string; message?: string }>();
  const recoverHost = async () => {
    setCheckingRecovery(true);
    const result = await gameSync.recoverPresenter();
    if (result.status === 'recovered') {
      setSelectedQuiz(result.quiz); setRecoveredSession(result.session); setView('host'); setRecoveryProblem(undefined);
    } else if (result.status !== 'none') setRecoveryProblem(result);
    setCheckingRecovery(false);
  };
  useEffect(() => { if (recoveryAllowed) void recoverHost(); }, []);

  // Player state for joining with PIN
  const [playerPin, setPlayerPin] = useState<string>('');

  // Guide modal
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Server info state
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    if (classroomOnly) return;
    gameSync.getServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });
  }, [classroomOnly]);

  // Check URL query params on mount for instant QR code joining
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      const urlRole = params.get('role');

      if (urlPin) {
        setPlayerPin(urlPin);
        setView('player');
      } else if (urlRole === 'player') {
        setView('player');
      }
    }
  }, []);

  // IndexedDB accommodates embedded images beyond localStorage's small quota.
  const saveQuizzes = async (updated: Quiz[]) => {
    await storeQuizzes(updated);
    setQuizzes(updated);
    setStorageError('');
  };

  // Launch Host Presenter screen
  const handleStartHost = (quiz: Quiz) => {
    if (quiz.videoConfig && (!quizCheckpoints(quiz).length || checkpointProblems(quiz).length)) {
      setStorageError('Apri l’editor e associa almeno una domanda al video, correggendo eventuali checkpoint non validi.'); return;
    }
    setRecoveredSession(undefined); setRecoveryProblem(undefined);
    setSelectedQuiz(quiz);
    setView('host');
  };

  // Launch Video Quiz Player
  const handleStartVideoQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setView('video_player');
  };

  // Launch Editor for existing or new quiz
  const handleEditQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setView('editor');
  };

  const handleCreateNewQuiz = (withVideo = false) => {
    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      title: withVideo ? 'Nuovo quiz video' : 'Nuovo Quiz Senza Titolo',
      description: withVideo ? 'Quiz con video e domande ai checkpoint' : 'Quiz interattivo multiplayer',
      videoConfig: withVideo ? { videoUrl: '', videoTitle: '', videoType: 'html5', pauseMode: 'defined', checkpointMode: 'explicit', checkpoints: [] } : undefined,
      category: 'Generale',
      coverImage: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&auto=format&fit=crop&q=80',
      author: 'Maurizio Napolitano',
      createdAt: Date.now(),
      settings: {
        pointsMultiplier: 1,
        showExplanation: true,
        streakBonus: true,
      },
      questions: [
        {
          id: `q-${Date.now()}-1`,
          text: 'Qual è la capitale d\'Italia?',
          type: 'multiple_choice',
          timeLimit: 20,
          points: 1000,
          explanation: 'Roma è la capitale della Repubblica Italiana.',
          options: [
            { id: 'opt-1', text: 'Roma', isCorrect: true, color: 'red', shape: 'triangle' },
            { id: 'opt-2', text: 'Milano', isCorrect: false, color: 'blue', shape: 'diamond' },
            { id: 'opt-3', text: 'Napoli', isCorrect: false, color: 'yellow', shape: 'circle' },
            { id: 'opt-4', text: 'Torino', isCorrect: false, color: 'green', shape: 'square' },
          ],
        },
      ],
    };
    setSelectedQuiz(newQuiz);
    setView('editor');
  };

  // Duplicate Quiz
  const handleDuplicateQuiz = (quiz: Quiz) => {
    const duplicated: Quiz = {
      ...JSON.parse(JSON.stringify(quiz)),
      id: `quiz-${Date.now()}`,
      title: `${quiz.title} (Copia)`,
      createdAt: Date.now(),
    };
    saveQuizzes([duplicated, ...quizzes]).catch(error => setStorageError(error.message));
  };

  // Delete Quiz
  const handleDeleteQuiz = (id: string) => {
    if (quizzes.length <= 1) {
      alert(t.cantDeleteLastQuiz);
      return;
    }
    if (confirm(t.deleteQuizConfirm)) {
      saveQuizzes(quizzes.filter((q) => q.id !== id)).catch(error => setStorageError(error.message));
    }
  };

  // Save from Editor
  const handleSaveFromEditor = async (savedQuiz: Quiz) => {
    const exists = quizzes.some((q) => q.id === savedQuiz.id);
    let updated: Quiz[] = [];
    if (exists) {
      updated = quizzes.map((q) => (q.id === savedQuiz.id ? savedQuiz : q));
    } else {
      updated = [savedQuiz, ...quizzes];
    }
    await saveQuizzes(updated);
    setView('dashboard');
  };

  if (checkingRecovery) return <div role="status" className="min-h-screen bg-white text-petrolio p-8">Recupero della sessione del presentatore…</div>;

  if (!libraryReady) return <div role="status" className="min-h-screen bg-white text-petrolio p-8">Caricamento quiz…</div>;

  if (view === 'classroom') return selectedQuiz.videoConfig
    ? <div className="h-screen bg-white"><VideoQuizPlayer quiz={selectedQuiz} classroom onExit={() => setView('dashboard')} /></div>
    : <ClassroomScreen quiz={selectedQuiz} onExit={() => setView('dashboard')} />;

  // If in Host Presenter mode
  if (view === 'host') {
    return (
      <div className="h-screen w-screen bg-white flex flex-col">
        <HostScreen quiz={selectedQuiz} recoveredSession={recoveredSession} onExit={() => setView('dashboard')} />
      </div>
    );
  }

  // If in Video Quiz player mode
  if (view === 'video_player') {
    return (
      <div className="h-screen w-screen bg-white flex flex-col">
        <VideoQuizPlayer quiz={selectedQuiz} classroom={classroomOnly} onExit={() => setView('dashboard')} />
      </div>
    );
  }

  // If in Participant / Mobile player mode
  if (view === 'player') {
    return (
      <div className="h-screen w-screen bg-white flex flex-col">
        <PlayerScreen initialPin={playerPin} onExit={() => setView('dashboard')} />
      </div>
    );
  }

  // If in Quiz Editor mode
  if (view === 'editor') {
    return (
      <div className="h-screen w-screen bg-white flex flex-col">
        <QuizEditor
          initialQuiz={selectedQuiz}
          onSave={handleSaveFromEditor}
          onCancel={() => setView('dashboard')}
        />
      </div>
    );
  }

  // DEFAULT VIEW: MAIN DASHBOARD & QUIZ HUB
  return (
    <div data-qurioso-dashboard className="min-h-screen bg-qurioso-canvas text-ink flex flex-col select-none">
      {importingQuestions && <QuestionImportDialog quizzes={quizzes} onCancel={() => setImportingQuestions(false)} onConfirm={quiz => { setSelectedQuiz(quiz); setImportingQuestions(false); setView('editor'); }} />}
      <Header
        classroomOnly={classroomOnly}
        onOpenGuide={() => setShowGuide(true)}
        onJoinClick={() => {
          setPlayerPin('');
          setView('player');
        }}
        onCreateQuiz={() => handleCreateNewQuiz()}
      />

      <OfflineIndicator />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        <a href="./" className="inline-block text-sm font-bold text-petrolio underline">← Torna alla pagina iniziale</a>
        {recoveryProblem && <div role="alert" className="rounded-xl border border-line bg-white p-4 text-petrolio">
          <p>{recoveryProblem.message}</p>
          {['unavailable', 'context_missing'].includes(recoveryProblem.status) && <div className="flex gap-3 mt-3">
            <button className="btn-mandarino rounded-xl px-4 py-2" onClick={() => void recoverHost()}>Riprova recupero</button>
            <button className="underline" onClick={async () => { await gameSync.endRecoverableSession(); setRecoveryProblem(undefined); }}>Termina sessione e cancella credenziale</button>
          </div>}
        </div>}
        {storageError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{storageError}</p>}
        <LibraryData quizzes={quizzes} onRestored={updated => { setQuizzes(updated); setStorageError(''); }} onEditor={handleEditQuiz} onQuestions={() => setImportingQuestions(true)} />
        {/* Hero Banner with Petrolio & Mandarino Brand Identity */}
        <div className="relative rounded-3xl bg-white border-2 border-line p-6 md:p-10 shadow-lg overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 rounded-full bg-petrolio/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-60 h-60 rounded-full bg-mandarino/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-soft text-petrolio border border-line text-xs font-bold mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
              <span>{classroomOnly ? 'Attività in classe · direttamente nel browser' : 'Quiz in Rete · Attività in classe'}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-ink tracking-tight leading-tight">
              {classroomOnly ? 'Una domanda, tutta la classe.' : t.heroTitle}
            </h1>

            <p className="mt-3 text-muted text-sm md:text-base leading-relaxed">
              {classroomOnly ? 'Apri un quiz o creane uno nuovo. Proietta le domande, ascolta gli studenti e seleziona la risposta collettiva. Con o senza video, senza limite di tempo.' : 'Avvia un Quiz in Rete per far rispondere ciascuno dal proprio dispositivo sulla stessa rete, oppure scegli Attività in classe per raccogliere una risposta collettiva sul dispositivo del docente.'}
            </p>

            {/* Quick Hero Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={() => handleCreateNewQuiz()}
                className="btn-mandarino flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.createNewQuizBtn}</span>
              </button>

              <button
                onClick={() => handleCreateNewQuiz(true)}
                className="btn-petrolio flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm shadow-md transition active:scale-95 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Crea quiz video</span>
              </button>
              <button type="button" onClick={() => setImportingQuestions(true)} className="btn-petrolio flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm">{importText(language, 'importQuestions')}</button>

              {!classroomOnly && <button
                disabled={!quizzes.length} onClick={() => handleStartHost(quizzes[0])}
                className="btn-petrolio flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 text-accent-ink fill-mandarino" />
                <span>Avvia Schermo Presentatore</span>
              </button>}

              <button
                disabled={!quizzes.length} onClick={() => handleStartVideoQuiz(quizzes[0])}
                className="flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink font-semibold text-sm border border-line transition cursor-pointer"
              >
                <Video className="w-4 h-4 text-accent-ink" />
                <span>{t.tryVideoQuizBtn}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Real-time Server & Multi-device Highlights */}
        {!classroomOnly && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-line flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-mandarino/20 text-accent-ink border border-mandarino/30 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm">Server HTTP & QR Code Diretto</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Nessuna app da installare per i partecipanti: inquadrano il QR Code con lo smartphone e si collegano al server locale o web in tempo reale.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-line flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-petrolio/40 text-petrolio border border-line shrink-0">
              <Radio className="w-5 h-5 text-accent-ink" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm">WebSocket a Bassa Latenza</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Sincronizzazione istantanea delle domande, calcolo del punteggio al millisecondo e podio dinamico con bonus serie.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-line flex items-start gap-3.5 shadow-lg">
            <div className="p-2.5 rounded-xl bg-petrolio/40 text-petrolio border border-line shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm">{t.feat2Title}</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Integra video interattivi con domande a checkpoint automatici o intervalli casuali per lezioni e intrattenimento.
              </p>
            </div>
          </div>
        </div>

        }

        {/* Quizzes Collection Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-ink">
                {t.libraryTitle}
              </h2>
              <p className="text-xs text-muted">
                {t.librarySubtitle}
              </p>
            </div>

            <button
              onClick={() => handleCreateNewQuiz()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted rounded-xl border border-line transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-accent-ink" />
              <span>{t.newQuizBtn}</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => {
              const isVideoQuiz = !!quiz.videoConfig;

              return (
                <div
                  key={quiz.id}
                  className="group rounded-3xl bg-white border border-line hover:border-mandarino/60 shadow-md overflow-hidden flex flex-col transition duration-200 hover:-translate-y-1"
                >
                  {/* Card Cover Image */}
                  <div className="relative h-44 w-full bg-surface-soft overflow-hidden">
                    {quiz.coverImage ? (
                      <img
                        src={quiz.coverImage}
                        alt={quiz.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-surface-soft to-surface-soft text-petrolio">
                        <Layers className="w-12 h-12" />
                      </div>
                    )}

                    {/* Category Tag */}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white backdrop-blur-md text-[11px] font-extrabold text-ink border border-line shadow-md">
                      {quiz.category}
                    </span>

                    {/* Mode Tag */}
                    {isVideoQuiz ? (
                      <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-mandarino/90 backdrop-blur-md text-[11px] font-extrabold text-ink shadow-md">
                        <Video className="w-3 h-3" />
                        {t.videoQuizBadge}
                      </span>
                    ) : (
                      <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-petrolio/90 backdrop-blur-md text-[11px] font-extrabold text-white shadow-md">
                        <Users className="w-3 h-3" />
                        {t.multiplayerLiveBadge}
                      </span>
                    )}

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-white/95 backdrop-blur-md text-[10px] font-bold text-muted">
                      {quiz.questions.length} {t.questionsCount}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-extrabold text-base text-ink group-hover:text-petrolio transition line-clamp-1">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                        {quiz.description}
                      </p>
                      {quiz.author && (
                        <p className="text-[10px] text-muted mt-2">
                          di {quiz.author}
                        </p>
                      )}
                    </div>

                    <ImageCredit attribution={quiz.coverAttribution} />

                    {/* Card Actions */}
                    <div className="mt-5 pt-4 border-t border-line space-y-2">
                      {!classroomOnly && <>
                      {/* Primary Play Button */}
                      <button
                        disabled={!serverInfo || (isVideoQuiz && !quizCheckpoints(quiz).length)}
                        title={!serverInfo ? 'Per usare Quiz in Rete avvia Qurioso sul computer del docente.' : 'I partecipanti devono essere sulla stessa rete locale.'}
                        onClick={() => handleStartHost(quiz)}
                        className="w-full py-2.5 px-3 rounded-xl btn-petrolio font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-white" />
                        <span>{isVideoQuiz ? 'Quiz video in rete' : 'Quiz classico in rete'}</span>
                      </button>

                      <p className="text-xs text-muted">{isVideoQuiz && !quizCheckpoints(quiz).length ? 'Apri Modifica e associa almeno una domanda al video per avviare il quiz in rete.' : serverInfo ? 'Ogni partecipante risponde dal proprio dispositivo sulla stessa rete.' : 'Quiz in Rete richiede Qurioso avviato sul computer del docente.'}</p>
                      </>}
                      <button type="button" onClick={() => { setSelectedQuiz(quiz); setView('classroom'); }} className="w-full py-3 px-3 rounded-xl btn-mandarino font-bold text-sm cursor-pointer">Attività in classe{isVideoQuiz ? ' con video' : ''}</button>
                      <p className="text-xs text-muted">Un solo dispositivo, risposta collettiva. Funziona via web senza installazioni.</p>
                      {/* If Video Quiz, provide direct video launch */}
                      {isVideoQuiz && (
                        <button
                          onClick={() => handleStartVideoQuiz(quiz)}
                          className="w-full py-2 px-3 rounded-xl bg-mandarino/20 hover:bg-mandarino/30 text-accent-ink border border-mandarino/40 font-semibold text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>{t.playVideoMode}</span>
                        </button>
                      )}

                      {/* Manage Buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleEditQuiz(quiz)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t.editQuiz}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDuplicateQuiz(quiz)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
                            title={t.duplicateQuiz}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted hover:text-rose-700 transition cursor-pointer"
                            title={t.deleteQuiz}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer with Qurioso Q Icon, Author, and Affero GPL License */}
      <footer className="w-full border-t border-line bg-surface-soft py-6 px-4 md:px-8 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <QuriosoIcon size={26} variant="contained" />
            <span className="font-extrabold text-ink">Qurioso</span>
            <span>•</span>
            <span>{t.authorLabel}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span>{t.licenseLabel}</span>
            <span>•</span>
            <button
              onClick={() => setShowGuide(true)}
              className="text-accent-ink hover:underline cursor-pointer font-semibold"
            >
              GitHub & Builds
            </button>
          </div>
        </div>
      </footer>

      {/* Multiplatform & GitHub Guide Modal */}
      {showGuide && <MultiplatformGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
