export type AsinNormalizationResult =
  | { ok: true; asin: string; normalized: boolean }
  | { ok: false; error: "missing" | "invalid_format"; message: string; raw?: string };

export type AsinCatalogStatus = "valid" | "missing" | "invalid" | "placeholder";

/**
 * Obvious development/test placeholder patterns — conservative only.
 * Does not flag unfamiliar but plausible ASINs.
 */
export function isObviousPlaceholderAsin(input: string | undefined): boolean {
  if (!input?.trim()) return false;
  const upper = input.trim().toUpperCase();
  if (/^B0EXAMPLE/.test(upper)) return true;
  if (/PLACEHOLDER/.test(upper)) return true;
  if (/^TEST/.test(upper) && upper.length <= 12) return true;
  if (/EXAMPLE/.test(upper) && !/^[A-Z0-9]{10}$/.test(upper)) return true;
  return false;
}

/**
 * Conservative ASIN normalization — trim and uppercase only.
 * Does not invent, truncate, or repair invalid identifiers.
 */
export function normalizeAsin(input: string | undefined): AsinNormalizationResult {
  if (!input?.trim()) {
    return { ok: false, error: "missing", message: "ASIN is missing." };
  }
  const trimmed = input.trim();
  if (isObviousPlaceholderAsin(trimmed)) {
    return {
      ok: false,
      error: "invalid_format",
      message: `Stored ASIN "${trimmed}" is a development placeholder, not a verified Amazon identifier.`,
      raw: trimmed,
    };
  }
  const asin = trimmed.toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    return {
      ok: false,
      error: "invalid_format",
      message: `Stored ASIN "${trimmed}" is not a valid 10-character Amazon identifier.`,
      raw: trimmed,
    };
  }
  return { ok: true, asin, normalized: asin !== trimmed };
}

export function isValidAsin(input: string | undefined): boolean {
  return normalizeAsin(input).ok;
}

export function classifyAsinStatus(input: string | undefined): AsinCatalogStatus {
  if (!input?.trim()) return "missing";
  if (isObviousPlaceholderAsin(input)) return "placeholder";
  if (isValidAsin(input)) return "valid";
  return "invalid";
}

/** Reject placeholder/fake ASIN on save/create. Missing ASIN is allowed. */
export function validateAsinForProductSave(asin: string | undefined): string | null {
  if (!asin?.trim()) return null;
  if (isObviousPlaceholderAsin(asin)) {
    return "commerce.asin is a development placeholder. Remove it or enter a verified real ASIN.";
  }
  const normalized = normalizeAsin(asin);
  if (!normalized.ok) {
    return normalized.message;
  }
  return null;
}
