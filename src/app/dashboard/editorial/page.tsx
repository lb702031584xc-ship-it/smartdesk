import Link from "next/link";
import {
  ActivityFeed,
  ReviewQueuePanel,
} from "@/components/intelligence/EditorialActivityPanels";
import { WorkspaceIndexHeader } from "@/components/editorial/EditorialWorkspacePanels";
import { getEditorialWorkspaceIndex } from "@/lib/editorial-workspace";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
} from "@/components/intelligence/SignalBadge";

export default async function EditorialOperationsPage() {
  const index = await getEditorialWorkspaceIndex();

  return (
    <div className="space-y-6">
      <WorkspaceIndexHeader />
      <ReviewQueuePanel queue={index.reviewQueue} />
      <ActivityFeed items={index.recentActivity} />
      <IntelligenceSection
        title="Intelligence surfaces"
        description="Corpus-level read models. Separate from entity workspaces."
      >
        <ul className="flex flex-wrap gap-2 text-sm">
          <li>
            <Link
              href="/dashboard/editorial/tasks"
              className="rounded-md px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Editorial tasks
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/intelligence/recommendations"
              className="rounded-md px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Recommendations
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/intelligence"
              className="rounded-md px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Coverage overview
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/intelligence/reviews"
              className="rounded-md px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Review intelligence
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/intelligence/changes"
              className="rounded-md px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
            >
              Change intelligence
            </Link>
          </li>
        </ul>
        {index.pendingCount === 0 && index.recentActivity.length === 0 ? (
          <div className="mt-4">
            <IntelligenceEmptyState message="No editorial operations recorded yet. Open a product or article workspace from Admin." />
          </div>
        ) : null}
      </IntelligenceSection>
    </div>
  );
}
