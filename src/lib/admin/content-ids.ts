import fs from "fs";
import path from "path";

const productsDirectory = path.join(process.cwd(), "content/products");

export function readProductIdsFromDisk(): string[] {
  if (!fs.existsSync(productsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(productsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.replace(/\.json$/, ""));
}
