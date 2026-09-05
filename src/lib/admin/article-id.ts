const ARTICLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESERVED_ARTICLE_IDS = new Set(["new"]);
const RESERVED_ARTICLE_SLUGS = new Set([
  "new",
  "admin",
  "api",
  "blog",
  "category",
  "login",
  "reviews",
  "about",
  "contact",
  "privacy",
  "affiliate-disclosure",
  "best-products",
]);

export function suggestArticleSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateArticleIdFormat(id: string): string | undefined {
  const trimmed = id.trim();
  if (!trimmed) return "Article ID is required.";
  if (trimmed !== id) return "Article ID must not have leading or trailing spaces.";
  if (/\s/.test(trimmed)) return "Article ID cannot contain spaces.";
  if (trimmed !== trimmed.toLowerCase()) return "Article ID must be lowercase.";
  if (RESERVED_ARTICLE_IDS.has(trimmed)) {
    return `Article ID "${trimmed}" is reserved.`;
  }
  if (!ARTICLE_ID_PATTERN.test(trimmed)) {
    return "Article ID must be slug-like (start with a letter; lowercase letters, numbers, and hyphens only).";
  }
  if (trimmed.length > 80) return "Article ID is too long.";
  return undefined;
}

export function validateArticleSlugFormat(slug: string): string | undefined {
  const trimmed = slug.trim();
  if (!trimmed) return "Article slug is required.";
  if (trimmed !== slug) return "Article slug must not have leading or trailing spaces.";
  if (/\s/.test(trimmed)) return "Article slug cannot contain spaces.";
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    return "Article slug must not include leading or trailing slashes.";
  }
  if (trimmed !== trimmed.toLowerCase()) return "Article slug must be lowercase.";
  if (RESERVED_ARTICLE_SLUGS.has(trimmed)) {
    return `Article slug "${trimmed}" is reserved.`;
  }
  if (!ARTICLE_ID_PATTERN.test(trimmed)) {
    return "Article slug must be URL-safe (start with a letter; lowercase letters, numbers, and hyphens only).";
  }
  if (trimmed.length > 80) return "Article slug is too long.";
  return undefined;
}
