/**
 * Controlled Product mutation boundary (Phase 34).
 *
 * Admin UI → this module → Validation → Revision → Neon → Revalidation
 *
 * Only product.editorial.{role,verdict,bestFor,notFor} may change.
 * No UI should write products except through this (or the legacy full
 * admin save path, which remains for the existing full editor).
 */
import type {
  ProductEditorialRoleV1,
  ProductEditorialV1,
  ProductV1Document,
} from "@/types/product-v1";
import { getAdminProduct, saveAdminProduct } from "@/lib/admin/product-store";
import {
  findPublishedArticleSlugsReferencingProduct,
  collectProductRevalidationPaths,
} from "@/lib/admin/revalidate-content";
import { assertWorkflowAllowsMutation } from "@/lib/editorial-workflow";
import { listProductRevisions } from "@/lib/db/revisions";
import { isDatabaseContentStore } from "@/lib/content/store-config";

/** Phase 34 allowlist — nothing else under editorial. */
export const EDITABLE_EDITORIAL_FIELDS = [
  "role",
  "verdict",
  "bestFor",
  "notFor",
] as const;

export type EditableEditorialField = (typeof EDITABLE_EDITORIAL_FIELDS)[number];

export const PRODUCT_EDITORIAL_ROLES: readonly ProductEditorialRoleV1[] = [
  "best-overall",
  "best-budget",
  "best-space-saving",
  "best-premium",
  "best-for-beginners",
  "best-value",
];

export type ProductEditorialFieldChanges = {
  role?: ProductEditorialRoleV1;
  verdict?: string;
  bestFor?: string[];
  notFor?: string[];
};

export type ProductEditorialChanges = {
  editorial: ProductEditorialFieldChanges;
};

export type UpdateProductEditorialInput = {
  productId: string;
  changes: unknown;
  expectedVersion: number;
  actor: string;
};

export type ProductMutationErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "FIELD_NOT_EDITABLE"
  | "INVALID_ENUM"
  | "INVALID_VALUE"
  | "SCHEMA_DRIFT"
  | "WRITE_DISABLED"
  | "SAVE_FAILED"
  | "INVALID_INPUT"
  | "WORKFLOW_LOCKED";

export type ProductMutationSuccess = {
  success: true;
  revisionId: string | null;
  updatedProduct: ProductV1Document;
  version: number;
  revisionCreated: boolean;
  revalidated?: boolean;
  /** Planned article dependency paths (for validation / diagnostics). */
  dependencyPaths: string[];
};

export type ProductMutationFailure = {
  success: false;
  error: ProductMutationErrorCode;
  message: string;
};

export type ProductMutationResult = ProductMutationSuccess | ProductMutationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Reject forbidden / unknown fields before any merge or write.
 * Pure — safe for unit tests without DB.
 */
export function validateEditorialMutationChanges(
  changes: unknown,
):
  | { ok: true; changes: ProductEditorialChanges }
  | { ok: false; error: ProductMutationErrorCode; message: string } {
  if (!isRecord(changes)) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "changes must be an object.",
    };
  }

  const topKeys = Object.keys(changes);
  for (const key of topKeys) {
    if (key !== "editorial") {
      return {
        ok: false,
        error: "FIELD_NOT_EDITABLE",
        message: `Field "${key}" is not editable via product editorial mutation.`,
      };
    }
  }

  if (!("editorial" in changes)) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: 'changes.editorial is required.',
    };
  }

  if (!isRecord(changes.editorial)) {
    return {
      ok: false,
      error: "SCHEMA_DRIFT",
      message: "editorial must be an object.",
    };
  }

  const editorial = changes.editorial;
  const allowed = new Set<string>(EDITABLE_EDITORIAL_FIELDS);

  for (const key of Object.keys(editorial)) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        error: "FIELD_NOT_EDITABLE",
        message: `editorial.${key} is not editable in Phase 34.`,
      };
    }
  }

  const next: ProductEditorialFieldChanges = {};

  if ("role" in editorial) {
    const role = editorial.role;
    if (role === undefined || role === null || role === "") {
      // Explicit clear — omit role from merge target by setting undefined later
      next.role = undefined;
    } else if (
      typeof role !== "string" ||
      !PRODUCT_EDITORIAL_ROLES.includes(role as ProductEditorialRoleV1)
    ) {
      return {
        ok: false,
        error: "INVALID_ENUM",
        message: `editorial.role must be one of: ${PRODUCT_EDITORIAL_ROLES.join(", ")}.`,
      };
    } else {
      next.role = role as ProductEditorialRoleV1;
    }
  }

  if ("verdict" in editorial) {
    if (editorial.verdict !== undefined && typeof editorial.verdict !== "string") {
      return {
        ok: false,
        error: "INVALID_VALUE",
        message: "editorial.verdict must be a string when present.",
      };
    }
    next.verdict = editorial.verdict as string | undefined;
  }

  if ("bestFor" in editorial) {
    if (editorial.bestFor !== undefined && !isStringArray(editorial.bestFor)) {
      return {
        ok: false,
        error: "INVALID_VALUE",
        message: "editorial.bestFor must be a string array when present.",
      };
    }
    next.bestFor = editorial.bestFor as string[] | undefined;
  }

  if ("notFor" in editorial) {
    if (editorial.notFor !== undefined && !isStringArray(editorial.notFor)) {
      return {
        ok: false,
        error: "INVALID_VALUE",
        message: "editorial.notFor must be a string array when present.",
      };
    }
    next.notFor = editorial.notFor as string[] | undefined;
  }

  if (Object.keys(next).length === 0) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "No editable editorial fields provided.",
    };
  }

  return { ok: true, changes: { editorial: next } };
}

/**
 * Merge allowlisted editorial changes onto an existing product.
 * Preserves description, pros, cons, featured, and all non-editorial sections.
 */
export function applyEditorialChanges(
  product: ProductV1Document,
  changes: ProductEditorialChanges,
): ProductV1Document {
  const prev: ProductEditorialV1 = { ...(product.editorial ?? {}) };
  const patch = changes.editorial;

  if ("role" in patch) {
    if (patch.role === undefined) {
      delete prev.role;
    } else {
      prev.role = patch.role;
    }
  }
  if ("verdict" in patch) {
    if (patch.verdict === undefined || patch.verdict === "") {
      delete prev.verdict;
    } else {
      prev.verdict = patch.verdict;
    }
  }
  if ("bestFor" in patch) {
    if (patch.bestFor === undefined) {
      delete prev.bestFor;
    } else {
      prev.bestFor = patch.bestFor;
    }
  }
  if ("notFor" in patch) {
    if (patch.notFor === undefined) {
      delete prev.notFor;
    } else {
      prev.notFor = patch.notFor;
    }
  }

  return {
    ...product,
    editorial: Object.keys(prev).length > 0 ? prev : undefined,
  };
}

/**
 * Controlled update of Product editorial fields only.
 * Uses the existing Admin save path for revision + Neon write + revalidation.
 */
export async function updateProductEditorialFields(
  input: UpdateProductEditorialInput,
): Promise<ProductMutationResult> {
  if (!input.productId || typeof input.productId !== "string") {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "productId is required.",
    };
  }
  if (!input.actor || typeof input.actor !== "string") {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "actor is required.",
    };
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion)
  ) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "expectedVersion must be an integer.",
    };
  }

  const parsed = validateEditorialMutationChanges(input.changes);
  if (!parsed.ok) {
    return {
      success: false,
      error: parsed.error,
      message: parsed.message,
    };
  }

  const existing = await getAdminProduct(input.productId);
  if (!existing) {
    return {
      success: false,
      error: "PRODUCT_NOT_FOUND",
      message: `Product not found: ${input.productId}`,
    };
  }

  const workflowLock = await assertWorkflowAllowsMutation(
    "product",
    input.productId,
  );
  if (workflowLock) {
    return {
      success: false,
      error: "WORKFLOW_LOCKED",
      message: workflowLock.message,
    };
  }

  const merged = applyEditorialChanges(existing.product, parsed.changes);

  const saveResult = await saveAdminProduct(merged, {
    expectedVersion: input.expectedVersion,
    actor: input.actor,
  });

  if (saveResult.blocked) {
    return {
      success: false,
      error: "WRITE_DISABLED",
      message: saveResult.blockedReason ?? "Admin write mode is disabled.",
    };
  }

  if (!saveResult.ok) {
    const stale = saveResult.errors.some((e) =>
      e.toLowerCase().includes("changed after you opened"),
    );
    if (stale) {
      return {
        success: false,
        error: "VERSION_CONFLICT",
        message: saveResult.errors[0] ?? "Version conflict.",
      };
    }
    return {
      success: false,
      error: "SAVE_FAILED",
      message: saveResult.errors[0] ?? "Save failed.",
    };
  }

  const updated = await getAdminProduct(input.productId);
  if (!updated) {
    return {
      success: false,
      error: "SAVE_FAILED",
      message: "Product missing after save.",
    };
  }

  let revisionId: string | null = null;
  if (saveResult.revisionCreated && isDatabaseContentStore()) {
    const revisions = await listProductRevisions(input.productId);
    revisionId = revisions[0]?.id ?? null;
  }

  const articleSlugs = await findPublishedArticleSlugsReferencingProduct(
    input.productId,
  );
  const dependencyPaths = collectProductRevalidationPaths({
    articleSlugs,
    category: updated.product.identity.category,
    featuredChanged: false,
  });

  return {
    success: true,
    revisionId,
    updatedProduct: updated.product,
    version: saveResult.version ?? updated.version ?? input.expectedVersion,
    revisionCreated: Boolean(saveResult.revisionCreated),
    revalidated: saveResult.revalidated,
    dependencyPaths,
  };
}
