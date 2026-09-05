function trimToUndefined(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function uniqueStrings(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next.length > 0 ? next : undefined;
}

export function parseOptionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return undefined;
}

export function omitEmptyObject<T extends Record<string, unknown>>(
  value: T | undefined,
): T | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as T;
}

export { trimToUndefined, uniqueStrings };
