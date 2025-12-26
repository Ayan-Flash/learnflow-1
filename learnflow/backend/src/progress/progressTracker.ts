import { logger } from "../utils/logger";
import { progressStore, ProgressStore } from "./progressStore";
import type { LearningEvent, StudentProgress, DepthLevel } from "./types";

export class ProgressTracker {
  private store: ProgressStore;

  constructor(store: ProgressStore = progressStore) {
    this.store = store;
  }

  recordInteraction(event: LearningEvent): StudentProgress {
    try {
      this.validateEvent(event);

      this.store.addEvent(event);

      const progress = this.store.getStudentProgress(event.studentId);
      if (!progress) {
        throw new Error("Failed to retrieve student progress after recording");
      }

      logger.debug({
        studentId: event.studentId,
        topic: event.topic,
        success: event.success,
        newMastery: progress.topics.find(t => t.topic === event.topic)?.masteryLevel
      }, "interaction_recorded");

      return progress;
    } catch (err) {
      logger.error({ err, event }, "interaction_recording_failed");
      throw err;
    }
  }

  calculateMasteryDelta(depth: DepthLevel, success: boolean): number {
    if (!success) {
      return -5;
    }

    switch (depth) {
      case 'Core':
        return 10;
      case 'Applied':
        return 15;
      case 'Mastery':
        return 25;
    }
  }

  updateReasoningQuality(topic: string, newScore: number): void {
    if (newScore < 0 || newScore > 1) {
      throw new Error("Reasoning quality must be between 0 and 1");
    }

    logger.debug({ topic, reasoningScore: newScore }, "reasoning_quality_updated");
  }

  recordMistakePattern(studentId: string, topic: string, mistake: string): void {
    const progress = this.store.getStudentProgress(studentId);
    if (!progress) {
      logger.warn({ studentId, topic }, "student_not_found_for_mistake");
      return;
    }

    const topicProgress = progress.topics.find(t => t.topic === topic);
    if (topicProgress) {
      topicProgress.errorFrequency[mistake] = (topicProgress.errorFrequency[mistake] || 0) + 1;
    }

    logger.debug({ studentId, topic, mistake }, "mistake_pattern_recorded");
  }

  recalculateConfidenceTrend(studentId: string, topic: string): 'improving' | 'stable' | 'declining' {
    const events = this.store.getStudentEvents(studentId);
    const topicEvents = events.filter(e => e.topic === topic);

    if (topicEvents.length < 3) {
      return 'stable';
    }

    const masteryHistory = this.extractMasteryHistory(topicEvents);
    return this.computeTrend(masteryHistory);
  }

  batchRecordInteractions(events: LearningEvent[]): StudentProgress[] {
    const results: StudentProgress[] = [];

    for (const event of events) {
      const progress = this.recordInteraction(event);
      results.push(progress);
    }

    logger.info({ count: events.length }, "batch_interactions_recorded");
    return results;
  }

  getTopicMastery(studentId: string, topic: string): number {
    const progress = this.store.getStudentProgress(studentId);
    if (!progress) return 0;

    const topicProgress = progress.topics.find(t => t.topic === topic);
    return topicProgress?.masteryLevel || 0;
  }

  getStudentOverallMastery(studentId: string): number {
    const progress = this.store.getStudentProgress(studentId);
    return progress?.overallMastery || 0;
  }

  getTopicsAttempted(studentId: string): string[] {
    const progress = this.store.getStudentProgress(studentId);
    if (!progress) return [];

    return progress.topics.map(t => t.topic);
  }

  getDepthProgress(studentId: string, topic: string): DepthLevel {
    const progress = this.store.getStudentProgress(studentId);
    if (!progress) return 'Core';

    const topicProgress = progress.topics.find(t => t.topic === topic);
    return topicProgress?.depthProgress || 'Core';
  }

  getStore(): ProgressStore {
    return this.store;
  }

  private validateEvent(event: LearningEvent): void {
    if (!event.studentId || typeof event.studentId !== 'string') {
      throw new Error("Invalid student ID");
    }

    if (!event.topic || typeof event.topic !== 'string') {
      throw new Error("Invalid topic");
    }

    if (!['Core', 'Applied', 'Mastery'].includes(event.depth)) {
      throw new Error("Invalid depth level");
    }

    if (!['Learning', 'Assignment'].includes(event.taskType)) {
      throw new Error("Invalid task type");
    }

    if (event.reasoningQuality < 0 || event.reasoningQuality > 1) {
      throw new Error("Reasoning quality must be between 0 and 1");
    }

    if (typeof event.success !== 'boolean') {
      throw new Error("Success must be a boolean");
    }

    if (!Array.isArray(event.mistakePatterns)) {
      throw new Error("Mistake patterns must be an array");
    }

    if (typeof event.timeSpent !== 'number' || event.timeSpent < 0) {
      throw new Error("Time spent must be a positive number");
    }

    if (!event.timestamp) {
      throw new Error("Timestamp is required");
    }
  }

  private extractMasteryHistory(events: LearningEvent[]): number[] {
    const history: number[] = [];
    let currentMastery = 0;

    for (const event of events) {
      const delta = this.calculateMasteryDelta(event.depth, event.success);
      currentMastery = Math.max(0, Math.min(100, currentMastery + delta));
      history.push(currentMastery);
    }

    return history;
  }

  private computeTrend(history: number[]): 'improving' | 'stable' | 'declining' {
    if (history.length < 3) return 'stable';

    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const delta = recentAvg - olderAvg;
    if (delta > 5) return 'improving';
    if (delta < -5) return 'declining';
    return 'stable';
  }
}

export const progressTracker = new ProgressTracker();
