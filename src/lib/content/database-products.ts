import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import {
  isProductV1Document,
  validateProductV1,
} from "@/lib/product-schema";
import type { ProductV1Document } from "@/types/product-v1";

export type ProductV1Record = {
  product: ProductV1Document;
  sourceFile: string;
  version: number;
};

function parseProductRow(row: {
  id: string;
  data: ProductV1Document;
  version: number;
}): ProductV1Document {
  const data = row.data;
  if (!isProductV1Document(data)) {
    throw new Error(`[content/db/products] ${row.id} is not Product V1 in database.`);
  }
  const validation = validateProductV1(data);
  if (!validation.valid) {
    throw new Error(
      `[content/db/products] Invalid Product V1 (${row.id}): ${validation.errors.join("; ")}`,
    );
  }
  return data;
}

export async function listDatabaseProductIds(): Promise<string[]> {
  const rows = await (await getDb()).select({ id: products.id }).from(products);
  return rows.map((r) => r.id).sort();
}

export async function listDatabaseProductsV1(): Promise<ProductV1Document[]> {
  const rows = await (await getDb()).select().from(products);
  return rows.map((row) => parseProductRow(row));
}

export async function getDatabaseProductV1(id: string): Promise<ProductV1Record | undefined> {
  const rows = await (await getDb())
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (rows.length === 0) return undefined;

  const row = rows[0];
  return {
    product: parseProductRow(row),
    sourceFile: `${row.id}.json`,
    version: row.version,
  };
}

export async function upsertDatabaseProductV1(
  product: ProductV1Document,
  options?: { expectedVersion?: number },
): Promise<{ ok: true; version: number } | { ok: false; stale: true }> {
  const existing = await getDatabaseProductV1(product.id);

  if (existing && options?.expectedVersion !== undefined) {
    if (existing.version !== options.expectedVersion) {
      return { ok: false, stale: true };
    }
  }

  const nextVersion = existing ? existing.version + 1 : 1;

  await (await getDb())
    .insert(products)
    .values({
      id: product.id,
      category: product.identity.category,
      data: product,
      version: nextVersion,
      dbUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: products.id,
      set: {
        category: product.identity.category,
        data: product,
        version: nextVersion,
        dbUpdatedAt: new Date(),
      },
    });

  return { ok: true, version: nextVersion };
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (String(record.code ?? "") === "23505") return true;
    if (typeof record.message === "string" && /duplicate key|unique constraint/i.test(record.message)) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

export async function insertDatabaseProductV1(
  product: ProductV1Document,
): Promise<{ ok: true; version: number } | { ok: false; duplicate: true }> {
  const existing = await getDatabaseProductV1(product.id);
  if (existing) {
    return { ok: false, duplicate: true };
  }

  try {
    await (await getDb()).insert(products).values({
      id: product.id,
      category: product.identity.category,
      data: product,
      version: 1,
      dbUpdatedAt: new Date(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, duplicate: true };
    }
    throw error;
  }

  return { ok: true, version: 1 };
}

export async function deleteDatabaseProductV1(id: string): Promise<void> {
  await (await getDb()).delete(products).where(eq(products.id, id));
}
