/**
 * Normalize env values copied into Vercel (often with wrapping quotes or spaces).
 */

export function normalizeEnvValue(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next || undefined;
}

export function getDatabaseUrl(): string | undefined {
  return normalizeEnvValue(process.env.DATABASE_URL);
}
