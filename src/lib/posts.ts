/**
 * @deprecated Import from `@/lib/articles` for new code.
 * Kept as a compatibility shim for existing imports.
 */
export {
  clearArticleCache,
  getAllArticles,
  getAllPosts,
  getArticleBySlug,
  getArticleMeta,
  getArticleSlugs,
  getArticlesByCategory,
  getArticlesByType,
  getFeaturedArticles,
  getFeaturedPosts,
  getPostBySlug,
  getPostMetaFromFile,
  getPostSlugs,
  getPostsByCategory,
  getRelatedArticles,
  getRelatedPosts,
  getResolvedArticle,
} from "@/lib/articles";

export type {
  Article,
  ArticleFrontmatter,
  ArticleMeta,
  Post,
  PostFrontmatter,
  PostMeta,
  ResolvedArticle,
} from "@/lib/articles";
