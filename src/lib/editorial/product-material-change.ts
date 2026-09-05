import { normalizeProductV1 } from "@/lib/admin/normalize-product";
import type { ProductV1Document } from "@/types/product-v1";

export type ProductMaterialChangeCategory =
  | "commerce"
  | "review"
  | "editorial"
  | "specs"
  | "media";

export type ProductMaterialChange = {
  category: ProductMaterialChangeCategory;
  fields: string[];
};

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickCommerce(product: ProductV1Document) {
  const c = product.commerce ?? {};
  return {
    amazonUrl: c.amazonUrl,
    asin: c.asin,
    availability: c.availability,
    priceRange: c.priceRange,
  };
}

function pickEditorial(product: ProductV1Document) {
  const e = product.editorial ?? {};
  return {
    verdict: e.verdict,
    bestFor: e.bestFor,
    notFor: e.notFor,
  };
}

/**
 * Deterministic material change detection between two Product snapshots.
 * Ignores lastChecked and other operational-only commerce metadata for prose impact.
 */
export function getProductMaterialChanges(
  previous: ProductV1Document,
  current: ProductV1Document,
): ProductMaterialChange[] {
  const prev = normalizeProductV1(previous);
  const curr = normalizeProductV1(current);
  const changes: ProductMaterialChange[] = [];

  const commerceFields: Array<keyof ReturnType<typeof pickCommerce>> = [
    "amazonUrl",
    "asin",
    "availability",
    "priceRange",
  ];
  const commerceChanged = commerceFields.filter(
    (field) => pickCommerce(prev)[field] !== pickCommerce(curr)[field],
  );
  if (commerceChanged.length > 0) {
    changes.push({
      category: "commerce",
      fields: commerceChanged.map((f) => `commerce.${f}`),
    });
  }

  if (prev.review?.rating !== curr.review?.rating) {
    changes.push({ category: "review", fields: ["review.rating"] });
  }

  const editorialFields: Array<keyof ReturnType<typeof pickEditorial>> = [
    "verdict",
    "bestFor",
    "notFor",
  ];
  const editorialChanged = editorialFields.filter(
    (field) => !sameJson(pickEditorial(prev)[field], pickEditorial(curr)[field]),
  );
  if (editorialChanged.length > 0) {
    changes.push({
      category: "editorial",
      fields: editorialChanged.map((f) => `editorial.${f}`),
    });
  }

  if (!sameJson(prev.specs, curr.specs)) {
    changes.push({ category: "specs", fields: ["specs"] });
  }

  if (prev.media?.primary !== curr.media?.primary) {
    changes.push({ category: "media", fields: ["media.primary"] });
  }

  return changes;
}

export function hasProductMaterialChanges(changes: ProductMaterialChange[]): boolean {
  return changes.length > 0;
}

export function flattenMaterialChangeFields(changes: ProductMaterialChange[]): string[] {
  return changes.flatMap((c) => c.fields);
}
