/**
 * Editorial workflow records (Phase 36).
 *
 * Separate from ProductV1 / ArticleV1 — do not store on canonical schemas.
 */

export type EditorialWorkflowEntityType = "product" | "article";

export type EditorialWorkflowStatus =
  | "draft"
  | "review"
  | "approved"
  | "published";

export type EditorialWorkflowAction =
  | "create"
  | "submit"
  | "approve"
  | "publish"
  | "reopen";

export type EditorialWorkflowRole = "editor" | "reviewer";

export type EditorialWorkflowRecord = {
  id: string;
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  status: EditorialWorkflowStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EditorialWorkflowEvent = {
  id: string;
  workflowId: string;
  actor: string;
  action: EditorialWorkflowAction;
  previousStatus: EditorialWorkflowStatus | null;
  newStatus: EditorialWorkflowStatus;
  createdAt: string;
};

export type EditorialWorkflowView = {
  record: EditorialWorkflowRecord;
  history: EditorialWorkflowEvent[];
};
