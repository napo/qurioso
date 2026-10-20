import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Check,
  Save,
  ArrowLeft,
  Image as ImageIcon,
  Clock,
  Award,
  Video,
  FileJson,
  Upload,
  HelpCircle
} from 'lucide-react';
import { Quiz, Question, QuestionOption } from '../../types/quiz';
import { OPTION_COLORS, SHAPE_ICONS } from '../../utils/quizStyles';
import { VideoTimelineEditor } from './VideoTimelineEditor';
import { VideoQuizPlayer } from '../video/VideoQuizPlayer';
import { editorDraft, type EditorDraft } from '../../services/quizStorage';
import { prepareVideoQuiz, exportVideoQuiz, quizCheckpoints, editableVideoQuiz, setQuestionCheckpoint } from '../../services/videoQuiz';
import { ImagePicker } from '../common/ImagePicker';
import { useLanguage } from '../../context/LanguageContext';
import { QuestionImportDialog } from './QuestionImportDialog';
import { importText } from '../../i18n/questionImport';

interface QuizEditorProps {
  initialQuiz?: Quiz;
  onSave: (quiz: Quiz) => void | Promise<void>;
  onCancel: () => void;
}

export const QuizEditor: React.FC<QuizEditorProps> = ({
  initialQuiz,
  onSave,
  onCancel,
}) => {
  const { t, language } = useLanguage();
  const titleId = useId();
  const [importingQuestions, setImportingQuestions] = useState(false);
  const quizImportInput = useRef<HTMLInputElement>(null);
  const [quiz, setQuiz] = useState<Quiz>(() => {
    if (initialQuiz) return editableVideoQuiz(JSON.parse(JSON.stringify(initialQuiz)));
    return {
      id: `quiz-${Date.now()}`,
      title: t.untitledQuiz,
      description: '',
      category: 'Cultura Generale',
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
          text: '',
          type: 'multiple_choice',
          timeLimit: 20,
          points: 1000,
          explanation: '',
          options: [
            { id: 'opt-1', text: '', isCorrect: true, color: 'red', shape: 'triangle' },
            { id: 'opt-2', text: '', isCorrect: false, color: 'blue', shape: 'diamond' },
            { id: 'opt-3', text: '', isCorrect: false, color: 'yellow', shape: 'circle' },
            { id: 'opt-4', text: '', isCorrect: false, color: 'green', shape: 'square' },
          ],
        },
      ],
    };
  });

  const [videoBusy, setVideoBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const currentQuestion: Question | undefined = quiz.questions[activeQuestionIndex];

  const [videoDuration, setVideoDuration] = useState(0);
  const [timelinePending, setTimelinePending] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz>();
  const baseline = useRef(JSON.stringify(quiz));
  const [draftReady, setDraftReady] = useState(false);
  const [draftCandidate, setDraftCandidate] = useState<EditorDraft>();
  const [draftError, setDraftError] = useState('');
  const dirty = JSON.stringify(quiz) !== baseline.current;
  useEffect(() => {
    let cancelled = false;
    editorDraft('read').then(draft => {
      if (cancelled) return;
      if (draft?.quiz && JSON.stringify(editableVideoQuiz(draft.quiz)) !== baseline.current) setDraftCandidate(draft);
      else setDraftReady(true);
    }).catch(() => { if (!cancelled) { setDraftReady(true); setDraftError('Recupero bozze non disponibile. Esporta il quiz prima di chiudere la pagina.'); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!dirty || !draftReady || isSaving) return;
    const timer = setTimeout(() => { editorDraft('write', quiz).then(() => setDraftError('')).catch(error => setDraftError(error.message)); }, 500);
    return () => clearTimeout(timer);
  }, [quiz, dirty, draftReady, isSaving]);
  useEffect(() => {
    if (!dirty && !videoBusy && !timelinePending) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, videoBusy, timelinePending]);
  const exitEditor = async () => {
    if ((dirty || videoBusy || timelinePending) && !window.confirm('Ci sono modifiche non salvate. Vuoi scartarle e uscire dall’editor?')) return;
    try { await editorDraft('delete'); } catch { /* Explicit discard still permits exit. */ }
    onCancel();
  };
  const selectQuestion = (id: string) => { if (timelinePending && id !== currentQuestion?.id && !window.confirm('Il tempo modificato non è stato applicato. Vuoi scartare questa modifica e cambiare domanda?')) return; const index = quiz.questions.findIndex(q => q.id === id); if (index >= 0) setActiveQuestionIndex(index); };
  const createId = () => `q-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')}`;

  const videoDraftRef = useRef(quiz.videoConfig);
  const chooseVideoMode = (enabled: boolean) => {
    if (timelinePending && !window.confirm('Il tempo modificato non è stato applicato. Vuoi scartare questa modifica e cambiare modalità?')) return;
    setTimelinePending(false);
    if (!enabled && quiz.videoConfig) videoDraftRef.current = quiz.videoConfig;
    setQuiz(prev => ({ ...prev, videoConfig: enabled ? prev.videoConfig || videoDraftRef.current || {
      videoUrl: '', videoTitle: '', videoType: 'html5', pauseMode: 'defined', checkpointMode: 'explicit', checkpoints: [],
    } : undefined }));
  };

  // Add Question
  const addQuestion = (type: 'multiple_choice' | 'true_false' = 'multiple_choice', timestamp?: number) => {
    let newOptions: QuestionOption[] = [];
    if (type === 'true_false') {
      newOptions = [
        { id: `opt-${Date.now()}-1`, text: 'Vero', isCorrect: true, color: 'blue', shape: 'diamond' },
        { id: `opt-${Date.now()}-2`, text: 'Falso', isCorrect: false, color: 'red', shape: 'triangle' },
      ];
    } else {
      newOptions = [
        { id: `opt-${Date.now()}-1`, text: '', isCorrect: true, color: 'red', shape: 'triangle' },
        { id: `opt-${Date.now()}-2`, text: '', isCorrect: false, color: 'blue', shape: 'diamond' },
        { id: `opt-${Date.now()}-3`, text: '', isCorrect: false, color: 'yellow', shape: 'circle' },
        { id: `opt-${Date.now()}-4`, text: '', isCorrect: false, color: 'green', shape: 'square' },
      ];
    }

    const newQ: Question = {
      id: createId(),
      text: '',
      type,
      timeLimit: 20,
      points: 1000,
      options: newOptions,
      explanation: '',
    };

    setQuiz(prev => {
      const next = { ...prev, questions: [...prev.questions, newQ] };
      return timestamp !== undefined && next.videoConfig ? setQuestionCheckpoint(next, newQ.id, timestamp) : next;
    });
    setActiveQuestionIndex(quiz.questions.length);
  };

  // Duplicate Question
  const duplicateQuestion = (idx: number) => {
    const qToDup = quiz.questions[idx];
    const duplicated: Question = {
      ...JSON.parse(JSON.stringify(qToDup)),
      id: createId(),
      text: qToDup.text ? `${qToDup.text} (${t.duplicate})` : '',
      ...(quiz.videoConfig ? { videoTimestamp: undefined } : {}),
    };

    const newQuestions = [...quiz.questions];
    newQuestions.splice(idx + 1, 0, duplicated);
    setQuiz((prev) => ({ ...prev, questions: newQuestions }));
    setActiveQuestionIndex(idx + 1);
  };

  // Delete Question
  const deleteQuestion = (idx: number) => {
    if (quiz.questions.length <= 1) return;
    const newQuestions = quiz.questions.filter((_, i) => i !== idx);
    setQuiz(prev => ({ ...prev, questions: newQuestions, videoConfig: prev.videoConfig ? { ...prev.videoConfig, checkpoints: prev.videoConfig.checkpoints.filter(cp => cp.questionId !== quiz.questions[idx].id) } : undefined }));
    if (activeQuestionIndex >= newQuestions.length) {
      setActiveQuestionIndex(Math.max(0, newQuestions.length - 1));
    }
  };

  // Move Question order
  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= quiz.questions.length) return;

    const newQuestions = [...quiz.questions];
    const temp = newQuestions[idx];
    newQuestions[idx] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;

    setQuiz((prev) => ({ ...prev, questions: newQuestions }));
    setActiveQuestionIndex(targetIdx);
  };

  // Update current active question
  const updateCurrentQuestion = (updates: Partial<Question>) => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    setQuiz(prev => ({ ...prev, questions: prev.questions.map(question =>
      question.id === questionId ? { ...question, ...updates } : question) }));
  };

  // Update Option
  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    if (!currentQuestion) return;
    const newOptions = currentQuestion.options.map((opt) => {
      if (opt.id === optionId) {
        return { ...opt, ...updates };
      }
      return opt;
    });
    updateCurrentQuestion({ options: newOptions });
  };

  const prepareQuiz = () => {
    if (!quiz.title.trim()) throw new Error('Inserisci il titolo del quiz prima di salvare o provare.');
    const invalidIndex = quiz.questions.findIndex(question => question.options.filter(option => option.isCorrect).length !== 1);
    if (invalidIndex >= 0) throw new Error(`La domanda ${invalidIndex + 1} deve avere una sola risposta corretta. Seleziona quella esatta.`);
    return prepareVideoQuiz({ ...quiz, title: quiz.title.trim() }, videoDuration);
  };

  // Import JSON quiz
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || (dirty && !window.confirm('Sostituire le modifiche correnti con il quiz importato?'))) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!imported || typeof imported.title !== 'string' || !imported.settings || !Array.isArray(imported.questions) || !imported.questions.length ||
            imported.questions.some((q: Question) => !q || typeof q.id !== 'string' || typeof q.text !== 'string' || !Array.isArray(q.options) || q.options.length < 2) ||
            (imported.videoConfig && (typeof imported.videoConfig.videoUrl !== 'string' || !Array.isArray(imported.videoConfig.checkpoints)))) throw new Error('Il file non contiene un quiz valido.');
        setQuiz(editableVideoQuiz({ ...imported, id: `quiz-${Date.now()}` }));
        setVideoDuration(0); setActiveQuestionIndex(0); setSaveError('');
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Importazione non riuscita.');
      }
    };
    reader.readAsText(file);
  };

  // Export JSON quiz
  const handleExportJSON = async () => {
    setSaveError('');
    setIsSaving(true);
    try {
      const exportedQuiz = await exportVideoQuiz(prepareQuiz());
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(exportedQuiz, null, 2)], { type: 'application/json' }));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = objectUrl;
      downloadAnchor.download = `${quiz.title.toLowerCase().replace(/\s+/g, '_')}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Esportazione non riuscita.'); }
    finally { setIsSaving(false); }
  };

  const questionSettings = currentQuestion && (
          <div className="w-full lg:w-64 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-line p-4 flex flex-col gap-5 lg:overflow-y-auto">
            <span className="text-xs uppercase font-extrabold tracking-wider text-muted">
              {t.questionSettings}
            </span>

            {/* Time Limit */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-petrolio" />
                {t.timeLimitLabel}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[5, 10, 15, 20, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateCurrentQuestion({ timeLimit: sec })}
                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      currentQuestion.timeLimit === sec
                        ? 'bg-petrolio text-white'
                        : 'bg-surface-soft text-muted hover:text-ink'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Points */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-accent-ink" />
                {t.standardPointsLabel}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: '0 pts', val: 0 },
                  { label: '1000', val: 1000 },
                  { label: '2000 (2x)', val: 2000 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => updateCurrentQuestion({ points: p.val })}
                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      currentQuestion.points === p.val
                        ? 'bg-mandarino text-ink'
                        : 'bg-surface-soft text-muted hover:text-ink'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Checkpoint Timestamp */}
            <div hidden={!!quiz.videoConfig} className="border-t border-line pt-4">
              <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-petrolio" />
                {t.videoCheckpointLabel}
              </label>
              <p className="text-[11px] text-muted mb-2">
                {t.videoCheckpointHint}
              </p>
              <input
                type="number"
                min={0}
                value={currentQuestion.videoTimestamp ?? quizCheckpoints(quiz).find(cp => cp.questionId === currentQuestion.id)?.timestamp ?? (activeQuestionIndex + 1) * 10}
                onChange={(e) => updateCurrentQuestion({ videoTimestamp: Number(e.target.value) })}
                className="w-full bg-white border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-petrolio"
              />
            </div>
          </div>

  );

  if (draftCandidate) return <main className="h-full overflow-auto flex flex-col items-center justify-center p-6 gap-4 bg-white text-petrolio" role="dialog" aria-modal="true" aria-label="Recupera bozza">
    <h2 className="text-2xl font-bold">C’è una bozza non salvata</h2><p>{draftCandidate.quiz.title}</p>
    <div className="flex flex-wrap gap-3"><button className="btn-petrolio rounded-xl px-5 py-3" onClick={() => { setQuiz(editableVideoQuiz(draftCandidate.quiz)); setActiveQuestionIndex(0); setVideoDuration(0); setDraftCandidate(undefined); setDraftReady(true); }}>Riprendi bozza</button>
      <button className="btn-mandarino rounded-xl px-5 py-3" onClick={async () => { try { await editorDraft('delete'); } catch { setDraftError('Impossibile cancellare la bozza precedente.'); } setDraftCandidate(undefined); setDraftReady(true); }}>Scarta bozza</button></div>
  </main>;
  if (previewQuiz) return <div className="h-full flex flex-col min-h-0"><p className="shrink-0 bg-surface-soft p-2 text-center text-sm text-petrolio">Prova attività · nessuna sessione multiplayer, nessun risultato permanente</p>
    <div className="flex-1 min-h-0"><VideoQuizPlayer quiz={previewQuiz} classroom preview onExit={() => setPreviewQuiz(undefined)} /></div></div>;

  return (
    <div className={`quiz-editor flex flex-col h-full w-full bg-white text-ink overflow-hidden ${quiz.videoConfig ? 'quiz-editor-video' : ''}`}>
      {importingQuestions && <QuestionImportDialog initialQuiz={quiz} onCancel={() => setImportingQuestions(false)} onConfirm={next => { setQuiz(next); setActiveQuestionIndex(quiz.questions.length); setImportingQuestions(false); }} />}
      {/* Top Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-line">
        <div className="flex items-center gap-3">
          <button
            aria-label="Esci dall’editor" onClick={() => void exitEditor()}
            className="p-1.5 rounded-xl hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <label htmlFor={titleId} className="block px-1 text-xs font-bold text-petrolio">Titolo del quiz</label>
            <input
              id={titleId} type="text"
              value={quiz.title}
              onChange={(e) => setQuiz((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t.untitledQuiz}
              className="w-full text-base md:text-lg font-black bg-white border border-line rounded-lg focus:border-petrolio focus:outline-none px-2 py-1 text-ink"
            />
            <div className="text-xs text-muted px-1">
              {quiz.questions.length} {t.questionsCreated}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={isSaving || videoBusy || timelinePending || !draftReady} onClick={() => setImportingQuestions(true)} className="btn-petrolio rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50">{importText(language, 'importQuestions')}</button>
          <button type="button" disabled={isSaving || videoBusy || timelinePending || !draftReady} onClick={() => quizImportInput.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-semibold rounded-xl border border-line transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-petrolio" />
            <span>{importText(language, 'fullQuiz')}</span>
          </button>
          <input ref={quizImportInput} type="file" accept=".json" onChange={handleImportJSON} className="hidden" aria-label={importText(language, 'fullQuiz')} />

          <button
            disabled={isSaving || videoBusy || timelinePending || !draftReady}
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-semibold rounded-xl border border-line transition cursor-pointer"
            title={t.exportJsonFile}
          >
            <FileJson className="w-3.5 h-3.5 text-petrolio" />
            <span>{t.exportJsonFile}</span>
          </button>

          {quiz.videoConfig && <button type="button" className="btn-petrolio rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={isSaving || videoBusy || timelinePending || !draftReady} onClick={() => {
            setSaveError('');
            try { const prepared = prepareQuiz(); if (!quizCheckpoints(prepared).length) throw new Error('Associa almeno una domanda al video prima di provare l’attività.'); setPreviewQuiz(prepared); }
            catch (error) { setSaveError(error instanceof Error ? error.message : 'Anteprima non disponibile.'); }
          }}>Prova attività</button>}
          <button
            disabled={isSaving || videoBusy || timelinePending || !draftReady}
            onClick={async () => {
              setIsSaving(true); setSaveError('');
              try { const prepared = prepareQuiz(); await onSave(prepared); baseline.current = JSON.stringify(quiz); await editorDraft('delete'); }
              catch (error) { setSaveError(error instanceof Error ? error.message : 'Salvataggio non riuscito.'); }
              finally { setIsSaving(false); }
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-mandarino hover:bg-mandarino text-ink text-xs font-bold rounded-xl shadow-md shadow-mandarino/25 transition active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{t.saveQuiz}</span>
          </button>
        </div>
      </div>

      <section aria-label="Tipo di quiz" className="shrink-0 border-b border-line bg-surface-soft px-4 py-3 md:px-6">
        <h2 className="text-xs font-bold text-petrolio mb-2">Tipo di quiz</h2>
        <div role="group" aria-label="Scegli il tipo di quiz" className="flex flex-wrap gap-3">
          <button type="button" aria-pressed={!quiz.videoConfig} disabled={videoBusy} onClick={() => chooseVideoMode(false)}
            className={`rounded-xl border-2 px-4 py-2 text-left cursor-pointer ${!quiz.videoConfig ? 'border-petrolio bg-white text-petrolio' : 'border-line bg-white text-muted'}`}>
            <span className="block text-sm font-bold">Quiz classico</span>
            <span className="block text-xs">Domande e risposte</span>
          </button>
          <button type="button" aria-pressed={!!quiz.videoConfig} disabled={videoBusy} onClick={() => chooseVideoMode(true)}
            className={`rounded-xl border-2 px-4 py-2 text-left cursor-pointer ${quiz.videoConfig ? 'border-mandarino bg-white text-petrolio' : 'border-line bg-white text-muted'}`}>
            <span className="flex items-center gap-2 text-sm font-bold"><Video className="h-4 w-4" />Quiz con video</span>
            <span className="block text-xs">YouTube, Vimeo o file dal computer</span>
          </button>
        </div>
      </section>

      {/* Editor Body: Left Sidebar (Question Thumbnails) + Center (Question Editor) + Right Sidebar (Settings) */}
      {(saveError || draftError) && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-rose-700">{saveError || draftError}</p>}
      <div className="editor-body flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {quiz.videoConfig && <VideoTimelineEditor quiz={quiz} selectedQuestionId={currentQuestion?.id} onChange={setQuiz} onSelect={selectQuestion}
          onCreateAt={seconds => addQuestion('multiple_choice', seconds)} onDuration={setVideoDuration} onBusy={setVideoBusy} onPending={setTimelinePending} />}
        {/* Left Sidebar: Questions List */}
        <div className="editor-question-list w-full lg:w-52 xl:w-64 shrink-0 max-h-56 lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-line flex flex-col">
          <div className="p-3 border-b border-line flex items-center justify-between">
            <span className="text-xs uppercase font-extrabold tracking-wider text-muted">
              {t.questionsSidebarTitle} ({quiz.questions.length})
            </span>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
            {quiz.questions.map((q, idx) => (
              <div
                key={q.id}
                role="button" tabIndex={0} aria-label={`Modifica domanda ${idx + 1}: ${q.text || 'senza titolo'}`}
                onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectQuestion(q.id); } }}
                onClick={() => selectQuestion(q.id)}
                className={`group relative p-3 rounded-xl border text-left cursor-pointer transition ${
                  activeQuestionIndex === idx
                    ? 'bg-petrolio/20 border-petrolio shadow-md ring-1 ring-petrolio'
                    : 'bg-surface-soft border-line hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted mb-1">
                  <span>#{idx + 1} • {q.type === 'true_false' ? t.trueFalse : t.multipleChoice}</span>
                  <span className="text-muted">{q.timeLimit}s</span>
                </div>
                <div className="text-xs font-semibold text-ink line-clamp-2">
                  {q.text || t.noQuestionText}
                </div>
                {quiz.videoConfig && !quizCheckpoints(quiz).some(cp => cp.questionId === q.id) && <p className="text-xs text-accent-ink mt-1">Non associata al video</p>}

                {/* Hover Quick Actions */}
                <div className="hidden group-hover:flex items-center gap-1 mt-2 pt-2 border-t border-line justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveQuestion(idx, 'up');
                    }}
                    disabled={idx === 0}
                    className="p-1 hover:bg-surface-hover rounded text-muted hover:text-ink disabled:opacity-30"
                    title={t.moveUp}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveQuestion(idx, 'down');
                    }}
                    disabled={idx === quiz.questions.length - 1}
                    className="p-1 hover:bg-surface-hover rounded text-muted hover:text-ink disabled:opacity-30"
                    title={t.moveDown}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateQuestion(idx);
                    }}
                    className="p-1 hover:bg-surface-hover rounded text-muted hover:text-ink"
                    title={t.duplicate}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestion(idx);
                    }}
                    className="p-1 hover:bg-rose-50 rounded text-muted hover:text-rose-700"
                    title={t.delete}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Buttons */}
          <div className="p-3 border-t border-line space-y-1.5">
            <button
              onClick={() => addQuestion('multiple_choice')}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-petrolio hover:bg-petrolio text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addMultipleChoice}</span>
            </button>
            <button
              onClick={() => addQuestion('true_false')}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-surface-soft hover:bg-surface-hover text-muted rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-petrolio" />
              <span>{t.addTrueFalse}</span>
            </button>
          </div>
        </div>

        {/* Center: Main Question Editor Canvas */}
        {currentQuestion && (
          <div className="editor-question-canvas min-w-0 shrink-0 lg:shrink flex-1 flex flex-col lg:overflow-y-auto p-4 md:p-6 bg-white">
            {saveError && <p role="alert" className="w-full max-w-3xl mx-auto mb-4 text-sm text-rose-700">{saveError}</p>}
            <div className="w-full max-w-3xl mx-auto mb-6 space-y-3">
              <details open><summary className="text-sm font-bold text-petrolio cursor-pointer">Copertina del quiz</summary>
              <ImagePicker label="Copertina del quiz" value={quiz.coverImage} attribution={quiz.coverAttribution}
                onChange={(url, attribution) => setQuiz(prev => ({ ...prev, coverImage: url, coverAttribution: attribution }))} /></details>
            </div>
            {/* Question Text Input */}
            <div className="w-full max-w-3xl mx-auto mb-6">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-muted mb-2">
                {t.questionTextInputLabel}
              </label>
              <textarea
                aria-label="Testo della domanda" rows={2}
                value={currentQuestion.text}
                onChange={(e) => updateCurrentQuestion({ text: e.target.value })}
                placeholder={t.questionTextInputLabel}
                className="w-full bg-white border-2 border-line focus:border-petrolio rounded-2xl p-4 text-base md:text-lg font-bold text-ink placeholder-muted focus:outline-none transition"
              />
            </div>

            <div className="w-full max-w-3xl mx-auto mb-6">
<details open={!quiz.videoConfig}><summary className="text-sm font-bold text-petrolio cursor-pointer">Immagine della domanda</summary><ImagePicker key={currentQuestion.id} label="Immagine della domanda" value={currentQuestion.mediaUrl} attribution={currentQuestion.mediaAttribution}
                onChange={(url, attribution) => updateCurrentQuestion({ mediaUrl: url, mediaType: url ? 'image' : undefined, mediaAttribution: attribution })} /></details>
            </div>

            {/* Options Grid */}
            <div className="w-full max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
                  {t.responseOptionsLabel}
                </span>
                <span className="text-xs text-muted">
                  {currentQuestion.options.filter((o) => o.isCorrect).length} {t.correctCount}
                </span>
              </div>

              <p className="mb-3 text-xs text-muted">Seleziona una sola risposta corretta.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentQuestion.options.map((opt, optIdx) => {
                  const style = OPTION_COLORS[opt.color] || OPTION_COLORS.blue;

                  return (
                    <div
                      key={opt.id}
                      className={`relative flex items-center gap-3 p-3.5 rounded-2xl transition border-2 ${
                        opt.isCorrect
                          ? 'border-emerald-400 bg-white ring-2 ring-emerald-500/20 shadow-lg'
                          : 'border-line bg-white'
                      }`}
                    >
                      {/* Shape Badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${style.badge}`}>
                        {SHAPE_ICONS[opt.shape] || '▲'}
                      </div>

                      {/* Long video answers remain readable and editable without pushing controls out. */}
                      {quiz.videoConfig ? <textarea aria-label={`Risposta ${optIdx + 1}`} rows={2} value={opt.text}
                        onChange={event => updateOption(opt.id, { text: event.target.value })} placeholder={`Option ${optIdx + 1}...`}
                        className="min-w-0 w-full flex-1 resize-y bg-transparent border-0 focus:outline-none font-bold text-sm text-ink placeholder-muted" /> : <input
                        type="text" value={opt.text} onChange={event => updateOption(opt.id, { text: event.target.value })} placeholder={`Option ${optIdx + 1}...`}
                        className="min-w-0 flex-1 bg-transparent border-0 focus:outline-none font-bold text-sm text-ink placeholder-muted" />}

                      {/* Selecting an answer replaces the previous correct answer. */}
                      <button
                        type="button"
                        onClick={() => updateCurrentQuestion({ options: currentQuestion.options.map(option => ({ ...option, isCorrect: option.id === opt.id })) })}
                        aria-label={`Risposta ${optIdx + 1} corretta`} aria-pressed={opt.isCorrect}
                        className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                          opt.isCorrect
                            ? 'bg-emerald-100 text-emerald-800 shadow-md'
                            : 'border-2 border-line hover:border-line text-transparent'
                        }`}
                        title={opt.isCorrect ? t.correctBadge : t.responseOptionsLabel}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {quiz.videoConfig && <details className="mt-3 rounded-xl border border-line p-3"><summary className="font-bold text-sm text-petrolio cursor-pointer">Impostazioni della domanda</summary>{questionSettings}</details>}
            {/* Explanation card */}
            <div className="w-full max-w-3xl mx-auto mt-6 bg-white p-4 rounded-2xl border border-line">
              <label className="block text-xs font-bold text-muted mb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-petrolio" />
                {t.explanationCuriosityLabel}
              </label>
              <textarea
                rows={2}
                value={currentQuestion.explanation || ''}
                onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                placeholder={t.explanationCuriosityLabel}
                className="w-full bg-white border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-muted focus:outline-none focus:border-petrolio"
              />
            </div>
          </div>
        )}

        {!quiz.videoConfig && questionSettings}
      </div>
    </div>
  );
};
