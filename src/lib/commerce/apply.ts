import type { ProductAvailabilityV1, ProductV1Document } from "@/types/product-v1";
import type { CommerceApplyField, CommerceApplyPatch, CommerceSuggestion } from "./types";

export const COMMERCE_APPLY_FIELDS: CommerceApplyField[] = [
  "commerce.asin",
  "commerce.amazonUrl",
  "commerce.availability",
  "media.primary",
];

export function getApplicableCommerceFields(suggestion: CommerceSuggestion): CommerceApplyField[] {
  const fields: CommerceApplyField[] = [];
  if (suggestion.asin) fields.push("commerce.asin");
  if (suggestion.amazonUrl) fields.push("commerce.amazonUrl");
  if (suggestion.availability) fields.push("commerce.availability");
  if (suggestion.primaryImage) fields.push("media.primary");
  return fields;
}

/** Build local form patch — does not write DB or touch lastChecked, rating, specs, editorial. */
export function buildCommerceApplyPatch(
  suggestion: CommerceSuggestion,
  fields: CommerceApplyField[],
): CommerceApplyPatch {
  const patch: CommerceApplyPatch = {};
  if (fields.includes("commerce.asin") && suggestion.asin) patch.asin = suggestion.asin;
  if (fields.includes("commerce.amazonUrl") && suggestion.amazonUrl) patch.amazonUrl = suggestion.amazonUrl;
  if (fields.includes("commerce.availability") && suggestion.availability) {
    patch.availability = suggestion.availability;
  }
  if (fields.includes("media.primary") && suggestion.primaryImage) {
    patch.primaryImage = suggestion.primaryImage;
  }
  return patch;
}

export function applyCommercePatchToProduct(
  product: ProductV1Document,
  patch: CommerceApplyPatch,
): ProductV1Document {
  const next = { ...product };
  if (patch.asin !== undefined) {
    next.commerce = { ...next.commerce, asin: patch.asin };
  }
  if (patch.amazonUrl !== undefined) {
    next.commerce = { ...next.commerce, amazonUrl: patch.amazonUrl };
  }
  if (patch.availability !== undefined) {
    next.commerce = { ...next.commerce, availability: patch.availability as ProductAvailabilityV1 };
  }
  if (patch.primaryImage !== undefined) {
    next.media = { ...next.media, primary: patch.primaryImage };
  }
  return next;
}

/** External Amazon star ratings must never map to SmartDesk review.rating. */
export function assertNoForbiddenCommerceMappings(fields: CommerceApplyField[]): void {
  const forbidden = (fields as string[]).filter(
    (f) =>
      f.startsWith("review.") ||
      f.startsWith("editorial.") ||
      f.startsWith("specs.") ||
      f === "commerce.priceRange",
  );
  if (forbidden.length > 0) {
    throw new Error(`Forbidden commerce apply fields: ${forbidden.join(", ")}`);
  }
}

export function buildApplyAllPatch(suggestion: CommerceSuggestion): CommerceApplyPatch {
  const fields = getApplicableCommerceFields(suggestion);
  assertNoForbiddenCommerceMappings(fields);
  return buildCommerceApplyPatch(suggestion, fields);
}
