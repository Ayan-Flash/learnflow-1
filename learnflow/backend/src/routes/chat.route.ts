import { Router } from "express";

import { chatController } from "../controllers/chat.controller";

export const chatRouter = Router();

chatRouter.post("/", (req, res, next) => {
  chatController.handleChat(req, res).catch(next);
});
