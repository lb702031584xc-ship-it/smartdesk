import { ReviewQueuePanel } from "@/components/intelligence/EditorialActivityPanels";
import { getReviewQueueViewModel } from "@/lib/editorial-dashboard";

export default async function IntelligenceReviewsPage() {
  const queue = await getReviewQueueViewModel();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Review Queue
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Workflow items waiting for approval. Navigation only — no actions here.
        </p>
      </div>
      <ReviewQueuePanel queue={queue} />
    </div>
  );
}
