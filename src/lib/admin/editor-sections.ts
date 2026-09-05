/** Product V1 editor section order — maps to on-disk schema groups. */
export const PRODUCT_EDITOR_SECTIONS = [
  "identity",
  "classification",
  "editorial",
  "commerce",
  "media",
  "specs",
  "review",
  "comparison",
  "relationships",
] as const;

export type ProductEditorSection = (typeof PRODUCT_EDITOR_SECTIONS)[number];

/** Article V1 editor section order — maps to on-disk schema groups. */
export const ARTICLE_EDITOR_SECTIONS = [
  "identity",
  "classification",
  "editorial",
  "seo",
  "products",
  "commerce",
  "media",
  "publishing",
  "faq",
  "review",
  "comparison",
  "relationships",
] as const;

export type ArticleEditorSection = (typeof ARTICLE_EDITOR_SECTIONS)[number];

/** Article-owned product reference fields (not canonical Product data). */
export const ARTICLE_PRODUCT_REF_FIELDS = [
  "productId",
  "rank",
  "role",
  "summary",
  "verdict",
  "bestFor",
] as const;
