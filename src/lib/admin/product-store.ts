import {
  getProductV1,
  insertProductV1,
  listProductV1Ids,
  listProductsV1,
  saveProductV1,
  deleteProductV1Record,
} from "@/lib/content/products";
import { clearProductCache } from "@/lib/products";
import type { ProductV1Document } from "@/types/product-v1";
import { isAdminWriteEnabled } from "./persistence";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import type {
  AdminProductRecord,
  AdminSaveResult,
  ProductListItem,
} from "./types";
import { normalizeProductV1 } from "./normalize-product";
import {
  revalidateProductPublicContent,
  revalidationWarning,
} from "./revalidate-content";
import { deleteProductRevisionsForProduct } from "@/lib/db/revisions";
import { validateAdminProductCreate, validateAdminProductSave } from "./validate-save";

function toListItem(product: ProductV1Document): ProductListItem {
  return {
    id: product.id,
    name: product.identity.name,
    brand: product.identity.brand,
    category: product.identity.category,
    subcategory: product.classification?.subcategory,
    availability: product.commerce?.availability,
    featured: Boolean(product.editorial?.featured),
    rating: product.review?.rating,
    lastChecked: product.commerce?.lastChecked,
    asin: product.commerce?.asin,
    amazonUrl: product.commerce?.amazonUrl,
    hasGallery: Boolean(product.media?.gallery?.length),
  };
}

export async function listAdminProductIds(): Promise<string[]> {
  return await listProductV1Ids();
}

export async function listAdminProducts(): Promise<ProductListItem[]> {
  const products = await listProductsV1();
  return products.map(toListItem);
}

export async function getAdminProduct(id: string): Promise<AdminProductRecord | undefined> {
  const record = await getProductV1(id);
  if (!record) return undefined;
  return {
    product: record.product,
    sourceFile: record.sourceFile,
    version: record.version,
  };
}

export async function saveAdminProduct(
  product: ProductV1Document,
  options?: { expectedVersion?: number; actor?: string },
): Promise<AdminSaveResult> {
  if (!isAdminWriteEnabled()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Admin write mode is disabled. Set CONTENT_STORE=database with DATABASE_URL, or use local development filesystem mode.",
    };
  }

  const existing = await getAdminProduct(product.id);
  const validation = validateAdminProductSave(product, {
    existingId: existing?.product.id,
  });

  if (!validation.ok) {
    return validation;
  }

  let saveResult;
  try {
    saveResult = await saveProductV1(product, {
      sourceFile: existing?.sourceFile ?? `${product.id}.json`,
      expectedVersion: options?.expectedVersion ?? existing?.version,
      createdBy: options?.actor,
    });
  } catch {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  if (!saveResult.ok && "stale" in saveResult && saveResult.stale) {
    return {
      ok: false,
      errors: [
        "This record changed after you opened it. Reload before saving.",
      ],
      warnings: validation.warnings,
    };
  }

  if (!saveResult.ok && "error" in saveResult) {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  clearProductCache();

  const revalidation = await revalidateProductPublicContent({
    productId: product.id,
    category: product.identity.category,
    featuredChanged: existing?.product.editorial?.featured !== product.editorial?.featured,
  });

  const warnings = [...validation.warnings];
  const refreshWarning = revalidationWarning(revalidation);
  if (refreshWarning) warnings.push(refreshWarning);

  return {
    ok: true,
    errors: [],
    warnings,
    version: saveResult.ok ? saveResult.version : undefined,
    revalidated: revalidation.attempted && revalidation.ok ? true : undefined,
    revisionCreated: saveResult.ok ? saveResult.revisionCreated : undefined,
  };
}

export async function getAdminOverviewProductCount(): Promise<number> {
  return (await listAdminProducts()).length;
}

export async function createAdminProduct(
  product: ProductV1Document,
): Promise<AdminSaveResult> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Product creation is only available when CONTENT_STORE=database. Filesystem create is disabled to avoid a second source of truth.",
    };
  }

  if (!isAdminWriteEnabled()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Admin write mode is disabled. Set CONTENT_STORE=database with DATABASE_URL.",
    };
  }

  const canonical = normalizeProductV1(product);
  const existingIds = await listProductV1Ids();
  const validation = await validateAdminProductCreate(canonical, { existingIds });
  if (!validation.ok) {
    return validation;
  }

  let insertResult;
  try {
    insertResult = await insertProductV1(canonical);
  } catch {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  if (!insertResult.ok && "duplicate" in insertResult && insertResult.duplicate) {
    return {
      ok: false,
      errors: ["A product with this ID already exists."],
      warnings: validation.warnings,
    };
  }

  if (!insertResult.ok) {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  clearProductCache();
  return {
    ok: true,
    errors: [],
    warnings: validation.warnings,
    version: insertResult.version,
  };
}

/** Store-level cleanup for validation scripts. Not exposed in Admin UI. */
export async function deleteAdminProductRecord(id: string): Promise<void> {
  if (isDatabaseContentStore()) {
    await deleteProductRevisionsForProduct(id);
  }
  await deleteProductV1Record(id);
  clearProductCache();
}
