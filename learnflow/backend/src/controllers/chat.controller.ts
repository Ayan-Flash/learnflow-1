import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../app";
import { getDepthConfig, normalizeDepthLevel, type DepthLevel } from "../ai/depthEngine";
import { buildChatPrompt, type ChatMode } from "../ai/promptBuilder";
import {
  assessEthics,
  guardPromptForEthics,
  postProcessForEthics,
  type EthicsFlag
} from "../ai/ethicsGuard";
import { createGeminiClientFromEnv } from "../ai/geminiClient";
import { clarityScore, depthAlignmentScore } from "../evaluation/metricsCalculator";
import { experimentLogger } from "../evaluation/experimentLogger";

const PROMPT_VERSION = "learnflow-chat-v1";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(12_000),
  depth_level: z.enum(["Core", "Applied", "Mastery"]).optional(),
  mode: z.enum(["Learning", "Assignment Help"]).optional()
});

const modelJsonSchema = z.object({
  answer: z.string(),
  follow_up_questions: z.array(z.string()).default([]),
  assignment_feedback: z
    .object({
      ethical_note: z.string(),
      hints: z.array(z.string()),
      next_steps: z.array(z.string())
    })
    .nullable()
});

const safeParseModelJson = (text: string): z.infer<typeof modelJsonSchema> => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const result = modelJsonSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // ignore
  }

  return {
    answer: text,
    follow_up_questions: [],
    assignment_feedback: null
  };
};

export const chatController = {
  async handleChat(req: Request, res: Response) {
    const parsedBody = chatRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid request body", parsedBody.error.flatten());
    }

    const mode: ChatMode = parsedBody.data.mode ?? "Learning";
    const depthLevel: DepthLevel = normalizeDepthLevel(parsedBody.data.depth_level);
    const depth = getDepthConfig(depthLevel);

    const ethics = assessEthics(parsedBody.data.message, mode);

    if (!ethics.allow_model_call) {
      const safeAnswer = ethics.user_facing_message ?? "I can’t help with that request.";

      const outputText = safeAnswer;
      const depthScore = depthAlignmentScore(depth, outputText);
      const clarity = clarityScore(outputText);

      experimentLogger.logInteraction({
        prompt_version: PROMPT_VERSION,
        depth_level: depthLevel,
        task_type: "chat",
        mode,
        input_tokens: 0,
        output_tokens: 0,
        depth_alignment_score: depthScore,
        clarity_score: clarity,
        ethics_flags: ethics.flags,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        ok: true,
        data: {
          answer: safeAnswer,
          follow_up_questions: ["What have you tried so far?", "What part is confusing?"],
          assignment_feedback:
            mode === "Assignment Help"
              ? {
                  ethical_note: "I can guide you with hints and reasoning, not a finished submission.",
                  hints: ["Share your attempt and I’ll help you improve it step-by-step."],
                  next_steps: ["Tell me the exact part you’re stuck on."]
                }
              : null,
          meta: {
            prompt_version: PROMPT_VERSION,
            depth_level: depthLevel,
            mode,
            tokens: { input: 0, output: 0 },
            ethics: { flags: ethics.flags }
          }
        }
      });
    }

    const prompt = buildChatPrompt({
      user_message: parsedBody.data.message,
      depth,
      mode,
      ethics,
      prompt_version: PROMPT_VERSION
    });

    const guardedPrompt = guardPromptForEthics(prompt, mode, ethics);

    let gemini;
    try {
      gemini = createGeminiClientFromEnv();
    } catch (err) {
      req.log.error({ err }, "gemini_client_init_failed");
      throw new HttpError(500, "Server is missing GOOGLE_API_KEY");
    }

    let modelText: string;
    let usage: { input_tokens: number; output_tokens: number };

    try {
      const result = await gemini.generate(guardedPrompt, depth);
      modelText = result.text;
      usage = result.usage;
    } catch (err) {
      req.log.error({ err }, "gemini_call_failed");
      throw new HttpError(502, "AI model call failed");
    }

    const post = postProcessForEthics(modelText, mode, ethics);
    const parsed = safeParseModelJson(post.text);

    const normalized = {
      answer: parsed.answer,
      follow_up_questions: parsed.follow_up_questions.slice(0, 5),
      assignment_feedback:
        mode === "Assignment Help"
          ? parsed.assignment_feedback ?? {
              ethical_note: "For assignments, I’ll give hints and reasoning—not a final answer.",
              hints: ["Show me your steps so far and I’ll help you spot the gap."],
              next_steps: ["Try the first step and share what you get."]
            }
          : null
    };

    const outputTextForScoring =
      normalized.answer +
      "\n" +
      normalized.follow_up_questions.join("\n") +
      (normalized.assignment_feedback
        ? "\n" +
          normalized.assignment_feedback.ethical_note +
          "\n" +
          normalized.assignment_feedback.hints.join("\n")
        : "");

    const depthScore = depthAlignmentScore(depth, outputTextForScoring);
    const clarity = clarityScore(outputTextForScoring);

    experimentLogger.logInteraction({
      prompt_version: PROMPT_VERSION,
      depth_level: depthLevel,
      task_type: "chat",
      mode,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: ethics.flags as EthicsFlag[],
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      data: {
        ...normalized,
        meta: {
          prompt_version: PROMPT_VERSION,
          depth_level: depthLevel,
          mode,
          tokens: { input: usage.input_tokens, output: usage.output_tokens },
          ethics: { flags: ethics.flags, redacted: post.redacted }
        }
      }
    });
  }
};
