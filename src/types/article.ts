import type { ProductRef, ResolvedProduct } from "@/types/product";

export type ArticleType = "best" | "review" | "comparison" | "guide";

export type FaqItem = {
  question: string;
  answer: string;
};

export type InternalLink = {
  title: string;
  href: string;
  description?: string;
};

export type RatingCategory = {
  label: string;
  score: number;
};

export type ComparisonRow = {
  feature: string;
  values: string[];
};

/**
 * Legacy Markdown frontmatter shape.
 * Production posts no longer load this path — they use Article V1 JSON + a V1 pointer.
 * Retained for type compatibility and historical migration tooling references.
 */
export type ArticleFrontmatter = {
  title: string;
  /** Optional explicit slug; defaults to filename. */
  slug?: string;
  description: string;
  date: string;
  updated?: string;
  category: string;
  /** Preferred article type. */
  type?: ArticleType | "ranking";
  /** @deprecated Use `type` instead. */
  template?: ArticleType | "ranking";
  coverImage?: string;
  featured?: boolean;
  tags?: string[];
  author?: string;
  intro?: string;
  methodology?: string;
  winnerId?: string;
  winnerReason?: string;
  /**
   * Product references by ID (preferred).
   * Examples:
   * - ["flexispot-compact", "bamboo-writing-desk"]
   * - [{ id: "flexispot-compact", rank: 1, badge: "Best Overall" }]
   */
  products?: Array<string | ProductRef | Record<string, unknown>>;
  /** Single product ID for review articles. */
  productId?: string;
  ratingCategories?: RatingCategory[];
  comparisonRows?: ComparisonRow[];
  /** Preferred FAQ key. */
  faq?: FaqItem[];
  /** @deprecated Use `faq`. */
  faqs?: FaqItem[];
  related?: InternalLink[];
};

export type ArticleMeta = Omit<
  ArticleFrontmatter,
  "type" | "template" | "faq" | "faqs" | "products" | "slug"
> & {
  slug: string;
  type: ArticleType;
  readingTime: string;
  productIds: string[];
  productRefs: ProductRef[];
  faq: FaqItem[];
  /** @deprecated Alias of `type` for older templates. */
  template: ArticleType;
  faqs: FaqItem[];
  /**
   * Optional browser/search title override (Article V1 `seo.metaTitle`).
   * Visible H1 continues to use `title`.
   */
  seoTitle?: string;
  /**
   * Optional canonical path or absolute URL (Article V1 `seo.canonical`).
   * Empty/undefined falls back to `/blog/{slug}`.
   */
  seoCanonical?: string;
  /** When true, emit robots noindex (Article V1 `seo.noindex`). */
  noindex?: boolean;
};

export type Article = ArticleMeta & {
  contentHtml: string;
};

export type ResolvedArticle = Article & {
  resolvedProducts: ResolvedProduct[];
  resolvedProduct?: ResolvedProduct;
};

/** @deprecated Prefer ArticleMeta */
export type PostMeta = ArticleMeta;
export type Post = Article;
export type PostFrontmatter = ArticleFrontmatter;

/** @deprecated Use ResolvedProduct from @/types/product */
export type ArticleProduct = ResolvedProduct;
export type ArticleTemplate = ArticleType;
