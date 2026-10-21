import { loadQuizzes, storeQuizzes } from './services/quizStorage';
import { ImageCreditDetails } from './components/common/ImageCredit';
/**
 * Qurioso ⚡ — Interactive Multiplayer & Video Quiz Studio
 * @author Maurizio Napolitano <maurizio.napolitano@gmail.com>
 * @license AGPL-3.0-or-later
 */

import React, { useState, useEffect, useRef } from 'react';
import type { DesktopMenuCommand } from './types/desktop';
import {
  Play,
  Video,
  Plus,
  Users,
  Copy,
  Trash2,
  Edit3,
  CheckCircle,
  Download,
} from 'lucide-react';
import { Quiz, GameSession } from './types/quiz';
import { DEFAULT_QUIZZES, DEFAULT_QUIZ_COVER } from './data/defaultQuizzes';
import { WebShell } from './components/shell/WebShell';
import { DesktopShell, ActivityModeSwitch, NewQuizMenu } from './components/shell/DesktopShell';
import { ClassroomScreen } from './components/classroom/ClassroomScreen';
import { FallbackImage, ImagePlaceholder } from './components/common/FallbackImage';
import { HostScreen } from './components/host/HostScreen';
import { PlayerScreen } from './components/player/PlayerScreen';
import { VideoQuizPlayer } from './components/video/VideoQuizPlayer';
import { QuizEditor } from './components/builder/QuizEditor';
import { MultiplatformGuide } from './components/guide/MultiplatformGuide';
import { useLanguage } from './context/LanguageContext';
import { gameSync, ServerInfo } from './services/gameSync';
import { checkpointProblems, quizCheckpoints } from './services/videoQuiz';
import { QuestionImportDialog } from './components/builder/QuestionImportDialog';
import { isPublicWebsite } from './services/appEnvironment';
import { settingsTranslations } from './i18n/settings';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { workspaceTranslations } from './i18n/workspace';
import { withOfficialQuizzes, OFFICIAL_QUIZZES } from './services/officialQuizzes';

export default function App({ classroomOnly = false }: { classroomOnly?: boolean }) {
  const { t, language } = useLanguage();
  const labels = settingsTranslations[language];
  const workspace = workspaceTranslations[language];
  const publicSite = isPublicWebsite();
  const desktop = !publicSite && Boolean(window.quriosoDesktop?.internetSharing);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [activityMode, setActivityMode] = useState<'classroom' | 'network'>(classroomOnly || publicSite ? 'classroom' : 'network');
  const networkMode = activityMode === 'network' && !publicSite && Boolean(desktop || serverInfo);
  const changeActivityMode = (mode: 'classroom' | 'network') => {
    setActivityMode(mode);
    const url = new URL(window.location.href);
    url.searchParams.set('app', mode);
    window.history.replaceState({}, '', url);
  };
  const downloadsUrl = `./?lang=${language}#quiz-in-rete`;
  const environmentText = publicSite
    ? labels.websiteEnvironment
    : desktop ? labels.desktopEnvironment
    : serverInfo ? labels.serverEnvironment
    : labels.browserEnvironment;
  const [importingQuestions, setImportingQuestions] = useState(false);
  // Navigation View State
  const [view, setView] = useState<'dashboard' | 'classroom' | 'host' | 'player' | 'editor' | 'settings'>('dashboard');

  const [quizzes, setQuizzes] = useState<Quiz[]>(DEFAULT_QUIZZES);
  const availableQuizzes = withOfficialQuizzes(quizzes);
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
  const recoveryAllowed = !classroomOnly && !publicSite && !new URLSearchParams(window.location.search).has('pin') && new URLSearchParams(window.location.search).get('role') !== 'player';
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
  const [settingsFocus, setSettingsFocus] = useState<'backup' | 'about'>();
  const openSettings = (focus?: 'backup' | 'about') => { setSettingsFocus(focus); setView('settings'); };

  // Discover a local server only outside the official static site.

  useEffect(() => {
    if (publicSite || (classroomOnly && !desktop)) return;
    gameSync.getServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });
  }, [classroomOnly, publicSite]);

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
    if (publicSite || !serverInfo) { setView('settings'); return; }
    if (quiz.videoConfig && (!quizCheckpoints(quiz).length || checkpointProblems(quiz).length)) {
      setStorageError(labels.invalidCheckpoints); return;
    }
    setRecoveredSession(undefined); setRecoveryProblem(undefined);
    setSelectedQuiz(quiz);
    setView('host');
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
      ...DEFAULT_QUIZ_COVER,
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

  // Native menu (desktop): commands act only from the library or Settings, never during a game or in the editor.
  const libraryVisible = view === 'dashboard' || view === 'settings';
  const menuCommand = useRef<(command: DesktopMenuCommand) => void>(() => {});
  menuCommand.current = command => {
    if (!libraryVisible) return;
    if (command === 'new-quiz' || command === 'new-video-quiz') handleCreateNewQuiz(command === 'new-video-quiz');
    else if (command === 'import-questions') setImportingQuestions(true);
    else if (command === 'backup' || command === 'about') openSettings(command);
    else if (command === 'guide') window.location.assign(`?app=guide&lang=${language}`);
  };
  useEffect(() => window.quriosoDesktop?.menu?.onCommand(command => menuCommand.current(command)), []);
  useEffect(() => { window.quriosoDesktop?.menu?.setLibraryVisible(libraryVisible); }, [libraryVisible]);
  // The window title names the open quiz.
  useEffect(() => {
    if (!desktop) return;
    document.title = ['editor', 'classroom', 'host'].includes(view) ? `${selectedQuiz.title} — Qurioso` : 'Qurioso';
  }, [desktop, view, selectedQuiz.title]);

  const importDialog = importingQuestions && <QuestionImportDialog quizzes={quizzes} onCancel={() => setImportingQuestions(false)} onConfirm={quiz => { setSelectedQuiz(quiz); setImportingQuestions(false); setView('editor'); }} />;
  const guide = showGuide && <MultiplatformGuide onClose={() => setShowGuide(false)} />;

  if (checkingRecovery) return <div role="status" className="min-h-screen bg-white text-petrolio p-8">{labels.recoveringPresenter}</div>;

  if (!libraryReady) return <div role="status" className="min-h-screen bg-white text-petrolio p-8">{labels.loadingLibrary}</div>;

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

  // A PIN belongs to the teacher's server, not the public static website.
  if (view === 'player' && publicSite) return <main className="max-w-2xl mx-auto p-8 space-y-5 text-ink"><h1 className="text-2xl font-black text-petrolio">{labels.joinNetworkTitle}</h1><p>{labels.joinWebsiteHelp}</p><p>{labels.participantDownloadHint}</p><a className="underline font-bold" href={downloadsUrl}>{labels.teacherDownloads}</a><button className="block underline" onClick={() => setView('dashboard')}>{labels.backToQuizzes}</button></main>;

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
          categories={quizzes.map(quiz => quiz.category || '')}
          onSave={handleSaveFromEditor}
          onCancel={() => setView('dashboard')}
        />
      </div>
    );
  }

  if (view === 'settings') return <>{importDialog}{guide}<SettingsScreen quizzes={quizzes} onRestored={updated => { setQuizzes(updated); setStorageError(''); }} onEditor={handleEditQuiz} onQuestions={() => setImportingQuestions(true)} onCreate={() => handleCreateNewQuiz()} onCreateVideo={() => handleCreateNewQuiz(true)} onBack={() => { setSettingsFocus(undefined); setView('dashboard'); }} onGuide={() => setShowGuide(true)} environment={environmentText} focus={settingsFocus} /></>;

  // DEFAULT VIEW: MAIN DASHBOARD & QUIZ HUB
  // The library and its cards are shared; only the surrounding frame depends on the environment.
  const alerts = <>
        {recoveryProblem && <div role="alert" className="rounded-xl border border-line bg-white p-4 text-petrolio">
          <p>{recoveryProblem.message}</p>
          {['unavailable', 'context_missing'].includes(recoveryProblem.status) && <div className="flex gap-3 mt-3">
            <button className="btn-mandarino rounded-xl px-4 py-2" onClick={() => void recoverHost()}>{labels.retryRecovery}</button>
            <button className="underline" onClick={async () => { await gameSync.endRecoverableSession(); setRecoveryProblem(undefined); }}>{labels.endRecovery}</button>
          </div>}
        </div>}
        {storageError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{storageError}</p>}
  </>;
  // Quizzes Collection Section
  const library = (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-ink">
                {workspace.library}
              </h2>
            </div>

            {!desktop && <NewQuizMenu w={workspace} onCreateQuiz={handleCreateNewQuiz} />}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableQuizzes.map((quiz) => {
              const included = OFFICIAL_QUIZZES.some(item => item.id === quiz.id);
              const personal = quizzes.some(item => item.id === quiz.id);
              const isVideoQuiz = !!quiz.videoConfig;

              return (
                <div
                  key={quiz.id} data-quiz-id={quiz.id}
                  className="group rounded-3xl bg-white border border-line hover:border-mandarino/60 shadow-md overflow-hidden flex flex-col transition duration-200 hover:-translate-y-1"
                >
                  {/* Card Cover Image */}
                  <div className="relative h-44 w-full bg-surface-soft overflow-hidden">
                    {quiz.coverImage ? (
                      <FallbackImage
                        src={quiz.coverImage}
                        alt={quiz.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        placeholderClassName="w-full h-full"
                      />
                    ) : (
                      <ImagePlaceholder className="w-full h-full" />
                    )}

                    {/* Category Tag */}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white backdrop-blur-md text-[11px] font-extrabold text-ink border border-line shadow-md">
                      {quiz.category}{included && ` · ${workspace.included}`}
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
                        {publicSite || classroomOnly ? labels.classicQuiz : t.multiplayerLiveBadge}
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
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-4 border-t border-line space-y-2">
                      {networkMode && <>
                      {/* Primary Play Button */}
                      <button
                        disabled={!serverInfo || (isVideoQuiz && !quizCheckpoints(quiz).length)}
                        title={!serverInfo ? labels.needsLocalServer : workspace.networkHint}
                        onClick={() => handleStartHost(quiz)}
                        className="w-full py-2.5 px-3 rounded-xl btn-petrolio font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-white" />
                        <span>{isVideoQuiz ? labels.networkVideo : labels.networkClassic}</span>
                      </button>

                      {(isVideoQuiz && !quizCheckpoints(quiz).length || !serverInfo) && <p className="text-xs text-muted">{isVideoQuiz && !quizCheckpoints(quiz).length ? labels.addCheckpoint : labels.networkRequiresServer}</p>}
                      </>}

                      {!networkMode && <button type="button" onClick={() => { setSelectedQuiz(quiz); setView('classroom'); }} className="w-full py-3 px-3 rounded-xl btn-mandarino font-bold text-sm cursor-pointer">{isVideoQuiz ? labels.classroomVideoAction : labels.classroomAction}</button>}
                      {/* Manage Buttons */}
                      <div className="relative flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleEditQuiz(quiz)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t.editQuiz}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <ImageCreditDetails attribution={quiz.coverAttribution} label={workspace.imageCredits} />
                          <button
                            onClick={() => handleDuplicateQuiz(quiz)}
                            className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
                            title={t.duplicateQuiz}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {personal && !included && <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-muted hover:text-rose-700 transition cursor-pointer"
                            title={t.deleteQuiz}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
  );

  if (desktop) return (
    <DesktopShell serverInfo={serverInfo} onCreateQuiz={handleCreateNewQuiz} onOpenSettings={() => openSettings()}>
      {importDialog}
      {alerts}
      <ActivityModeSwitch mode={activityMode} onChange={changeActivityMode} />
      {library}
    </DesktopShell>
  );

  return (
    <WebShell
      classroomOnly={!networkMode}
      serverInfo={publicSite ? null : serverInfo}
      onOpenSettings={() => openSettings()}
      onJoinClick={() => {
        setPlayerPin('');
        setView('player');
      }}
      onShowGuide={() => setShowGuide(true)}
    >
      {importDialog}
      {alerts}
        <section data-workspace className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <h2 className="text-2xl md:text-3xl font-black text-ink">{serverInfo ? workspace.title : workspace.webTitle}</h2>
              <p className="text-muted">{workspace.intro}</p>
            </div>
          </div>
          {!publicSite && serverInfo ? <div role="group" aria-label={workspace.mode} className="grid sm:grid-cols-2 gap-3">
            {(['classroom', 'network'] as const).map(mode => <button key={mode} type="button" data-activity-mode={mode} aria-pressed={activityMode === mode} onClick={() => changeActivityMode(mode)} className={`rounded-2xl border-2 p-4 text-left transition ${activityMode === mode ? 'border-petrolio bg-petrolio text-white shadow-md' : 'border-line bg-white text-petrolio hover:bg-surface-soft'}`}>
              <span className="flex items-center justify-between gap-2 font-black">{mode === 'classroom' ? workspace.classroom : workspace.network}{activityMode === mode && <CheckCircle size={20} aria-label={workspace.selected} />}</span>
              <span className="block mt-2 text-sm">{mode === 'classroom' ? workspace.classroomHint : workspace.networkHint}</span>
            </button>)}
          </div> : <p className="rounded-2xl bg-white border border-line p-4 text-petrolio">{workspace.classroomHint}</p>}
          {networkMode && <p role="status" className="text-sm text-petrolio">{serverInfo ? workspace.networkReady : workspace.networkWaiting} <a className="underline font-bold" href={`?app=guide&topic=network&lang=${language}`}>{workspace.docs}</a></p>}
          {publicSite && <aside data-device-download className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"><p className="font-bold text-petrolio">{workspace.devicesTitle}</p><a href={downloadsUrl} className="inline-flex items-center gap-2 btn-petrolio rounded-xl px-4 py-2.5 font-bold"><Download size={18} />{workspace.devicesDownload}</a></aside>}
        </section>
      {library}
      {guide}
    </WebShell>
  );
}
