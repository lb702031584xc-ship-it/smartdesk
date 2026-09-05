/**
 * CMS content editor read model (Phase 39) — derived only.
 */
import { getAdminArticle } from "@/lib/admin/article-store";
import { validateContentBlocks } from "@/lib/content-blocks";
import { getWorkflowStatus } from "@/lib/editorial-workflow";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  parseArticleContent,
  summarizeContentBlocks,
} from "@/lib/markdown/parse-article-content";
import type { ContentEditorViewModel } from "@/types/content-editor";
import type { ArticleV1 } from "@/types/article-v1";

function catalogProductIds(article: ArticleV1): string[] {
  const fromArticle = (article.products?.primary ?? []).map((p) => p.productId);
  return fromArticle;
}

export async function buildContentEditorViewModel(
  articleId: string,
): Promise<ContentEditorViewModel | undefined> {
  const record = await getAdminArticle(articleId);
  if (!record) return undefined;

  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();
  const productMap = new Map(products.map((p) => [p.id, p.identity.name]));

  const articleProductIds = catalogProductIds(record.article);
  const allKnownIds = [
    ...new Set([...articleProductIds, ...products.map((p) => p.id)]),
  ];

  const parsed = parseArticleContent(record.body ?? "", {
    knownProductIds: allKnownIds,
  });

  const validation = validateContentBlocks(parsed.blocks, {
    knownProductIds: allKnownIds,
  });

  const workflow = await getWorkflowStatus("article", articleId);
  const workflowStatus = workflow?.record.status ?? null;
  const mutationAllowed = workflowStatus === null || workflowStatus === "draft";

  const { blockCount, blockTypes } = summarizeContentBlocks(parsed.blocks);

  const productRefs = (record.article.products?.primary ?? []).map((ref) => ({
    productId: ref.productId,
    name: productMap.get(ref.productId) ?? ref.productId,
    rank: ref.rank,
    role: ref.role,
  }));

  return {
    articleId,
    articleTitle: record.article.identity.title,
    blocks: parsed.blocks,
    rawBody: parsed.rawBody,
    blockCount,
    blockTypes,
    products: productRefs,
    validationStatus: validation.valid ? "valid" : "invalid",
    validationErrors: validation.errors,
    workflowStatus,
    mutationAllowed,
    parseWarnings: parsed.parseWarnings,
  };
}

export type { ContentEditorViewModel };
