import {
  productV1ToLegacyProduct,
  validateProductV1,
} from "@/lib/product-schema";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { getProductV1, listProductsV1 } from "@/lib/content/products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import type { Product } from "@/types/product";

export type { Product };

type ProductCache = {
  list: Product[];
  byId: Map<string, Product>;
};

let filesystemCache: ProductCache | null = null;

function buildFilesystemCache(): ProductCache {
  const v1List = listFilesystemProductsV1();
  const list: Product[] = [];
  const byId = new Map<string, Product>();

  for (const doc of v1List) {
    const result = validateProductV1(doc);
    if (!result.valid) {
      throw new Error(
        `[products] Invalid Product V1 (${doc.id}):\n- ${result.errors.join("\n- ")}`,
      );
    }
    for (const warning of result.warnings) {
      console.warn(`[products] ${doc.id}: ${warning}`);
    }

    const product = productV1ToLegacyProduct(doc);

    if (byId.has(product.id)) {
      throw new Error(`[products] Duplicate product id "${product.id}".`);
    }

    byId.set(product.id, product);
    list.push(product);
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  return { list, byId };
}

function getFilesystemCache(): ProductCache {
  if (!filesystemCache) {
    filesystemCache = buildFilesystemCache();
  }
  return filesystemCache;
}

async function buildDatabaseCache(): Promise<ProductCache> {
  const v1List = await listProductsV1();
  const list: Product[] = [];
  const byId = new Map<string, Product>();

  for (const doc of v1List) {
    const result = validateProductV1(doc);
    if (!result.valid) {
      throw new Error(
        `[products] Invalid Product V1 (${doc.id}):\n- ${result.errors.join("\n- ")}`,
      );
    }
    try {
      const product = productV1ToLegacyProduct(doc);
      byId.set(product.id, product);
      list.push(product);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (detail.includes("cannot adapt")) {
        continue;
      }
      throw error;
    }
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  return { list, byId };
}

export function clearProductCache() {
  filesystemCache = null;
}

/** Sync filesystem loader — used by validation scripts and default build without DB. */
export function getProductByIdSync(id: string): Product | undefined {
  return getFilesystemCache().byId.get(id);
}

export function getAllProductsSync(): Product[] {
  return getFilesystemCache().list;
}

export async function getAllProducts(): Promise<Product[]> {
  if (isDatabaseContentStore()) {
    return (await buildDatabaseCache()).list;
  }
  return getAllProductsSync();
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (isDatabaseContentStore()) {
    const record = await getProductV1(id);
    if (!record) return undefined;
    return productV1ToLegacyProduct(record.product);
  }
  return getProductByIdSync(id);
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const results = await Promise.all(ids.map((id) => getProductById(id)));
  return results.filter((product): product is Product => Boolean(product));
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const list = await getAllProducts();
  return list.filter((product) => product.category === categorySlug);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const list = await getAllProducts();
  return list.filter((product) => product.featured).slice(0, limit);
}

export async function requireProduct(id: string): Promise<Product> {
  const product = await getProductById(id);
  if (!product) {
    throw new Error(`Product not found: ${id}`);
  }
  return product;
}
