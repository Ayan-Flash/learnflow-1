import type { DepthLevel } from "../ai/depthEngine";

export interface AssignmentTemplate {
  depth_level: DepthLevel;
  title: string;
  prompt: (topic: string) => string;
  expected_concepts: (topic: string) => string[];
  rubric: string[];
  starter_hints: (topic: string) => string[];
}

const coreTemplates: AssignmentTemplate[] = [
  {
    depth_level: "Core",
    title: "Explain + Check Understanding",
    prompt: (topic) =>
      `In your own words, explain the core idea of “${topic}”.\n\nInclude:\n1) A clear definition\n2) One everyday analogy\n3) One simple example (not from your class materials)\n4) Two common misconceptions`,
    expected_concepts: (topic) => ["definition", "analogy", "example", topic],
    rubric: [
      "Defines the concept correctly in plain language",
      "Uses an analogy that matches the concept",
      "Gives a simple example that demonstrates the idea",
      "Mentions at least two misconceptions and corrects them"
    ],
    starter_hints: (topic) => [
      `Start with: “${topic} is …” and keep it to one sentence.`,
      "For the analogy, pick something familiar (sports, cooking, music).",
      "For misconceptions, think: what do beginners often confuse it with?"
    ]
  }
];

const appliedTemplates: AssignmentTemplate[] = [
  {
    depth_level: "Applied",
    title: "Apply to a Scenario",
    prompt: (topic) =>
      `You are teaching a friend ${topic} who has never seen it before.\n\nTask:\n- Create a realistic scenario where ${topic} is useful.\n- Describe how you would use it step-by-step.\n- Explain how you would check whether your result makes sense.\n\nDo NOT copy from a textbook; make your own scenario.`,
    expected_concepts: (topic) => ["scenario", "steps", "sanity check", topic],
    rubric: [
      "Scenario is realistic and clearly stated",
      "Steps are logically ordered and justified",
      "Includes a reasonableness/sanity check",
      "Uses correct terminology and explains it"
    ],
    starter_hints: (topic) => [
      "Pick a scenario you can visualize (budgeting, measurement, scheduling).",
      "Write down what is given vs. what you need to find.",
      "For the sanity check: estimate the answer before calculating."
    ]
  },
  {
    depth_level: "Applied",
    title: "Debugging an Incorrect Solution",
    prompt: (topic) =>
      `Someone attempted a problem involving ${topic} and got the wrong result.\n\nTask:\n1) List 3 likely mistakes a student could make with ${topic}.\n2) For each mistake, show how you would detect it.\n3) For each mistake, explain how to fix it.`,
    expected_concepts: (topic) => ["common mistakes", "detection", "fix", topic],
    rubric: [
      "Identifies plausible mistakes",
      "Gives concrete ways to detect each mistake",
      "Explains how to correct each mistake",
      "Keeps the explanation practical"
    ],
    starter_hints: (topic) => [
      "Think of mistakes around definitions, sign errors, and unit/assumption errors.",
      "A good detection step is a quick check or counterexample.",
      "Fixes should name the principle that prevents the mistake."
    ]
  }
];

const masteryTemplates: AssignmentTemplate[] = [
  {
    depth_level: "Mastery",
    title: "Compare, Critique, and Extend",
    prompt: (topic) =>
      `Write a mini-lesson on ${topic} that includes:\n\nA) A precise definition (with boundaries: what it is NOT)\nB) Two contrasting examples (one that fits, one that almost fits but fails)\nC) A short critique: when using ${topic} can be misleading\nD) An extension question that goes beyond the basics and explains why it matters\n\nKeep it original and focused on understanding, not memorization.`,
    expected_concepts: (topic) => ["precise definition", "boundaries", "counterexample", "limitations", "extension", topic],
    rubric: [
      "Definition is precise and includes boundaries",
      "Examples are contrasting and well-explained",
      "Critique is realistic and shows insight",
      "Extension question is meaningful and motivated"
    ],
    starter_hints: (topic) => [
      "For boundaries: name a nearby concept people confuse with it.",
      "For the 'almost fits' example: change one assumption so it breaks.",
      "For critique: think about real-world constraints (noise, bias, oversimplification)."
    ]
  }
];

export const ASSIGNMENT_TEMPLATES: Record<DepthLevel, AssignmentTemplate[]> = {
  Core: coreTemplates,
  Applied: appliedTemplates,
  Mastery: masteryTemplates
};
