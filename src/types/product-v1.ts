/**
 * SmartDesk Product Schema V1 — future-facing contract.
 *
 * Production components still consume legacy `Product` from `@/types/product`.
 * Use adapters in `@/lib/product-schema` to convert between the two shapes.
 *
 * --- Ownership (Phase 9) ---
 * Identity: name, brand, model, category
 * Classification: subcategory, tags
 * Editorial: role, verdict, description, bestFor, notFor, pros, cons, featured
 * Commerce: asin, amazonUrl, priceRange, availability, lastChecked
 * Media: primary, gallery
 * Specs: dimensions, weightLb, desk/chair/monitor/accessory blocks
 * Review: rating (canonical overall), summary, slug
 * Comparison: compareReady, keyFactors
 * Relationships: relatedProducts
 *
 * Article productRef overrides remain article-owned and must not be copied here.
 */

export type ProductCategoryV1 = "desks" | "chairs" | "monitors" | "accessories";

export type ProductEditorialRoleV1 =
  | "best-overall"
  | "best-budget"
  | "best-space-saving"
  | "best-premium"
  | "best-for-beginners"
  | "best-value";

export type ProductAvailabilityV1 = "active" | "inactive" | "unknown";

export type ProductIdentityV1 = {
  name: string;
  brand: string;
  model?: string;
  category: ProductCategoryV1;
};

export type ProductClassificationV1 = {
  subcategory?: string;
  tags?: string[];
};

export type ProductEditorialV1 = {
  role?: ProductEditorialRoleV1;
  verdict?: string;
  description?: string;
  bestFor?: string[];
  notFor?: string[];
  /** Legacy ProductCard / Review still require pros/cons arrays. */
  pros?: string[];
  cons?: string[];
  /** Homepage / listing featured flag (legacy Product.featured). */
  featured?: boolean;
};

export type ProductCommerceV1 = {
  asin?: string;
  amazonUrl?: string;
  priceRange?: string;
  availability?: ProductAvailabilityV1;
  lastChecked?: string;
};

export type ProductMediaV1 = {
  primary?: string;
  gallery?: string[];
};

export type ProductDeskSpecsV1 = {
  adjustable?: boolean;
  heightRangeIn?: string;
  motor?: string;
  weightCapacityLb?: number;
  widthIn?: number;
  depthIn?: number;
  assemblyTimeMin?: number;
};

export type ProductChairSpecsV1 = {
  seatHeightRangeIn?: string;
  lumbarSupport?: boolean;
  lumbarType?: string;
  armrest?: boolean;
  armrestAdjustable?: boolean;
  armrestRemovable?: boolean;
  recline?: boolean;
  meshBack?: boolean;
  weightCapacityLb?: number;
  widthIn?: number;
  depthIn?: number;
  heightIn?: number;
  adjustable?: boolean;
  assemblyTimeMin?: number;
};

export type ProductMonitorSpecsV1 = {
  sizeIn?: number;
  resolution?: string;
  panel?: string;
  refreshRate?: number;
};

export type ProductAccessorySpecsV1 = {
  type?: string;
  maxWeightLb?: number;
  monitorCount?: number;
};

export type ProductSpecsV1 = {
  dimensions?: {
    widthIn?: number;
    depthIn?: number;
    heightIn?: number;
  };
  weightLb?: number;
  desk?: ProductDeskSpecsV1;
  chair?: ProductChairSpecsV1;
  monitor?: ProductMonitorSpecsV1;
  accessory?: ProductAccessorySpecsV1;
};

/**
 * Canonical product-level review score and summary.
 * Article Review owns long-form prose + article-specific ratingCategories.
 */
export type ProductReviewV1 = {
  slug?: string;
  rating?: number;
  summary?: string;
};

export type ProductComparisonV1 = {
  compareReady?: boolean;
  keyFactors?: string[];
};

/**
 * Product-owned product↔product relationships (Phase 28).
 *
 * - relatedProducts: peer / alternative productIds
 *
 * Comparison candidates and “featured in” article lists are derived by the
 * Content Graph (`@/lib/content-graph`) — not stored on ProductV1.
 * Do not add article IDs here.
 */
export type ProductRelationshipsV1 = {
  relatedProducts?: string[];
};

export type ProductV1 = {
  id: string;
  identity: ProductIdentityV1;
  classification?: ProductClassificationV1;
  editorial?: ProductEditorialV1;
  commerce?: ProductCommerceV1;
  media?: ProductMediaV1;
  specs?: ProductSpecsV1;
  review?: ProductReviewV1;
  comparison?: ProductComparisonV1;
  relationships?: ProductRelationshipsV1;
};

/** On-disk document includes an explicit version marker. */
export type ProductV1Document = ProductV1 & {
  schemaVersion: 1;
};

export type ProductV1ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
