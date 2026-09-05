import { ContentOverviewCard } from "@/components/intelligence/ContentOverviewCard";
import { CoverageStatusCard } from "@/components/intelligence/CoverageStatusCard";
import { CommerceSignalsCard } from "@/components/intelligence/CommerceSignalsCard";
import { SignalBadge } from "@/components/intelligence/SignalBadge";
import { getContentOverviewViewModel } from "@/lib/content-dashboard";

export default async function IntelligenceOverviewPage() {
  const overview = await getContentOverviewViewModel();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Content Intelligence
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Read-only overview of coverage, orphans, and commerce signals. No editing.
        </p>
        <div className="mt-3">
          <SignalBadge
            label={
              overview.integrity.valid
                ? "Graph integrity PASS"
                : `Graph integrity FAIL (${overview.integrity.errors.length})`
            }
            tone={overview.integrity.valid ? "ok" : "bad"}
          />
        </div>
      </div>

      <ContentOverviewCard overview={overview} />
      <CoverageStatusCard overview={overview} />
      <CommerceSignalsCard overview={overview} />
    </div>
  );
}
