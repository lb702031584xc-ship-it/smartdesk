import fs from "fs";
import path from "path";
import { isProductV1Document, validateProductV1 } from "@/lib/product-schema";
import type { ProductV1Document } from "@/types/product-v1";

const productsDirectory = path.join(process.cwd(), "content/products");

export type ProductV1Record = {
  product: ProductV1Document;
  sourceFile: string;
  version?: number;
};

function readProductFile(filePath: string): ProductV1Document {
  const fileName = path.basename(filePath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[content/fs/products] Failed to parse ${fileName}: ${detail}`);
  }

  if (!isProductV1Document(parsed)) {
    throw new Error(`[content/fs/products] ${fileName} must be Product V1 (schemaVersion: 1).`);
  }

  const validation = validateProductV1(parsed);
  if (!validation.valid) {
    throw new Error(
      `[content/fs/products] Invalid Product V1 (${fileName}): ${validation.errors.join("; ")}`,
    );
  }

  return parsed;
}

export function listFilesystemProductIds(): string[] {
  if (!fs.existsSync(productsDirectory)) return [];
  return fs
    .readdirSync(productsDirectory)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function listFilesystemProductsV1(): ProductV1Document[] {
  return listFilesystemProductIds().map((id) => {
    const record = getFilesystemProductV1(id);
    if (!record) throw new Error(`[content/fs/products] missing ${id}`);
    return record.product;
  });
}

export function getFilesystemProductV1(id: string): ProductV1Record | undefined {
  const filePath = path.join(productsDirectory, `${id}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return {
    product: readProductFile(filePath),
    sourceFile: `${id}.json`,
  };
}

export function saveFilesystemProductV1(
  product: ProductV1Document,
  sourceFile: string,
): void {
  const filePath = path.join(productsDirectory, sourceFile);
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${sourceFile}.${process.pid}.tmp`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tempPath, `${JSON.stringify(product, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}
