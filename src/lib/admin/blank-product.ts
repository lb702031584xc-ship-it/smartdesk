import type { ProductCategoryV1, ProductV1Document } from "@/types/product-v1";

/**
 * Smallest editable Product V1 candidate. Optional fields stay absent.
 * Category is empty until the editor selects a canonical value.
 */
export function blankProductV1(): ProductV1Document {
  return {
    schemaVersion: 1,
    id: "",
    identity: {
      name: "",
      brand: "",
      category: "" as ProductCategoryV1,
    },
  };
}
