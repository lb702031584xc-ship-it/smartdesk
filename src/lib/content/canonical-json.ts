/**
 * Stable JSON serialization for parity checks (sorted keys, 2-space indent).
 */
export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value), null, 2);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalEquals(a: unknown, b: unknown): boolean {
  return canonicalJsonString(a) === canonicalJsonString(b);
}
