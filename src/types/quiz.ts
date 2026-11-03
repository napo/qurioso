export interface ImageAttribution {
  title: string;
  creator: string;
  license: string;
  sourceUrl: string;
  licenseUrl?: string;
  attributionText?: string;
  credit?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  color: 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'orange';
  shape: 'triangle' | 'diamond' | 'circle' | 'square' | 'star' | 'hexagon';
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'multiple_select' | 'poll' | 'ordering';

export interface Question {
  id: string;
  text: string;
  /**
   * multiple_select: every correct option and nothing else; poll: no correct answer and no points;
   * ordering: the options in their saved order, shown shuffled.
   */
  type: QuestionType;
  options: QuestionOption[];
  timeLimit: number; // in seconds, e.g. 20
  points: number; // default 1000
  mediaUrl?: string;
  mediaAttribution?: ImageAttribution;
  mediaType?: 'image' | 'video';
  videoTimestamp?: number; // timestamp in seconds for video quiz checkpoints
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImage?: string;
  coverAttribution?: ImageAttribution;
  author: string;
  createdAt: number;
  questions: Question[];
  videoConfig?: VideoQuizConfig;
  settings: {
    pointsMultiplier: number;
    showExplanation: boolean;
    streakBonus: boolean;
  };
}

export interface VideoQuizConfig {
  videoUrl: string;
  videoTitle: string;
  videoType: 'html5' | 'sample' | 'youtube' | 'vimeo' | 'file';
  videoAssetId?: string;
  videoFileName?: string;
  /** Portable descriptor for a local video excluded from a library backup. */
  missingVideo?: { name?: string; size: number; sizeKnown?: boolean; mime: string };
  pauseMode: 'defined' | 'random';
  /** Explicit lists may omit unassigned questions; absent preserves legacy implicit checkpoints. */
  checkpointMode?: 'explicit';
  checkpoints: {
    timestamp: number;
    questionId: string;
  }[];
  randomConfig?: {
    frequencySeconds: number;
    totalCheckpoints: number;
  };
}

/** Homework: open until `deadline` (epoch ms) or until the presenter closes it. */
export interface AssignmentSettings {
  deadline: number;
  /** Each answer is followed by right/wrong, the solution and the explanation (when the quiz shows explanations). */
  showFeedback: boolean;
  closed?: boolean;
}

/** One participant's graded answer to a homework question. */
export interface AssignmentAnswer {
  optionId: string;
  optionIds?: string[];
  /** Undefined for a poll. */
  isCorrect?: boolean;
  pointsEarned: number;
  answeredAt: number;
}

/** What a participant sees of their homework: the next question, or nothing once finished or closed. */
export interface AssignmentView {
  deadline: number;
  open: boolean;
  total: number;
  /** Questions answered so far; equals `total` when finished. */
  done: number;
  score: number;
  correct: number;
  /** Scored questions, polls excluded. */
  scored: number;
  question?: NonNullable<GameSession['currentQuestion']> & { mediaUrl?: string };
}

/** The answer to a homework submission. Solution and explanation only when the presenter chose feedback. */
export interface AssignmentFeedback {
  isCorrect?: boolean;
  pointsEarned: number;
  correctOptionIds?: string[];
  explanation?: string;
}

/** A team of a network game. Its score is the average of its members, so team size gives no advantage. */
export interface Team {
  id: string;
  name: string;
  color: QuestionOption['color'];
}

export interface Player {
  id: string;
  /** One of the session's teams, when the game is played in teams. */
  teamId?: string;
  nickname: string;
  name?: string;
  avatar: string; // emoji or avatar icon
  score: number;
  streak: number;
  correctAnswersCount?: number;
  totalTimeTakenMs?: number;
  joinedAt?: number;
  connected?: boolean;
  isBot?: boolean;
  connectedAt?: number;
  lastAnswerCorrect?: boolean;
  lastAnswer?: {
    questionId: string;
    optionId: string;
    optionIds?: string[];
    isCorrect: boolean;
    pointsEarned: number;
    timeTakenMs: number;
  };
}

export interface GameSession {
  /** Ephemeral server round identity; never part of a saved Quiz. */
  roundId?: string;
  pin: string;
  quizId: string;
  quizTitle: string;
  /** `assignment`: homework, each participant alone and at their own pace until the deadline. */
  mode: 'standard' | 'video' | 'assignment';
  status: 'lobby' | 'countdown' | 'video' | 'question' | 'question_results' | 'leaderboard' | 'finished';
  currentQuestionIndex: number;
  currentQuestion?: {
    id: string;
    text: string;
    /** Absent in sessions of older versions, which only had single-choice questions. */
    type?: QuestionType;
    options: Omit<QuestionOption, 'isCorrect'>[];
  };
  questionStartTime: number;
  timeRemaining: number;
  players: Record<string, Player>;
  /** `optionIds` carries the whole choice of multiple_select and ordering; `optionId` is then its first item. */
  answersForCurrentQuestion: Record<string, {
    questionId: string;
    optionId: string;
    optionIds?: string[];
    isCorrect?: boolean;
    pointsEarned?: number;
    timeTakenMs: number;
  }>;
  totalQuestions: number;
  /** Present when the game is played in teams; chosen by the presenter before the start. */
  teams?: Team[];
  /** Homework settings, present in `assignment` mode. */
  assignment?: AssignmentSettings;
  /** Server-owned progress, used to recover a checkpoint after a lost acknowledgement. */
  videoQuestionsOpened?: number;
  questionResult?: { correctOptionIds: string[]; explanation?: string };
  videoState?: {
    currentTime: number;
    isPlaying: boolean;
    activeCheckpointIndex: number;
    ended?: boolean;
  };
}
