import { Router } from "express";

import { dashboardController } from "../controllers/dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/teacher", (req, res, next) => {
  dashboardController.getTeacherDashboard(req, res).catch(next);
});

dashboardRouter.get("/institution", (req, res, next) => {
  dashboardController.getInstitutionDashboard(req, res).catch(next);
});

dashboardRouter.get("/metrics/:period", (req, res, next) => {
  dashboardController.getMetricsForPeriod(req, res).catch(next);
});

dashboardRouter.get("/topic/:topicName", (req, res, next) => {
  dashboardController.getTopicAnalysis(req, res).catch(next);
});

dashboardRouter.get("/system-health", (req, res, next) => {
  dashboardController.getSystemHealth(req, res).catch(next);
});

dashboardRouter.get("/ethics-report", (req, res, next) => {
  dashboardController.getEthicsReport(req, res).catch(next);
});
