import axios, { AxiosError } from "axios";

export type DashboardPeriod = "day" | "week" | "month";

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
  depth_level?: "Core" | "Applied" | "Mastery";
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
    systemHealth: SystemHealthMetric & { modules: ModuleErrorRate[] };
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
  type: "cheating_detected" | "prompt_modified" | "assignment_enforced" | "privacy_alert";
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

type CacheEntry<T> = { expiresAt: number; value: T };

const cache = new Map<string, CacheEntry<unknown>>();

export const refreshMetrics = async (): Promise<void> => {
  cache.clear();
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080",
  timeout: 10_000
});

const sleep = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ error?: { message?: string } }>;
    return ax.response?.data?.error?.message ?? ax.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
};

const requestWithRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable = axios.isAxiosError(err) && (!err.response || err.response.status >= 500);
      if (!isRetryable || i === attempts - 1) break;
      await sleep(300 * Math.pow(2, i));
    }
  }

  throw new Error(getErrorMessage(lastErr));
};

const cachedFetch = async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
  const existing = cache.get(key);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.value as T;
  }

  const value = await requestWithRetry(fetcher);
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
};

const getJson = async <T>(path: string, role: "teacher" | "institution", params?: Record<string, string>): Promise<T> => {
  const res = await api.get<{ ok: boolean; data: T }>(path, {
    params,
    headers: {
      "x-role": role
    }
  });
  return res.data.data;
};

export const getTeacherMetrics = async (period: DashboardPeriod = "week"): Promise<TeacherDashboardResponse> => {
  return cachedFetch(`teacher:${period}`, 15_000, () => getJson<TeacherDashboardResponse>("/api/dashboard/teacher", "teacher", { period }));
};

export const getInstitutionMetrics = async (period: DashboardPeriod = "month"): Promise<InstitutionDashboardResponse> => {
  return cachedFetch(`institution:${period}`, 20_000, () =>
    getJson<InstitutionDashboardResponse>("/api/dashboard/institution", "institution", { period })
  );
};

export const getTopicAnalysis = async (topic: string, period: DashboardPeriod = "month"): Promise<TopicAnalysis> => {
  const encoded = encodeURIComponent(topic);
  return cachedFetch(`topic:${period}:${encoded}`, 30_000, () =>
    getJson<TopicAnalysis>(`/api/dashboard/topic/${encoded}`, "teacher", { period })
  );
};

export const getSystemHealth = async (): Promise<SystemHealthMetric> => {
  return cachedFetch("system-health", 10_000, () => getJson<SystemHealthMetric>("/api/dashboard/system-health", "teacher"));
};

export const getEthicsReport = async (period: DashboardPeriod = "month"): Promise<EthicsReport> => {
  return cachedFetch(`ethics:${period}`, 20_000, () =>
    getJson<EthicsReport>("/api/dashboard/ethics-report", "institution", { period })
  );
};
