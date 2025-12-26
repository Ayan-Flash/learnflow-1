declare module "wandb" {
  export interface WandbRun {
    log: (data: Record<string, unknown>) => void;
    finish: () => Promise<void> | void;
    config: Record<string, unknown>;
  }

  export interface InitOptions {
    project: string;
    entity?: string;
    config?: Record<string, unknown>;
    reinit?: boolean;
    name?: string;
  }

  export function init(options: InitOptions): WandbRun;
}
