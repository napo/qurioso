import type { GameSession, Quiz } from '../types/quiz';
import { choiceCorrect, displayOrder, validChoice, type Choice } from './questionTypes';

export interface AnswerSubmission extends Choice {
  playerId: string;
  questionId: string;
  timeTakenMs: number;
}

/** Ignore duplicates and answers for any round other than the active one. A graded answer carries `pointsEarned`. */
export function applyPlayerAnswer(session: GameSession, quiz: Quiz, answer: AnswerSubmission): GameSession {
  const question = quiz.questions[session.currentQuestionIndex];
  const player = session.players[answer.playerId];
  if (session.status !== 'question' || !question || !player || question.id !== answer.questionId ||
      session.answersForCurrentQuestion[answer.playerId]?.pointsEarned !== undefined ||
      !Number.isFinite(answer.timeTakenMs) || answer.timeTakenMs < 0 || !validChoice(question, answer)) return session;
  const isCorrect = choiceCorrect(question, answer);
  const choice = { optionId: answer.optionId, ...(answer.optionIds ? { optionIds: answer.optionIds } : {}) };
  // A poll records the choice only: score, streak, counts and the last-answer feedback stay as they were.
  if (isCorrect === undefined) return { ...session, answersForCurrentQuestion: { ...session.answersForCurrentQuestion,
    [player.id]: { questionId: answer.questionId, ...choice, timeTakenMs: answer.timeTakenMs, pointsEarned: 0 } } };
  const streak = isCorrect ? player.streak + 1 : 0;
  const speedRatio = Math.max(0, Math.min(1, 1 - answer.timeTakenMs / (question.timeLimit * 2000)));
  const pointsEarned = isCorrect
    ? Math.round(question.points * quiz.settings.pointsMultiplier * speedRatio) +
      (quiz.settings.streakBonus ? Math.min(streak * 50, 300) : 0)
    : 0;
  return {
    ...session,
    players: { ...session.players, [player.id]: {
      ...player, score: player.score + pointsEarned, streak,
      correctAnswersCount: (player.correctAnswersCount || 0) + (isCorrect ? 1 : 0),
      totalTimeTakenMs: (player.totalTimeTakenMs || 0) + answer.timeTakenMs,
      lastAnswerCorrect: isCorrect,
      lastAnswer: { questionId: question.id, ...choice, isCorrect, pointsEarned, timeTakenMs: answer.timeTakenMs },
    } },
    answersForCurrentQuestion: { ...session.answersForCurrentQuestion, [player.id]: {
      questionId: answer.questionId, ...choice, timeTakenMs: answer.timeTakenMs, isCorrect, pointsEarned,
    } },
  };
}

/** Participants receive the real option IDs and the question type, but never the solution key or the correct order. */
export function publicQuestion(quiz: Quiz, index: number): GameSession['currentQuestion'] {
  const question = quiz.questions[index];
  if (!question) return undefined;
  return {
    id: question.id, text: question.text, type: question.type,
    options: displayOrder(question, question.options).map(({ id, text, color, shape }) => ({ id, text, color, shape })),
  };
}
