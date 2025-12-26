import { Router } from "express";

import { progressController } from "../progress/progress.controller";

export const progressRouter = Router();

progressRouter.post("/track", (req, res, next) => {
  progressController.recordLearningEvent(req, res).catch(next);
});

progressRouter.get("/summary/:studentId", (req, res, next) => {
  progressController.getStudentProgressSummary(req, res).catch(next);
});

progressRouter.get("/recommendations/:studentId", (req, res, next) => {
  progressController.getStudentRecommendations(req, res).catch(next);
});

progressRouter.get("/insights/:studentId", (req, res, next) => {
  progressController.getStudentInsights(req, res).catch(next);
});

progressRouter.get("/topic/:studentId/:topic", (req, res, next) => {
  progressController.getTopicAnalysis(req, res).catch(next);
});

progressRouter.get("/export/:studentId", (req, res, next) => {
  progressController.exportStudentData(req, res).catch(next);
});

progressRouter.get("/teaching-plan/:studentId", (req, res, next) => {
  progressController.getTeachingPlan(req, res).catch(next);
});

progressRouter.get("/next-step/:studentId", (req, res, next) => {
  progressController.getOptimalNextStep(req, res).catch(next);
});
