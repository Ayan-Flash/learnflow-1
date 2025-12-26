export type DepthLevel = 'Core' | 'Applied' | 'Mastery';
export type TaskType = 'Learning' | 'Assignment';
export type ConfidenceTrend = 'improving' | 'stable' | 'declining';
export type MasteryTrend = 'accelerating' | 'steady' | 'plateauing' | 'declining';

export interface LearningEvent {
  studentId: string;
  topic: string;
  depth: DepthLevel;
  taskType: TaskType;
  reasoningQuality: number;
  success: boolean;
  mistakePatterns: string[];
  timeSpent: number;
  timestamp: string;
}

export interface TopicProgress {
  topic: string;
  masteryLevel: number;
  confidenceTrend: ConfidenceTrend;
  errorFrequency: Record<string, number>;
  lastInteraction: string;
  depthProgress: DepthLevel;
  reasoningAverage: number;
  attemptCount: number;
  depthAttempts: Record<string, number>;
  masteryHistory: number[];
}

export interface StudentProgress {
  studentId: string;
  topics: TopicProgress[];
  overallMastery: number;
  totalInteractions: number;
  lastActivity: string;
  createdAt: string;
}

export interface StudentInsight {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  adaptiveSignal: string;
  masteryTrend: MasteryTrend;
  suggestedNextTopic: string | null;
}

export interface AdaptiveSignal {
  signal: 'INCREASE_DEPTH' | 'MAINTAIN_LEVEL' | 'REDUCE_COMPLEXITY' | 'PRACTICE_MORE' | 'READY_FOR_MASTERY';
  confidence: number;
  reason: string;
  suggestedDepth?: DepthLevel;
}
