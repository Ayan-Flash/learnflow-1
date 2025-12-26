import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../app";
import { normalizeDepthLevel, type DepthLevel } from "../ai/depthEngine";
import { assessEthics } from "../ai/ethicsGuard";
import { countTokens, clarityScore, depthAlignmentScore } from "../evaluation/metricsCalculator";
import { experimentLogger } from "../evaluation/experimentLogger";
import { generateAssignment, type Assignment } from "../assignments/assignmentGenerator";
import { evaluateAssignmentResponse } from "../assignments/assignmentEvaluator";
import { getDepthConfig } from "../ai/depthEngine";

const PROMPT_VERSION = "learnflow-assignment-v1";

const generateSchema = z.object({
  topic: z.string().min(2).max(200),
  depth_level: z.enum(["Core", "Applied", "Mastery"]).optional()
});

const assignmentSchema: z.ZodType<Assignment> = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  depth_level: z.enum(["Core", "Applied", "Mastery"]),
  title: z.string().min(1),
  prompt: z.string().min(1),
  expected_concepts: z.array(z.string()),
  hints: z.array(z.string()),
  rubric: z.array(z.string()),
  created_at: z.string().min(1)
});

const evaluateSchema = z.object({
  assignment: assignmentSchema,
  student_response: z.string().min(1).max(20_000)
});

export const assignmentController = {
  async generate(req: Request, res: Response) {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid request body", parsed.error.flatten());

    const depthLevel: DepthLevel = normalizeDepthLevel(parsed.data.depth_level);

    let assignment: Assignment;
    try {
      assignment = generateAssignment(parsed.data.topic, depthLevel);
    } catch (err) {
      req.log.error({ err }, "assignment_generate_failed");
      throw new HttpError(500, "Failed to generate assignment");
    }

    const inputTokens = countTokens(JSON.stringify(parsed.data));
    const outputTokens = countTokens(JSON.stringify(assignment));

    const depth = getDepthConfig(depthLevel);
    const depthScore = depthAlignmentScore(depth, assignment.prompt);
    const clarity = clarityScore(assignment.prompt);

    experimentLogger.logInteraction({
      prompt_version: PROMPT_VERSION,
      depth_level: depthLevel,
      task_type: "assignment_generate",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: [],
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ ok: true, data: assignment });
  },

  async evaluate(req: Request, res: Response) {
    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid request body", parsed.error.flatten());

    const ethics = assessEthics(parsed.data.student_response, "Assignment Help");
    if (!ethics.allow_model_call) {
      const message = ethics.user_facing_message ?? "I can’t help with that request.";
      return res.status(200).json({
        ok: true,
        data: {
          feedback: {
            conceptual_score: 0,
            strengths: [],
            missing_concepts: [],
            hints: ["Share your attempt and I’ll give hints and reasoning."],
            next_steps: ["Tell me what you tried and where you got stuck."],
            flags: ["off_topic"]
          },
          ethical_note: message,
          meta: { ethics_flags: ethics.flags }
        }
      });
    }

    const evaluation = evaluateAssignmentResponse(parsed.data.assignment, parsed.data.student_response);

    const depth = getDepthConfig(parsed.data.assignment.depth_level);
    const inputTokens = countTokens(JSON.stringify(parsed.data));
    const outputTokens = countTokens(JSON.stringify(evaluation));

    const depthScore = depthAlignmentScore(depth, parsed.data.student_response);
    const clarity = clarityScore(parsed.data.student_response);

    experimentLogger.logInteraction({
      prompt_version: PROMPT_VERSION,
      depth_level: parsed.data.assignment.depth_level,
      task_type: "assignment_evaluate",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: ethics.flags,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      data: {
        feedback: evaluation,
        ethical_note: "I’ll give feedback and hints, not a final answer.",
        meta: {
          ethics_flags: ethics.flags
        }
      }
    });
  }
};
