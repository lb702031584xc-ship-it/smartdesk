import Link from "next/link";
import { AIAssistanceQueuePanel } from "@/components/intelligence/AIAssistancePanels";
import { getAssistanceQueue } from "@/lib/ai-assistance";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";

/**
 * Phase 43 — AI assistance review surface.
 * Accept creates suggestion/task only; no canonical writes.
 */
export default async function IntelligenceAIAssistancePage() {
  const queue = await getAssistanceQueue(80);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          AI Assistance
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Context-aware drafts for SEO, editorial, coverage, and internal
          links. Humans review every output. Accept never writes ProductV1 or
          ArticleV1.
        </p>
      </div>

      <AIAssistanceQueuePanel queue={queue} />

      <IntelligenceSection
        title="Review flow"
        description="Governance preserved."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>SmartDesk context is assembled read-only</li>
          <li>Assistance draft is stored separately</li>
          <li>Operator reviews, then accepts or rejects</li>
          <li>Accept creates an AI suggestion or editorial task</li>
          <li>Existing mutation / workflow paths apply after that</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/ai"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            AI suggestions
          </Link>
          {" · "}
          <Link
            href="/dashboard/editorial/tasks"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Editorial tasks
          </Link>
        </p>
      </IntelligenceSection>
    </div>
  );
}
