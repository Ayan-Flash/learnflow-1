import type { DepthLevel } from "../ai/depthEngine";
import type { Assignment } from "./assignmentGenerator";

export interface AssignmentEvaluation {
  conceptual_score: number; // 0..1
  strengths: string[];
  missing_concepts: string[];
  hints: string[];
  next_steps: string[];
  flags: Array<"too_short" | "possible_copy_paste" | "off_topic">;
}

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

const containsConcept = (response: string, concept: string): boolean => {
  const r = normalize(response);
  const c = normalize(concept);

  if (c.length <= 3) return r.includes(c);

  const words = c.split(" ").filter(Boolean);
  if (words.length <= 1) return r.includes(c);

  // Consider the concept covered if at least half of its words appear.
  const hits = words.filter((w) => w.length > 2 && r.includes(w));
  return hits.length >= Math.ceil(words.length / 2);
};

const wordCount = (text: string): number => {
  const matches = text.trim().match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
};

const depthHintPack = (depth: DepthLevel): { hints: string[]; next_steps: string[] } => {
  switch (depth) {
    case "Core":
      return {
        hints: [
          "Add a one-sentence definition before you explain details.",
          "Include one simple example that you invented (not from class).",
          "Finish by naming two misconceptions and correcting them."
        ],
        next_steps: [
          "Rewrite your first sentence as a crisp definition.",
          "Underline the key term(s) and define them in plain language.",
          "Add a short check: 'How would I know this is working?'"
        ]
      };
    case "Applied":
      return {
        hints: [
          "State what is given vs. what you must find (inputs vs. outputs).",
          "Explain *why* each step is valid (one sentence per step).",
          "Add a sanity-check: estimate the answer or check units/constraints."
        ],
        next_steps: [
          "Number your steps and add a short justification to each.",
          "Try a smaller/edge-case scenario to validate your approach.",
          "Explain what would change if an assumption changed."
        ]
      };
    case "Mastery":
      return {
        hints: [
          "Add a boundary: describe what the concept is *not* and why.",
          "Use one counterexample: something that looks similar but fails.",
          "Include a brief critique: when the concept can mislead."
        ],
        next_steps: [
          "Refine your definition by stating the assumptions explicitly.",
          "Add a 'nearly works' example and point to the exact breaking point.",
          "Write one extension question and explain why it matters."
        ]
      };
  }
};

export const evaluateAssignmentResponse = (assignment: Assignment, studentResponseRaw: string): AssignmentEvaluation => {
  const response = studentResponseRaw.trim();
  const wc = wordCount(response);

  const flags: AssignmentEvaluation["flags"] = [];
  if (wc < 60) flags.push("too_short");

  if (/\b(chatgpt|copied|copy\s*paste)\b/i.test(response)) flags.push("possible_copy_paste");

  const onTopic = normalize(response).includes(normalize(assignment.topic).split(" ")[0] ?? "");
  if (!onTopic && wc > 0) flags.push("off_topic");

  const hits = assignment.expected_concepts.map((c) => ({ c, ok: containsConcept(response, c) }));
  const covered = hits.filter((h) => h.ok).length;
  const total = Math.max(1, hits.length);

  const conceptual_score = Number((covered / total).toFixed(3));

  const strengths: string[] = [];
  if (wc >= 120) strengths.push("Your response has enough detail to work with.");
  if (covered >= Math.ceil(total / 2)) strengths.push("You covered several key elements expected for this depth.");

  const missing_concepts = hits.filter((h) => !h.ok).map((h) => h.c);

  const depthPack = depthHintPack(assignment.depth_level);

  const hints: string[] = [
    ...depthPack.hints,
    ...missing_concepts.slice(0, 3).map((c) => `Add something explicitly about: ${c}.`)
  ].slice(0, 6);

  const next_steps: string[] = [
    ...depthPack.next_steps,
    "After revising, read it once and ask: 'Could a beginner follow this without me present?'"
  ].slice(0, 5);

  return {
    conceptual_score,
    strengths,
    missing_concepts,
    hints,
    next_steps,
    flags
  };
};
