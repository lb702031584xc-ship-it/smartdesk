import type { GSCRow } from "./types";

type CacheEntry = {
  data: GSCRow[];
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

function cacheKey(
  property: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): string {
  return `${property}:${startDate}:${endDate}:${dimensions.join(",")}`;
}

export function getCachedRows(
  property: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): { rows: GSCRow[]; fetchedAt: number } | null {
  const key = cacheKey(property, startDate, endDate, dimensions);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { rows: entry.data, fetchedAt: entry.fetchedAt };
}

export function setCachedRows(
  property: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rows: GSCRow[],
): void {
  const key = cacheKey(property, startDate, endDate, dimensions);
  cache.set(key, { data: rows, fetchedAt: Date.now() });
}

export function clearSearchConsoleCache(): void {
  cache.clear();
}

export function getLastFetchedAt(): string | undefined {
  let latest = 0;
  for (const entry of cache.values()) {
    if (entry.fetchedAt > latest) latest = entry.fetchedAt;
  }
  return latest > 0 ? new Date(latest).toISOString() : undefined;
}

export function __resetCacheForTests(): void {
  cache.clear();
}
