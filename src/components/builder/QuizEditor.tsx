import React, { useState, useRef } from 'react';
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
import { VideoSourcePicker } from '../common/VideoSourcePicker';
import { prepareVideoQuiz, exportVideoQuiz, quizCheckpoints } from '../../services/videoQuiz';
import { ImagePicker } from '../common/ImagePicker';
import { useLanguage } from '../../context/LanguageContext';

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
  const { t } = useLanguage();
  const [quiz, setQuiz] = useState<Quiz>(() => {
    if (initialQuiz) return JSON.parse(JSON.stringify(initialQuiz));
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

  const videoDraftRef = useRef(quiz.videoConfig);
  const chooseVideoMode = (enabled: boolean) => {
    if (!enabled && quiz.videoConfig) videoDraftRef.current = quiz.videoConfig;
    setQuiz(prev => ({ ...prev, videoConfig: enabled ? prev.videoConfig || videoDraftRef.current || {
      videoUrl: '', videoTitle: '', videoType: 'html5', pauseMode: 'defined', checkpoints: [],
    } : undefined }));
  };

  // Add Question
  const addQuestion = (type: 'multiple_choice' | 'true_false' = 'multiple_choice') => {
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
      id: `q-${Date.now()}`,
      text: '',
      type,
      timeLimit: 20,
      points: 1000,
      options: newOptions,
      explanation: '',
    };

    setQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    setActiveQuestionIndex(quiz.questions.length);
  };

  // Duplicate Question
  const duplicateQuestion = (idx: number) => {
    const qToDup = quiz.questions[idx];
    const duplicated: Question = {
      ...JSON.parse(JSON.stringify(qToDup)),
      id: `q-${Date.now()}`,
      text: qToDup.text ? `${qToDup.text} (${t.duplicate})` : '',
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
    setQuiz((prev) => ({ ...prev, questions: newQuestions }));
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

  // Import JSON quiz
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && imported.questions && Array.isArray(imported.questions)) {
          setQuiz({
            ...imported,
            id: `quiz-${Date.now()}`,
          });
          setActiveQuestionIndex(0);
        }
      } catch {
        // invalid JSON
      }
    };
    reader.readAsText(file);
  };

  // Export JSON quiz
  const handleExportJSON = async () => {
    setSaveError('');
    setIsSaving(true);
    try {
      const exportedQuiz = await exportVideoQuiz(quiz);
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

  return (
    <div className="flex flex-col h-full w-full bg-white text-ink overflow-hidden">
      {/* Top Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-line">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-xl hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => setQuiz((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t.untitledQuiz}
              className="text-base md:text-lg font-black bg-transparent border-b border-transparent hover:border-line focus:border-petrolio focus:outline-none px-1 text-ink"
            />
            <div className="text-xs text-muted px-1">
              {quiz.questions.length} {t.questionsCreated}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-semibold rounded-xl border border-line transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-petrolio" />
            <span>{t.importJson}</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            disabled={isSaving || videoBusy}
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-semibold rounded-xl border border-line transition cursor-pointer"
            title={t.exportJsonFile}
          >
            <FileJson className="w-3.5 h-3.5 text-petrolio" />
            <span>{t.exportJsonFile}</span>
          </button>

          <button
            disabled={isSaving || videoBusy}
            onClick={async () => {
              setIsSaving(true); setSaveError('');
              try { await onSave(prepareVideoQuiz(quiz)); }
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
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Sidebar: Questions List */}
        <div className="w-full lg:w-52 xl:w-64 shrink-0 max-h-56 lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-line flex flex-col">
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
                onClick={() => setActiveQuestionIndex(idx)}
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
          <div className="min-w-0 shrink-0 lg:shrink flex-1 flex flex-col lg:overflow-y-auto p-4 md:p-6 bg-white">
            {saveError && <p role="alert" className="w-full max-w-3xl mx-auto mb-4 text-sm text-rose-700">{saveError}</p>}
            <div className="w-full max-w-3xl mx-auto mb-6 space-y-3">
              {quiz.videoConfig && <>
                <VideoSourcePicker value={quiz.videoConfig} onBusyChange={setVideoBusy} onChange={selection => {
                  setQuiz(prev => ({ ...prev, videoConfig: prev.videoConfig ? { ...prev.videoConfig, ...selection } : undefined }));
                }} />
                <p className="text-xs text-muted">Per ogni domanda imposta il tempo del checkpoint nella colonna a destra. Il video si fermerà e riprenderà dopo la risposta.</p>
              </>}
              <ImagePicker label="Copertina del quiz" value={quiz.coverImage} attribution={quiz.coverAttribution}
                onChange={(url, attribution) => setQuiz(prev => ({ ...prev, coverImage: url, coverAttribution: attribution }))} />
            </div>
            {/* Question Text Input */}
            <div className="w-full max-w-3xl mx-auto mb-6">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-muted mb-2">
                {t.questionTextInputLabel}
              </label>
              <textarea
                rows={2}
                value={currentQuestion.text}
                onChange={(e) => updateCurrentQuestion({ text: e.target.value })}
                placeholder={t.questionTextInputLabel}
                className="w-full bg-white border-2 border-line focus:border-petrolio rounded-2xl p-4 text-base md:text-lg font-bold text-ink placeholder-muted focus:outline-none transition"
              />
            </div>

            <div className="w-full max-w-3xl mx-auto mb-6">
              <ImagePicker key={currentQuestion.id} label="Immagine della domanda" value={currentQuestion.mediaUrl} attribution={currentQuestion.mediaAttribution}
                onChange={(url, attribution) => updateCurrentQuestion({ mediaUrl: url, mediaType: url ? 'image' : undefined, mediaAttribution: attribution })} />
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

                      {/* Input Text */}
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOption(opt.id, { text: e.target.value })}
                        placeholder={`Option ${optIdx + 1}...`}
                        className="flex-1 bg-transparent border-0 focus:outline-none font-bold text-sm text-ink placeholder-muted"
                      />

                      {/* Correct Checkbox */}
                      <button
                        type="button"
                        onClick={() => updateOption(opt.id, { isCorrect: !opt.isCorrect })}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
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

        {/* Right Sidebar: Question Settings */}
        {currentQuestion && (
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
            <div className="border-t border-line pt-4">
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
        )}
      </div>
    </div>
  );
};
