import { isAmazonSearchUrl } from "@/lib/admin/editorial-signals";
import { isValidAsin } from "@/lib/commerce/asin";
import { COMMERCE_STALE_DAYS, daysSince, extractAsinFromAmazonUrl } from "@/lib/editorial/product-maintenance";

export type AmazonUrlType = "detail" | "search" | "other" | "missing";

export type CommerceVerificationDisplayState =
  | { kind: "never-checked" }
  | { kind: "checked-today" }
  | { kind: "checked-days-ago"; days: number; stale: boolean };

/** Canonical YYYY-MM-DD date string (UTC) for commerce.lastChecked. */
export function getCanonicalDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Amazon ASIN — delegates to canonical commerce/asin validator. */
export function isPlausibleAsin(asin: string | undefined): boolean {
  return isValidAsin(asin);
}

export function classifyAmazonUrlType(url: string | undefined): AmazonUrlType {
  if (!url?.trim()) return "missing";
  if (isAmazonSearchUrl(url)) return "search";
  if (extractAsinFromAmazonUrl(url)) return "detail";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon.")) return "other";
  } catch {
    if (/amazon\./i.test(url)) return "other";
  }
  return "other";
}

export function resolveAmazonHost(existingUrl?: string): string {
  if (existingUrl?.trim()) {
    try {
      const parsed = new URL(existingUrl);
      if (parsed.hostname.toLowerCase().includes("amazon.")) {
        return parsed.hostname;
      }
    } catch {
      // fall through
    }
  }
  return "www.amazon.com";
}

/**
 * Syntactic detail URL from stored ASIN — Admin must verify before saving.
 * Returns null when suggestion is not applicable.
 */
export function suggestAmazonDetailUrl(
  asin: string | undefined,
  existingUrl?: string,
): string | null {
  if (!isPlausibleAsin(asin)) return null;
  if (!existingUrl?.trim() || !isAmazonSearchUrl(existingUrl)) return null;
  if (classifyAmazonUrlType(existingUrl) === "detail") return null;
  const host = resolveAmazonHost(existingUrl);
  return `https://${host}/dp/${asin!.trim().toUpperCase()}`;
}

export function hasDetailUrlSuggestion(
  asin: string | undefined,
  amazonUrl: string | undefined,
): boolean {
  return suggestAmazonDetailUrl(asin, amazonUrl) !== null;
}

export function getCommerceVerificationDisplayState(
  lastChecked: string | undefined,
  options?: { now?: Date; staleDays?: number },
): CommerceVerificationDisplayState {
  if (!lastChecked?.trim()) return { kind: "never-checked" };
  const now = options?.now ?? new Date();
  const today = getCanonicalDateString(now);
  if (lastChecked.trim() === today) return { kind: "checked-today" };
  const days = daysSince(lastChecked, now);
  if (days === null) return { kind: "never-checked" };
  const staleDays = options?.staleDays ?? COMMERCE_STALE_DAYS;
  return { kind: "checked-days-ago", days, stale: days > staleDays };
}

export function formatVerificationStateLabel(state: CommerceVerificationDisplayState): string {
  switch (state.kind) {
    case "never-checked":
      return "Never checked";
    case "checked-today":
      return "Checked today";
    case "checked-days-ago":
      return state.stale
        ? `Checked ${state.days} days ago (stale)`
        : `Checked ${state.days} days ago`;
  }
}
