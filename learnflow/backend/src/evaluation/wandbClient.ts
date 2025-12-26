import * as wandb from "wandb";

import { logger } from "../utils/logger";

export interface WandbConfig {
  project: string;
  entity?: string;
}

export class WandbClient {
  private run: wandb.WandbRun | null = null;
  private readonly cfg: WandbConfig;
  private readonly enabled: boolean;

  constructor(cfg: WandbConfig, enabled: boolean) {
    this.cfg = cfg;
    this.enabled = enabled;
  }

  ensureRun(extraConfig?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (this.run) return;

    try {
      this.run = wandb.init({
        project: this.cfg.project,
        entity: this.cfg.entity,
        config: {
          service: "learnflow-backend",
          node_env: process.env.NODE_ENV ?? "development",
          ...extraConfig
        },
        reinit: true
      });
      logger.info({ project: this.cfg.project, entity: this.cfg.entity }, "wandb_initialized");
    } catch (err) {
      logger.warn({ err }, "wandb_init_failed");
      this.run = null;
    }
  }

  log(data: Record<string, unknown>): void {
    if (!this.enabled) return;
    this.ensureRun();

    try {
      this.run?.log(data);
    } catch (err) {
      logger.warn({ err }, "wandb_log_failed");
    }
  }

  async finish(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.run?.finish();
    } catch (err) {
      logger.warn({ err }, "wandb_finish_failed");
    } finally {
      this.run = null;
    }
  }
}

export const createWandbClientFromEnv = (): WandbClient => {
  const apiKey = process.env.WANDB_API_KEY;
  const project = process.env.WANDB_PROJECT || "learnflow-ai";
  const entity = process.env.WANDB_ENTITY;

  const enabled = Boolean(apiKey && project);

  return new WandbClient({ project, entity }, enabled);
};
