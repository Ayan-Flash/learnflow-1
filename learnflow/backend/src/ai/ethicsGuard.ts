import type { ChatMode } from "./promptBuilder";

export type EthicsFlag =
  | "cheating_intent"
  | "explicit_request_final_answer"
  | "request_for_plagiarism"
  | "request_for_solution_code"
  | "unsafe_or_illegal";

export interface EthicsAssessment {
  flags: EthicsFlag[];
  allow_model_call: boolean;
  user_facing_message?: string;
}

const CHEATING_PATTERNS: Array<{ flag: EthicsFlag; re: RegExp }> = [
  {
    flag: "explicit_request_final_answer",
    re: /\b(final answer|just the answer|only the answer|give me the answer)\b/i
  },
  { flag: "cheating_intent", re: /\bsolve (this|it) for me\b/i },
  { flag: "request_for_plagiarism", re: /\b(write|draft) (my|the) (essay|report|assignment)\b/i },
  {
    flag: "request_for_solution_code",
    re: /\b(write|generate) (the )?(full )?(code|program)\b/i
  }
];

const UNSAFE_PATTERNS: RegExp[] = [
  /\b(hack|exploit|ddos|malware|ransomware)\b/i,
  /\bhow to make (a )?(bomb|explosive)\b/i
];

export const assessEthics = (userMessage: string, mode: ChatMode): EthicsAssessment => {
  const flags: EthicsFlag[] = [];

  for (const { flag, re } of CHEATING_PATTERNS) {
    if (re.test(userMessage)) flags.push(flag);
  }

  if (UNSAFE_PATTERNS.some((re) => re.test(userMessage))) {
    flags.push("unsafe_or_illegal");
  }

  const isCheating = flags.includes("cheating_intent") || flags.includes("explicit_request_final_answer");

  if (flags.includes("unsafe_or_illegal")) {
    return {
      flags,
      allow_model_call: false,
      user_facing_message:
        "I can’t help with harmful or illegal requests. If you’re studying safety/security concepts, tell me the topic and I can explain defensive best practices."
    };
  }

  if (mode === "Assignment Help" && isCheating) {
    return {
      flags,
      allow_model_call: false,
      user_facing_message:
        "I can’t provide a finished answer for an assignment. If you share what you’ve tried so far, I can help with hints, reasoning, and a step-by-step approach so you can finish it yourself."
    };
  }

  return {
    flags,
    allow_model_call: true
  };
};

export const guardPromptForEthics = (prompt: string, mode: ChatMode, assessment: EthicsAssessment): string => {
  if (assessment.flags.length === 0) return prompt;

  const extra = [
    "\n\nAdditional safety constraints:",
    `- Mode: ${mode}`,
    `- Flags: ${assessment.flags.join(", ")}`,
    "- If the user is requesting disallowed content, refuse and provide learning-oriented alternatives.",
    mode === "Assignment Help"
      ? "- For assignment help: never provide a completed final answer, completed code, or a submission-ready solution."
      : "- Keep the response educational and avoid facilitating wrongdoing."
  ].join("\n");

  return `${prompt}${extra}`;
};

const looksLikeSubmission = (text: string): boolean => {
  return (
    /\bfinal answer\b/i.test(text) ||
    /\bhere'?s the solution\b/i.test(text) ||
    /\banswer:\s*/i.test(text) ||
    /\btherefore,?\s+[\w\W]{0,80}=/i.test(text)
  );
};

export const postProcessForEthics = (
  modelText: string,
  mode: ChatMode,
  assessment: EthicsAssessment
): { text: string; redacted: boolean } => {
  if (mode !== "Assignment Help") return { text: modelText, redacted: false };

  if (assessment.flags.includes("unsafe_or_illegal")) {
    return {
      text: JSON.stringify({
        answer:
          "I can’t help with harmful or illegal requests. If you’re studying this topic, I can explain safe, defensive concepts and learning resources.",
        follow_up_questions: ["What course/topic is this for?", "What safe, defensive goal are you trying to achieve?"] ,
        assignment_feedback: {
          ethical_note: "I’m here to support learning and safety.",
          hints: ["Tell me the allowed learning objective in your own words."],
          next_steps: ["Share what you’ve already tried and where you’re stuck."]
        }
      }),
      redacted: true
    };
  }

  if (!looksLikeSubmission(modelText)) return { text: modelText, redacted: false };

  const safe = {
    answer:
      "I can’t provide a finished, submission-ready answer. I can help you learn the method and guide you to your own solution.",
    follow_up_questions: [
      "What have you tried so far (even a rough attempt)?",
      "What part is confusing: setup, formulas, or checking your work?"
    ],
    assignment_feedback: {
      ethical_note: "For assignments, I’ll give hints and reasoning—not a final answer.",
      hints: [
        "Start by writing down what the problem is asking for in one sentence.",
        "List the given information and identify the unknown.",
        "Try solving a smaller version of the problem first."
      ],
      next_steps: ["Share your attempt and I’ll help you debug it step-by-step."]
    }
  };

  return { text: JSON.stringify(safe), redacted: true };
};
