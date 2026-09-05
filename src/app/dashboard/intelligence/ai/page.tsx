import Link from "next/link";
import { AISuggestionQueuePanel } from "@/components/intelligence/AISuggestionPanels";
import { getPendingSuggestions } from "@/lib/ai-suggestions";
import {
  IntelligenceSection,
} from "@/components/intelligence/SignalBadge";

/**
 * Phase 40 — AI Assisted Operations review surface.
 * Accept/Reject only; no direct content editing.
 */
export default async function IntelligenceAIPage() {
  const queue = await getPendingSuggestions(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          AI Suggestions
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Decision-support recommendations. Accept uses existing mutation
          boundaries, revision, and workflow locks. AI never writes production
          content directly.
        </p>
      </div>

      <AISuggestionQueuePanel queue={queue} />

      <IntelligenceSection
        title="How acceptance works"
        description="Governance preserved."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Operator reviews proposed field change</li>
          <li>Accept → Phase 34/35 mutation boundary (or advisory acknowledge)</li>
          <li>Validation → revision snapshot → Neon save</li>
          <li>Workflow lock still blocks non-draft entities</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/reviews"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Editorial review queue
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
