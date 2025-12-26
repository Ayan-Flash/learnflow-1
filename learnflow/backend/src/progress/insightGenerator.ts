import { logger } from "../utils/logger";
import { progressStore, ProgressStore } from "./progressStore";
import type { StudentProgress, StudentInsight, TopicProgress } from "./types";

export class InsightGenerator {
  private store: ProgressStore;

  constructor(store: ProgressStore = progressStore) {
    this.store = store;
  }

  generateInsights(studentId: string): StudentInsight | null {
    try {
      const progress = this.store.getStudentProgress(studentId);
      if (!progress) {
        logger.debug({ studentId }, "no_progress_found_for_insights");
        return null;
      }

      const strengths = this.identifyStrengths(progress);
      const weaknesses = this.identifyWeaknesses(progress);
      const recommendations = this.generateRecommendations(progress, strengths, weaknesses);
      const masteryTrend = this.analyzeMasteryTrend(progress);
      const suggestedNextTopic = this.suggestNextTopic(progress);

      return {
        strengths,
        weaknesses,
        recommendations,
        adaptiveSignal: this.determineAdaptiveSignal(progress, masteryTrend),
        masteryTrend,
        suggestedNextTopic
      };
    } catch (err) {
      logger.error({ err, studentId }, "insight_generation_failed");
      throw err;
    }
  }

  identifyStrengths(progress: StudentProgress): string[] {
    const strengths: string[] = [];

    progress.topics.forEach(tp => {
      if (tp.masteryLevel >= 75) {
        strengths.push(tp.topic);
      }
    });

    strengths.sort((a, b) => {
      const masteryA = progress.topics.find(t => t.topic === a)?.masteryLevel || 0;
      const masteryB = progress.topics.find(t => t.topic === b)?.masteryLevel || 0;
      return masteryB - masteryA;
    });

    return strengths.slice(0, 5);
  }

  identifyWeaknesses(progress: StudentProgress): string[] {
    const weaknesses: string[] = [];

    progress.topics.forEach(tp => {
      if (tp.masteryLevel < 50) {
        weaknesses.push(tp.topic);
      }
    });

    weaknesses.sort((a, b) => {
      const masteryA = progress.topics.find(t => t.topic === a)?.masteryLevel || 0;
      const masteryB = progress.topics.find(t => t.topic === b)?.masteryLevel || 0;
      return masteryA - masteryB;
    });

    return weaknesses.slice(0, 5);
  }

  generateRecommendations(
    progress: StudentProgress,
    strengths: string[],
    weaknesses: string[]
  ): string[] {
    const recommendations: string[] = [];

    weaknesses.forEach(topic => {
      const tp = progress.topics.find(t => t.topic === topic);
      if (!tp) return;

      if (tp.confidenceTrend === 'declining') {
        recommendations.push(`Review ${topic} fundamentals - confidence appears to be declining`);
      } else if (tp.attemptCount < 3) {
        recommendations.push(`Practice more ${topic} to build a stronger foundation`);
      } else if (tp.reasoningAverage < 0.5) {
        recommendations.push(`Focus on understanding concepts behind ${topic} rather than memorization`);
      }
    });

    strengths.forEach(topic => {
      const tp = progress.topics.find(t => t.topic === topic);
      if (!tp) return;

      if (tp.masteryLevel >= 90 && tp.depthProgress !== 'Mastery') {
        recommendations.push(`${topic} is mastered - consider advancing to mastery-level challenges`);
      }
    });

    const topicsWithErrors = progress.topics.filter(tp => {
      const errorCount = Object.values(tp.errorFrequency).reduce((a, b) => a + b, 0);
      return errorCount >= 3;
    });

    topicsWithErrors.forEach(tp => {
      const commonErrors = Object.entries(tp.errorFrequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 2)
        .map(([pattern]) => pattern);

      if (commonErrors.length > 0) {
        recommendations.push(`Pay attention to common patterns in ${tp.topic}: ${commonErrors.join(', ')}`);
      }
    });

    if (progress.topics.length > 0 && progress.overallMastery < 50) {
      recommendations.push("Focus on building confidence in core concepts before advancing");
    }

    if (recommendations.length === 0) {
      recommendations.push("Continue practicing - you're making steady progress!");
    }

    return recommendations.slice(0, 7);
  }

  analyzeMasteryTrend(progress: StudentProgress): 'accelerating' | 'steady' | 'plateauing' | 'declining' {
    if (progress.topics.length < 2) {
      return 'steady';
    }

    const topics = progress.topics.filter(tp => tp.masteryHistory.length >= 3);
    if (topics.length === 0) {
      return 'steady';
    }

    let acceleratingCount = 0;
    let decliningCount = 0;
    let totalChange = 0;

    topics.forEach(tp => {
      const history = tp.masteryHistory;
      const recent = history.slice(-5);
      const older = history.slice(-10, -5);

      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const change = recentAvg - olderAvg;

        totalChange += change;

        if (change > 10) acceleratingCount++;
        else if (change < -10) decliningCount++;
      }
    });

    const avgChange = totalChange / topics.length;

    if (avgChange > 8 && acceleratingCount > topics.length / 2) {
      return 'accelerating';
    }
    if (avgChange < -8 && decliningCount > topics.length / 2) {
      return 'declining';
    }
    if (Math.abs(avgChange) < 3) {
      return 'plateauing';
    }

    return 'steady';
  }

  suggestNextTopic(progress: StudentProgress): string | null {
    if (progress.topics.length === 0) {
      return null;
    }

    const candidates = progress.topics
      .filter(tp => tp.masteryLevel >= 50 && tp.masteryLevel < 80)
      .sort((a, b) => b.masteryLevel - a.masteryLevel);

    if (candidates.length > 0) {
      return candidates[0]?.topic || null;
    }

    const weakestTopics = progress.topics
      .filter(tp => tp.masteryLevel < 30)
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    if (weakestTopics.length > 0) {
      return weakestTopics[0]?.topic || null;
    }

    return progress.topics[0]?.topic || null;
  }

  getTopicAnalysis(studentId: string, topic: string): TopicProgress | null {
    const progress = this.store.getStudentProgress(studentId);
    if (!progress) return null;

    return progress.topics.find(tp => tp.topic === topic) || null;
  }

  compareTopics(progress: StudentProgress, topics: string[]): Record<string, number> {
    const comparison: Record<string, number> = {};

    topics.forEach(topic => {
      const tp = progress.topics.find(t => t.topic === topic);
      comparison[topic] = tp?.masteryLevel || 0;
    });

    return comparison;
  }

  getLearningVelocity(studentId: string): number {
    const events = this.store.getStudentEvents(studentId);
    if (events.length < 2) return 0;

    const recentEvents = events.slice(-10);
    const successfulAttempts = recentEvents.filter(e => e.success).length;

    return Math.round((successfulAttempts / recentEvents.length) * 100);
  }

  private determineAdaptiveSignal(
    progress: StudentProgress,
    masteryTrend: 'accelerating' | 'steady' | 'plateauing' | 'declining'
  ): string {
    const overallMastery = progress.overallMastery;
    const highestTopic = progress.topics.reduce(
      (max, tp) => (tp.masteryLevel > (max?.masteryLevel || 0) ? tp : max),
      null as TopicProgress | null
    );

    if (overallMastery >= 85 && highestTopic?.confidenceTrend === 'improving') {
      return 'INCREASE_DEPTH';
    }

    if (overallMastery >= 50 && overallMastery < 85 && masteryTrend !== 'declining') {
      return 'MAINTAIN_LEVEL';
    }

    if (overallMastery < 50 || masteryTrend === 'declining') {
      return 'REDUCE_COMPLEXITY';
    }

    const errorProneTopics = progress.topics.filter(tp => {
      const errorCount = Object.values(tp.errorFrequency).reduce((a, b) => a + b, 0);
      return errorCount >= 3 && tp.attemptCount < 5;
    });

    if (errorProneTopics.length > 0) {
      return 'PRACTICE_MORE';
    }

    const readyForMastery = progress.topics.filter(
      tp => tp.masteryLevel >= 80 && tp.depthProgress === 'Core'
    );

    if (readyForMastery.length > 0) {
      return 'READY_FOR_MASTERY';
    }

    return 'MAINTAIN_LEVEL';
  }
}

export const insightGenerator = new InsightGenerator();
