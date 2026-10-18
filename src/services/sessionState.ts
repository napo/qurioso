import type { GameSession, Quiz } from '../types/quiz';

export interface AnswerSubmission {
  playerId: string;
  questionId: string;
  optionId: string;
  timeTakenMs: number;
}

/** Ignore duplicates and answers for any round other than the active one. */
export function applyPlayerAnswer(session: GameSession, quiz: Quiz, answer: AnswerSubmission): GameSession {
  const question = quiz.questions[session.currentQuestionIndex];
  const player = session.players[answer.playerId];
  if (session.status !== 'question' || !question || !player || question.id !== answer.questionId ||
      session.answersForCurrentQuestion[answer.playerId]?.isCorrect !== undefined ||
      !Number.isFinite(answer.timeTakenMs) || answer.timeTakenMs < 0) return session;
  const option = question.options.find(o => o.id === answer.optionId);
  if (!option) return session;
  const streak = option.isCorrect ? player.streak + 1 : 0;
  const speedRatio = Math.max(0, Math.min(1, 1 - answer.timeTakenMs / (question.timeLimit * 2000)));
  const pointsEarned = option.isCorrect
    ? Math.round(question.points * quiz.settings.pointsMultiplier * speedRatio) +
      (quiz.settings.streakBonus ? Math.min(streak * 50, 300) : 0)
    : 0;
  return {
    ...session,
    players: { ...session.players, [player.id]: {
      ...player, score: player.score + pointsEarned, streak,
      correctAnswersCount: (player.correctAnswersCount || 0) + (option.isCorrect ? 1 : 0),
      totalTimeTakenMs: (player.totalTimeTakenMs || 0) + answer.timeTakenMs,
      lastAnswerCorrect: option.isCorrect,
      lastAnswer: { questionId: question.id, optionId: option.id, isCorrect: option.isCorrect, pointsEarned, timeTakenMs: answer.timeTakenMs },
    } },
    answersForCurrentQuestion: { ...session.answersForCurrentQuestion, [player.id]: {
      ...answer, isCorrect: option.isCorrect, pointsEarned,
    } },
  };
}

/** Participants receive the real option IDs, but never the solution key. */
export function publicQuestion(quiz: Quiz, index: number): GameSession['currentQuestion'] {
  const question = quiz.questions[index];
  if (!question) return undefined;
  return {
    id: question.id, text: question.text,
    options: question.options.map(({ id, text, color, shape }) => ({ id, text, color, shape })),
  };
}
