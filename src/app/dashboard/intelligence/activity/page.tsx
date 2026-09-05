import {
  ActivityFeed,
  PublishedChangesPanel,
  StaleContentPanel,
} from "@/components/intelligence/EditorialActivityPanels";
import {
  getEditorialActivityViewModel,
  getPublishedChangesViewModel,
  getStaleContentViewModel,
} from "@/lib/editorial-dashboard";

export default async function IntelligenceActivityPage() {
  const [activity, published, stale] = await Promise.all([
    getEditorialActivityViewModel(40),
    getPublishedChangesViewModel(15),
    getStaleContentViewModel(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Editorial Activity
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          What changed, who changed it, and what was recently published. Read-only.
        </p>
      </div>
      <ActivityFeed items={activity} />
      <PublishedChangesPanel items={published} />
      <StaleContentPanel items={stale} />
    </div>
  );
}
