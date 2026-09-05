import { countArticlesByStatus, getAdminOverviewArticleCount, listAdminArticles } from "./article-store";
import { getAdminOverviewProductCount, listAdminProducts } from "./product-store";
import { getAdminWriteMode } from "./persistence";
import { isAmazonSearchUrl } from "./editorial-signals";
import type { AdminOverviewStats, AttentionItem } from "./types";

export {
  ARTICLE_EDITOR_SECTIONS,
  ARTICLE_PRODUCT_REF_FIELDS,
  PRODUCT_EDITOR_SECTIONS,
} from "./editor-sections";
export type { ArticleEditorSection, ProductEditorSection } from "./editor-sections";

export {
  getAdminWriteMode,
  isAdminWriteEnabled,
  serializeJsonDocument,
} from "./persistence";

export {
  listAdminArticles,
  listAdminArticleIds,
  getAdminArticle,
  saveAdminArticle,
  createAdminArticle,
  countArticlesByStatus,
} from "./article-store";

export {
  listAdminProducts,
  listAdminProductIds,
  getAdminProduct,
  saveAdminProduct,
  createAdminProduct,
} from "./product-store";

export {
  getArticleRevisionCount,
  getProductRevisionCount,
  listArticleRevisionItems,
  listProductRevisionItems,
} from "./revision-store";

export {
  validateAdminArticleSave,
  validateAdminArticleCreate,
  validateAdminProductSave,
  validateAdminProductCreate,
} from "./validate-save";

export {
  isArticleCreateEnabled,
  articleCreateDisabledReason,
} from "./article-create-policy";

export type {
  AdminArticleRecord,
  AdminOverviewStats,
  AdminProductRecord,
  AdminSaveResult,
  AdminWriteMode,
  ArticleListItem,
  AttentionItem,
  ProductListItem,
} from "./types";

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const products = await listAdminProducts();
  const articles = await listAdminArticles();
  const attention: AttentionItem[] = [];

  const missingAsin = products.filter((product) => !product.asin);
  const searchUrls = products.filter((product) => isAmazonSearchUrl(product.amazonUrl));
  const unknownAvailability = products.filter((product) => product.availability === "unknown");
  const drafts = articles.filter((article) => article.status === "draft");
  const reviews = articles.filter((article) => article.status === "review");
  const scheduled = articles.filter((article) => article.status === "scheduled");

  if (drafts.length) {
    attention.push({
      severity: "info",
      message: `${drafts.length} article${drafts.length === 1 ? "" : "s"} in draft`,
      href: "/admin/articles",
    });
  }
  if (reviews.length) {
    attention.push({
      severity: "info",
      message: `${reviews.length} article${reviews.length === 1 ? "" : "s"} in review`,
      href: "/admin/articles",
    });
  }
  if (scheduled.length) {
    const now = Date.now();
    const overdue = scheduled.filter((a) => {
      const raw = articles.find((x) => x.id === a.id)?.scheduledAt;
      return raw && new Date(raw).getTime() <= now;
    });
    if (overdue.length) {
      attention.push({
        severity: "warning",
        message: `${overdue.length} scheduled article${overdue.length === 1 ? "" : "s"} overdue`,
        href: "/admin/articles",
      });
    }
    const pending = scheduled.length - overdue.length;
    if (pending > 0) {
      attention.push({
        severity: "info",
        message: `${pending} scheduled article${pending === 1 ? "" : "s"}`,
        href: "/admin/articles",
      });
    }
  }
  if (missingAsin.length) {
    attention.push({
      severity: "warning",
      message: `${missingAsin.length} product${missingAsin.length === 1 ? "" : "s"} missing ASIN`,
      href: "/admin/products",
    });
  }
  if (searchUrls.length) {
    attention.push({
      severity: "warning",
      message: `${searchUrls.length} product${searchUrls.length === 1 ? "" : "s"} use search URLs`,
      href: "/admin/products",
    });
  }
  if (unknownAvailability.length) {
    attention.push({
      severity: "warning",
      message: `${unknownAvailability.length} product${unknownAvailability.length === 1 ? "" : "s"} have unknown availability`,
      href: "/admin/products",
    });
  }

  return {
    productCount: products.length,
    articleCount: articles.length,
    productV1Count: await getAdminOverviewProductCount(),
    articleV1Count: await getAdminOverviewArticleCount(),
    draftArticles: drafts.length,
    reviewArticles: reviews.length,
    scheduledArticles: scheduled.length,
    publishedArticles: await countArticlesByStatus("published"),
    archivedArticles: articles.filter((article) => article.status === "archived").length,
    featuredArticles: articles.filter((article) => article.featured).length,
    featuredProducts: products.filter((product) => product.featured).length,
    writeMode: getAdminWriteMode(),
    attention,
  };
}
