import crypto from "crypto";

import type { DepthLevel } from "../ai/depthEngine";
import { ASSIGNMENT_TEMPLATES, type AssignmentTemplate } from "./assignmentTemplates";

export interface Assignment {
  id: string;
  topic: string;
  depth_level: DepthLevel;
  title: string;
  prompt: string;
  expected_concepts: string[];
  hints: string[];
  rubric: string[];
  created_at: string;
}

const stableHashInt = (value: string): number => {
  const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16);
};

const makeId = (topic: string, depth: DepthLevel, title: string): string => {
  const h = crypto.createHash("sha256").update(`${depth}:${title}:${topic}`).digest("hex").slice(0, 16);
  return `asg_${h}`;
};

export const generateAssignment = (topicRaw: string, depth: DepthLevel): Assignment => {
  const topic = topicRaw.trim();
  const templates = ASSIGNMENT_TEMPLATES[depth];
  if (!templates || templates.length === 0) {
    throw new Error(`No templates configured for depth level: ${depth}`);
  }

  const idx = stableHashInt(`${depth}:${topic}`) % templates.length;
  const template: AssignmentTemplate = templates[idx]!;

  const assignment: Assignment = {
    id: makeId(topic, depth, template.title),
    topic,
    depth_level: depth,
    title: template.title,
    prompt: template.prompt(topic),
    expected_concepts: template.expected_concepts(topic),
    hints: template.starter_hints(topic),
    rubric: template.rubric,
    created_at: new Date().toISOString()
  };

  return assignment;
};
