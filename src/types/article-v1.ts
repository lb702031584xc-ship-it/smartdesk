/**
 * SmartDesk Article Schema V1 — canonical article contract (Phase 27 Content Graph).
 *
 * Article references Product by productId only.
 * Catalog fields (name, brand, image, price, amazonUrl, specs) live on ProductV1.
 *
 * Sections:
 *   identity | classification | editorial | seo | products | commerce |
 *   media | publishing | relationships | faq | review | comparison
 *
 * Markdown body is a sibling of this document (Neon `articles.body` /
 * `content/posts/*.md`), never an HTML blob inside ArticleV1.
 * Pair them with `ArticleDocumentV1` from this module.
 *
 * Production pages still consume legacy `ArticleMeta` via
 * `articleV1ToLegacyMeta` in `@/lib/article-schema`.
 * Resolve ProductV1 joins with `@/lib/article-products`.
 *
 * --- Ownership ---
 * ProductV1: canonical rating, pros, cons, verdict, commerce, specs, media
 * ArticleV1: prose body, SEO, placement (rank/role), article overrides
 * RatingBox overall score still comes from Product at runtime.
 */

export type ArticleV1Type =
  | "best-list"
  | "review"
  | "comparison"
  | "guide"
  | "how-to"
  | "informational";

export type ArticleSearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "mixed";

export type ArticlePublishingStatus =
  | "draft"
  | "review"
  | "scheduled"
  | "published"
  | "archived";

export type ArticleIdentityV1 = {
  /** Permanent internal identifier. Not required to match slug. */
  id: string;
  title: string;
  /** Public URL segment. */
  slug: string;
};

export type ArticleClassificationV1 = {
  type: ArticleV1Type;
  category?: string;
  subcategory?: string;
  tags?: string[];
};

export type ArticleEditorialV1 = {
  summary?: string;
  audience?: string[];
  intent: ArticleSearchIntent;
  /** Best-list methodology blurb (legacy RankingTemplate). */
  methodology?: string;
};

export type ArticleSeoV1 = {
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  canonical?: string;
  noindex?: boolean;
};

/**
 * Article-owned product placement.
 *
 * Required/placement fields: productId, rank?, role?
 * Optional article framing (not Product catalog copies): summary?, verdict?, bestFor?
 *
 * Forbidden on refs: name, brand, image, price, amazonUrl, asin, specs, rating.
 * Resolve those from ProductV1 via `@/lib/article-products`.
 */
export type ArticleProductReferenceV1 = {
  productId: string;
  rank?: number;
  /** Article-specific role, e.g. "best-overall". Maps to legacy `badge`. */
  role?: string;
  /** Article-specific blurb. Not the product catalog verdict. */
  summary?: string;
  /** Article-specific review verdict override (maps to ProductRef.verdict). */
  verdict?: string;
  /** Article-specific best-for override (maps to ProductRef.bestFor). */
  bestFor?: string;
};

export type ArticleProductsV1 = {
  primary?: ArticleProductReferenceV1[];
  /**
   * Compatibility winner location (best-list / comparison).
   * Prefer comparison.winnerId for comparison articles when present.
   */
  winnerProductId?: string;
  winnerReason?: string;
};

export type ArticleCommerceV1 = {
  affiliateEnabled?: boolean;
  disclosure?: boolean;
  ctaStyle?: string;
};

export type ArticleMediaV1 = {
  featuredImage?: string;
  ogImage?: string;
  pinterestImage?: string;
};

export type ArticlePublishingV1 = {
  status: ArticlePublishingStatus;
  publishedAt?: string;
  updatedAt?: string;
  /** UTC ISO 8601 timestamp for scheduled automatic publication. */
  scheduledAt?: string;
  author?: string;
  /** Homepage / listing featured flag. */
  featured?: boolean;
};

export type ArticleInternalLinkV1 = {
  title: string;
  href: string;
  description?: string;
};

/**
 * Article-owned content relationships (Phase 28).
 *
 * - parentTopic: topic cluster id (e.g. "office-chairs")
 * - relatedArticles: Article identity.id list (not Product IDs)
 * - relatedLinks: legacy href objects for current templates
 *
 * Product placements stay in `article.products` — never duplicate here.
 */
export type ArticleRelationshipsV1 = {
  parentTopic?: string;
  relatedArticles?: string[];
  relatedLinks?: ArticleInternalLinkV1[];
};

/** Article-owned FAQ. Never stored on Product V1. */
export type ArticleFaqItemV1 = {
  question: string;
  answer: string;
};

/**
 * Article-specific rating breakdown for Review pages.
 * Distinct from Product.review.rating (canonical overall score).
 */
export type ArticleRatingCategoryV1 = {
  label: string;
  score: number;
};

export type ArticleReviewV1 = {
  ratingCategories?: ArticleRatingCategoryV1[];
};

/**
 * Comparison rows.
 * - editorial: article-owned values keyed by productId
 * - spec: future Product-derived path; values optional until a resolver exists
 */
export type ArticleComparisonRowV1 =
  | {
      label: string;
      source: "editorial";
      values: Record<string, string>;
    }
  | {
      label: string;
      source: "spec";
      specPath: string;
      /** Temporary fallback until Product-spec resolution ships. */
      values?: Record<string, string>;
    };

export type ArticleComparisonV1 = {
  /** Preferred winner ownership for comparison articles. */
  winnerId?: string;
  winnerReason?: string;
  rows?: ArticleComparisonRowV1[];
};

export type ArticleV1 = {
  identity: ArticleIdentityV1;
  classification: ArticleClassificationV1;
  editorial: ArticleEditorialV1;
  seo?: ArticleSeoV1;
  products?: ArticleProductsV1;
  commerce?: ArticleCommerceV1;
  media?: ArticleMediaV1;
  publishing: ArticlePublishingV1;
  relationships?: ArticleRelationshipsV1;
  faq?: ArticleFaqItemV1[];
  review?: ArticleReviewV1;
  comparison?: ArticleComparisonV1;
};

/**
 * Canonical article + Markdown body pair.
 * Body is Markdown only — never store rendered HTML here.
 */
export type ArticleDocumentV1 = {
  article: ArticleV1;
  body: string;
};

export type ArticleV1ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
