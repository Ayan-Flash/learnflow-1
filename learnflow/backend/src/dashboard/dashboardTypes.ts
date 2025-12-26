import type { DepthLevel } from "../ai/depthEngine";

export type DashboardPeriod = "day" | "week" | "month";

export interface DashboardMetrics {
  period: DashboardPeriod;
  timestamp: string;
  metrics: {
    totalStudents: number;
    totalInteractions: number;
    averageMastery: number;
    topicBreakdown: Record<string, TopicMetric>;
    depthDistribution: DepthDistribution;
    ethicsFlags: EthicsMetric;
    qualityScores: QualityMetric;
  };
}

export interface TopicMetric {
  topic: string;
  masteryLevel: number;
  attemptCount: number;
  errorFrequency: number;
  lastUpdated: string;
}

export interface DepthDistribution {
  Core: number;
  Applied: number;
  Mastery: number;
}

export interface EthicsMetric {
  cheatingDetected: number;
  promptModifications: number;
  assignmentEnforcements: number;
  privacyAlerts: number;
}

export interface QualityMetric {
  depthAlignmentScore: number;
  clarityScore: number;
  reasoningQualityAverage: number;
  trend: "improving" | "stable" | "declining";
}

export interface SystemHealthMetric {
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  activeBugs: number;
}

export interface StudentProgress {
  student_hash: string;
  topic: string;
  mastery_level: number;
  depth_level: DepthLevel;
  attempt_count: number;
  error_count: number;
  last_updated: string;
}

export interface AssignmentStatistic {
  topic: string;
  generatedCount: number;
  evaluatedCount: number;
  averageScore: number;
  hintEffectiveness: {
    averageHintsProvided: number;
    averageScoreWhenHintsProvided: number;
  };
  misconceptionCounts: Record<string, number>;
  lastUpdated: string;
}

export interface TrendAnalysis {
  trend: "improving" | "stable" | "declining";
  delta: number;
}

export interface InsightRecommendation {
  topic: string;
  recommendation: string;
  priority: "low" | "medium" | "high";
}

export interface InsightSet {
  highlights: string[];
  concerns: string[];
  recommendedInterventions: InsightRecommendation[];
}

export interface DepthTrendPoint {
  timestamp: string;
  Core: number;
  Applied: number;
  Mastery: number;
}

export interface ActivityEvent {
  timestamp: string;
  type:
    | "chat"
    | "assignment_generate"
    | "assignment_evaluate"
    | "ethics_enforcement"
    | "privacy_alert"
    | "system_error";
  summary: string;
  topic?: string;
  depth_level?: DepthLevel;
}

export interface TeacherDashboardResponse {
  period: DashboardPeriod;
  timestamp: string;
  metrics: DashboardMetrics["metrics"] & {
    systemHealth: SystemHealthMetric;
    systemHealthScore: number;
    complianceScore: number;
    depthTrend: DepthTrendPoint[];
    assignmentStats: AssignmentStatistic[];
    recentActivity: ActivityEvent[];
    studentsReadyForAdvancement: {
      CoreToApplied: number;
      AppliedToMastery: number;
    };
    timeSpentByDepthMinutes: {
      Core: number;
      Applied: number;
      Mastery: number;
    };
  };
  insights: InsightSet;
}

export interface UsageMetric {
  totalInteractions: number;
  geminiApiCalls: number;
  estimatedGeminiCostUsd: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  errorRate: number;
}

export interface ModuleErrorRate {
  module: string;
  errorRate: number;
  count: number;
}

export interface PipelineHealth {
  telemetryWritable: boolean;
  wandbEnabled: boolean;
  lastIngestAt?: string;
}

export interface AlertEvent {
  timestamp: string;
  severity: "info" | "warning" | "critical";
  message: string;
  module?: string;
}

export interface InstitutionDashboardResponse {
  period: DashboardPeriod;
  timestamp: string;
  metrics: {
    usage: UsageMetric;
    ethicsFlags: EthicsMetric;
    qualityScores: QualityMetric;
    systemHealth: SystemHealthMetric & {
      modules: ModuleErrorRate[];
    };
    pipeline: PipelineHealth;
    recentAlerts: AlertEvent[];
  };
}

export interface TopicAnalysis {
  topic: string;
  period: DashboardPeriod;
  timestamp: string;
  metric: TopicMetric;
  depthDistribution: DepthDistribution;
  misconceptionCounts: Record<string, number>;
  recommendedInterventions: string[];
}

export interface EthicsEvent {
  timestamp: string;
  type:
    | "cheating_detected"
    | "prompt_modified"
    | "assignment_enforced"
    | "privacy_alert";
  flags?: string[];
  mode?: string;
  endpoint?: string;
}

export interface EthicsReport {
  period: DashboardPeriod;
  timestamp: string;
  summary: EthicsMetric;
  recentEvents: EthicsEvent[];
  complianceScore: number;
}
