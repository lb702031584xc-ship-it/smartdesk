import Link from "next/link";
import {
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";
import type { AIEvaluationRecord } from "@/types/ai-evaluation";

export function AIEvaluationDetailPanel({
  record,
}: {
  record: AIEvaluationRecord;
}) {
  const draftTitle =
    record.output.structured &&
    typeof record.output.structured === "object" &&
    "title" in record.output.structured
      ? String((record.output.structured as { title?: string }).title ?? "")
      : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--subtle)]">
          Evaluation detail
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)]">
          {draftTitle || record.assistanceId}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Explains why this assistance contributes to Quality Analytics metrics.
          Snapshot version {record.snapshot.version} · {record.snapshot.mode}
        </p>
        <p className="mt-2">
          <Link
            href="/dashboard/intelligence/ai-evaluation"
            className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
          >
            ← Back to Quality Analytics
          </Link>
        </p>
      </div>

      <IntelligenceSection title="Assistance" description="Identity and status">
        <ul className="space-y-1 text-sm text-[var(--ink)]">
          <li>
            <SignalBadge label={record.assistanceType} />{" "}
            <SignalBadge label={record.assistanceStatus} />
          </li>
          <li>
            Entity: {record.entityType}/{record.entityId}
          </li>
          <li>Generated: {record.generatedAt}</li>
          <li className="font-mono text-xs text-[var(--subtle)]">
            {record.assistanceId}
          </li>
        </ul>
      </IntelligenceSection>

      <IntelligenceSection
        title="Generation metadata"
        description="Known provenance only — missing fields are not-recorded / unknown (never guessed)."
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ["Provider", record.generation.provider],
              ["Model", record.generation.model],
              ["Prompt key", record.generation.promptKey],
              ["Prompt version", record.generation.promptVersion],
              ["Context version", record.generation.contextVersion],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[var(--subtle)]">{k}</dt>
              <dd className="text-[var(--ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </IntelligenceSection>

      <IntelligenceSection
        title="Context summary"
        description="Assistance-time input_context (redacted). Not a live CMS join."
      >
        <p className="text-xs text-[var(--subtle)]">
          Hash: {record.context.hash}
        </p>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[var(--canvas)] p-3 text-xs text-[var(--ink)]">
          {record.context.serialized.slice(0, 4000)}
          {record.context.serialized.length > 4000 ? "…" : ""}
        </pre>
      </IntelligenceSection>

      <IntelligenceSection title="AI output" description="Stored draft payload">
        <pre className="max-h-64 overflow-auto rounded-md bg-[var(--canvas)] p-3 text-xs text-[var(--ink)]">
          {record.output.raw.slice(0, 4000)}
          {record.output.raw.length > 4000 ? "…" : ""}
        </pre>
      </IntelligenceSection>

      <IntelligenceSection
        title="Human feedback"
        description="No-feedback ≠ rejected. Feedback ≠ outcome."
      >
        {record.feedback.noFeedback ? (
          <p className="text-sm text-[var(--muted)]">
            No feedback yet (eligible terminal assistance without a feedback
            row).
          </p>
        ) : record.feedback.disposition ? (
          <ul className="space-y-1 text-sm">
            <li>
              Disposition:{" "}
              <SignalBadge label={record.feedback.disposition} />
            </li>
            <li>
              Reason:{" "}
              {record.feedback.reason ? (
                <SignalBadge label={record.feedback.reason} />
              ) : (
                "—"
              )}
            </li>
            <li>Actor: {record.feedback.actor ?? "—"}</li>
            <li>Created: {record.feedback.createdAt ?? "—"}</li>
            <li>Updated: {record.feedback.updatedAt ?? "—"}</li>
            {record.feedback.note ? (
              <li>Note: {record.feedback.note}</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Not eligible for feedback yet (draft/reviewed).
          </p>
        )}
      </IntelligenceSection>

      <IntelligenceSection
        title="Feedback history"
        description="Append-only create/update events. Events do not inflate feedback counts."
      >
        {record.feedbackHistory.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No feedback events.</p>
        ) : (
          <ol className="space-y-3">
            {record.feedbackHistory.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              >
                <p className="font-medium text-[var(--ink)]">
                  {event.action} · {event.actor}
                </p>
                <p className="text-xs text-[var(--subtle)]">{event.createdAt}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {event.previousDisposition ?? "—"}/{event.previousReason ?? "—"}{" "}
                  → {event.newDisposition}/{event.newReason}
                </p>
                {event.note ? (
                  <p className="mt-1 text-xs text-[var(--subtle)]">
                    Note: {event.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </IntelligenceSection>

      <IntelligenceSection
        title="Operational outcome"
        description="Explicit linkage only. Unknown ≠ failure."
      >
        <ul className="space-y-1 text-sm">
          <li>
            Attribution:{" "}
            <SignalBadge label={record.attribution.linkage} />
          </li>
          <li>Outcome: {record.outcome.outcome}</li>
          <li>Suggestion: {record.outcome.suggestionId ?? "—"}</li>
          <li>Suggestion status: {record.outcome.suggestionStatus ?? "—"}</li>
          <li>Task: {record.outcome.taskId ?? "—"}</li>
          <li>Task status: {record.outcome.taskStatus ?? "—"}</li>
          <li>Revision: {record.outcome.revisionId ?? "—"}</li>
        </ul>
      </IntelligenceSection>

      <IntelligenceSection
        title="Edit burden proxy"
        description={record.editBurden.note}
      >
        {record.editBurden.available ? (
          <p className="text-sm text-[var(--ink)]">
            Character Δ: {record.editBurden.characterDelta} · Normalized length
            Δ: {record.editBurden.normalizedLengthDelta}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Not available with current linkage.
          </p>
        )}
      </IntelligenceSection>
    </div>
  );
}
