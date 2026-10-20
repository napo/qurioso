import volcanoQuiz from '../../public/quizzes/tipi-di-vulcani.json';
import type { Quiz } from '../types/quiz';

export const OFFICIAL_QUIZZES = [volcanoQuiz as Quiz];
/** Keep included lessons available after upgrades without rewriting a personal library. */
export function withOfficialQuizzes(personal: Quiz[]): Quiz[] {
  const ids = new Set(personal.map(quiz => quiz.id));
  return [...personal, ...OFFICIAL_QUIZZES.filter(quiz => !ids.has(quiz.id))];
}
