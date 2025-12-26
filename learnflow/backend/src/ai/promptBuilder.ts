import type { DepthConfig } from "./depthEngine";
import type { EthicsAssessment } from "./ethicsGuard";

export type ChatMode = "Learning" | "Assignment Help";

export interface PromptBuildInput {
  user_message: string;
  depth: DepthConfig;
  mode: ChatMode;
  ethics: EthicsAssessment;
  prompt_version: string;
}

const jsonOutputSpec = `Return ONLY valid JSON (no markdown) matching:
{
  "answer": string,
  "follow_up_questions": string[],
  "assignment_feedback": null | {
    "ethical_note": string,
    "hints": string[],
    "next_steps": string[]
  }
}`;

export const buildChatPrompt = (input: PromptBuildInput): string => {
  const { user_message, depth, mode, ethics, prompt_version } = input;

  const depthRules = [
    `Depth level: ${depth.depth_level}`,
    `Target length: ${depth.target_word_count.min}-${depth.target_word_count.max} words (be concise but complete).`,
    `Reasoning detail: ${depth.reasoning_detail}.`,
    `Examples: provide exactly ${depth.example_count} example(s).`,
    `Structure: ${depth.structure.use_bullets ? "use bullets where helpful" : "prefer paragraphs"}.`,
    depth.structure.include_check_for_understanding
      ? "End with 2 short check-for-understanding questions."
      : "No check-for-understanding questions."
  ].join("\n");

  const ethicsRules = [
    "Ethics rules (must obey):",
    "- If this is assignment help: do NOT provide a final answer, finished solution, or a copy-pastable submission.",
    "- Provide hints, scaffolding, reasoning steps, and questions that help the student learn.",
    "- If the user requests cheating (e.g., 'give the answer', 'solve this for me'), refuse and redirect to learning support.",
    ethics.flags.length > 0 ? `- Ethics flags detected: ${ethics.flags.join(", ")}` : "- Ethics flags detected: none"
  ].join("\n");

  const teacherStyle = [
    "You are LearnFlow AI: a friendly, encouraging tutor.",
    "Write clearly, avoid jargon when possible, define terms before using them.",
    "Be honest about uncertainty and ask clarifying questions when needed.",
    "Keep a teacher-like tone: supportive, practical, and respectful."
  ].join("\n");

  const modeRules =
    mode === "Assignment Help"
      ? [
          "Mode: Assignment Help",
          "Your output must focus on learning support: conceptual explanation + hints + next steps.",
          "Do not provide final numeric results, final code, or the final sentence that would complete the assignment.",
          "If you must show an example, use a different but analogous example (not the same values as the user's assignment)."
        ].join("\n")
      : [
          "Mode: Learning",
          "Provide a clear explanation at the selected depth.",
          "If the user seems confused, add a brief analogy and one micro-exercise they can try."
        ].join("\n");

  const request = [
    `Prompt version: ${prompt_version}`,
    teacherStyle,
    "",
    depthRules,
    "",
    ethicsRules,
    "",
    modeRules,
    "",
    jsonOutputSpec,
    "",
    "User message:",
    user_message
  ].join("\n");

  return request;
};
