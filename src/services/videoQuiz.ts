import type { Quiz, VideoQuizConfig } from '../types/quiz';
import { loadVideo } from './quizStorage';
import { blobToDataUrl } from './images';

export type VideoSelection = Pick<VideoQuizConfig, 'videoUrl' | 'videoType' | 'videoTitle' | 'videoAssetId' | 'videoFileName'>;

export function quizCheckpoints(quiz: Quiz) {
  return quiz.questions.map((question, index) => ({
    questionId: question.id,
    timestamp: question.videoTimestamp ?? quiz.videoConfig?.checkpoints.find(cp => cp.questionId === question.id)?.timestamp ?? (index + 1) * 10,
  })).sort((a, b) => a.timestamp - b.timestamp);
}

export function prepareVideoQuiz(quiz: Quiz): Quiz {
  if (!quiz.videoConfig) return quiz;
  const checkpoints = quizCheckpoints(quiz);
  if (checkpoints.some(cp => !Number.isFinite(cp.timestamp) || cp.timestamp < 0)) throw new Error('I tempi delle domande devono essere numeri positivi o zero.');
  if (!quiz.videoConfig.videoUrl && !quiz.videoConfig.videoAssetId) throw new Error('Scegli un video per il quiz oppure disattiva la modalità video.');
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
