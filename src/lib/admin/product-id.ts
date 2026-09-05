const PRODUCT_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESERVED_PRODUCT_IDS = new Set(["new"]);

export function suggestProductId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateProductIdFormat(id: string): string | undefined {
  const trimmed = id.trim();
  if (!trimmed) return "Product ID is required.";
  if (trimmed !== id) return "Product ID must not have leading or trailing spaces.";
  if (/\s/.test(trimmed)) return "Product ID cannot contain spaces.";
  if (trimmed !== trimmed.toLowerCase()) return "Product ID must be lowercase.";
  if (RESERVED_PRODUCT_IDS.has(trimmed)) {
    return `Product ID "${trimmed}" is reserved.`;
  }
  if (!PRODUCT_ID_PATTERN.test(trimmed)) {
    return "Product ID must be slug-like (start with a letter; lowercase letters, numbers, and hyphens only).";
  }
  if (trimmed.length > 80) return "Product ID is too long.";
  return undefined;
}
