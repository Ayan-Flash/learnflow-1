import type { DepthLevel } from "../ai/depthEngine";
import { logger } from "../utils/logger";
import { systemMonitor } from "./systemMonitor";
import {
  periodToRange,
  telemetryStore,
  type AssignmentEvent,
  type InteractionEvent,
  type TelemetryEvent
} from "./telemetryStore";
import type {
  AssignmentStatistic,
  DashboardPeriod,
  EthicsMetric,
  QualityMetric,
  StudentProgress,
  SystemHealthMetric,
  TopicMetric
} from "./dashboardTypes";

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const depthInit = (): Record<DepthLevel, number> => ({ Core: 0, Applied: 0, Mastery: 0 });

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const maxIso = (a: string, b: string): string => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
};

const computeReasoningQuality = (depthAlignment: number, clarity: number): number => {
  return Number((clamp01(depthAlignment) * 0.6 + clamp01(clarity) * 0.4).toFixed(3));
};

const estimateGeminiCostUsd = (events: InteractionEvent[]): number => {
  const inputRate = Number(process.env.GEMINI_COST_PER_1K_INPUT_TOKENS ?? 0.00025);
  const outputRate = Number(process.env.GEMINI_COST_PER_1K_OUTPUT_TOKENS ?? 0.0005);

  const input = events.reduce((acc, e) => acc + e.input_tokens, 0);
  const output = events.reduce((acc, e) => acc + e.output_tokens, 0);

  const cost = (input / 1000) * inputRate + (output / 1000) * outputRate;
  return Number(cost.toFixed(2));
};

const computeTimeSpentByDepthMinutes = (events: InteractionEvent[]): Record<DepthLevel, number> => {
  const byActor = new Map<string, InteractionEvent[]>();

  for (const e of events) {
    const actor = e.actor_hash;
    if (!actor) continue;
    const list = byActor.get(actor) ?? [];
    list.push(e);
    byActor.set(actor, list);
  }

  const totals = depthInit();

  for (const list of byActor.values()) {
    const sorted = list.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current) continue;

      if (!next) continue;

      const deltaMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      if (deltaMs <= 0) continue;

      const maxSessionGapMs = 30 * 60 * 1000;
      if (deltaMs > maxSessionGapMs) continue;

      const cappedMs = Math.min(deltaMs, 10 * 60 * 1000);
      totals[current.depth_level] += cappedMs / (60 * 1000);
    }
  }

  return {
    Core: Number(totals.Core.toFixed(1)),
    Applied: Number(totals.Applied.toFixed(1)),
    Mastery: Number(totals.Mastery.toFixed(1))
  };
};

export class DashboardDataService {
  async getStudentProgressData(period: string): Promise<StudentProgress[]> {
    const p = period as DashboardPeriod;
    const { from, to } = periodToRange(p);

    try {
      const events = await telemetryStore.query({ from, to }, { kind: ["assignment"] });
      const evals = events.filter(
        (e): e is AssignmentEvent => e.kind === "assignment" && e.action === "evaluate" && Boolean(e.actor_hash)
      );

      const byStudentTopic = new Map<string, StudentProgress>();

      for (const e of evals) {
        const key = `${e.actor_hash}:${e.topic}`;
        const current = byStudentTopic.get(key) ?? {
          student_hash: e.actor_hash ?? "",
          topic: e.topic,
          mastery_level: 0,
          depth_level: e.depth_level,
          attempt_count: 0,
          error_count: 0,
          last_updated: e.timestamp
        };

        const score = clamp01((e.conceptual_score ?? 0) / 100) * 100;

        current.mastery_level =
          current.attempt_count === 0 ? score : (current.mastery_level * current.attempt_count + score) / (current.attempt_count + 1);
        current.attempt_count += 1;

        const error = (e.conceptual_score ?? 0) < 60 || (e.flags ?? []).length > 0;
        if (error) current.error_count += 1;

        const depthOrder: Record<DepthLevel, number> = { Core: 0, Applied: 1, Mastery: 2 };
        if (depthOrder[e.depth_level] > depthOrder[current.depth_level]) {
          current.depth_level = e.depth_level;
        }

        current.last_updated = maxIso(current.last_updated, e.timestamp);
        byStudentTopic.set(key, current);
      }

      return [...byStudentTopic.values()].map((s) => ({ ...s, mastery_level: Number(s.mastery_level.toFixed(1)) }));
    } catch (err) {
      logger.warn({ err }, "dashboard_getStudentProgressData_failed");
      return [];
    }
  }

  async getTopicMetrics(period: string): Promise<TopicMetric[]> {
    const p = period as DashboardPeriod;
    const { from, to } = periodToRange(p);

    try {
      const events = await telemetryStore.query({ from, to }, { kind: ["assignment"] });
      const evals = events.filter((e): e is AssignmentEvent => e.kind === "assignment" && e.action === "evaluate");

      const byTopic = new Map<string, { scores: number[]; attempts: number; errors: number; last: string }>();

      for (const e of evals) {
        const current = byTopic.get(e.topic) ?? { scores: [], attempts: 0, errors: 0, last: e.timestamp };
        current.attempts += 1;

        const score = clamp01((e.conceptual_score ?? 0) / 100) * 100;
        current.scores.push(score);

        const error = (e.conceptual_score ?? 0) < 60 || (e.flags ?? []).length > 0;
        if (error) current.errors += 1;

        current.last = maxIso(current.last, e.timestamp);
        byTopic.set(e.topic, current);
      }

      return [...byTopic.entries()].map(([topic, v]) => ({
        topic,
        masteryLevel: Number(average(v.scores).toFixed(1)),
        attemptCount: v.attempts,
        errorFrequency: v.attempts === 0 ? 0 : Number((v.errors / v.attempts).toFixed(3)),
        lastUpdated: v.last
      }));
    } catch (err) {
      logger.warn({ err }, "dashboard_getTopicMetrics_failed");
      return [];
    }
  }

  async getEthicsCompliance(period: string): Promise<EthicsMetric> {
    const p = period as DashboardPeriod;
    const { from, to } = periodToRange(p);

    try {
      const events = await telemetryStore.query({ from, to }, { kind: ["ethics", "privacy"] });

      const cheatingDetected = events.filter((e) => e.kind === "ethics" && e.type === "cheating_detected").length;
      const promptModifications = events.filter((e) => e.kind === "ethics" && e.type === "prompt_modified").length;
      const assignmentEnforcements = events.filter((e) => e.kind === "ethics" && e.type === "assignment_enforced").length;
      const privacyAlerts = events.filter((e) => e.kind === "privacy").length;

      return {
        cheatingDetected,
        promptModifications,
        assignmentEnforcements,
        privacyAlerts
      };
    } catch (err) {
      logger.warn({ err }, "dashboard_getEthicsCompliance_failed");
      return {
        cheatingDetected: 0,
        promptModifications: 0,
        assignmentEnforcements: 0,
        privacyAlerts: 0
      };
    }
  }

  async getWandBMetrics(period: string): Promise<QualityMetric> {
    const p = period as DashboardPeriod;
    const { from, to } = periodToRange(p);

    try {
      const events = await telemetryStore.query({ from, to }, { kind: ["interaction"] });
      const interactions = events.filter((e): e is InteractionEvent => e.kind === "interaction");

      const depthAlignmentScore = Number(average(interactions.map((i) => i.depth_alignment_score)).toFixed(3));
      const clarityScore = Number(average(interactions.map((i) => i.clarity_score)).toFixed(3));
      const reasoningQualityAverage = computeReasoningQuality(depthAlignmentScore, clarityScore);

      return {
        depthAlignmentScore,
        clarityScore,
        reasoningQualityAverage,
        trend: "stable"
      };
    } catch (err) {
      logger.warn({ err }, "dashboard_getWandBMetrics_failed");
      return {
        depthAlignmentScore: 0,
        clarityScore: 0,
        reasoningQualityAverage: 0,
        trend: "stable"
      };
    }
  }

  async getSystemHealthMetrics(): Promise<SystemHealthMetric> {
    try {
      const snap = systemMonitor.getSnapshot(60 * 60 * 1000);
      return {
        uptime: systemMonitor.getUptimeSeconds(),
        averageResponseTime: Number(snap.avgResponseTimeMs.toFixed(1)),
        errorRate: Number(snap.errorRate.toFixed(4)),
        activeBugs: snap.errors
      };
    } catch (err) {
      logger.warn({ err }, "dashboard_getSystemHealthMetrics_failed");
      return {
        uptime: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeBugs: 0
      };
    }
  }

  async getAssignmentStats(period: string): Promise<AssignmentStatistic[]> {
    const p = period as DashboardPeriod;
    const { from, to } = periodToRange(p);

    try {
      const events = await telemetryStore.query({ from, to }, { kind: ["assignment"] });
      const assignmentEvents = events.filter((e): e is AssignmentEvent => e.kind === "assignment");

      const byTopic = new Map<
        string,
        {
          generated: number;
          evaluated: number;
          scores: number[];
          hintsProvided: number[];
          scoresWithHints: number[];
          misconceptions: Record<string, number>;
          last: string;
        }
      >();

      for (const e of assignmentEvents) {
        const current = byTopic.get(e.topic) ?? {
          generated: 0,
          evaluated: 0,
          scores: [],
          hintsProvided: [],
          scoresWithHints: [],
          misconceptions: {},
          last: e.timestamp
        };

        if (e.action === "generate") current.generated += 1;

        if (e.action === "evaluate") {
          current.evaluated += 1;
          const score = clamp01((e.conceptual_score ?? 0) / 100) * 100;
          current.scores.push(score);

          const hints = e.hints_provided ?? 0;
          current.hintsProvided.push(hints);
          if (hints > 0) current.scoresWithHints.push(score);

          for (const c of e.missing_concepts ?? []) {
            current.misconceptions[c] = (current.misconceptions[c] ?? 0) + 1;
          }
        }

        current.last = maxIso(current.last, e.timestamp);
        byTopic.set(e.topic, current);
      }

      return [...byTopic.entries()].map(([topic, v]) => ({
        topic,
        generatedCount: v.generated,
        evaluatedCount: v.evaluated,
        averageScore: Number(average(v.scores).toFixed(1)),
        hintEffectiveness: {
          averageHintsProvided: Number(average(v.hintsProvided).toFixed(2)),
          averageScoreWhenHintsProvided: Number(average(v.scoresWithHints).toFixed(1))
        },
        misconceptionCounts: v.misconceptions,
        lastUpdated: v.last
      }));
    } catch (err) {
      logger.warn({ err }, "dashboard_getAssignmentStats_failed");
      return [];
    }
  }

  async getInteractionEvents(period: DashboardPeriod): Promise<InteractionEvent[]> {
    const { from, to } = periodToRange(period);
    const events = await telemetryStore.query({ from, to }, { kind: ["interaction"] });
    return events.filter((e): e is InteractionEvent => e.kind === "interaction");
  }

  async getDepthTimeSpentMinutes(period: DashboardPeriod): Promise<Record<DepthLevel, number>> {
    try {
      const interactions = await this.getInteractionEvents(period);
      return computeTimeSpentByDepthMinutes(interactions);
    } catch (err) {
      logger.warn({ err }, "dashboard_getDepthTimeSpentMinutes_failed");
      return { Core: 0, Applied: 0, Mastery: 0 };
    }
  }

  async getEstimatedGeminiCost(period: DashboardPeriod): Promise<{ apiCalls: number; costUsd: number }> {
    try {
      const interactions = await this.getInteractionEvents(period);
      const calls = interactions.filter((i) => i.model_called).length;
      return { apiCalls: calls, costUsd: estimateGeminiCostUsd(interactions.filter((i) => i.model_called)) };
    } catch (err) {
      logger.warn({ err }, "dashboard_getEstimatedGeminiCost_failed");
      return { apiCalls: 0, costUsd: 0 };
    }
  }

  async getRecentTelemetry(period: DashboardPeriod, limit: number): Promise<TelemetryEvent[]> {
    const { from, to } = periodToRange(period);
    return telemetryStore.getRecent(limit, { from, to });
  }
}

export const dashboardDataService = new DashboardDataService();
