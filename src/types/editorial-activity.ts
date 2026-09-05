/**
 * Editorial Activity & Change Intelligence read models (Phase 37).
 *
 * Derived from revisions + workflow events only.
 * No schema duplication. No mutations.
 */

import type {
  EditorialWorkflowEntityType,
  EditorialWorkflowStatus,
} from "@/types/editorial-workflow";

export type EditorialActivityAction =
  | "revision"
  | "workflow_create"
  | "workflow_submit"
  | "workflow_approve"
  | "workflow_publish"
  | "workflow_reopen";

export type EditorialActivityViewModel = {
  id: string;
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  action: EditorialActivityAction;
  actor: string;
  timestamp: string;
  workflowStatus: EditorialWorkflowStatus | null;
  /** Short human labels for revision field groups when applicable. */
  summary?: string[];
};

export type ReviewQueueItemViewModel = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  submittedBy: string;
  submittedAt: string;
  currentStatus: EditorialWorkflowStatus;
};

export type ReviewQueueViewModel = {
  pendingCount: number;
  items: ReviewQueueItemViewModel[];
};

export type ChangeFieldDiff = {
  field: string;
  before: string | null;
  after: string | null;
};

export type ChangeSummaryViewModel = {
  id: string;
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  changedFields: string[];
  actor: string;
  timestamp: string;
  /** Allowed editorial/SEO field diffs only (Phase 34/35 surface). */
  diffs: ChangeFieldDiff[];
};

export type EditorialDiffViewModel = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  revisionId: string;
  actor: string;
  timestamp: string;
  diffs: ChangeFieldDiff[];
};

export type PublishedChangeViewModel = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  publishedBy: string;
  publishedAt: string;
};

export type StaleContentItemViewModel = {
  entityType: "article";
  entityId: string;
  entityName: string;
  publishedAt: string | null;
  lastUpdatedAt: string | null;
  daysSinceUpdate: number;
};

export type EditorialIntelligenceOverview = {
  recentActivity: EditorialActivityViewModel[];
  reviewQueue: ReviewQueueViewModel;
  recentChanges: ChangeSummaryViewModel[];
  recentlyPublished: PublishedChangeViewModel[];
  staleArticles: StaleContentItemViewModel[];
};
