import type { Quiz } from '../types/quiz';
import { OFFICIAL_QUIZ_SLUGS } from './officialQuizzes';
import { portableQuiz } from './libraryBackup';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Resolves ?app=classroom&quiz=<value>: a library ID or bundled slug first, then a JSON
 * published next to the app in quizzes/<slug>.json, validated like a backup.
 */
export async function resolveQuizLink(value: string, library: Quiz[]): Promise<Quiz | null> {
  const known = library.find(quiz => quiz.id === value) || (Object.hasOwn(OFFICIAL_QUIZ_SLUGS, value) ? OFFICIAL_QUIZ_SLUGS[value] : undefined);
  if (known) return known;
  if (!SLUG.test(value) || value.length > 100) return null;
  try {
    const response = await fetch(`quizzes/${value}.json`, { cache: 'no-cache' });
    return response.ok ? portableQuiz(await response.json()) : null;
  } catch { return null; }
}
