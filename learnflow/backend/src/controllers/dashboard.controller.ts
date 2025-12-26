import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../app";
import { logger } from "../utils/logger";
import { dashboardCache } from "../dashboard/dashboardCache";
import { dashboardDataService } from "../dashboard/dashboardDataService";
import {
  aggregateTeacherMetrics,
  calculateTrends,
  computeComplianceScore,
  computeSystemHealthScore,
  generateInsights
} from "../dashboard/dashboardAggregator";
import {
  type ActivityEvent,
  type AlertEvent,
  type DashboardPeriod,
  type EthicsReport,
  type InstitutionDashboardResponse,
  type QualityMetric,
  type TeacherDashboardResponse,
  type TopicAnalysis
} from "../dashboard/dashboardTypes";
import { periodToRange, telemetryStore, type InteractionEvent, type TelemetryEvent } from "../dashboard/telemetryStore";
import { systemMonitor } from "../dashboard/systemMonitor";

const periodSchema = z.enum(["day", "week", "month"]);

const getRole = (req: Request): "teacher" | "institution" | "unknown" => {
  const raw = (req.header("x-role") ?? req.header("x-learnflow-role") ?? "").toLowerCase().trim();
  if (raw === "teacher") return "teacher";
  if (raw === "institution" || raw === "auditor") return "institution";
  return "unknown";
};

const requireRole = (req: Request, allowed: Array<"teacher" | "institution">): void => {
  const role = getRole(req);
  if (role === "unknown" || !allowed.includes(role)) {
    throw new HttpError(403, "Forbidden");
  }
};

const parsePeriod = (input: unknown, fallback: DashboardPeriod): DashboardPeriod => {
  const parsed = periodSchema.safeParse(input);
  return parsed.success ? parsed.data : fallback;
};

const toDayKey = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const computeQualityForRange = async (range: { from: Date; to: Date }): Promise<QualityMetric> => {
  const events = await telemetryStore.query(range, { kind: ["interaction"] });
  const interactions = events.filter((e): e is InteractionEvent => e.kind === "interaction");

  const avg = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const depthAlignmentScore = Number(avg(interactions.map((i) => i.depth_alignment_score)).toFixed(3));
  const clarityScore = Number(avg(interactions.map((i) => i.clarity_score)).toFixed(3));
  const reasoningQualityAverage = Number((depthAlignmentScore * 0.6 + clarityScore * 0.4).toFixed(3));

  return { depthAlignmentScore, clarityScore, reasoningQualityAverage, trend: "stable" };
};

const depthTrendFromInteractions = (interactions: InteractionEvent[]): Array<{ timestamp: string; Core: number; Applied: number; Mastery: number }> => {
  const buckets = new Map<string, { Core: number; Applied: number; Mastery: number }>();

  for (const i of interactions) {
    const key = toDayKey(i.timestamp);
    const current = buckets.get(key) ?? { Core: 0, Applied: 0, Mastery: 0 };
    current[i.depth_level] += 1;
    buckets.set(key, current);
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

  return sorted.map(([day, v]) => {
    const total = v.Core + v.Applied + v.Mastery;
    if (total === 0) return { timestamp: day, Core: 0, Applied: 0, Mastery: 0 };

    return {
      timestamp: day,
      Core: Number((v.Core / total).toFixed(3)),
      Applied: Number((v.Applied / total).toFixed(3)),
      Mastery: Number((v.Mastery / total).toFixed(3))
    };
  });
};

const advancementFromProgress = (progress: Array<{ student_hash: string; mastery_level: number; depth_level: "Core" | "Applied" | "Mastery" }>) => {
  const order: Record<string, number> = { Core: 0, Applied: 1, Mastery: 2 };

  const byStudent = new Map<string, { maxDepth: "Core" | "Applied" | "Mastery"; scores: number[] }>();

  for (const p of progress) {
    const current = byStudent.get(p.student_hash) ?? { maxDepth: p.depth_level, scores: [] };
    current.scores.push(p.mastery_level);

    if (order[p.depth_level] > order[current.maxDepth]) {
      current.maxDepth = p.depth_level;
    }

    byStudent.set(p.student_hash, current);
  }

  let coreToApplied = 0;
  let appliedToMastery = 0;

  for (const s of byStudent.values()) {
    const avg = s.scores.length === 0 ? 0 : s.scores.reduce((a, b) => a + b, 0) / s.scores.length;

    if (s.maxDepth === "Core" && avg >= 75) coreToApplied += 1;
    if (s.maxDepth === "Applied" && avg >= 82) appliedToMastery += 1;
  }

  return { CoreToApplied: coreToApplied, AppliedToMastery: appliedToMastery };
};

const telemetryToActivity = (events: TelemetryEvent[]): ActivityEvent[] => {
  return events.map((e) => {
    if (e.kind === "interaction") {
      const endpoint = e.endpoint ?? "";

      if (endpoint.includes("/api/assignment/generate")) {
        return {
          timestamp: e.timestamp,
          type: "assignment_generate",
          summary: "Assignment generated",
          depth_level: e.depth_level
        };
      }

      if (endpoint.includes("/api/assignment/evaluate")) {
        return {
          timestamp: e.timestamp,
          type: "assignment_evaluate",
          summary: "Assignment evaluated",
          depth_level: e.depth_level
        };
      }

      return {
        timestamp: e.timestamp,
        type: "chat",
        summary: e.model_called ? "Chat interaction (model call)" : "Chat interaction (local response)",
        depth_level: e.depth_level
      };
    }

    if (e.kind === "assignment") {
      return {
        timestamp: e.timestamp,
        type: e.action === "generate" ? "assignment_generate" : "assignment_evaluate",
        summary: e.action === "generate" ? `Assignment generated: ${e.topic}` : `Assignment evaluated: ${e.topic}`,
        topic: e.topic,
        depth_level: e.depth_level
      };
    }

    if (e.kind === "ethics") {
      return {
        timestamp: e.timestamp,
        type: "ethics_enforcement",
        summary: `Ethics event: ${e.type.replace(/_/g, " ")}`
      };
    }

    if (e.kind === "privacy") {
      return {
        timestamp: e.timestamp,
        type: "privacy_alert",
        summary: "Privacy alert detected in user input"
      };
    }

    return {
      timestamp: e.timestamp,
      type: "system_error",
      summary: e.message
    };
  });
};

const telemetryToAlerts = (events: TelemetryEvent[]): AlertEvent[] => {
  return events
    .filter((e) => e.kind === "system_error" || e.kind === "privacy" || e.kind === "ethics")
    .map((e) => {
      if (e.kind === "system_error") {
        return {
          timestamp: e.timestamp,
          severity: e.status && e.status >= 500 ? "critical" : "warning",
          message: e.message,
          module: e.endpoint
        };
      }

      if (e.kind === "privacy") {
        return {
          timestamp: e.timestamp,
          severity: "critical",
          message: "Privacy safeguard triggered (possible PII detected)",
          module: e.endpoint
        };
      }

      return {
        timestamp: e.timestamp,
        severity: e.type === "cheating_detected" ? "warning" : "info",
        message: `Ethics event: ${e.type.replace(/_/g, " ")}`,
        module: e.endpoint
      };
    })
    .slice(0, 25);
};

export const dashboardController = {
  async getTeacherDashboard(req: Request, res: Response): Promise<void> {
    requireRole(req, ["teacher"]);

    const period = parsePeriod(req.query.period, "week");
    const cacheKey = `dashboard:teacher:${period}`;
    const cached = dashboardCache.getCachedMetrics<TeacherDashboardResponse>(cacheKey);
    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const [studentProgress, topicMetrics, ethics, qualityCurrent, systemHealth, assignmentStats, interactions, timeSpentByDepth, recent] =
        await Promise.all([
          dashboardDataService.getStudentProgressData(period),
          dashboardDataService.getTopicMetrics(period),
          dashboardDataService.getEthicsCompliance(period),
          dashboardDataService.getWandBMetrics(period),
          dashboardDataService.getSystemHealthMetrics(),
          dashboardDataService.getAssignmentStats(period),
          dashboardDataService.getInteractionEvents(period),
          dashboardDataService.getDepthTimeSpentMinutes(period),
          dashboardDataService.getRecentTelemetry(period, 20)
        ]);

      const range = periodToRange(period);
      const prevRange = periodToRange(period, range.from);
      const qualityHistorical = await computeQualityForRange(prevRange);
      const trend = calculateTrends(
        { ...qualityCurrent, reasoningQualityAverage: qualityCurrent.reasoningQualityAverage },
        qualityHistorical
      );
      qualityCurrent.trend = trend.trend;

      const base = aggregateTeacherMetrics({
        period,
        timestamp,
        studentProgress,
        topicMetrics,
        ethics,
        quality: qualityCurrent,
        interactionDepths: interactions.map((i) => ({ depth_level: i.depth_level }))
      });

      const systemHealthScore = computeSystemHealthScore(systemHealth);
      const complianceScore = computeComplianceScore(ethics, base.metrics.totalInteractions);

      const depthTrend = depthTrendFromInteractions(interactions);
      const studentsReadyForAdvancement = advancementFromProgress(studentProgress);

      const response: TeacherDashboardResponse = {
        period,
        timestamp,
        metrics: {
          ...base.metrics,
          systemHealth,
          systemHealthScore,
          complianceScore,
          depthTrend,
          assignmentStats,
          recentActivity: telemetryToActivity(recent),
          studentsReadyForAdvancement,
          timeSpentByDepthMinutes: timeSpentByDepth
        },
        insights: generateInsights(base)
      };

      dashboardCache.setCachedMetrics(cacheKey, response, 60_000);
      res.status(200).json({ ok: true, data: response });
    } catch (err) {
      logger.error({ err }, "teacher_dashboard_failed");
      throw new HttpError(500, "Failed to build teacher dashboard metrics");
    }
  },

  async getInstitutionDashboard(req: Request, res: Response): Promise<void> {
    requireRole(req, ["institution"]);

    const period = parsePeriod(req.query.period, "month");
    const cacheKey = `dashboard:institution:${period}`;
    const cached = dashboardCache.getCachedMetrics<InstitutionDashboardResponse>(cacheKey);
    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const [ethics, qualityCurrent, systemHealth, interactions, recent, gemini] = await Promise.all([
        dashboardDataService.getEthicsCompliance(period),
        dashboardDataService.getWandBMetrics(period),
        dashboardDataService.getSystemHealthMetrics(),
        dashboardDataService.getInteractionEvents(period),
        dashboardDataService.getRecentTelemetry(period, 50),
        dashboardDataService.getEstimatedGeminiCost(period)
      ]);

      const range = periodToRange(period);
      const prevRange = periodToRange(period, range.from);
      const qualityHistorical = await computeQualityForRange(prevRange);
      const trend = calculateTrends(
        { ...qualityCurrent, reasoningQualityAverage: qualityCurrent.reasoningQualityAverage },
        qualityHistorical
      );
      qualityCurrent.trend = trend.trend;

      const snap = systemMonitor.getSnapshot(60 * 60 * 1000);

      const response: InstitutionDashboardResponse = {
        period,
        timestamp,
        metrics: {
          usage: {
            totalInteractions: interactions.length,
            geminiApiCalls: gemini.apiCalls,
            estimatedGeminiCostUsd: gemini.costUsd,
            averageResponseTimeMs: Number(snap.avgResponseTimeMs.toFixed(1)),
            p95ResponseTimeMs: Number(snap.p95ResponseTimeMs.toFixed(1)),
            errorRate: Number(snap.errorRate.toFixed(4))
          },
          ethicsFlags: ethics,
          qualityScores: qualityCurrent,
          systemHealth: {
            ...systemHealth,
            modules: snap.modules.map((m) => ({ module: m.module, errorRate: Number(m.errorRate.toFixed(4)), count: m.count }))
          },
          pipeline: {
            telemetryWritable: await telemetryStore.isWritable(),
            wandbEnabled: Boolean(process.env.WANDB_API_KEY && process.env.WANDB_PROJECT)
          },
          recentAlerts: telemetryToAlerts(recent)
        }
      };

      dashboardCache.setCachedMetrics(cacheKey, response, 120_000);
      res.status(200).json({ ok: true, data: response });
    } catch (err) {
      logger.error({ err }, "institution_dashboard_failed");
      throw new HttpError(500, "Failed to build institution dashboard metrics");
    }
  },

  async getMetricsForPeriod(req: Request, res: Response): Promise<void> {
    const role = getRole(req);
    if (role === "unknown") throw new HttpError(403, "Forbidden");

    const period = parsePeriod(req.params.period, "week");
    const cacheKey = `dashboard:metrics:${role}:${period}`;
    const cached = dashboardCache.getCachedMetrics<unknown>(cacheKey);

    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const [studentProgress, topicMetrics, ethics, quality, interactions] = await Promise.all([
        dashboardDataService.getStudentProgressData(period),
        dashboardDataService.getTopicMetrics(period),
        dashboardDataService.getEthicsCompliance(period),
        dashboardDataService.getWandBMetrics(period),
        dashboardDataService.getInteractionEvents(period)
      ]);

      if (role === "institution") {
        const base = aggregateTeacherMetrics({
          period,
          timestamp,
          studentProgress: [],
          topicMetrics: [],
          ethics,
          quality,
          interactionDepths: interactions.map((i) => ({ depth_level: i.depth_level }))
        });

        dashboardCache.setCachedMetrics(cacheKey, base, 60_000);
        res.status(200).json({ ok: true, data: base });
        return;
      }

      const base = aggregateTeacherMetrics({
        period,
        timestamp,
        studentProgress,
        topicMetrics,
        ethics,
        quality,
        interactionDepths: interactions.map((i) => ({ depth_level: i.depth_level }))
      });

      dashboardCache.setCachedMetrics(cacheKey, base, 60_000);
      res.status(200).json({ ok: true, data: base });
    } catch (err) {
      logger.error({ err }, "dashboard_metrics_for_period_failed");
      throw new HttpError(500, "Failed to build metrics");
    }
  },

  async getTopicAnalysis(req: Request, res: Response): Promise<void> {
    const role = getRole(req);
    if (role === "unknown") throw new HttpError(403, "Forbidden");

    const topicName = z.string().min(2).max(200).parse(req.params.topicName);
    const period = parsePeriod(req.query.period, "month");

    const cacheKey = `dashboard:topic:${period}:${topicName}`;
    const cached = dashboardCache.getCachedMetrics<TopicAnalysis>(cacheKey);
    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const [topics, assignments] = await Promise.all([
        dashboardDataService.getTopicMetrics(period),
        dashboardDataService.getAssignmentStats(period)
      ]);

      const metric = topics.find((t) => t.topic.toLowerCase() === topicName.toLowerCase());
      if (!metric) {
        throw new HttpError(404, "Topic not found for period");
      }

      const range = periodToRange(period);
      const events = await telemetryStore.query(range, { kind: ["assignment"] });
      const relevant = events.filter((e) => e.kind === "assignment" && e.topic.toLowerCase() === topicName.toLowerCase());

      const depthDist = { Core: 0, Applied: 0, Mastery: 0 };
      const misconceptionCounts: Record<string, number> = {};

      for (const e of relevant) {
        depthDist[e.depth_level] += 1;
        if (e.action === "evaluate") {
          for (const c of e.missing_concepts ?? []) {
            misconceptionCounts[c] = (misconceptionCounts[c] ?? 0) + 1;
          }
        }
      }

      const assignment = assignments.find((a) => a.topic.toLowerCase() === topicName.toLowerCase());

      const recommendedInterventions = [
        metric.masteryLevel < 55
          ? "Run a short prerequisite refresher and provide a worked example followed by a near-transfer practice problem."
          : "Use a quick formative check, then provide targeted practice on the most-missed subskills.",
        metric.errorFrequency > 0.3
          ? "Increase feedback frequency: ask students to explain each step before moving on, and use retrieval practice."
          : "Encourage self-explanation and use spaced repetition for reinforcement."
      ];

      if (assignment && Object.keys(assignment.misconceptionCounts).length > 0) {
        const topMisconception = Object.entries(assignment.misconceptionCounts).sort((a, b) => b[1] - a[1])[0];
        if (topMisconception) {
          recommendedInterventions.push(`Address common misconception: "${topMisconception[0]}".`);
        }
      }

      const response: TopicAnalysis = {
        topic: metric.topic,
        period,
        timestamp,
        metric,
        depthDistribution: depthDist,
        misconceptionCounts,
        recommendedInterventions
      };

      dashboardCache.setCachedMetrics(cacheKey, response, 120_000);
      res.status(200).json({ ok: true, data: response });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      logger.error({ err }, "topic_analysis_failed");
      throw new HttpError(500, "Failed to build topic analysis");
    }
  },

  async getSystemHealth(req: Request, res: Response): Promise<void> {
    const role = getRole(req);
    if (role === "unknown") throw new HttpError(403, "Forbidden");

    const cacheKey = "dashboard:system-health";
    const cached = dashboardCache.getCachedMetrics<unknown>(cacheKey);
    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    try {
      const metric = await dashboardDataService.getSystemHealthMetrics();
      dashboardCache.setCachedMetrics(cacheKey, metric, 10_000);
      res.status(200).json({ ok: true, data: metric });
    } catch (err) {
      logger.error({ err }, "system_health_failed");
      throw new HttpError(500, "Failed to get system health");
    }
  },

  async getEthicsReport(req: Request, res: Response): Promise<void> {
    requireRole(req, ["institution"]);

    const period = parsePeriod(req.query.period, "month");
    const cacheKey = `dashboard:ethics:${period}`;
    const cached = dashboardCache.getCachedMetrics<EthicsReport>(cacheKey);
    if (cached) {
      res.status(200).json({ ok: true, data: cached, cached: true });
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const summary = await dashboardDataService.getEthicsCompliance(period);
      const interactions = await dashboardDataService.getInteractionEvents(period);
      const complianceScore = computeComplianceScore(summary, interactions.length);

      const range = periodToRange(period);
      const events = await telemetryStore.query(range, { kind: ["ethics", "privacy"] });
      const recentEvents = events
        .slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50)
        .map((e) => {
          if (e.kind === "privacy") {
            return { timestamp: e.timestamp, type: "privacy_alert" as const, endpoint: e.endpoint };
          }

          return {
            timestamp: e.timestamp,
            type: e.type,
            endpoint: e.endpoint,
            flags: e.flags?.map((f) => String(f))
          };
        });

      const response: EthicsReport = {
        period,
        timestamp,
        summary,
        recentEvents,
        complianceScore
      };

      dashboardCache.setCachedMetrics(cacheKey, response, 120_000);
      res.status(200).json({ ok: true, data: response });
    } catch (err) {
      logger.error({ err }, "ethics_report_failed");
      throw new HttpError(500, "Failed to build ethics report");
    }
  }
};
