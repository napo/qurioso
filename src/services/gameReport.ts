import type { GameSession, Quiz } from '../types/quiz';
import { chosenIds, isScored } from './questionTypes';

/**
 * What the class answered to each question, kept by the presenter while the game runs. It holds counts and chosen
 * options, never names, so it can be shown on the projector and exported without exposing a student.
 */
export interface QuestionReport {
  questionId: string; index: number; text: string;
  /** False for a poll: no correct answer, so it shows the votes and stays out of the review. */
  scored: boolean;
  players: number; answered: number; correct: number;
  options: { id: string; text: string; isCorrect: boolean; count: number }[];
}
/** Below this share of correct answers a question goes into the review. */
export const REVIEW_THRESHOLD = 0.7;

export function questionReport(quiz: Quiz, index: number, session: Pick<GameSession, 'players' | 'answersForCurrentQuestion'>): QuestionReport | undefined {
  const question = quiz.questions[index];
  if (!question) return undefined;
  const answers = Object.values(session.answersForCurrentQuestion).filter(answer => answer.questionId === question.id);
  const correctIds = new Set(question.options.filter(option => option.isCorrect).map(option => option.id));
  return {
    questionId: question.id, index, text: question.text, scored: isScored(question),
    players: Object.keys(session.players).length, answered: answers.length,
    correct: isScored(question) ? answers.filter(answer => answer.isCorrect ?? correctIds.has(answer.optionId)).length : 0,
    // An ordering uses every option in every answer: its counts say nothing, only the share of exact orders does.
    options: question.options.map(option => ({ id: option.id, text: option.text, isCorrect: option.isCorrect,
      count: question.type === 'ordering' ? 0 : answers.filter(answer => chosenIds(answer).includes(option.id)).length })),
  };
}

export const correctShare = (report: QuestionReport) => report.scored && report.answered ? report.correct / report.answered : 1;

/** Hardest first; polls and questions nobody answered tell nothing about difficulty and go last. */
export function hardestFirst(reports: QuestionReport[]): QuestionReport[] {
  return [...reports].sort((a, b) => Number(!a.scored) - Number(!b.scored) || Number(!a.answered) - Number(!b.answered) || correctShare(a) - correctShare(b) || a.index - b.index);
}

/** A poll's most chosen option. */
export const mostChosen = (report: QuestionReport) => [...report.options].filter(option => option.count > 0).sort((a, b) => b.count - a.count)[0];

export function mostChosenWrong(report: QuestionReport) {
  const wrong = report.options.filter(option => !option.isCorrect && option.count > 0);
  return wrong.sort((a, b) => b.count - a.count)[0];
}

/** A classroom activity with the questions the class got wrong most often, hardest first, without the video. */
export function reviewQuiz(quiz: Quiz, reports: QuestionReport[], title: string): Quiz | undefined {
  const missed = hardestFirst(reports).filter(report => report.scored && report.answered && correctShare(report) < REVIEW_THRESHOLD);
  if (!missed.length) return undefined;
  const questions = missed.map(report => quiz.questions.find(question => question.id === report.questionId)!).filter(Boolean)
    .map(({ videoTimestamp: _time, ...question }) => question);
  const { videoConfig: _video, ...rest } = quiz;
  return { ...rest, id: `${quiz.id}-review`, title, questions };
}

const cell = (value: string | number) => {
  const text = String(value);
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
/** In question order, with the share of correct answers and the wrong option chosen most often. */
export function reportCsv(reports: QuestionReport[], headers: string[]): string {
  const rows = [...reports].sort((a, b) => a.index - b.index).map(report => [
    report.index + 1, report.text, report.answered, report.correct,
    report.scored && report.answered ? Math.round(correctShare(report) * 100) : '', (report.scored ? mostChosenWrong(report) : mostChosen(report))?.text ?? '',
  ]);
  return toCsv([headers, ...rows]);
}

/** `;`-separated, UTF-8 with BOM: opens as a table in spreadsheets with Italian or German settings. */
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
