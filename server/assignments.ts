import fs from 'node:fs';
import path from 'node:path';
import type { AssignmentAnswer, AssignmentFeedback, AssignmentView, GameSession, Quiz } from '../src/types/quiz';
import { choiceCorrect, isScored, sameChoice, validChoice, type Choice } from '../src/services/questionTypes';
import { publicQuestion } from '../src/services/sessionState';
import { ProtocolError } from './sessionProtocol';

export const MIN_ASSIGNMENT_MS = 10 * 60 * 1000;
export const MAX_ASSIGNMENT_MS = 7 * 24 * 60 * 60 * 1000;
/** Participants may still read their result for a while after the deadline. */
export const ASSIGNMENT_GRACE_MS = 24 * 60 * 60 * 1000;
/** A closed homework stays on the teacher computer for its report, then it is forgotten. */
export const KEEP_CLOSED_MS = 30 * 24 * 60 * 60 * 1000;

/** One participant's answers, by question id. Questions are answered in quiz order, so their count is the position. */
export type AssignmentProgress = Record<string, AssignmentAnswer>;

export function assignmentOpen(session: GameSession, now = Date.now()): boolean {
  return Boolean(session.assignment && !session.assignment.closed && now < session.assignment.deadline);
}

/** A minute of slack on the upper bound absorbs the time between the teacher's choice and the request. */
export function deadlineAllowed(deadline: number, now = Date.now()): boolean {
  return Number.isSafeInteger(deadline) && deadline >= now + MIN_ASSIGNMENT_MS && deadline <= now + MAX_ASSIGNMENT_MS + 60_000;
}

export function assignmentTotals(quiz: Quiz, answers: AssignmentProgress = {}) {
  const given = quiz.questions.map(question => answers[question.id]).filter((answer): answer is AssignmentAnswer => Boolean(answer));
  return { done: given.length, score: given.reduce((sum, answer) => sum + answer.pointsEarned, 0), correct: given.filter(answer => answer.isCorrect).length };
}

export function assignmentView(quiz: Quiz, session: GameSession, answers: AssignmentProgress = {}, now = Date.now()): AssignmentView {
  const totals = assignmentTotals(quiz, answers), open = assignmentOpen(session, now);
  const view: AssignmentView = { deadline: session.assignment!.deadline, open, total: quiz.questions.length, scored: quiz.questions.filter(isScored).length, ...totals };
  const next = quiz.questions[totals.done];
  if (open && next) view.question = { ...publicQuestion(quiz, totals.done)!, ...(next.mediaUrl ? { mediaUrl: next.mediaUrl } : {}) };
  return view;
}

/**
 * Grades the participant's next question. A retry of the same answer returns the recorded one without
 * grading it twice; a different answer, or any other question, is refused.
 */
export function gradeAssignmentAnswer(quiz: Quiz, answers: AssignmentProgress, questionId: string, choice: Choice, now = Date.now()): { answer: AssignmentAnswer; fresh: boolean } {
  const previous = answers[questionId];
  if (previous) {
    if (!sameChoice(previous, choice)) throw new ProtocolError(409, 'Answer already submitted');
    return { answer: previous, fresh: false };
  }
  const question = quiz.questions[assignmentTotals(quiz, answers).done];
  if (!question || question.id !== questionId) throw new ProtocolError(409, 'Question out of order');
  if (!validChoice(question, choice)) throw new ProtocolError(400, 'Invalid answer');
  const isCorrect = choiceCorrect(question, choice);
  // No speed bonus: each participant answers alone, whenever they like.
  const pointsEarned = isCorrect ? Math.round(question.points * quiz.settings.pointsMultiplier) : 0;
  return { fresh: true, answer: { optionId: choice.optionId, ...(choice.optionIds ? { optionIds: choice.optionIds } : {}),
    ...(isCorrect !== undefined ? { isCorrect } : {}), pointsEarned, answeredAt: now } };
}

export function assignmentFeedback(quiz: Quiz, questionId: string, answer: AssignmentAnswer, show: boolean): AssignmentFeedback {
  const question = quiz.questions.find(q => q.id === questionId)!;
  const result: AssignmentFeedback = { pointsEarned: answer.pointsEarned, ...(answer.isCorrect !== undefined ? { isCorrect: answer.isCorrect } : {}) };
  if (!show || !isScored(question)) return result;
  return { ...result,
    correctOptionIds: question.type === 'ordering' ? question.options.map(o => o.id) : question.options.filter(o => o.isCorrect).map(o => o.id),
    ...(quiz.settings.showExplanation && question.explanation ? { explanation: question.explanation } : {}) };
}

/** Atomic and private: the file holds the presenter and participant credentials of open homework. */
export function writeAssignmentsFile(file: string, data: unknown) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
}

export function readAssignmentsFile(file: string): unknown[] {
  let contents: string;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('Unable to read homework file:', error instanceof Error ? error.message : String(error));
    return [];
  }
  try {
    const data: unknown = JSON.parse(contents);
    if (Array.isArray(data)) return data;
    console.error('Unable to read homework file: expected an array of homework records');
  } catch (error) {
    console.error('Unable to parse homework file:', error instanceof Error ? error.message : String(error));
  }
  return [];
}
