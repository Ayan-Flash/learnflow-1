import { logger } from "../utils/logger";
import type {
  LearningEvent,
  StudentProgress,
  TopicProgress,
  DepthLevel
} from "./types";

export class ProgressStore {
  private students: Map<string, StudentProgress> = new Map();
  private events: Map<string, LearningEvent[]> = new Map();

  addEvent(event: LearningEvent): void {
    let studentEvents = this.events.get(event.studentId);
    if (!studentEvents) {
      studentEvents = [];
      this.events.set(event.studentId, studentEvents);
    }
    studentEvents.push({ ...event, timestamp: event.timestamp || new Date().toISOString() });

    let progress = this.students.get(event.studentId);
    if (!progress) {
      progress = this.createNewStudentProgress(event.studentId);
      this.students.set(event.studentId, progress);
    }

    this.updateTopicProgressFromEvent(progress, event);
  }

  getStudentProgress(studentId: string): StudentProgress | null {
    const progress = this.students.get(studentId);
    if (!progress) return null;

    const events = this.events.get(studentId) || [];
    const recalculatedProgress: StudentProgress = {
      ...progress,
      topics: this.recalculateAllTopics(events),
      overallMastery: 0,
      totalInteractions: events.length,
      lastActivity: events.length > 0
        ? (events[events.length - 1]?.timestamp ?? progress.lastActivity)
        : progress.lastActivity
    };
    recalculatedProgress.overallMastery = this.calculateOverallMastery(recalculatedProgress.topics);

    return recalculatedProgress;
  }

  getStudentEvents(studentId: string): LearningEvent[] {
    return this.events.get(studentId) || [];
  }

  getAllStudents(): string[] {
    return Array.from(this.students.keys());
  }

  updateTopicProgress(studentId: string, updates: Partial<TopicProgress>): void {
    const progress = this.students.get(studentId);
    if (!progress) return;

    const topic = updates.topic;
    if (!topic) return;

    let topicProgress = progress.topics.find(t => t.topic === topic);
    if (!topicProgress) {
      topicProgress = this.createNewTopicProgress(topic);
      progress.topics.push(topicProgress);
    }

    Object.assign(topicProgress, updates);
  }

  exportToJSON(): object {
    const studentsData: Record<string, StudentProgress> = {};
    const eventsData: Record<string, LearningEvent[]> = {};

    this.students.forEach((progress, id) => {
      studentsData[id] = { ...progress };
    });

    this.events.forEach((events, id) => {
      eventsData[id] = [...events];
    });

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      students: studentsData,
      events: eventsData
    };
  }

  importFromJSON(data: object): void {
    try {
      const typedData = data as {
        students?: Record<string, StudentProgress>;
        events?: Record<string, LearningEvent[]>;
      };

      if (typedData.students) {
        Object.entries(typedData.students).forEach(([id, progress]) => {
          this.students.set(id, { ...progress, topics: [...progress.topics] });
        });
      }

      if (typedData.events) {
        Object.entries(typedData.events).forEach(([id, events]) => {
          this.events.set(id, [...events]);
        });
      }

      logger.info({ count: Object.keys(typedData.students || {}).length }, "progress_data_imported");
    } catch (err) {
      logger.error({ err }, "progress_data_import_failed");
      throw new Error("Failed to import progress data");
    }
  }

  clear(): void {
    this.students.clear();
    this.events.clear();
  }

  private createNewStudentProgress(studentId: string): StudentProgress {
    return {
      studentId,
      topics: [],
      overallMastery: 0,
      totalInteractions: 0,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  private createNewTopicProgress(topic: string): TopicProgress {
    return {
      topic,
      masteryLevel: 0,
      confidenceTrend: 'stable',
      errorFrequency: {},
      lastInteraction: new Date().toISOString(),
      depthProgress: 'Core',
      reasoningAverage: 0,
      attemptCount: 0,
      depthAttempts: { Core: 0, Applied: 0, Mastery: 0 },
      masteryHistory: []
    };
  }

  private updateTopicProgressFromEvent(progress: StudentProgress, event: LearningEvent): void {
    const { topic, depth, reasoningQuality, success, mistakePatterns, timestamp } = event;

    let topicProgress = progress.topics.find(t => t.topic === topic);
    if (!topicProgress) {
      topicProgress = this.createNewTopicProgress(topic);
      progress.topics.push(topicProgress);
    }

    topicProgress.attemptCount += 1;
    topicProgress.depthAttempts[depth] = (topicProgress.depthAttempts[depth] || 0) + 1;
    topicProgress.lastInteraction = timestamp;

    if (success) {
      switch (depth) {
        case 'Core':
          topicProgress.masteryLevel = Math.min(100, topicProgress.masteryLevel + 10);
          break;
        case 'Applied':
          topicProgress.masteryLevel = Math.min(100, topicProgress.masteryLevel + 15);
          topicProgress.depthProgress = 'Applied';
          break;
        case 'Mastery':
          topicProgress.masteryLevel = Math.min(100, topicProgress.masteryLevel + 25);
          topicProgress.depthProgress = 'Mastery';
          break;
      }
    } else {
      topicProgress.masteryLevel = Math.max(0, topicProgress.masteryLevel - 5);
    }

    topicProgress.masteryHistory.push(topicProgress.masteryLevel);

    const totalAttempts = topicProgress.attemptCount;
    topicProgress.reasoningAverage =
      ((topicProgress.reasoningAverage * (totalAttempts - 1)) + reasoningQuality) / totalAttempts;

    mistakePatterns.forEach(pattern => {
      topicProgress!.errorFrequency[pattern] = (topicProgress!.errorFrequency[pattern] || 0) + 1;
    });

    if (topicProgress.masteryHistory.length >= 3) {
      topicProgress.confidenceTrend = this.calculateConfidenceTrend(topicProgress.masteryHistory);
    }
  }

  private recalculateAllTopics(events: LearningEvent[]): TopicProgress[] {
    const topicMap = new Map<string, TopicProgress>();

    for (const event of events) {
      const { topic, depth, reasoningQuality, success, mistakePatterns, timestamp } = event;

      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          masteryLevel: 0,
          confidenceTrend: 'stable' as const,
          errorFrequency: {},
          lastInteraction: timestamp,
          depthProgress: 'Core' as DepthLevel,
          reasoningAverage: 0,
          attemptCount: 0,
          depthAttempts: { Core: 0, Applied: 0, Mastery: 0 },
          masteryHistory: []
        });
      }

      const tp = topicMap.get(topic)!;
      tp.attemptCount += 1;
      tp.depthAttempts[depth] = (tp.depthAttempts[depth] || 0) + 1;
      tp.lastInteraction = timestamp;

      if (success) {
        switch (depth) {
          case 'Core':
            tp.masteryLevel = Math.min(100, tp.masteryLevel + 10);
            break;
          case 'Applied':
            tp.masteryLevel = Math.min(100, tp.masteryLevel + 15);
            tp.depthProgress = 'Applied';
            break;
          case 'Mastery':
            tp.masteryLevel = Math.min(100, tp.masteryLevel + 25);
            tp.depthProgress = 'Mastery';
            break;
        }
      } else {
        tp.masteryLevel = Math.max(0, tp.masteryLevel - 5);
      }

      tp.masteryHistory.push(tp.masteryLevel);

      const totalAttempts = tp.attemptCount;
      tp.reasoningAverage =
        ((tp.reasoningAverage * (totalAttempts - 1)) + reasoningQuality) / totalAttempts;

      mistakePatterns.forEach(pattern => {
        tp.errorFrequency[pattern] = (tp.errorFrequency[pattern] || 0) + 1;
      });
    }

    topicMap.forEach(tp => {
      if (tp.masteryHistory.length >= 3) {
        tp.confidenceTrend = this.calculateConfidenceTrend(tp.masteryHistory);
      }
    });

    return Array.from(topicMap.values());
  }

  private calculateConfidenceTrend(history: number[]): 'improving' | 'stable' | 'declining' {
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const delta = recentAvg - olderAvg;
    if (delta > 5) return 'improving';
    if (delta < -5) return 'declining';
    return 'stable';
  }

  private calculateOverallMastery(topics: TopicProgress[]): number {
    if (topics.length === 0) return 0;
    const total = topics.reduce((sum, tp) => sum + tp.masteryLevel, 0);
    return Math.round(total / topics.length);
  }
}

export const progressStore = new ProgressStore();
