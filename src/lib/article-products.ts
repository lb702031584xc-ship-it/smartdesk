/**
 * Article → Product relationship resolver (Phase 27 Content Graph).
 *
 * Input: ArticleV1 (+ optional Markdown body)
 * Output: ArticleWithProducts — article plus resolved ProductV1 documents.
 *
 * Does not duplicate Product catalog fields onto the Article.
 * Does not change public render adapters (legacy ResolvedArticle remains).
 */
import type { ArticleDocumentV1, ArticleProductReferenceV1, ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import { getProductV1, listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";

export type ArticleProductPlacement = {
  ref: ArticleProductReferenceV1;
  product: ProductV1Document;
};

export type ArticleWithProducts = {
  article: ArticleV1;
  /** Markdown body when provided; never HTML. */
  body?: string;
  /** Resolved ProductV1 documents in `products.primary` order. */
  products: ProductV1Document[];
  /** Same join with placement metadata (rank/role/summary). */
  placements: ArticleProductPlacement[];
  /** productIds referenced but missing from the Product repository. */
  missingProductIds: string[];
};

export type ResolveArticleProductsOptions = {
  /** Injected Product map (tests / fixtures). */
  productById?: Map<string, ProductV1Document> | Record<string, ProductV1Document>;
  body?: string;
};

function toProductMap(
  source?: Map<string, ProductV1Document> | Record<string, ProductV1Document>,
): Map<string, ProductV1Document> | undefined {
  if (!source) return undefined;
  if (source instanceof Map) return source;
  return new Map(Object.entries(source));
}

function primaryRefs(article: ArticleV1): ArticleProductReferenceV1[] {
  return article.products?.primary ?? [];
}

/**
 * Pure resolver: ArticleV1 + Product lookup → ArticleWithProducts.
 */
export function resolveArticleWithProducts(
  article: ArticleV1,
  lookup: (productId: string) => ProductV1Document | undefined,
  options?: { body?: string },
): ArticleWithProducts {
  const products: ProductV1Document[] = [];
  const placements: ArticleProductPlacement[] = [];
  const missingProductIds: string[] = [];

  for (const ref of primaryRefs(article)) {
    const product = lookup(ref.productId);
    if (!product) {
      missingProductIds.push(ref.productId);
      continue;
    }
    products.push(product);
    placements.push({ ref, product });
  }

  return {
    article,
    body: options?.body,
    products,
    placements,
    missingProductIds,
  };
}

async function loadProductMap(): Promise<Map<string, ProductV1Document>> {
  const list = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();
  return new Map(list.map((product) => [product.id, product]));
}

/**
 * Resolve using the active content store (Neon or filesystem Product V1).
 */
export async function resolveArticleWithProductsFromStore(
  article: ArticleV1,
  options?: ResolveArticleProductsOptions,
): Promise<ArticleWithProducts> {
  const injected = toProductMap(options?.productById);
  if (injected) {
    return resolveArticleWithProducts(article, (id) => injected.get(id), {
      body: options?.body,
    });
  }

  const map = await loadProductMap();
  return resolveArticleWithProducts(article, (id) => map.get(id), {
    body: options?.body,
  });
}

/**
 * Resolve a full ArticleDocumentV1 (article + Markdown body).
 */
export async function resolveArticleDocumentWithProducts(
  document: ArticleDocumentV1,
  options?: Omit<ResolveArticleProductsOptions, "body">,
): Promise<ArticleWithProducts> {
  return resolveArticleWithProductsFromStore(document.article, {
    ...options,
    body: document.body,
  });
}

/**
 * Convenience: load one ProductV1 by id from the active store.
 */
export async function loadProductV1ForArticle(
  productId: string,
): Promise<ProductV1Document | undefined> {
  const record = await getProductV1(productId);
  return record?.product;
}
