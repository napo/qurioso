import type { GameSession, Player, Quiz } from '../src/types/quiz';

export const MAX_MESSAGE_BYTES = 1024 * 1024;
export const MAX_PLAYERS = 500;
const forbiddenKeys = new Set(['prototype', ...Object.getOwnPropertyNames(Object.prototype)]);
const statuses = new Set(['lobby', 'countdown', 'video', 'question', 'question_results', 'leaderboard', 'finished']);
const colors = new Set(['red', 'blue', 'yellow', 'green', 'purple', 'orange']);
const shapes = new Set(['triangle', 'diamond', 'circle', 'square', 'star', 'hexagon']);

export class ProtocolError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function check(condition: unknown, message = 'Invalid input'): asserts condition {
  if (!condition) throw new ProtocolError(400, message);
}
export function object(value: unknown): Record<string, any> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).every(key => !forbiddenKeys.has(key)));
  return value as Record<string, any>;
}
function text(value: unknown, max: number, empty = false): string {
  check(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0));
  return value;
}
export function id(value: unknown): string {
  const result = text(value, 128);
  check(!forbiddenKeys.has(result));
  return result;
}
export function pin(value: unknown): string {
  check(typeof value === 'string' && /^\d{6}$/.test(value), 'Invalid PIN');
  return value;
}
function number(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max);
  return value;
}
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  const result = number(value, max); check(Number.isSafeInteger(result)); return result;
}
function bool(value: unknown): boolean { check(typeof value === 'boolean'); return value; }

function answer(value: unknown) {
  const a = object(value);
  return {
    questionId: id(a.questionId), optionId: id(a.optionId), timeTakenMs: number(a.timeTakenMs, 86400000),
    ...(a.isCorrect !== undefined ? { isCorrect: bool(a.isCorrect) } : {}),
    ...(a.pointsEarned !== undefined ? { pointsEarned: number(a.pointsEarned) } : {}),
  };
}
export function submission(value: unknown) {
  const a = object(value);
  return { roundId: id(a.roundId), playerId: id(a.playerId), questionId: id(a.questionId), optionId: id(a.optionId), timeTakenMs: number(a.timeTakenMs, 86400000) };
}
export function player(value: unknown, joining = false): Player {
  const p = object(value);
  const result: Player = {
    id: id(p.id), nickname: text(p.nickname, 64), avatar: text(p.avatar, 32),
    score: joining ? 0 : number(p.score), streak: joining ? 0 : integer(p.streak),
  };
  if (joining) return { ...result, name: result.nickname, joinedAt: Date.now(), connected: true };
  if (p.name !== undefined) result.name = text(p.name, 64);
  for (const key of ['correctAnswersCount', 'totalTimeTakenMs', 'joinedAt', 'connectedAt'] as const) {
    if (p[key] !== undefined) result[key] = number(p[key]);
  }
  for (const key of ['connected', 'isBot', 'lastAnswerCorrect'] as const) {
    if (p[key] !== undefined) result[key] = bool(p[key]);
  }
  if (p.lastAnswer !== undefined) {
    const last = answer(p.lastAnswer);
    check(last.isCorrect !== undefined && last.pointsEarned !== undefined);
    result.lastAnswer = { ...last, isCorrect: last.isCorrect, pointsEarned: last.pointsEarned };
  }
  return result;
}
export function session(value: unknown): GameSession {
  const s = object(value);
  check(statuses.has(s.status) && ['standard', 'video'].includes(s.mode));
  check(s.status !== 'video' || s.mode === 'video');
  const totalQuestions = integer(s.totalQuestions, 10000);
  check(totalQuestions > 0);
  const currentQuestionIndex = integer(s.currentQuestionIndex, totalQuestions - 1);
  const players = object(s.players), answers = object(s.answersForCurrentQuestion);
  check(Object.keys(players).length <= MAX_PLAYERS && Object.keys(answers).length <= MAX_PLAYERS);
  const result: GameSession = {
    pin: pin(s.pin), quizId: id(s.quizId), quizTitle: text(s.quizTitle, 500), mode: s.mode, status: s.status,
    totalQuestions, currentQuestionIndex, questionStartTime: integer(s.questionStartTime), timeRemaining: number(s.timeRemaining, 86400),
    players: Object.fromEntries(Object.entries(players).map(([key, value]) => {
      const p = player(value); check(id(key) === p.id); return [key, p];
    })),
    answersForCurrentQuestion: Object.fromEntries(Object.entries(answers).map(([key, value]) => {
      check(Object.hasOwn(players, id(key))); return [key, answer(value)];
    })),
  };
  if (s.currentQuestion !== undefined) {
    const q = object(s.currentQuestion);
    check(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 12);
    const options = q.options.map((value: unknown) => {
      const o = object(value); check(colors.has(o.color) && shapes.has(o.shape));
      // Explicit projection: a presenter accidentally sending an entire Question cannot leak its answer key.
      return { id: id(o.id), text: text(o.text, 10000, true), color: o.color, shape: o.shape };
    });
    check(new Set(options.map(o => o.id)).size === options.length);
    result.currentQuestion = { id: id(q.id), text: text(q.text, 20000), options };
  }
  check(s.status !== 'question' || (result.currentQuestion && result.questionStartTime > 0));
  if (s.videoState !== undefined) {
    const v = object(s.videoState);
    result.videoState = { currentTime: number(v.currentTime, 86400), isPlaying: bool(v.isPlaying), activeCheckpointIndex: integer(v.activeCheckpointIndex, 10000) };
  }
  return result;
}

/** Freeze scores at the start of the round; neither answer receipts nor live scoring reveal correctness. */
export function participantSession(s: GameSession, roundPlayers: Record<string, Player>): GameSession {
  if (s.status !== 'question') return structuredClone(s);
  return {
    ...s,
    players: Object.fromEntries(Object.entries(s.players).map(([key, p]) => {
      const visible = { ...(roundPlayers[key] || p) };
      delete visible.lastAnswer;
      delete visible.lastAnswerCorrect;
      // A player joining mid-round has not yet earned any points.
      if (!roundPlayers[key]) {
        visible.score = 0; visible.streak = 0; visible.correctAnswersCount = 0; visible.totalTimeTakenMs = 0;
      }
      return [key, visible];
    })),
    answersForCurrentQuestion: {},
  };
}

/** Private grading definition: no video URL, asset, image or unrelated saved-quiz metadata. */
export function videoQuizDefinition(value: unknown): Quiz {
  const q = object(value), settings = object(q.settings);
  check(Array.isArray(q.questions) && q.questions.length > 0 && q.questions.length <= 10000);
  const questions = q.questions.map((value: unknown) => {
    const question = object(value);
    check(['multiple_choice', 'true_false'].includes(question.type));
    check(Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 12);
    const options = question.options.map((value: unknown) => {
      const option = object(value);
      check(colors.has(option.color) && shapes.has(option.shape));
      return { id: id(option.id), text: text(option.text, 10000, true), color: option.color,
        shape: option.shape, isCorrect: bool(option.isCorrect) };
    });
    check(new Set(options.map(o => o.id)).size === options.length);
    const timeLimit = number(question.timeLimit, 86400); check(timeLimit > 0);
    return { id: id(question.id), text: text(question.text, 20000), type: question.type, options,
      timeLimit, points: number(question.points, 1000000),
      ...(question.explanation !== undefined ? { explanation: text(question.explanation, 20000, true) } : {}) };
  });
  check(new Set(questions.map(q => q.id)).size === questions.length);
  return { id: id(q.id), title: text(q.title, 500), description: '', category: '', author: '', createdAt: 0,
    questions, settings: { pointsMultiplier: number(settings.pointsMultiplier, 100),
      showExplanation: bool(settings.showExplanation), streakBonus: bool(settings.streakBonus) } };
}
