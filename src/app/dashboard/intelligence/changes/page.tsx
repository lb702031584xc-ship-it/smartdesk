import { ChangeSummaryList } from "@/components/intelligence/EditorialActivityPanels";
import { getChangeSummaryViewModel } from "@/lib/editorial-dashboard";

export default async function IntelligenceChangesPage() {
  const changes = await getChangeSummaryViewModel(40);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Editorial Changes
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Before/after summaries for allowlisted editorial and SEO fields. No
          revert.
        </p>
      </div>
      <ChangeSummaryList changes={changes} />
    </div>
  );
}
