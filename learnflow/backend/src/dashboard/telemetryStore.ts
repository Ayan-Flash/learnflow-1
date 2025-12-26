import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import type { DepthLevel } from "../ai/depthEngine";
import type { ChatMode } from "../ai/promptBuilder";
import type { EthicsFlag } from "../ai/ethicsGuard";
import { logger } from "../utils/logger";
import { dashboardCache } from "./dashboardCache";
import type { DashboardPeriod } from "./dashboardTypes";

export type TelemetryEvent =
  | InteractionEvent
  | AssignmentEvent
  | EthicsTelemetryEvent
  | PrivacyAlertTelemetryEvent
  | SystemErrorTelemetryEvent;

export interface InteractionEvent {
  kind: "interaction";
  timestamp: string;
  actor_hash?: string;
  endpoint: string;
  mode?: ChatMode;
  depth_level: DepthLevel;
  prompt_version: string;
  model_called: boolean;
  input_tokens: number;
  output_tokens: number;
  depth_alignment_score: number;
  clarity_score: number;
  ethics_flags: EthicsFlag[];
  redacted: boolean;
}

export interface AssignmentEvent {
  kind: "assignment";
  timestamp: string;
  actor_hash?: string;
  action: "generate" | "evaluate";
  assignment_id: string;
  topic: string;
  depth_level: DepthLevel;
  conceptual_score?: number;
  missing_concepts?: string[];
  hints_provided?: number;
  flags?: string[];
}

export interface EthicsTelemetryEvent {
  kind: "ethics";
  timestamp: string;
  actor_hash?: string;
  type: "cheating_detected" | "prompt_modified" | "assignment_enforced";
  endpoint?: string;
  flags?: EthicsFlag[];
}

export interface PrivacyAlertTelemetryEvent {
  kind: "privacy";
  timestamp: string;
  actor_hash?: string;
  type: "privacy_alert";
  endpoint?: string;
  detector: string;
}

export interface SystemErrorTelemetryEvent {
  kind: "system_error";
  timestamp: string;
  endpoint?: string;
  status?: number;
  message: string;
}

export const periodToRange = (period: DashboardPeriod, now = new Date()): { from: Date; to: Date } => {
  const to = new Date(now);
  const from = new Date(now);

  if (period === "day") {
    from.setDate(from.getDate() - 1);
  } else if (period === "week") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setMonth(from.getMonth() - 1);
  }

  return { from, to };
};

const withinRetention = (d: Date, retentionDays: number): boolean => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return d.getTime() >= cutoff.getTime();
};

export class TelemetryStore {
  private readonly retentionDays: number;
  private readonly telemetryFile: string;
  private initialized: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private events: TelemetryEvent[] = [];

  constructor(opts?: { retentionDays?: number; telemetryFile?: string }) {
    this.retentionDays = opts?.retentionDays ?? 365;
    this.telemetryFile =
      opts?.telemetryFile ??
      process.env.TELEMETRY_FILE ??
      path.join(process.cwd(), "data", "telemetry.jsonl");
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return this.initialized;

    this.initialized = (async () => {
      await fs.mkdir(path.dirname(this.telemetryFile), { recursive: true });
      try {
        const raw = await fs.readFile(this.telemetryFile, "utf8");
        const lines = raw.split("\n").filter(Boolean);
        const parsed: TelemetryEvent[] = [];

        for (const line of lines) {
          try {
            const evt = JSON.parse(line) as TelemetryEvent;
            const ts = new Date(evt.timestamp);
            if (Number.isNaN(ts.getTime())) continue;
            if (!withinRetention(ts, this.retentionDays)) continue;
            parsed.push(evt);
          } catch {
            continue;
          }
        }

        this.events = parsed;

        const before = lines.length;
        if (before !== parsed.length) {
          await this.rewriteFile(parsed);
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code !== "ENOENT") {
          logger.warn({ err }, "telemetry_load_failed");
        }
        this.events = [];
      }
    })();

    return this.initialized;
  }

  private async rewriteFile(events: TelemetryEvent[]): Promise<void> {
    const tmp = `${this.telemetryFile}.tmp`;
    const content = events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, this.telemetryFile);
  }

  anonymizeActorId(rawId: string): string {
    const salt = process.env.ANONYMIZATION_SALT ?? "learnflow-default-salt";
    return crypto.createHash("sha256").update(`${salt}:${rawId}`).digest("hex");
  }

  async isWritable(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await fs.mkdir(path.dirname(this.telemetryFile), { recursive: true });
      await fs.appendFile(this.telemetryFile, "", "utf8");
      return true;
    } catch {
      return false;
    }
  }

  async record(event: TelemetryEvent): Promise<void> {
    await this.ensureInitialized();

    const ts = new Date(event.timestamp);
    if (Number.isNaN(ts.getTime())) return;

    if (!withinRetention(ts, this.retentionDays)) return;

    this.events.push(event);
    dashboardCache.invalidateCache("dashboard:");

    this.writeChain = this.writeChain
      .then(async () => {
        await fs.appendFile(this.telemetryFile, JSON.stringify(event) + "\n", "utf8");
      })
      .catch((err) => {
        logger.warn({ err }, "telemetry_append_failed");
      });

    await this.writeChain;
  }

  async query(range: { from: Date; to: Date }, opts?: { kind?: TelemetryEvent["kind"][] }): Promise<TelemetryEvent[]> {
    await this.ensureInitialized();

    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();

    return this.events.filter((evt) => {
      if (opts?.kind && !opts.kind.includes(evt.kind)) return false;
      const ms = new Date(evt.timestamp).getTime();
      return ms >= fromMs && ms <= toMs;
    });
  }

  async getRecent(limit: number, range: { from: Date; to: Date }): Promise<TelemetryEvent[]> {
    const evts = await this.query(range);
    return evts
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async purgeOld(): Promise<void> {
    await this.ensureInitialized();

    const kept = this.events.filter((evt) => withinRetention(new Date(evt.timestamp), this.retentionDays));
    if (kept.length === this.events.length) return;

    this.events = kept;

    try {
      await this.rewriteFile(kept);
    } catch (err) {
      logger.warn({ err }, "telemetry_purge_rewrite_failed");
    }
  }
}

export const telemetryStore = new TelemetryStore();
