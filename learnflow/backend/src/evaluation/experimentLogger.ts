import type { DepthLevel } from "../ai/depthEngine";
import type { ChatMode } from "../ai/promptBuilder";
import type { EthicsFlag } from "../ai/ethicsGuard";
import { createWandbClientFromEnv, type WandbClient } from "./wandbClient";

export interface InteractionMetrics {
  prompt_version: string;
  depth_level: DepthLevel;
  task_type: "chat" | "assignment_generate" | "assignment_evaluate";
  mode?: ChatMode;
  input_tokens: number;
  output_tokens: number;
  depth_alignment_score: number;
  clarity_score: number;
  ethics_flags: EthicsFlag[];
  timestamp: string;
}

export class ExperimentLogger {
  private readonly wandb: WandbClient;

  constructor(wandbClient?: WandbClient) {
    this.wandb = wandbClient ?? createWandbClientFromEnv();
  }

  logInteraction(metrics: InteractionMetrics): void {
    this.wandb.log({
      ...metrics,
      ethics_flags: metrics.ethics_flags.join(","),
      timestamp: metrics.timestamp
    });
  }
}

export const experimentLogger = new ExperimentLogger();
