export type MessageRole = "system" | "user" | "assistant";

export type Message = {
  role: MessageRole;
  content: string;
};

export interface Question {
  id: string;
  title?: string;
  prompt?: string;
  framework: string;
  type: string;
  tags?: string[];
  difficulty?: string;
  source?: string;
  referenceAnswer?: string;
  commonErrors?: string[];
  isMistake?: number;
  content?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface PracticeRecord {
  id: string;
  practicedAt: string;
  questionId: string;
  framework: string;
  overallScore?: number;
  attempt?: number;
  durationSeconds?: number;
  dimensionScores?: Record<string, number>;
  issueList?: string[];
  optimizedAnswer?: string;
  userAnswer?: string;
  outline?: string;
  aiFeedback?: string;
  aiOptimizedVersion?: string;
  messages?: Message[];
  isTimeExpired?: boolean;
  [key: string]: unknown;
}

export interface Principle {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  id: number;
  mistakeThreshold?: number;
  defaultModel?: string;
  practiceDurationSeconds?: number;
  deepseekApiKey?: string;
  deepseekApiUrl?: string;
  strictSketchMode?: boolean;
  language?: string;
}
