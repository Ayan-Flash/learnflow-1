export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class DashboardCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  getCachedMetrics<T>(cacheKey: string): T | null {
    const entry = this.store.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(cacheKey);
      return null;
    }

    return entry.value as T;
  }

  setCachedMetrics<T>(cacheKey: string, metrics: T, ttlMs: number): void {
    const ttl = Math.max(0, ttlMs);
    this.store.set(cacheKey, { value: metrics, expiresAt: Date.now() + ttl });
  }

  invalidateCache(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clearAllCache(): void {
    this.store.clear();
  }
}

export const dashboardCache = new DashboardCache();
