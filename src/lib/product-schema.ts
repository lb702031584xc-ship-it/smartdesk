import type { Product } from "@/types/product";
import type {
  ProductCategoryV1,
  ProductEditorialRoleV1,
  ProductSpecsV1,
  ProductV1,
  ProductV1Document,
  ProductV1ValidationResult,
} from "@/types/product-v1";

const PRODUCT_CATEGORIES: readonly ProductCategoryV1[] = [
  "desks",
  "chairs",
  "monitors",
  "accessories",
];

const EDITORIAL_ROLES: readonly ProductEditorialRoleV1[] = [
  "best-overall",
  "best-budget",
  "best-space-saving",
  "best-premium",
  "best-for-beginners",
  "best-value",
];

const LEGACY_CATEGORIES = [
  "desks",
  "chairs",
  "monitors",
  "storage",
  "lighting",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isProductV1Document(value: unknown): value is ProductV1Document {
  return isRecord(value) && value.schemaVersion === 1;
}

/**
 * Structural validation for Product Schema V1 documents.
 */
export function validateProductV1(product: unknown): ProductV1ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(product)) {
    return { valid: false, errors: ["Product V1 must be an object."], warnings };
  }

  if (product.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1 for Product V1 documents.");
  }

  if (!isNonEmptyString(product.id)) {
    errors.push("id is required.");
  }

  const identity = product.identity;
  if (!isRecord(identity)) {
    errors.push("identity is required.");
  } else {
    if (!isNonEmptyString(identity.name)) errors.push("identity.name is required.");
    if (!isNonEmptyString(identity.brand)) errors.push("identity.brand is required.");
    if (
      typeof identity.category !== "string" ||
      !PRODUCT_CATEGORIES.includes(identity.category as ProductCategoryV1)
    ) {
      errors.push(
        `identity.category must be one of: ${PRODUCT_CATEGORIES.join(", ")}.`,
      );
    }
  }

  const editorial = product.editorial;
  if (editorial !== undefined) {
    if (!isRecord(editorial)) {
      errors.push("editorial must be an object when present.");
    } else {
      if (
        editorial.role !== undefined &&
        (typeof editorial.role !== "string" ||
          !EDITORIAL_ROLES.includes(editorial.role as ProductEditorialRoleV1))
      ) {
        errors.push(
          `editorial.role must be one of: ${EDITORIAL_ROLES.join(", ")}.`,
        );
      }
      if (editorial.bestFor !== undefined && !isStringArray(editorial.bestFor)) {
        errors.push("editorial.bestFor must be a string array when present.");
      }
      if (editorial.notFor !== undefined && !isStringArray(editorial.notFor)) {
        errors.push("editorial.notFor must be a string array when present.");
      }
      if (editorial.pros !== undefined && !isStringArray(editorial.pros)) {
        errors.push("editorial.pros must be a string array when present.");
      }
      if (editorial.cons !== undefined && !isStringArray(editorial.cons)) {
        errors.push("editorial.cons must be a string array when present.");
      }
      if (
        editorial.featured !== undefined &&
        typeof editorial.featured !== "boolean"
      ) {
        errors.push("editorial.featured must be a boolean when present.");
      }
    }
  }

  const commerce = product.commerce;
  if (commerce !== undefined) {
    if (!isRecord(commerce)) {
      errors.push("commerce must be an object when present.");
    } else {
      if (commerce.asin !== undefined && typeof commerce.asin !== "string") {
        errors.push("commerce.asin must be a string when present.");
      }
      if (
        commerce.amazonUrl !== undefined &&
        typeof commerce.amazonUrl !== "string"
      ) {
        errors.push("commerce.amazonUrl must be a string when present.");
      }
      if (
        commerce.priceRange !== undefined &&
        typeof commerce.priceRange !== "string"
      ) {
        errors.push("commerce.priceRange must be a string when present.");
      }
    }
  }

  const media = product.media;
  if (media !== undefined) {
    if (!isRecord(media)) {
      errors.push("media must be an object when present.");
    } else {
      if (media.primary !== undefined && typeof media.primary !== "string") {
        errors.push("media.primary must be a string when present.");
      }
      if (media.gallery !== undefined && !isStringArray(media.gallery)) {
        errors.push("media.gallery must be a string array when present.");
      }
    }
  }

  const review = product.review;
  if (review !== undefined) {
    if (!isRecord(review)) {
      errors.push("review must be an object when present.");
    } else if (review.rating !== undefined) {
      if (typeof review.rating !== "number" || !Number.isFinite(review.rating)) {
        errors.push("review.rating must be a number when present.");
      } else if (review.rating < 0 || review.rating > 5) {
        errors.push("review.rating must be between 0 and 5.");
      }
    }
  }

  const relationships = product.relationships;
  if (relationships !== undefined) {
    if (!isRecord(relationships)) {
      errors.push("relationships must be an object when present.");
    } else if (relationships.relatedProducts !== undefined) {
      if (!isStringArray(relationships.relatedProducts)) {
        errors.push("relationships.relatedProducts must be a string array.");
      } else if (
        isNonEmptyString(product.id) &&
        relationships.relatedProducts.includes(product.id)
      ) {
        errors.push("relationships.relatedProducts must not include self id.");
      }
    }
  }

  if (isRecord(identity) && typeof identity.category === "string") {
    const specs = product.specs;
    if (isRecord(specs)) {
      if (identity.category === "desks" && specs.chair) {
        warnings.push("desks product includes unused specs.chair.");
      }
      if (identity.category === "chairs" && specs.desk) {
        warnings.push("chairs product includes unused specs.desk.");
      }
      if (identity.category === "monitors" && specs.accessory && !specs.monitor) {
        warnings.push(
          "monitors product has specs.accessory only; prefer identity.category accessories for arms/lights.",
        );
      }
      if (identity.category === "accessories" && specs.monitor) {
        warnings.push("accessories product includes unused specs.monitor.");
      }
      if (identity.category === "monitors" && specs.desk) {
        warnings.push("monitors product includes unused specs.desk.");
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function isProductV1(value: unknown): value is ProductV1Document {
  return validateProductV1(value).valid && isProductV1Document(value);
}

export type FlattenSpecsResult = {
  specs: Record<string, string | number | boolean>;
  collisions: string[];
};

/**
 * Nested V1 specs → flat legacy Record.
 * Detects key collisions that would silently overwrite values.
 */
export function flattenProductV1Specs(product: ProductV1): FlattenSpecsResult {
  const out: Record<string, string | number | boolean> = {};
  const collisions: string[] = [];
  const specs = product.specs;
  if (!specs) return { specs: out, collisions };

  function assign(key: string, value: string | number | boolean) {
    if (key in out && out[key] !== value) {
      collisions.push(
        `spec key "${key}" collision: existing=${String(out[key])} new=${String(value)}`,
      );
    }
    out[key] = value;
  }

  if (specs.dimensions) {
    if (typeof specs.dimensions.widthIn === "number") {
      assign("widthIn", specs.dimensions.widthIn);
    }
    if (typeof specs.dimensions.depthIn === "number") {
      assign("depthIn", specs.dimensions.depthIn);
    }
    if (typeof specs.dimensions.heightIn === "number") {
      assign("heightIn", specs.dimensions.heightIn);
    }
  }
  if (typeof specs.weightLb === "number") assign("weightLb", specs.weightLb);

  const blocks = [specs.desk, specs.chair, specs.monitor, specs.accessory];
  for (const block of blocks) {
    if (!block) continue;
    for (const [key, value] of Object.entries(block)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        assign(key, value);
      }
    }
  }

  return { specs: out, collisions };
}

/**
 * Canonical Product V1 categories stay semantically correct in storage.
 * Legacy site nav only knows desks|chairs|monitors|storage|lighting.
 */
export function mapProductV1CategoryToLegacy(
  category: ProductCategoryV1,
  subcategory?: string,
): string {
  if (category === "desks" || category === "chairs" || category === "monitors") {
    return category;
  }

  const sub = subcategory || "";
  if (
    sub === "lighting" ||
    sub.includes("light-bar") ||
    sub.includes("monitor-light") ||
    sub.includes("lamp")
  ) {
    return "lighting";
  }
  if (sub.includes("monitor") || sub.includes("arm")) {
    return "monitors";
  }
  if (sub.includes("cable") || sub.includes("storage") || sub.includes("shelf")) {
    return "storage";
  }
  return "storage";
}

/**
 * Map legacy runtime categories into canonical Product V1 categories.
 * Accessories stay accessories even when legacy used monitors/storage/lighting.
 */
export function mapLegacyCategoryToV1(
  legacyCategory: string,
  hints?: { id?: string; name?: string },
): ProductCategoryV1 {
  const category = legacyCategory.trim().toLowerCase();
  const hint = `${hints?.id ?? ""} ${hints?.name ?? ""}`.toLowerCase();

  if (category === "desks") return "desks";
  if (category === "chairs") return "chairs";

  if (
    category === "storage" ||
    category === "lighting" ||
    hint.includes("monitor-arm") ||
    hint.includes("light-bar") ||
    hint.includes("cable") ||
    hint.includes("shelf")
  ) {
    return "accessories";
  }

  if (category === "monitors") {
    if (hint.includes("arm") || hint.includes("light") || hint.includes("riser")) {
      return "accessories";
    }
    return "monitors";
  }

  throw new Error(
    `[product-v1] Cannot map legacy category "${legacyCategory}" to Product V1.`,
  );
}

function deriveSubcategory(product: Product, category: ProductCategoryV1): string | undefined {
  const id = product.id.toLowerCase();
  const name = product.name.toLowerCase();

  if (category === "accessories") {
    if (id.includes("monitor-arm") || name.includes("monitor arm")) return "monitor-arm";
    if (id.includes("light") || name.includes("light bar")) return "monitor-light";
    if (id.includes("cable") || name.includes("cable")) return "cable-management";
    if (id.includes("shelf") || name.includes("shelf")) return "shelf";
    if (product.category === "lighting") return "lighting";
    if (product.category === "storage") return "storage";
    return "accessory";
  }
  if (category === "desks") {
    if (id.includes("standing") || name.includes("standing")) return "standing-desk";
    if (id.includes("writing") || name.includes("writing")) return "writing-desk";
    if (id.includes("folding") || name.includes("folding")) return "folding-desk";
    return "desk";
  }
  if (category === "chairs") {
    if (id.includes("space-saving") || name.includes("armless")) return "space-saving-chair";
    if (id.includes("budget")) return "budget-ergonomic-chair";
    return "ergonomic-chair";
  }
  if (category === "monitors") return "monitor";
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return [value];
  if (isStringArray(value)) return value.filter((item) => item.trim().length > 0);
  return undefined;
}

function pickSpecKeys(
  specs: Record<string, string | number | boolean>,
  keys: string[],
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    if (key in specs) out[key] = specs[key];
  }
  return out;
}

/**
 * Migration/tooling only: legacy flat Product JSON → Product V1.
 * Not used by the production Product loader (V1-only since Phase 11).
 */
export function legacyProductToV1(product: Product): ProductV1Document {
  const category = mapLegacyCategoryToV1(product.category, {
    id: product.id,
    name: product.name,
  });
  const subcategory = deriveSubcategory(product, category);
  const flat = product.specs ?? {};

  let specs: ProductSpecsV1 | undefined;

  // Keep flat legacy keys in one category block to avoid dimension/block collisions.
  if (category === "desks") {
    const desk = pickSpecKeys(flat, [
      "adjustable",
      "heightRangeIn",
      "motor",
      "weightCapacityLb",
      "widthIn",
      "depthIn",
      "assemblyTimeMin",
    ]);
    specs = Object.keys(desk).length > 0 ? { desk } : undefined;
  } else if (category === "chairs") {
    const chair = pickSpecKeys(flat, [
      "adjustable",
      "seatHeightRangeIn",
      "lumbarSupport",
      "lumbarType",
      "armrest",
      "armrestAdjustable",
      "armrestRemovable",
      "recline",
      "meshBack",
      "weightCapacityLb",
      "widthIn",
      "depthIn",
      "heightIn",
      "assemblyTimeMin",
    ]);
    specs = Object.keys(chair).length > 0 ? { chair } : undefined;
  } else if (category === "monitors") {
    const monitor = pickSpecKeys(flat, [
      "sizeIn",
      "resolution",
      "panel",
      "refreshRate",
    ]);
    specs = Object.keys(monitor).length > 0 ? { monitor } : undefined;
  } else {
    const accessory = pickSpecKeys(flat, [
      "type",
      "maxWeightLb",
      "monitorCount",
    ]);
    specs = Object.keys(accessory).length > 0 ? { accessory } : undefined;
  }

  // Detect unmapped legacy spec keys (migration blocker signal for tooling).
  const mapped = new Set(Object.keys(flattenProductV1Specs({ id: product.id, identity: { name: product.name, brand: product.brand, category }, specs }).specs));
  const unmapped = Object.keys(flat).filter((key) => !mapped.has(key));
  if (unmapped.length > 0) {
    throw new Error(
      `[product-v1] "${product.id}" has unmapped legacy specs: ${unmapped.join(", ")}`,
    );
  }

  const bestFor = asStringList(product.bestFor);
  const notFor = asStringList(product.notFor);
  const reviewSlug = product.reviewSlug?.trim() || undefined;
  const gallery =
    product.images && product.images.length > 0 ? product.images : undefined;

  return {
    schemaVersion: 1,
    id: product.id,
    identity: {
      name: product.name,
      brand: product.brand,
      category,
    },
    classification: subcategory
      ? {
          subcategory,
        }
      : undefined,
    editorial: {
      verdict: product.verdict,
      description: product.description,
      bestFor,
      notFor,
      pros: product.pros,
      cons: product.cons,
      featured: product.featured === true,
    },
    commerce: {
      asin: product.asin?.trim() || undefined,
      amazonUrl: product.amazonUrl,
      priceRange: product.priceRange,
      lastChecked: product.updatedAt?.trim() || undefined,
    },
    media: {
      primary: product.image,
      gallery,
    },
    specs,
    review: {
      rating: product.rating,
      slug: reviewSlug,
      summary: product.description,
    },
    relationships:
      product.alternatives && product.alternatives.length > 0
        ? { relatedProducts: product.alternatives }
        : undefined,
  };
}

/**
 * Maps ProductV1 into the existing runtime Product shape used by components.
 * Throws on missing required runtime fields — never invents semantic defaults.
 */
export function productV1ToLegacyProduct(product: ProductV1): Product {
  const amazonUrl = product.commerce?.amazonUrl?.trim() || "";
  const priceRange = product.commerce?.priceRange?.trim() || "";
  const image = product.media?.primary?.trim() || "";
  const rating = product.review?.rating;
  const pros = product.editorial?.pros ?? [];
  const cons = product.editorial?.cons ?? [];

  if (!amazonUrl) {
    throw new Error(
      `[product-v1] "${product.id}" cannot adapt: commerce.amazonUrl is required for legacy Product.`,
    );
  }
  if (!priceRange) {
    throw new Error(
      `[product-v1] "${product.id}" cannot adapt: commerce.priceRange is required for legacy Product.`,
    );
  }
  if (!image) {
    throw new Error(
      `[product-v1] "${product.id}" cannot adapt: media.primary is required for legacy Product.`,
    );
  }
  if (typeof rating !== "number") {
    throw new Error(
      `[product-v1] "${product.id}" cannot adapt: review.rating is required for legacy Product.`,
    );
  }
  if (pros.length === 0 || cons.length === 0) {
    throw new Error(
      `[product-v1] "${product.id}" cannot adapt: editorial.pros and editorial.cons are required for legacy Product.`,
    );
  }

  const { specs: flatSpecs, collisions } = flattenProductV1Specs(product);
  if (collisions.length > 0) {
    throw new Error(
      `[product-v1] "${product.id}" spec collisions:\n- ${collisions.join("\n- ")}`,
    );
  }

  const category = mapProductV1CategoryToLegacy(
    product.identity.category,
    product.classification?.subcategory,
  );

  const bestFor =
    product.editorial?.bestFor?.filter(Boolean).join("; ") || undefined;

  return {
    id: product.id,
    name: product.identity.name,
    brand: product.identity.brand,
    category,
    image,
    rating,
    priceRange,
    pros,
    cons,
    amazonUrl,
    description:
      product.editorial?.description ||
      product.review?.summary ||
      product.editorial?.verdict,
    bestFor,
    featured: product.editorial?.featured === true,
    asin: product.commerce?.asin?.trim() || undefined,
    updatedAt: product.commerce?.lastChecked?.trim() || undefined,
    verdict: product.editorial?.verdict,
    notFor: product.editorial?.notFor,
    specs: Object.keys(flatSpecs).length > 0 ? flatSpecs : undefined,
    reviewSlug: product.review?.slug?.trim() || undefined,
    alternatives: product.relationships?.relatedProducts,
    images:
      product.media?.gallery && product.media.gallery.length > 0
        ? product.media.gallery
        : undefined,
  };
}

/** Runtime fields compared for migration parity. */
export const PRODUCT_PARITY_FIELDS = [
  "id",
  "name",
  "brand",
  "category",
  "image",
  "rating",
  "priceRange",
  "pros",
  "cons",
  "amazonUrl",
  "description",
  "bestFor",
  "featured",
  "asin",
  "updatedAt",
  "verdict",
  "notFor",
  "specs",
  "reviewSlug",
  "alternatives",
  "images",
] as const;

export type ProductParityField = (typeof PRODUCT_PARITY_FIELDS)[number];

function normalizeParityValue(field: ProductParityField, value: unknown): unknown {
  if (field === "notFor") {
    return asStringList(value) ?? [];
  }
  if (field === "bestFor") {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.filter(Boolean).join("; ");
    return value ?? "";
  }
  if (field === "reviewSlug") {
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }
  if (field === "alternatives" || field === "images") {
    return Array.isArray(value) ? value : [];
  }
  if (field === "specs") {
    const obj =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const item = obj[key];
      sorted[key] =
        typeof item === "string" ? item.replace(/[�?–—]/g, "-") : item;
    }
    return sorted;
  }
  if (field === "featured") {
    return value === true;
  }
  return value ?? null;
}

/**
 * Compare legacy Product vs adapted Product for migration parity.
 * Category may intentionally differ when V1 canonical accessories map back
 * through mapProductV1CategoryToLegacy — callers can allow category remap.
 */
export function compareProductParity(
  original: Product,
  adapted: Product,
  options?: { allowCategoryRemap?: boolean },
): { equal: boolean; diffs: string[] } {
  const diffs: string[] = [];

  for (const field of PRODUCT_PARITY_FIELDS) {
    if (field === "category" && options?.allowCategoryRemap) {
      // Remap is checked separately by callers.
      continue;
    }
    const left = normalizeParityValue(field, original[field]);
    const right = normalizeParityValue(field, adapted[field]);
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push(
        `${field}: ${JSON.stringify(left)} → ${JSON.stringify(right)}`,
      );
    }
  }

  return { equal: diffs.length === 0, diffs };
}

export function isLegacyProductCategory(
  value: string,
): value is (typeof LEGACY_CATEGORIES)[number] {
  return (LEGACY_CATEGORIES as readonly string[]).includes(value);
}
