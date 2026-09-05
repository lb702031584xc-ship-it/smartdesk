import Link from "next/link";
import { AIOperationalDashboardPanel } from "@/components/intelligence/AIOperationalPanels";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";
import { getAIOperationalOverview } from "@/lib/ai-operational-intelligence";

/**
 * Phase 44 — AI operational intelligence dashboard.
 * Read-only observational metrics. No mutation or learning controls.
 */
export default async function IntelligenceAIOperationsPage() {
  const overview = await getAIOperationalOverview(120);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          AI Operations
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Observational feedback on assistance, suggestions, recommendations,
          and tasks. Unknown relationships stay unknown. Nothing here changes
          prompts, scores, or canonical content.
        </p>
      </div>

      <AIOperationalDashboardPanel overview={overview} />

      <IntelligenceSection
        title="Evidence rules"
        description="Phase 44 does not invent causality."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>
            Assistance → suggestion/task only via stored suggestion_id / task_id
          </li>
          <li>
            Applied only when suggestion.mutation_revision_id is present
          </li>
          <li>
            Recommendation conversion only via task source_type /
            source_id
          </li>
          <li>Entity workflow status is shown when available; not AI-linked</li>
        </ul>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/ai-assistance"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Assistance
          </Link>
          {" · "}
          <Link
            href="/dashboard/intelligence/ai"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Suggestions
          </Link>
          {" · "}
          <Link
            href="/dashboard/intelligence/recommendations"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Recommendations
          </Link>
          {" · "}
          <Link
            href="/dashboard/editorial/tasks"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Tasks
          </Link>
        </p>
      </IntelligenceSection>
    </div>
  );
}
