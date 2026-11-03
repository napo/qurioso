import type { GameSession, Quiz } from '../../src/types/quiz';
import { round } from './lanServer';

export const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
export function homeworkQuiz(): Quiz {
  const option = (id: string, text: string, isCorrect: boolean, color: 'red' | 'blue' | 'yellow' | 'green', shape: 'triangle' | 'diamond' | 'circle' | 'square') => ({ id, text, isCorrect, color, shape });
  return {
    id: 'hw-quiz', title: 'Compito', description: '', category: '', author: '', createdAt: 1,
    settings: { pointsMultiplier: 1, showExplanation: true, streakBonus: true },
    questions: [
      { id: 'q1', type: 'multiple_choice', text: 'Capitale d’Italia?', timeLimit: 20, points: 1000, mediaUrl: PIXEL, mediaType: 'image', explanation: 'Roma dal 1871.',
        options: [option('a', 'Roma', true, 'red', 'triangle'), option('b', 'Milano', false, 'blue', 'diamond')] },
      { id: 'q2', type: 'poll', text: 'Ti è piaciuto?', timeLimit: 20, points: 1000,
        options: [option('c', 'Sì', false, 'red', 'triangle'), option('d', 'No', false, 'blue', 'diamond')] },
      { id: 'q3', type: 'ordering', text: 'Ordina', timeLimit: 20, points: 500,
        options: [option('e', 'Uno', false, 'red', 'triangle'), option('f', 'Due', false, 'blue', 'diamond'), option('g', 'Tre', false, 'yellow', 'circle')] },
    ],
  };
}
export function homeworkSession(pin: string, quiz: Quiz, deadline = Date.now() + 24 * 3600_000, showFeedback = true): GameSession {
  return { ...round(pin), quizId: quiz.id, quizTitle: quiz.title, mode: 'assignment', status: 'lobby', currentQuestion: undefined, questionStartTime: 0,
    totalQuestions: quiz.questions.length, assignment: { deadline, showFeedback } };
}
