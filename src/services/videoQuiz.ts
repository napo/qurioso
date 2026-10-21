import type { Quiz, VideoQuizConfig } from '../types/quiz';
import { loadVideo } from './quizStorage';
import { blobToDataUrl } from './images';
import { serviceText } from '../i18n/serviceMessages';

export type VideoSelection = Pick<VideoQuizConfig, 'videoUrl' | 'videoType' | 'videoTitle' | 'videoAssetId' | 'videoFileName'>;

export function quizCheckpoints(quiz: Quiz) {
  if (quiz.videoConfig?.checkpointMode === 'explicit') {
    const order = new Map(quiz.questions.map((q, index) => [q.id, index]));
    return [...quiz.videoConfig.checkpoints].filter(cp => order.has(cp.questionId))
      .sort((a, b) => a.timestamp - b.timestamp || order.get(a.questionId)! - order.get(b.questionId)!);
  }
  return quiz.questions.map((question, index) => ({
    questionId: question.id,
    timestamp: question.videoTimestamp ?? quiz.videoConfig?.checkpoints.find(cp => cp.questionId === question.id)?.timestamp ?? (index + 1) * 10,
  })).sort((a, b) => a.timestamp - b.timestamp);
}

/** Materialize legacy defaults once on entry to the editor, without mutating the original. */
export function editableVideoQuiz(quiz: Quiz): Quiz {
  return quiz.videoConfig ? { ...quiz, videoConfig: { ...quiz.videoConfig, checkpointMode: 'explicit', checkpoints: quiz.videoConfig.checkpointMode === 'explicit'
    ? [...quiz.videoConfig.checkpoints] : [...quizCheckpoints(quiz), ...quiz.videoConfig.checkpoints.filter(cp => !quiz.questions.some(q => q.id === cp.questionId))] } } : quiz;
}

export function setQuestionCheckpoint(quiz: Quiz, questionId: string, timestamp?: number): Quiz {
  if (!quiz.videoConfig || !quiz.questions.some(q => q.id === questionId)) throw new Error(serviceText('questionMissing'));
  if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp < 0)) throw new Error(serviceText('timeNumeric'));
  const checkpoints = editableVideoQuiz(quiz).videoConfig!.checkpoints.filter(cp => cp.questionId !== questionId);
  if (timestamp !== undefined) checkpoints.push({ questionId, timestamp });
  return { ...quiz, questions: quiz.questions.map(q => q.id === questionId ? { ...q, videoTimestamp: timestamp } : q),
    videoConfig: { ...quiz.videoConfig, checkpointMode: 'explicit', pauseMode: 'defined', checkpoints } };
}

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const tenths = Math.round(seconds * 10), total = Math.floor(tenths / 10);
  const hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, secs = total % 60;
  return `${hours ? `${hours}:` : ''}${String(hours ? minutes : Math.floor(total / 60)).padStart(2, '0')}:${String(secs).padStart(2, '0')}${tenths % 10 ? `.${tenths % 10}` : ''}`;
}

export function parseVideoTime(value: string): number {
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || !parts.every((p, i) => i === parts.length - 1 ? /^\d{2}(?:\.\d{1,3})?$/.test(p) : /^\d+$/.test(p))) throw new Error(serviceText('timeFormat'));
  const numbers = parts.map(Number);
  if (numbers.at(-1)! >= 60 || (parts.length === 3 && numbers[1] >= 60)) throw new Error(serviceText('timeRange'));
  const seconds = numbers.reduce((total, number) => total * 60 + number, 0);
  if (!Number.isFinite(seconds)) throw new Error(serviceText('timeInvalid'));
  return seconds;
}

export function checkpointProblems(quiz: Quiz, duration?: number): string[] {
  if (!quiz.videoConfig) return [];
  const raw = quiz.videoConfig.checkpoints;
  const ids = new Set(quiz.questions.map(q => q.id));
  const errors: string[] = [];
  if (new Set(quiz.questions.map(q => q.id)).size !== quiz.questions.length) errors.push(serviceText('questionIds'));
  if (raw.some(cp => !ids.has(cp.questionId))) errors.push(serviceText('checkpointOrphan'));
  if (new Set(raw.map(cp => cp.questionId)).size !== raw.length) errors.push(serviceText('checkpointDuplicate'));
  const checkpoints = quizCheckpoints(quiz);
  if ([...raw, ...checkpoints].some(cp => !Number.isFinite(cp.timestamp) || cp.timestamp < 0)) errors.push(serviceText('checkpointTimes'));
  if (duration && Number.isFinite(duration) && checkpoints.some(cp => cp.timestamp > duration)) errors.push(serviceText('checkpointBeyond'));
  return errors;
}

export function prepareVideoQuiz(quiz: Quiz, duration?: number): Quiz {
  if (!quiz.videoConfig) return quiz;
  const problems = checkpointProblems(quiz, duration);
  if (problems.length) throw new Error(problems.join(' '));
  const checkpoints = quizCheckpoints(quiz);
  if (checkpoints.some(cp => !Number.isFinite(cp.timestamp) || cp.timestamp < 0)) throw new Error(serviceText('questionTimes'));
  if (!quiz.videoConfig.videoUrl && !quiz.videoConfig.videoAssetId) throw new Error(serviceText('videoRequired'));
  if (quiz.videoConfig.videoUrl.startsWith('blob:')) throw new Error(serviceText('temporaryUrl'));
  return { ...quiz, videoConfig: { ...quiz.videoConfig, checkpoints } };
}

export async function exportVideoQuiz(quiz: Quiz): Promise<Quiz> {
  const prepared = prepareVideoQuiz(quiz);
  if (!prepared.videoConfig?.videoAssetId) return prepared;
  const blob = await loadVideo(prepared.videoConfig.videoAssetId);
  return { ...prepared, videoConfig: { ...prepared.videoConfig, videoAssetId: undefined, videoUrl: await blobToDataUrl(blob) } };
}

export function nextCheckpoint(checkpoints: { timestamp: number; questionId: string }[], triggered: Set<number>, now: number): number {
  if (!Number.isFinite(now) || now < 0) return -1;
  return checkpoints.findIndex((cp, index) => !triggered.has(index) && cp.timestamp <= now);
}
