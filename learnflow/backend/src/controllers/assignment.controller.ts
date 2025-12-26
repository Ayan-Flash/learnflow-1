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
import { telemetryStore } from "../dashboard/telemetryStore";

const PROMPT_VERSION = "learnflow-assignment-v1";

const getActorHashFromRequest = (req: Request): string | undefined => {
  const raw =
    req.header("x-anon-student-id") ?? req.header("x-student-id") ?? req.header("x-session-id") ?? undefined;
  return raw ? telemetryStore.anonymizeActorId(raw) : undefined;
};

const detectPrivacyIssue = (text: string): string | null => {
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phone = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/;
  const ssn = /\b\d{3}-\d{2}-\d{4}\b/;

  if (email.test(text)) return "email";
  if (phone.test(text)) return "phone";
  if (ssn.test(text)) return "ssn";
  return null;
};

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
    const actorHash = getActorHashFromRequest(req);

    const privacyDetector = detectPrivacyIssue(parsed.data.topic);
    if (privacyDetector) {
      await telemetryStore.record({
        kind: "privacy",
        timestamp: new Date().toISOString(),
        actor_hash: actorHash,
        type: "privacy_alert",
        endpoint: "/api/assignment/generate",
        detector: privacyDetector
      });
    }

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

    const ts = new Date().toISOString();

    experimentLogger.logInteraction({
      prompt_version: PROMPT_VERSION,
      depth_level: depthLevel,
      task_type: "assignment_generate",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: [],
      timestamp: ts
    });

    await telemetryStore.record({
      kind: "interaction",
      timestamp: ts,
      actor_hash: actorHash,
      endpoint: "/api/assignment/generate",
      depth_level: depthLevel,
      prompt_version: PROMPT_VERSION,
      model_called: false,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: [],
      redacted: false
    });

    await telemetryStore.record({
      kind: "assignment",
      timestamp: ts,
      actor_hash: actorHash,
      action: "generate",
      assignment_id: assignment.id,
      topic: assignment.topic,
      depth_level: assignment.depth_level
    });

    return res.status(200).json({ ok: true, data: assignment });
  },

  async evaluate(req: Request, res: Response) {
    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid request body", parsed.error.flatten());

    const actorHash = getActorHashFromRequest(req);

    const privacyDetector = detectPrivacyIssue(parsed.data.student_response);
    if (privacyDetector) {
      await telemetryStore.record({
        kind: "privacy",
        timestamp: new Date().toISOString(),
        actor_hash: actorHash,
        type: "privacy_alert",
        endpoint: "/api/assignment/evaluate",
        detector: privacyDetector
      });
    }

    const ethics = assessEthics(parsed.data.student_response, "Assignment Help");
    if (!ethics.allow_model_call) {
      const message = ethics.user_facing_message ?? "I can’t help with that request.";
      const ts = new Date().toISOString();

      if (ethics.flags.includes("cheating_intent") || ethics.flags.includes("explicit_request_final_answer")) {
        await telemetryStore.record({
          kind: "ethics",
          timestamp: ts,
          actor_hash: actorHash,
          type: "cheating_detected",
          endpoint: "/api/assignment/evaluate",
          flags: ethics.flags
        });
      }

      await telemetryStore.record({
        kind: "ethics",
        timestamp: ts,
        actor_hash: actorHash,
        type: "assignment_enforced",
        endpoint: "/api/assignment/evaluate",
        flags: ethics.flags
      });

      await telemetryStore.record({
        kind: "interaction",
        timestamp: ts,
        actor_hash: actorHash,
        endpoint: "/api/assignment/evaluate",
        depth_level: parsed.data.assignment.depth_level,
        prompt_version: PROMPT_VERSION,
        model_called: false,
        input_tokens: 0,
        output_tokens: 0,
        depth_alignment_score: 0,
        clarity_score: 0,
        ethics_flags: ethics.flags,
        redacted: true
      });

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

    const ts = new Date().toISOString();

    experimentLogger.logInteraction({
      prompt_version: PROMPT_VERSION,
      depth_level: parsed.data.assignment.depth_level,
      task_type: "assignment_evaluate",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: ethics.flags,
      timestamp: ts
    });

    await telemetryStore.record({
      kind: "interaction",
      timestamp: ts,
      actor_hash: actorHash,
      endpoint: "/api/assignment/evaluate",
      depth_level: parsed.data.assignment.depth_level,
      prompt_version: PROMPT_VERSION,
      model_called: false,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      depth_alignment_score: depthScore,
      clarity_score: clarity,
      ethics_flags: ethics.flags,
      redacted: false
    });

    await telemetryStore.record({
      kind: "assignment",
      timestamp: ts,
      actor_hash: actorHash,
      action: "evaluate",
      assignment_id: parsed.data.assignment.id,
      topic: parsed.data.assignment.topic,
      depth_level: parsed.data.assignment.depth_level,
      conceptual_score: Number((evaluation.conceptual_score * 100).toFixed(1)),
      missing_concepts: evaluation.missing_concepts,
      hints_provided: evaluation.hints.length,
      flags: evaluation.flags
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
