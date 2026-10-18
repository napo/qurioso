export interface ImageAttribution {
  title: string;
  creator: string;
  license: string;
  sourceUrl: string;
  licenseUrl?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  color: 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'orange';
  shape: 'triangle' | 'diamond' | 'circle' | 'square' | 'star' | 'hexagon';
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'true_false';
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
  pauseMode: 'defined' | 'random';
  checkpoints: {
    timestamp: number;
    questionId: string;
  }[];
  randomConfig?: {
    frequencySeconds: number;
    totalCheckpoints: number;
  };
}

export interface Player {
  id: string;
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
    isCorrect: boolean;
    pointsEarned: number;
    timeTakenMs: number;
  };
}

export interface GameSession {
  pin: string;
  quizId: string;
  quizTitle: string;
  mode: 'standard' | 'video';
  status: 'lobby' | 'countdown' | 'question' | 'question_results' | 'leaderboard' | 'finished';
  currentQuestionIndex: number;
  currentQuestion?: {
    id: string;
    text: string;
    options: Omit<QuestionOption, 'isCorrect'>[];
  };
  questionStartTime: number;
  timeRemaining: number;
  players: Record<string, Player>;
  answersForCurrentQuestion: Record<string, {
    questionId: string;
    optionId: string;
    isCorrect?: boolean;
    pointsEarned?: number;
    timeTakenMs: number;
  }>;
  totalQuestions: number;
  videoState?: {
    currentTime: number;
    isPlaying: boolean;
    activeCheckpointIndex: number;
  };
}
