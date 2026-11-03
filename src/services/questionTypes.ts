import type { Question, QuestionOption, QuestionType } from '../types/quiz';

/** What each question type asks of the participant, and how a choice is checked and scored. */
export const QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'true_false', 'multiple_select', 'poll', 'ordering'];
export const OPTION_LIMITS: Record<QuestionType, [number, number]> = {
  multiple_choice: [2, 12], true_false: [2, 2], multiple_select: [2, 12], poll: [2, 12], ordering: [2, 8],
};
type Typed = { type?: QuestionType };
const typeOf = (question: Typed): QuestionType => question.type ?? 'multiple_choice';
/** A poll has no correct answer: no points, no streak and no place in the share of correct answers. */
export const isScored = (question: Typed) => typeOf(question) !== 'poll';
/** These types send the whole choice in `optionIds`. */
export const takesSeveral = (question: Typed) => ['multiple_select', 'ordering'].includes(typeOf(question));

export interface Choice { optionId: string; optionIds?: string[] }
export const chosenIds = (choice: Choice) => choice.optionIds ?? [choice.optionId];
export function makeChoice(question: Typed, ids: string[]): Choice {
  return takesSeveral(question) ? { optionId: ids[0], optionIds: [...ids] } : { optionId: ids[0] };
}

/** The choice fits the question: real options, no repeats, and the whole list for an ordering. */
export function validChoice(question: Typed & { options: { id: string }[] }, choice: Choice): boolean {
  const ids = new Set(question.options.map(option => option.id));
  if (!takesSeveral(question)) return choice.optionIds === undefined && ids.has(choice.optionId);
  const list = choice.optionIds;
  if (!Array.isArray(list) || !list.length || list[0] !== choice.optionId || new Set(list).size !== list.length || !list.every(id => ids.has(id))) return false;
  return typeOf(question) !== 'ordering' || list.length === ids.size;
}

export function sameChoice(a: Choice, b: Choice): boolean {
  return a.optionId === b.optionId && JSON.stringify(a.optionIds ?? null) === JSON.stringify(b.optionIds ?? null);
}

/** Undefined for a poll. All or nothing for several options: exactly the correct set, or exactly the saved order. */
export function choiceCorrect(question: Question, choice: Choice): boolean | undefined {
  switch (typeOf(question)) {
    case 'poll': return undefined;
    case 'ordering': return JSON.stringify(choice.optionIds) === JSON.stringify(question.options.map(option => option.id));
    case 'multiple_select': {
      const correct = question.options.filter(option => option.isCorrect).map(option => option.id).sort();
      return JSON.stringify([...(choice.optionIds ?? [])].sort()) === JSON.stringify(correct);
    }
    default: return Boolean(question.options.find(option => option.id === choice.optionId)?.isCorrect);
  }
}

/**
 * The order participants see. An ordering is shuffled the same way on every device and on the server (seeded by the
 * question id), and never in its correct order; other types keep their saved order.
 */
export function displayOrder<T extends Pick<QuestionOption, 'id'>>(question: Typed & { id: string }, options: T[]): T[] {
  if (typeOf(question) !== 'ordering' || options.length < 2) return options;
  let seed = [...question.id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  return shuffled.every((option, i) => option.id === options[i].id) ? [...shuffled.slice(1), shuffled[0]] : shuffled;
}
