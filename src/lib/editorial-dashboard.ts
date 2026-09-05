/**
 * Editorial Intelligence Dashboard read layer (Phase 37).
 * Read-only wrappers for dashboard UI. No mutations.
 */
import {
  getChangeSummaries,
  getPendingReviewItems,
  getPublishedChanges,
  getRecentEditorialActivity,
  getStaleArticles,
} from "@/lib/editorial-activity";
import type {
  ChangeSummaryViewModel,
  EditorialActivityViewModel,
  EditorialIntelligenceOverview,
  PublishedChangeViewModel,
  ReviewQueueViewModel,
  StaleContentItemViewModel,
} from "@/types/editorial-activity";

export async function getEditorialActivityViewModel(
  limit = 40,
): Promise<EditorialActivityViewModel[]> {
  return getRecentEditorialActivity(limit);
}

export async function getReviewQueueViewModel(): Promise<ReviewQueueViewModel> {
  return getPendingReviewItems();
}

export async function getChangeSummaryViewModel(
  limit = 30,
): Promise<ChangeSummaryViewModel[]> {
  return getChangeSummaries(limit);
}

export async function getPublishedChangesViewModel(
  limit = 30,
): Promise<PublishedChangeViewModel[]> {
  return getPublishedChanges(limit);
}

export async function getStaleContentViewModel(): Promise<
  StaleContentItemViewModel[]
> {
  return getStaleArticles();
}

export async function getEditorialIntelligenceOverview(): Promise<EditorialIntelligenceOverview> {
  const [
    recentActivity,
    reviewQueue,
    recentChanges,
    recentlyPublished,
    staleArticles,
  ] = await Promise.all([
    getRecentEditorialActivity(25),
    getPendingReviewItems(),
    getChangeSummaries(20),
    getPublishedChanges(15),
    getStaleArticles(),
  ]);

  return {
    recentActivity,
    reviewQueue,
    recentChanges,
    recentlyPublished,
    staleArticles,
  };
}

export type {
  EditorialActivityViewModel,
  ReviewQueueViewModel,
  ChangeSummaryViewModel,
  EditorialIntelligenceOverview,
};
