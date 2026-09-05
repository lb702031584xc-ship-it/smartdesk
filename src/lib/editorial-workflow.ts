/**
 * Controlled editorial workflow service (Phase 36).
 *
 * Separate from ProductV1 / ArticleV1. Wraps review/approval around existing
 * mutation + save paths without replacing them.
 *
 * Transitions:
 *   create → draft
 *   draft → review (submit)
 *   review → approved (approve)
 *   approved → published (publish)
 *   published → draft (reopen)
 *
 * Invalid: draft → publish, review → publish, draft → approved, etc.
 */
import { hasEditorialWorkflowRole } from "@/lib/admin/auth-config";
import { getAdminArticle, saveAdminArticle } from "@/lib/admin/article-store";
import { getAdminProduct } from "@/lib/admin/product-store";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  deleteWorkflowForEntity,
  findWorkflowByEntity,
  insertWorkflowWithEvent,
  listWorkflowEvents,
  transitionWorkflow,
} from "@/lib/editorial-workflow-store";
import type {
  EditorialWorkflowEntityType,
  EditorialWorkflowRecord,
  EditorialWorkflowRole,
  EditorialWorkflowStatus,
  EditorialWorkflowView,
} from "@/types/editorial-workflow";

export type WorkflowErrorCode =
  | "WORKFLOW_DISABLED"
  | "ENTITY_NOT_FOUND"
  | "WORKFLOW_EXISTS"
  | "WORKFLOW_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "PERMISSION_DENIED"
  | "PUBLISH_FAILED"
  | "INVALID_INPUT";

export type WorkflowResult =
  | {
      success: true;
      workflow: EditorialWorkflowView;
      articlePublished?: boolean;
    }
  | {
      success: false;
      error: WorkflowErrorCode;
      message: string;
    };

const ALLOWED_TRANSITIONS: Record<
  EditorialWorkflowStatus,
  Partial<Record<"submit" | "approve" | "publish" | "reopen", EditorialWorkflowStatus>>
> = {
  draft: { submit: "review" },
  review: { approve: "approved" },
  approved: { publish: "published" },
  published: { reopen: "draft" },
};

export function isValidWorkflowTransition(
  from: EditorialWorkflowStatus,
  action: "submit" | "approve" | "publish" | "reopen",
): boolean {
  return Boolean(ALLOWED_TRANSITIONS[from]?.[action]);
}

export function nextStatusForAction(
  from: EditorialWorkflowStatus,
  action: "submit" | "approve" | "publish" | "reopen",
): EditorialWorkflowStatus | undefined {
  return ALLOWED_TRANSITIONS[from]?.[action];
}

/** Mutations may only run while workflow is draft (or no workflow yet). */
export function workflowAllowsMutation(
  status: EditorialWorkflowStatus | undefined,
): boolean {
  if (status === undefined) return true;
  return status === "draft";
}

async function requireDatabase(): Promise<WorkflowResult | null> {
  if (!isDatabaseContentStore()) {
    return {
      success: false,
      error: "WORKFLOW_DISABLED",
      message:
        "Editorial workflow requires CONTENT_STORE=database (Neon-backed records).",
    };
  }
  return null;
}

async function loadView(
  record: EditorialWorkflowRecord,
): Promise<EditorialWorkflowView> {
  const history = await listWorkflowEvents(record.id);
  return { record, history };
}

export async function getWorkflowStatus(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<EditorialWorkflowView | undefined> {
  if (!isDatabaseContentStore()) return undefined;
  const record = await findWorkflowByEntity(entityType, entityId);
  if (!record) return undefined;
  return loadView(record);
}

/**
 * Gate for existing mutation boundaries — does not change allowlisted fields.
 * Returns null when mutation may proceed.
 */
export async function assertWorkflowAllowsMutation(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<{ error: "WORKFLOW_LOCKED"; message: string } | null> {
  if (!isDatabaseContentStore()) return null;
  const record = await findWorkflowByEntity(entityType, entityId);
  if (!record) return null;
  if (workflowAllowsMutation(record.status)) return null;
  return {
    error: "WORKFLOW_LOCKED",
    message: `Editorial workflow is "${record.status}". Reopen to draft before mutating.`,
  };
}

export async function createWorkflowRecord(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
}): Promise<WorkflowResult> {
  const disabled = await requireDatabase();
  if (disabled) return disabled;

  if (!input.entityId || !input.actor) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "entityId and actor are required.",
    };
  }

  if (!hasEditorialWorkflowRole(input.actor, "editor")) {
    return {
      success: false,
      error: "PERMISSION_DENIED",
      message: "Editor role required to create a workflow.",
    };
  }

  if (input.entityType === "article") {
    const article = await getAdminArticle(input.entityId);
    if (!article) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Article not found: ${input.entityId}`,
      };
    }
  } else {
    const product = await getAdminProduct(input.entityId);
    if (!product) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Product not found: ${input.entityId}`,
      };
    }
  }

  const existing = await findWorkflowByEntity(input.entityType, input.entityId);
  if (existing) {
    return {
      success: false,
      error: "WORKFLOW_EXISTS",
      message: "Workflow already exists for this entity.",
    };
  }

  const record = await insertWorkflowWithEvent({
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor,
    status: "draft",
  });

  return { success: true, workflow: await loadView(record) };
}

async function transitionWithPermission(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
  action: "submit" | "approve" | "publish" | "reopen";
  requiredRole: EditorialWorkflowRole;
}): Promise<WorkflowResult> {
  const disabled = await requireDatabase();
  if (disabled) return disabled;

  if (!hasEditorialWorkflowRole(input.actor, input.requiredRole)) {
    return {
      success: false,
      error: "PERMISSION_DENIED",
      message: `${input.requiredRole} role required for "${input.action}".`,
    };
  }

  const record = await findWorkflowByEntity(input.entityType, input.entityId);
  if (!record) {
    return {
      success: false,
      error: "WORKFLOW_NOT_FOUND",
      message: "No workflow record. Create a draft workflow first.",
    };
  }

  const next = nextStatusForAction(record.status, input.action);
  if (!next) {
    return {
      success: false,
      error: "INVALID_TRANSITION",
      message: `Cannot "${input.action}" from status "${record.status}".`,
    };
  }

  const updated = await transitionWorkflow({
    workflowId: record.id,
    actor: input.actor,
    action: input.action,
    nextStatus: next,
  });

  return { success: true, workflow: await loadView(updated) };
}

export async function submitForReview(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
}): Promise<WorkflowResult> {
  return transitionWithPermission({
    ...input,
    action: "submit",
    requiredRole: "editor",
  });
}

export async function approveChange(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
}): Promise<WorkflowResult> {
  return transitionWithPermission({
    ...input,
    action: "approve",
    requiredRole: "reviewer",
  });
}

export async function reopenForEdit(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
}): Promise<WorkflowResult> {
  return transitionWithPermission({
    ...input,
    action: "reopen",
    requiredRole: "editor",
  });
}

/**
 * Publish after approval.
 * - Articles: uses existing saveAdminArticle to set publishing.status=published
 * - Products: workflow status only (no Product publishing field)
 */
export async function publishChange(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
}): Promise<WorkflowResult> {
  const disabled = await requireDatabase();
  if (disabled) return disabled;

  if (!hasEditorialWorkflowRole(input.actor, "reviewer")) {
    return {
      success: false,
      error: "PERMISSION_DENIED",
      message: "Reviewer role required to publish.",
    };
  }

  const record = await findWorkflowByEntity(input.entityType, input.entityId);
  if (!record) {
    return {
      success: false,
      error: "WORKFLOW_NOT_FOUND",
      message: "No workflow record.",
    };
  }

  if (record.status !== "approved") {
    return {
      success: false,
      error: "INVALID_TRANSITION",
      message: `Cannot publish from status "${record.status}". Approval required.`,
    };
  }

  let articlePublished = false;

  if (input.entityType === "article") {
    const existing = await getAdminArticle(input.entityId);
    if (!existing) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Article not found: ${input.entityId}`,
      };
    }

    if (existing.article.publishing.status !== "published") {
      const now = new Date().toISOString();
      const nextArticle = {
        ...existing.article,
        publishing: {
          ...existing.article.publishing,
          status: "published" as const,
          publishedAt: existing.article.publishing.publishedAt ?? now,
          updatedAt: now,
        },
      };
      const saveResult = await saveAdminArticle(nextArticle, {
        expectedVersion: existing.version,
        body: existing.body ?? "",
        actor: input.actor,
      });
      if (!saveResult.ok) {
        return {
          success: false,
          error: "PUBLISH_FAILED",
          message: saveResult.errors[0] ?? "Article publish save failed.",
        };
      }
      articlePublished = true;
    }
  } else {
    const product = await getAdminProduct(input.entityId);
    if (!product) {
      return {
        success: false,
        error: "ENTITY_NOT_FOUND",
        message: `Product not found: ${input.entityId}`,
      };
    }
  }

  const updated = await transitionWorkflow({
    workflowId: record.id,
    actor: input.actor,
    action: "publish",
    nextStatus: "published",
  });

  return {
    success: true,
    workflow: await loadView(updated),
    articlePublished,
  };
}

/** Test helper — remove workflow rows for an entity. */
export async function deleteEditorialWorkflowForTests(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<void> {
  await deleteWorkflowForEntity(entityType, entityId);
}

export type { EditorialWorkflowView, EditorialWorkflowRecord };
