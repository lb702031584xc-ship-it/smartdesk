import Link from "next/link";
import { AIRecommendationQueuePanel } from "@/components/intelligence/AIRecommendationPanels";
import { getRecommendationQueue } from "@/lib/ai-recommendation-resolver";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";

/**
 * Phase 41 — AI Recommendation Intelligence queue.
 * Read-only operational priority from existing signals.
 */
export default async function IntelligenceRecommendationsPage() {
  const queue = await getRecommendationQueue(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Recommendations
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Prioritized operational intelligence from content gaps, commerce
          signals, topic coverage, and pending AI suggestions. Scores are
          transparent — no automatic actions.
        </p>
      </div>

      <AIRecommendationQueuePanel queue={queue} />

      <IntelligenceSection
        title="Decision flow"
        description="Governance preserved — recommendations never bypass mutation boundaries."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Signal → AI Recommendation Scoring → Priority Queue</li>
          <li>Operator reviews reason and impact</li>
          <li>
            When linked to an AI suggestion → review on{" "}
            <Link
              href="/dashboard/intelligence/ai"
              className="underline-offset-2 hover:underline"
            >
              AI Suggestions
            </Link>
          </li>
          <li>Human accept → existing mutation / workflow path</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Content intelligence overview
          </Link>
          {" · "}
          <Link
            href="/dashboard/editorial"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Editorial operations
          </Link>
        </p>
      </IntelligenceSection>
    </div>
  );
}
