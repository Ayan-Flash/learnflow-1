export type DepthLevel = "Core" | "Applied" | "Mastery";

export interface DepthConfig {
  depth_level: DepthLevel;
  target_word_count: {
    min: number;
    max: number;
  };
  reasoning_detail: "low" | "medium" | "high";
  example_count: number;
  temperature: number;
  max_output_tokens: number;
  structure: {
    use_bullets: boolean;
    include_check_for_understanding: boolean;
  };
}

const DEPTH_CONFIGS: Record<DepthLevel, DepthConfig> = {
  Core: {
    depth_level: "Core",
    target_word_count: { min: 120, max: 220 },
    reasoning_detail: "low",
    example_count: 1,
    temperature: 0.3,
    max_output_tokens: 400,
    structure: { use_bullets: true, include_check_for_understanding: true }
  },
  Applied: {
    depth_level: "Applied",
    target_word_count: { min: 220, max: 420 },
    reasoning_detail: "medium",
    example_count: 2,
    temperature: 0.4,
    max_output_tokens: 700,
    structure: { use_bullets: true, include_check_for_understanding: true }
  },
  Mastery: {
    depth_level: "Mastery",
    target_word_count: { min: 420, max: 800 },
    reasoning_detail: "high",
    example_count: 3,
    temperature: 0.5,
    max_output_tokens: 1200,
    structure: { use_bullets: true, include_check_for_understanding: true }
  }
};

export const getDepthConfig = (depthLevel: DepthLevel): DepthConfig => {
  return DEPTH_CONFIGS[depthLevel];
};

export const normalizeDepthLevel = (value: unknown): DepthLevel => {
  if (value === "Core" || value === "Applied" || value === "Mastery") return value;
  return "Core";
};
