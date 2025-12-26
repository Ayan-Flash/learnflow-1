import { logger } from "../utils/logger";
import type {
  StudentInsight,
  StudentProgress,
  AdaptiveSignal,
  TopicProgress,
  DepthLevel
} from "./types";

export class AdaptiveEngine {
  generateSignal(insight: StudentInsight, topic: string): AdaptiveSignal {
    switch (insight.adaptiveSignal) {
      case 'INCREASE_DEPTH':
        return this.signalIncreaseDepth(topic);
      case 'MAINTAIN_LEVEL':
        return this.signalMaintainLevel(topic);
      case 'REDUCE_COMPLEXITY':
        return this.signalReduceComplexity(topic);
      case 'PRACTICE_MORE':
        return this.signalPracticeMore(topic);
      case 'READY_FOR_MASTERY':
        return this.signalReadyForMastery(topic);
      default:
        return this.signalMaintainLevel(topic);
    }
  }

  determineCoreAdherence(masteryLevel: number): boolean {
    return masteryLevel < 70;
  }

  suggestDepthProgression(topic: string, progress: StudentProgress): 'Core' | 'Applied' | 'Mastery' | 'MAINTAIN' {
    const topicProgress = progress.topics.find(tp => tp.topic === topic);
    if (!topicProgress) {
      return 'Core';
    }

    const { masteryLevel, depthProgress, confidenceTrend } = topicProgress;

    if (masteryLevel >= 85 && depthProgress === 'Applied' && confidenceTrend === 'improving') {
      return 'Mastery';
    }

    if (masteryLevel >= 70 && depthProgress === 'Core' && confidenceTrend === 'improving') {
      return 'Applied';
    }

    if (masteryLevel >= 90 && depthProgress === 'Mastery') {
      return 'MAINTAIN';
    }

    return depthProgress;
  }

  generatePracticeRecommendation(topic: string, progress: StudentProgress): 'HEAVY_PRACTICE' | 'LIGHT_PRACTICE' | 'READY_TO_ADVANCE' {
    const topicProgress = progress.topics.find(tp => tp.topic === topic);
    if (!topicProgress) {
      return 'LIGHT_PRACTICE';
    }

    const { masteryLevel, confidenceTrend, errorFrequency } = topicProgress;
    const errorCount = Object.values(errorFrequency).reduce((a, b) => a + b, 0);

    if (masteryLevel < 40 || confidenceTrend === 'declining' || errorCount > 5) {
      return 'HEAVY_PRACTICE';
    }

    if (masteryLevel >= 75 && confidenceTrend === 'improving' && errorCount < 2) {
      return 'READY_TO_ADVANCE';
    }

    return 'LIGHT_PRACTICE';
  }

  private signalIncreaseDepth(topic: string): AdaptiveSignal {
    return {
      signal: 'INCREASE_DEPTH',
      confidence: 0.85,
      reason: `Student demonstrates strong understanding of ${topic} and is ready for increased complexity`,
      suggestedDepth: 'Mastery'
    };
  }

  private signalMaintainLevel(topic: string): AdaptiveSignal {
    return {
      signal: 'MAINTAIN_LEVEL',
      confidence: 0.75,
      reason: `Student is making steady progress in ${topic}. Continue with current depth level`,
      suggestedDepth: 'Applied'
    };
  }

  private signalReduceComplexity(topic: string): AdaptiveSignal {
    return {
      signal: 'REDUCE_COMPLEXITY',
      confidence: 0.80,
      reason: `Student needs reinforcement of fundamental concepts in ${topic} before advancing`,
      suggestedDepth: 'Core'
    };
  }

  private signalPracticeMore(topic: string): AdaptiveSignal {
    return {
      signal: 'PRACTICE_MORE',
      confidence: 0.70,
      reason: `Additional practice needed for ${topic} to address common mistakes and build confidence`
    };
  }

  private signalReadyForMastery(topic: string): AdaptiveSignal {
    return {
      signal: 'READY_FOR_MASTERY',
      confidence: 0.90,
      reason: `Student has demonstrated mastery of ${topic} fundamentals and is prepared for advanced challenges`,
      suggestedDepth: 'Mastery'
    };
  }

  generateTeachingPlan(studentId: string, progress: StudentProgress): object {
    const topics = progress.topics;

    const plan = topics.map(tp => {
      const depthSuggestion = this.suggestDepthProgression(tp.topic, progress);
      const practiceRec = this.generatePracticeRecommendation(tp.topic, progress);

      return {
        topic: tp.topic,
        currentDepth: tp.depthProgress,
        suggestedDepth: depthSuggestion === 'MAINTAIN' ? tp.depthProgress : depthSuggestion,
        practiceIntensity: practiceRec,
        priority: tp.masteryLevel < 50 ? 'HIGH' : tp.masteryLevel < 75 ? 'MEDIUM' : 'LOW',
        focusAreas: Object.entries(tp.errorFrequency)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([pattern]) => pattern)
      };
    });

    return {
      studentId,
      generatedAt: new Date().toISOString(),
      overallMastery: progress.overallMastery,
      plan
    };
  }

  calculateOptimalNextStep(studentId: string, progress: StudentProgress): object {
    const weakestTopics = progress.topics
      .filter(tp => tp.masteryLevel < 50)
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    const strongestTopics = progress.topics
      .filter(tp => tp.masteryLevel >= 70)
      .sort((a, b) => b.masteryLevel - a.masteryLevel);

    let recommendedTopic: string | null = null;
    let recommendedAction: string = 'Continue practicing';

    if (weakestTopics.length > 0) {
      recommendedTopic = weakestTopics[0]?.topic || null;
      if (recommendedTopic) {
        recommendedAction = `Strengthen fundamentals in ${recommendedTopic}`;
      }
    } else if (strongestTopics.length > 0) {
      recommendedTopic = strongestTopics[0]?.topic || null;
      if (recommendedTopic) {
        recommendedAction = `Advance to higher complexity in ${recommendedTopic}`;
      }
    } else {
      const allTopics = progress.topics.sort((a, b) => b.masteryLevel - a.masteryLevel);
      recommendedTopic = allTopics[0]?.topic || null;
      recommendedAction = 'Continue current learning path';
    }

    return {
      recommendedTopic,
      recommendedAction,
      reason: this.explainRecommendation(progress, recommendedTopic),
      estimatedTime: this.estimateTimeToMastery(progress, recommendedTopic || '')
    };
  }

  private explainRecommendation(progress: StudentProgress, topic: string | null): string {
    if (!topic) {
      return 'Not enough data to generate recommendation';
    }

    const tp = progress.topics.find(t => t.topic === topic);
    if (!tp) {
      return `No progress data available for ${topic}`;
    }

    if (tp.masteryLevel < 50) {
      return `Focus on ${topic} to build a stronger foundation before advancing`;
    }

    if (tp.masteryLevel >= 85) {
      return `${topic} is nearly mastered - ready for advanced challenges`;
    }

    return `${topic} shows steady progress - continue with current approach`;
  }

  private estimateTimeToMastery(progress: StudentProgress, topic: string): number {
    const tp = progress.topics.find(t => t.topic === topic);
    if (!tp) return 0;

    const remainingMastery = 100 - tp.masteryLevel;
    const avgMasteryPerAttempt = 10;
    const attemptsNeeded = Math.ceil(remainingMastery / avgMasteryPerAttempt);

    const avgTimePerAttempt = 300;

    return Math.round(attemptsNeeded * avgTimePerAttempt / 60);
  }
}

export const adaptiveEngine = new AdaptiveEngine();
