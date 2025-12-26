import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../app";
import { progressTracker } from "../progress/progressTracker";
import { insightGenerator } from "../progress/insightGenerator";
import { adaptiveEngine } from "../progress/adaptiveEngine";
import type {
  LearningEvent,
  StudentProgress,
  StudentInsight,
  TopicProgress,
  AdaptiveSignal
} from "../progress/types";

const learningEventSchema = z.object({
  studentId: z.string().min(1).max(100),
  topic: z.string().min(1).max(200),
  depth: z.enum(['Core', 'Applied', 'Mastery']),
  taskType: z.enum(['Learning', 'Assignment']),
  reasoningQuality: z.number().min(0).max(1),
  success: z.boolean(),
  mistakePatterns: z.array(z.string()).default([]),
  timeSpent: z.number().positive(),
  timestamp: z.string().datetime()
});

const studentIdParamSchema = z.object({
  studentId: z.string().min(1).max(100)
});

const topicParamSchema = z.object({
  studentId: z.string().min(1).max(100),
  topic: z.string().min(1).max(200)
});

export class ProgressController {
  async recordLearningEvent(req: Request, res: Response): Promise<void> {
    const parsedBody = learningEventSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid learning event", parsedBody.error.flatten());
    }

    const event: LearningEvent = {
      ...parsedBody.data,
      mistakePatterns: parsedBody.data.mistakePatterns || []
    };

    const progress = progressTracker.recordInteraction(event);

    res.status(200).json({
      ok: true,
      data: {
        studentId: progress.studentId,
        overallMastery: progress.overallMastery,
        topicsCount: progress.topics.length,
        lastActivity: progress.lastActivity
      }
    });
  }

  async getStudentProgressSummary(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const store = progressTracker.getStore();
    const progress = store.getStudentProgress(studentId);

    if (!progress) {
      res.status(200).json({
        ok: true,
        data: {
          studentId,
          topics: [],
          overallMastery: 0,
          totalInteractions: 0,
          lastActivity: null
        }
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: {
        studentId: progress.studentId,
        topics: progress.topics.map((tp: TopicProgress) => ({
          topic: tp.topic,
          masteryLevel: tp.masteryLevel,
          depthProgress: tp.depthProgress,
          attemptCount: tp.attemptCount,
          confidenceTrend: tp.confidenceTrend
        })),
        overallMastery: progress.overallMastery,
        totalInteractions: progress.totalInteractions,
        lastActivity: progress.lastActivity
      }
    });
  }

  async getStudentRecommendations(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const insight = insightGenerator.generateInsights(studentId);

    if (!insight) {
      res.status(200).json({
        ok: true,
        data: {
          studentId,
          strengths: [],
          weaknesses: [],
          recommendations: ["Start practicing to generate personalized recommendations"],
          adaptiveSignal: "MAINTAIN_LEVEL",
          masteryTrend: "steady",
          suggestedNextTopic: null
        }
      });
      return;
    }

    const signal = adaptiveEngine.generateSignal(insight, insight.suggestedNextTopic || '');

    res.status(200).json({
      ok: true,
      data: {
        ...insight,
        currentSignal: signal
      }
    });
  }

  async getStudentInsights(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const insight = insightGenerator.generateInsights(studentId);

    if (!insight) {
      throw new HttpError(404, "No progress data found for student");
    }

    res.status(200).json({
      ok: true,
      data: insight
    });
  }

  async getTopicAnalysis(req: Request, res: Response): Promise<void> {
    const parsedParams = topicParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid parameters", parsedParams.error.flatten());
    }

    const { studentId, topic } = parsedParams.data;
    const analysis = insightGenerator.getTopicAnalysis(studentId, topic);

    if (!analysis) {
      res.status(200).json({
        ok: true,
        data: {
          topic,
          masteryLevel: 0,
          depthProgress: 'Core',
          attemptCount: 0,
          message: "No data available for this topic"
        }
      });
      return;
    }

    const store = progressTracker.getStore();
    const progress = store.getStudentProgress(studentId);
    let teachingSignal: AdaptiveSignal | null = null;
    let teachingPlan: object | null = null;

    if (progress) {
      teachingSignal = adaptiveEngine.generateSignal(
        { ...analysis, strengths: [], weaknesses: [], recommendations: [], adaptiveSignal: "", masteryTrend: "steady", suggestedNextTopic: topic },
        topic
      );
      teachingPlan = adaptiveEngine.generateTeachingPlan(studentId, progress);
    }

    res.status(200).json({
      ok: true,
      data: {
        topic: analysis.topic,
        masteryLevel: analysis.masteryLevel,
        depthProgress: analysis.depthProgress,
        attemptCount: analysis.attemptCount,
        confidenceTrend: analysis.confidenceTrend,
        reasoningAverage: Math.round(analysis.reasoningAverage * 100) / 100,
        lastInteraction: analysis.lastInteraction,
        errorPatterns: Object.entries(analysis.errorFrequency)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([pattern, count]) => ({ pattern, count })),
        teachingSignal,
        teachingPlan
      }
    });
  }

  async exportStudentData(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const store = progressTracker.getStore();
    const progress = store.getStudentProgress(studentId);
    const events = store.getStudentEvents(studentId);

    if (!progress) {
      throw new HttpError(404, "No progress data found for student");
    }

    res.status(200).json({
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        studentId,
        progress,
        events
      }
    });
  }

  async getTeachingPlan(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const store = progressTracker.getStore();
    const progress = store.getStudentProgress(studentId);

    if (!progress) {
      throw new HttpError(404, "No progress data found for student");
    }

    const teachingPlan = adaptiveEngine.generateTeachingPlan(studentId, progress);

    res.status(200).json({
      ok: true,
      data: teachingPlan
    });
  }

  async getOptimalNextStep(req: Request, res: Response): Promise<void> {
    const parsedParams = studentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new HttpError(400, "Invalid student ID", parsedParams.error.flatten());
    }

    const { studentId } = parsedParams.data;
    const store = progressTracker.getStore();
    const progress = store.getStudentProgress(studentId);

    if (!progress) {
      throw new HttpError(404, "No progress data found for student");
    }

    const nextStep = adaptiveEngine.calculateOptimalNextStep(studentId, progress);

    res.status(200).json({
      ok: true,
      data: nextStep
    });
  }
}

export const progressController = new ProgressController();
