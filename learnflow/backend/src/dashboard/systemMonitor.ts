import { logger } from "../utils/logger";

export interface RequestMetric {
  timestamp: number;
  durationMs: number;
  status: number;
  module: string;
}

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx] ?? 0;
};

export class SystemMonitor {
  private readonly start = Date.now();
  private readonly metrics: RequestMetric[] = [];
  private readonly maxEntries: number;

  constructor(opts?: { maxEntries?: number }) {
    this.maxEntries = opts?.maxEntries ?? 10_000;
  }

  recordRequest(metric: RequestMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxEntries) {
      this.metrics.splice(0, this.metrics.length - this.maxEntries);
    }
  }

  recordError(err: unknown, context?: { endpoint?: string; status?: number }): void {
    logger.warn({ err, context }, "system_error_recorded");
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.start) / 1000);
  }

  getSnapshot(rangeMs: number): {
    total: number;
    errors: number;
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    errorRate: number;
    modules: Array<{ module: string; count: number; errors: number; errorRate: number }>;
  } {
    const cutoff = Date.now() - rangeMs;
    const recent = this.metrics.filter((m) => m.timestamp >= cutoff);

    const durations = recent.map((m) => m.durationMs).sort((a, b) => a - b);
    const total = recent.length;
    const errors = recent.filter((m) => m.status >= 500).length;

    const avgResponseTimeMs = total === 0 ? 0 : recent.reduce((acc, m) => acc + m.durationMs, 0) / total;
    const p95ResponseTimeMs = percentile(durations, 95);
    const errorRate = total === 0 ? 0 : errors / total;

    const moduleMap = new Map<string, { count: number; errors: number }>();
    for (const m of recent) {
      const current = moduleMap.get(m.module) ?? { count: 0, errors: 0 };
      current.count += 1;
      if (m.status >= 500) current.errors += 1;
      moduleMap.set(m.module, current);
    }

    const modules = [...moduleMap.entries()].map(([module, s]) => ({
      module,
      count: s.count,
      errors: s.errors,
      errorRate: s.count === 0 ? 0 : s.errors / s.count
    }));

    return { total, errors, avgResponseTimeMs, p95ResponseTimeMs, errorRate, modules };
  }
}

export const systemMonitor = new SystemMonitor();
