import type { AssignmentAnswer, AssignmentFeedback, AssignmentView, GameSession, Quiz } from '../types/quiz';
import type { Choice } from './questionTypes';
import { questionReport, type QuestionReport } from './gameReport';

/** The server accepts 5 minutes to 7 days; asking for at least 10 minutes leaves room for slow clicks. */
export const MIN_DEADLINE_MS = 10 * 60 * 1000;
export const MAX_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Homework the teacher has given from this computer, to reopen its page after a restart. */
export interface SavedHomework { pin: string; token: string; quizId: string; title: string; deadline: number }
/** `quiz` is the quiz as assigned, without images; only a full read returns it. */
export interface HomeworkState { session: GameSession; answers: Record<string, Record<string, AssignmentAnswer>>; quiz?: Quiz }

// The one presenter credential kept beyond the tab: homework lasts days. The server accepts presenter requests
// only from this computer, and participants open the app on another origin, so they cannot read it.
const KEY = 'qurioso_homework_v1';
export function savedHomework(): SavedHomework[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(item => /^\d{6}$/.test(item?.pin) && /^[a-f0-9]{64}$/.test(item?.token)) : [];
  } catch { return []; }
}
function store(list: SavedHomework[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* The homework still runs; only its shortcut is lost. */ }
}
export function forgetHomework(pin: string) { store(savedHomework().filter(item => item.pin !== pin)); }
const remember = (item: SavedHomework) => store([...savedHomework().filter(saved => saved.pin !== item.pin), item]);

const headers = (token?: string) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
const call = async (url: string, method: string, token?: string, body?: unknown) => {
  const response = await fetch(url, { method, headers: headers(token), cache: 'no-store', signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw Object.assign(new Error((await response.json().catch(() => ({}))).error || 'Request failed'), { status: response.status });
  return response.json();
};

/** Only what the server needs to grade, plus each question's image: students are alone with their phone. */
function privateQuiz(quiz: Quiz) {
  return { id: quiz.id, title: quiz.title, settings: quiz.settings,
    questions: quiz.questions.map(({ id, text, type, options, timeLimit, points, explanation, mediaUrl, mediaType }) => ({
      id, text, type, timeLimit, points, explanation, ...(mediaUrl && mediaType !== 'video' ? { mediaUrl } : {}),
      options: options.map(({ id, text, color, shape, isCorrect }) => ({ id, text, color, shape, isCorrect })),
    })) };
}

export async function createHomework(quiz: Quiz, pin: string, deadline: number, showFeedback: boolean): Promise<SavedHomework> {
  const { hostToken } = await call('/api/presenter-token', 'POST', undefined, {});
  const session: GameSession = { pin, quizId: quiz.id, quizTitle: quiz.title, mode: 'assignment', status: 'lobby', currentQuestionIndex: 0,
    questionStartTime: 0, timeRemaining: 0, players: {}, answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length, assignment: { deadline, showFeedback } };
  await call('/api/assignment/create', 'POST', hostToken, { session, assignmentQuiz: privateQuiz(quiz) });
  const saved = { pin, token: hostToken, quizId: quiz.id, title: quiz.title, deadline };
  remember(saved);
  return saved;
}

const toState = (data: { session: GameSession; assignmentAnswers?: HomeworkState['answers']; assignmentQuiz?: Quiz }): HomeworkState =>
  ({ session: data.session, answers: data.assignmentAnswers ?? {}, ...(data.assignmentQuiz ? { quiz: data.assignmentQuiz } : {}) });

/** The class report, question by question, from every participant's answers: counts only, as in a live game. */
export function homeworkReports(quiz: Quiz, state: HomeworkState): QuestionReport[] {
  return quiz.questions.map((question, index) => questionReport(quiz, index, { players: state.session.players,
    answersForCurrentQuestion: Object.fromEntries(Object.entries(state.answers).flatMap(([player, answers]) =>
      answers[question.id] ? [[player, { questionId: question.id, ...answers[question.id], timeTakenMs: 0 }]] : [])) })!);
}
export async function readHomework(saved: SavedHomework): Promise<HomeworkState> {
  return toState(await call(`/api/session/${saved.pin}/presenter`, 'GET', saved.token));
}
export async function closeHomework(saved: SavedHomework): Promise<HomeworkState> {
  return toState(await call(`/api/session/${saved.pin}/assignment/close`, 'POST', saved.token, {}));
}
export async function extendHomework(saved: SavedHomework, deadline: number): Promise<HomeworkState> {
  const state = toState(await call(`/api/session/${saved.pin}/assignment/extend`, 'POST', saved.token, { deadline }));
  remember({ ...saved, deadline });
  return state;
}
export async function removeStudent(saved: SavedHomework, playerId: string): Promise<void> {
  await call(`/api/session/${saved.pin}/player/${encodeURIComponent(playerId)}/remove`, 'POST', saved.token, {});
}
/** Deletes the homework and its results from the teacher computer. */
export async function deleteHomework(saved: SavedHomework): Promise<void> {
  try { await call(`/api/session/${saved.pin}`, 'DELETE', saved.token); }
  catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
  forgetHomework(saved.pin);
}

export async function readAssignment(pin: string, token: string): Promise<AssignmentView> {
  return (await call(`/api/session/${pin}/assignment`, 'GET', token)).assignment;
}
export async function answerAssignment(pin: string, token: string, playerId: string, questionId: string, choice: Choice): Promise<{ feedback: AssignmentFeedback; assignment: AssignmentView }> {
  return call(`/api/session/${pin}/assignment/answer`, 'POST', token, { playerId, questionId, ...choice });
}
