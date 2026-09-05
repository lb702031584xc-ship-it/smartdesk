import Link from "next/link";
import { AIAssistanceQueuePanel } from "@/components/intelligence/AIAssistancePanels";
import { getAssistanceQueue } from "@/lib/ai-assistance";
import { listAllFeedback } from "@/lib/ai-feedback-store";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import type { AIAssistanceFeedbackViewModel } from "@/types/ai-feedback";

/**
 * Phase 43/45 — AI assistance review + human evaluation surface.
 * Accept creates suggestion/task only; feedback is evaluation-only.
 */
export default async function IntelligenceAIAssistancePage() {
  const queue = await getAssistanceQueue(80);
  const feedbackByAssistanceId: Record<string, AIAssistanceFeedbackViewModel> =
    {};
  if (isDatabaseContentStore()) {
    const feedbacks = await listAllFeedback(200);
    for (const f of feedbacks) {
      feedbackByAssistanceId[f.assistanceId] = {
        id: f.id,
        assistanceId: f.assistanceId,
        disposition: f.disposition,
        reason: f.reason,
        note: f.note,
        createdBy: f.createdBy,
        createdAt: f.createdAt,
        updatedBy: f.updatedBy,
        updatedAt: f.updatedAt,
        assistanceType: null,
        entityType: null,
        entityId: null,
        assistanceStatus: null,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          AI Assistance
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Context-aware drafts for SEO, editorial, coverage, and internal
          links. Humans review every output. Accept never writes ProductV1 or
          ArticleV1. Structured feedback is evaluation only.
        </p>
      </div>

      <AIAssistanceQueuePanel
        queue={queue}
        feedbackByAssistanceId={feedbackByAssistanceId}
      />

      <IntelligenceSection
        title="Review flow"
        description="Governance preserved."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>SmartDesk context is assembled read-only</li>
          <li>Assistance draft is stored separately</li>
          <li>Operator accepts or rejects (governance handoff)</li>
          <li>Operator may add structured evaluation feedback</li>
          <li>Accept creates an AI suggestion or editorial task</li>
          <li>Existing mutation / workflow paths apply after that</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/ai-operations"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            AI operations + evaluation
          </Link>
        </p>
      </IntelligenceSection>
    </div>
  );
}
