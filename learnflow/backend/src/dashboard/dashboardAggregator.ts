import type {
  DashboardMetrics,
  DepthDistribution,
  EthicsMetric,
  InsightRecommendation,
  InsightSet,
  InstitutionDashboardResponse,
  QualityMetric,
  StudentProgress,
  SystemHealthMetric,
  TopicMetric,
  TrendAnalysis
} from "./dashboardTypes";
import type { TelemetryEvent } from "./telemetryStore";

const depthEmpty = (): DepthDistribution => ({ Core: 0, Applied: 0, Mastery: 0 });

const safeAvg = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const toRecord = (topicMetrics: TopicMetric[]): Record<string, TopicMetric> => {
  const out: Record<string, TopicMetric> = {};
  for (const m of topicMetrics) {
    out[m.topic] = m;
  }
  return out;
};

const computeDepthDistribution = (events: Array<{ depth_level: "Core" | "Applied" | "Mastery" }>): DepthDistribution => {
  const out = depthEmpty();
  for (const e of events) {
    out[e.depth_level] += 1;
  }
  return out;
};

const normalizeDistribution = (d: DepthDistribution): DepthDistribution => {
  const total = d.Core + d.Applied + d.Mastery;
  if (total === 0) return d;
  return {
    Core: Number((d.Core / total).toFixed(3)),
    Applied: Number((d.Applied / total).toFixed(3)),
    Mastery: Number((d.Mastery / total).toFixed(3))
  };
};

export const calculateTrends = (currentData: QualityMetric, historicalData: QualityMetric): TrendAnalysis => {
  const delta = Number((currentData.reasoningQualityAverage - historicalData.reasoningQualityAverage).toFixed(3));
  const threshold = 0.02;

  if (delta > threshold) return { trend: "improving", delta };
  if (delta < -threshold) return { trend: "declining", delta };
  return { trend: "stable", delta };
};

export const filterAnonymizedData = (data: {
  studentProgress?: StudentProgress[];
  recentTelemetry?: TelemetryEvent[];
}): {
  studentProgress?: Array<Omit<StudentProgress, "student_hash">>;
  recentTelemetry?: TelemetryEvent[];
} => {
  const studentProgress = data.studentProgress?.map(({ student_hash: _s, ...rest }) => rest);

  const recentTelemetry = data.recentTelemetry?.map((evt) => {
    if ("actor_hash" in evt) {
      const { actor_hash: _a, ...rest } = evt as unknown as { actor_hash?: string };
      return rest as TelemetryEvent;
    }
    return evt;
  });

  return { studentProgress, recentTelemetry };
};

export const generateInsights = (metrics: DashboardMetrics): InsightSet => {
  const topicList = Object.values(metrics.metrics.topicBreakdown);

  const sortedByMastery = topicList.slice().sort((a, b) => b.masteryLevel - a.masteryLevel);
  const top = sortedByMastery[0];
  const bottom = sortedByMastery[sortedByMastery.length - 1];

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (top) {
    highlights.push(`Top topic: ${top.topic} (${top.masteryLevel.toFixed(0)}% mastery)`);
  }

  if (bottom) {
    concerns.push(`Weakest topic: ${bottom.topic} (${bottom.masteryLevel.toFixed(0)}% mastery)`);
  }

  const recommendedInterventions: InsightRecommendation[] = topicList
    .filter((t) => t.attemptCount >= 3)
    .filter((t) => t.masteryLevel < 70 || t.errorFrequency > 0.25)
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 8)
    .map((t) => {
      const priority: InsightRecommendation["priority"] = t.masteryLevel < 55 || t.errorFrequency > 0.4 ? "high" : t.masteryLevel < 65 ? "medium" : "low";
      const recommendation =
        t.errorFrequency > 0.35
          ? "Increase spaced retrieval practice and error-focused worked examples; encourage students to explain reasoning in steps."
          : "Add short formative checks and targeted practice; review key misconceptions and prerequisite concepts.";

      return { topic: t.topic, priority, recommendation };
    });

  if (topicList.length === 0) {
    highlights.push("No topic activity logged yet. Once students complete assignments, this dashboard will populate with anonymized trends.");
  }

  return { highlights, concerns, recommendedInterventions };
};

export const aggregateTeacherMetrics = (rawData: {
  period: DashboardMetrics["period"];
  timestamp: string;
  studentProgress: StudentProgress[];
  topicMetrics: TopicMetric[];
  ethics: EthicsMetric;
  quality: QualityMetric;
  interactionDepths: Array<{ depth_level: "Core" | "Applied" | "Mastery" }>;
}): DashboardMetrics => {
  const totalStudents = new Set(rawData.studentProgress.map((s) => s.student_hash)).size;
  const totalInteractions = rawData.interactionDepths.length;

  const avgMastery = safeAvg(rawData.topicMetrics.map((t) => t.masteryLevel));

  const depthDistribution = normalizeDistribution(computeDepthDistribution(rawData.interactionDepths));

  return {
    period: rawData.period,
    timestamp: rawData.timestamp,
    metrics: {
      totalStudents,
      totalInteractions,
      averageMastery: Number(avgMastery.toFixed(1)),
      topicBreakdown: toRecord(rawData.topicMetrics),
      depthDistribution,
      ethicsFlags: rawData.ethics,
      qualityScores: rawData.quality
    }
  };
};

export const aggregateInstitutionMetrics = (rawData: InstitutionDashboardResponse): InstitutionDashboardResponse => {
  return rawData;
};

export const computeSystemHealthScore = (health: SystemHealthMetric): number => {
  const errorPenalty = Math.min(60, health.errorRate * 100 * 10);
  const latencyPenalty = Math.min(30, health.averageResponseTime / 100);
  const bugPenalty = Math.min(20, health.activeBugs * 2);

  const score = 100 - errorPenalty - latencyPenalty - bugPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const computeComplianceScore = (ethics: EthicsMetric, totalInteractions: number): number => {
  const normalizedInteractions = Math.max(1, totalInteractions);
  const severity = ethics.cheatingDetected * 2 + ethics.privacyAlerts * 3 + ethics.assignmentEnforcements + ethics.promptModifications;
  const rate = severity / normalizedInteractions;

  const score = 100 - Math.min(100, rate * 200);
  return Math.max(0, Math.min(100, Math.round(score)));
};
