import volcanoQuiz from '../../public/quizzes/tipi-di-vulcani.json';
import parmigianaQuiz from '../../public/quizzes/parmigiana-di-melanzane.json';
import type { Quiz } from '../types/quiz';

/** Keyed by file name in public/quizzes, which is also the slug of the classroom link. */
export const OFFICIAL_QUIZ_SLUGS: Record<string, Quiz> = { 'tipi-di-vulcani': volcanoQuiz as Quiz, 'parmigiana-di-melanzane': parmigianaQuiz as Quiz };
export const OFFICIAL_QUIZZES = Object.values(OFFICIAL_QUIZ_SLUGS);
/** Keep included lessons available after upgrades without rewriting a personal library. */
export function withOfficialQuizzes(personal: Quiz[]): Quiz[] {
  const ids = new Set(personal.map(quiz => quiz.id));
  return [...personal, ...OFFICIAL_QUIZZES.filter(quiz => !ids.has(quiz.id))];
}
