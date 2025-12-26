import { Router } from "express";

import { assignmentController } from "../controllers/assignment.controller";

export const assignmentRouter = Router();

assignmentRouter.post("/generate", (req, res, next) => {
  assignmentController.generate(req, res).catch(next);
});

assignmentRouter.post("/evaluate", (req, res, next) => {
  assignmentController.evaluate(req, res).catch(next);
});
