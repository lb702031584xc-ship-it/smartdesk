/**
 * Unified Editorial Workspace resolver (Phase 38) — READ ONLY composition.
 *
 * Connects:
 * - Phase 34/35 mutation paths (links only)
 * - Phase 36 workflow status
 * - Phase 37 activity + change intelligence
 * - Revision counts (existing store)
 *
 * Does not add mutations or schema changes.
 */
import { buildEditorialWorkspaceLinks } from "@/lib/editorial-workspace-links";
import {
  getArticleRevisionCount,
  getProductRevisionCount,
} from "@/lib/admin/revision-store";
import { getAdminArticle, getAdminProduct } from "@/lib/admin";
import {
  getChangeSummaries,
  getEntityActivity,
  getPendingReviewItems,
  getRecentEditorialActivity,
} from "@/lib/editorial-activity";
import { getWorkflowStatus } from "@/lib/editorial-workflow";
import type {
  EditorialWorkspaceIndexViewModel,
  EditorialWorkspaceViewModel,
} from "@/types/editorial-workspace";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

export { buildEditorialWorkspaceLinks, editorialWorkspaceHref } from "@/lib/editorial-workspace-links";

export async function getEditorialWorkspace(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<EditorialWorkspaceViewModel | undefined> {
  if (entityType === "product") {
    const [record, workflow, activity, allChanges] = await Promise.all([
      getAdminProduct(entityId),
      getWorkflowStatus(entityType, entityId),
      getEntityActivity(entityType, entityId),
      getChangeSummaries(100),
    ]);
    if (!record) return undefined;

    const revisionCount = await getProductRevisionCount(entityId);
    const recentChanges = allChanges
      .filter((c) => c.entityType === entityType && c.entityId === entityId)
      .slice(0, 10);

    return {
      entityType,
      entityId,
      entityName: record.product.identity.name,
      version: record.version ?? null,
      revisionCount,
      workflowStatus: workflow?.record.status ?? null,
      workflowUpdatedAt: workflow?.record.updatedAt ?? null,
      workflowUpdatedBy: workflow?.record.updatedBy ?? null,
      recentActivity: activity.slice(0, 15),
      recentChanges,
      links: buildEditorialWorkspaceLinks(entityType, entityId),
    };
  }

  const [record, workflow, activity, allChanges] = await Promise.all([
    getAdminArticle(entityId),
    getWorkflowStatus(entityType, entityId),
    getEntityActivity(entityType, entityId),
    getChangeSummaries(100),
  ]);
  if (!record) return undefined;

  const revisionCount = await getArticleRevisionCount(entityId);
  const recentChanges = allChanges
    .filter((c) => c.entityType === entityType && c.entityId === entityId)
    .slice(0, 10);

  return {
    entityType,
    entityId,
    entityName: record.article.identity.title,
    version: record.version ?? null,
    revisionCount,
    workflowStatus: workflow?.record.status ?? null,
    workflowUpdatedAt: workflow?.record.updatedAt ?? null,
    workflowUpdatedBy: workflow?.record.updatedBy ?? null,
    recentActivity: activity.slice(0, 15),
    recentChanges,
    links: buildEditorialWorkspaceLinks(entityType, entityId),
  };
}

export async function getEditorialWorkspaceIndex(): Promise<EditorialWorkspaceIndexViewModel> {
  const [reviewQueue, recentActivity] = await Promise.all([
    getPendingReviewItems(),
    getRecentEditorialActivity(30),
  ]);

  return {
    pendingCount: reviewQueue.pendingCount,
    reviewQueue,
    recentActivity,
  };
}

export type {
  EditorialWorkspaceViewModel,
  EditorialWorkspaceIndexViewModel,
};
export type { EditorialWorkspaceLink } from "@/types/editorial-workspace";
