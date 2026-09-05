import { cache } from "react";
import { isDatabaseContentStore } from "./store-config";
import {
  getFilesystemProductV1,
  listFilesystemProductIds,
  listFilesystemProductsV1,
  saveFilesystemProductV1,
} from "./filesystem-products";
import {
  deleteDatabaseProductV1,
  getDatabaseProductV1,
  insertDatabaseProductV1,
  listDatabaseProductIds,
  listDatabaseProductsV1,
  upsertDatabaseProductV1,
} from "./database-products";
import { upsertDatabaseProductV1WithRevision } from "@/lib/db/revisions";
import type { ProductV1Document } from "@/types/product-v1";

export type ProductV1Record = {
  product: ProductV1Document;
  sourceFile: string;
  version?: number;
};

const loadAllProductsV1 = cache(async (): Promise<ProductV1Document[]> => {
  if (isDatabaseContentStore()) {
    return await listDatabaseProductsV1();
  }
  return listFilesystemProductsV1();
});

export async function listProductV1Ids(): Promise<string[]> {
  if (isDatabaseContentStore()) {
    return await listDatabaseProductIds();
  }
  return listFilesystemProductIds();
}

export async function getProductV1(id: string): Promise<ProductV1Record | undefined> {
  if (isDatabaseContentStore()) {
    return await getDatabaseProductV1(id);
  }
  return getFilesystemProductV1(id);
}

export async function listProductsV1(): Promise<ProductV1Document[]> {
  return await loadAllProductsV1();
}

export async function productV1Exists(id: string): Promise<boolean> {
  const record = await getProductV1(id);
  return Boolean(record);
}

export async function insertProductV1(
  product: ProductV1Document,
): Promise<
  | { ok: true; version: number }
  | { ok: false; duplicate: true }
  | { ok: false; error: string }
> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      error: "Product creation is only available when CONTENT_STORE=database.",
    };
  }
  const result = await insertDatabaseProductV1(product);
  if (!result.ok) return result;
  return { ok: true, version: result.version };
}

export async function deleteProductV1Record(id: string): Promise<void> {
  if (!isDatabaseContentStore()) {
    throw new Error("Product record delete is only available in database content store.");
  }
  await deleteDatabaseProductV1(id);
}

export async function saveProductV1(
  product: ProductV1Document,
  options?: { sourceFile?: string; expectedVersion?: number; createdBy?: string },
): Promise<
  | { ok: true; version?: number; revisionCreated?: boolean }
  | { ok: false; stale: true }
  | { ok: false; error: string }
> {
  if (isDatabaseContentStore()) {
    if (options?.createdBy) {
      const result = await upsertDatabaseProductV1WithRevision(product, {
        expectedVersion: options.expectedVersion,
        createdBy: options.createdBy,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        version: result.version,
        revisionCreated: result.revisionCreated,
      };
    }

    const result = await upsertDatabaseProductV1(product, {
      expectedVersion: options?.expectedVersion,
    });
    if (!result.ok) return result;
    return { ok: true, version: result.version };
  }

  const sourceFile = options?.sourceFile ?? `${product.id}.json`;
  saveFilesystemProductV1(product, sourceFile);
  return { ok: true };
}
