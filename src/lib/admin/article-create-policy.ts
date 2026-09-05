import { isDatabaseContentStore } from "@/lib/content/store-config";
import { canCreateArticleMarkdown } from "@/lib/content/article-markdown";

/**
 * New Article requires database metadata authority plus a writable Markdown body path.
 * Neon stores durable body text; Markdown is the filesystem body snapshot/pointer.
 */
export function isArticleCreateEnabled(): boolean {
  if (!isDatabaseContentStore()) return false;
  if (process.env.ARTICLE_CREATE_ENABLED === "0") return false;
  if (process.env.ARTICLE_CREATE_ENABLED === "1") return true;
  return canCreateArticleMarkdown();
}

export function articleCreateDisabledReason(): string {
  if (!isDatabaseContentStore()) {
    return "Article creation requires CONTENT_STORE=database so metadata authority stays in Neon.";
  }
  if (!canCreateArticleMarkdown()) {
    return "Article creation is disabled because Markdown body files cannot be written on this filesystem. Neon can store body text, but Phase 14B still requires a content/posts/{slug}.md snapshot for the current body-source contract.";
  }
  return "Article creation is disabled.";
}
