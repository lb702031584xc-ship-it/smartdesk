import type {
  AIOperationalOverview,
  AIOutcomeViewModel,
  AssistanceTypePerformance,
  EntityAIOutcomeSummary,
  RecommendationOutcomeViewModel,
  SuggestionOutcomeViewModel,
} from "@/types/ai-outcome";
import {
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

function pct(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function signalTone(
  signal: AssistanceTypePerformance["signal"],
): "neutral" | "ok" | "warn" | "bad" {
  if (signal === "high-acceptance") return "ok";
  if (signal === "low-acceptance") return "warn";
  if (signal === "mixed") return "neutral";
  return "neutral";
}

function signalLabel(signal: AssistanceTypePerformance["signal"]): string {
  if (signal === "high-acceptance") return "High acceptance rate";
  if (signal === "low-acceptance") return "Low acceptance rate";
  if (signal === "mixed") return "Mixed acceptance";
  return "Insufficient data";
}

function outcomeTone(
  outcome: AIOutcomeViewModel["outcome"],
): "neutral" | "ok" | "warn" | "bad" {
  if (outcome === "applied" || outcome === "completed") return "ok";
  if (outcome === "rejected") return "bad";
  if (outcome === "unknown") return "warn";
  return "neutral";
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md bg-[var(--canvas)] px-3 py-2 ring-1 ring-[var(--line)]"
        >
          <dt className="text-xs text-[var(--subtle)]">{item.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--ink)]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProvenanceLine({ outcome }: { outcome: AIOutcomeViewModel }) {
  if (outcome.provenance.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-[var(--subtle)]">
      {outcome.provenance
        .map((hop) => `${hop.kind}:${hop.id.slice(0, 8)} (${hop.status ?? "—"})`)
        .join(" → ")}
    </p>
  );
}

export function AIOperationalDashboardPanel({
  overview,
}: {
  overview: AIOperationalOverview;
}) {
  const { metrics, recommendationMetrics, suggestionMetrics } = overview;

  return (
    <div className="space-y-6">
      <IntelligenceSection
        title="AI Assistance"
        description="Counts from ai_assistance_outputs. Observational only."
      >
        <MetricGrid
          items={[
            { label: "Generated", value: metrics.totalAssistance },
            { label: "Accepted", value: metrics.acceptedAssistance },
            { label: "Rejected", value: metrics.rejectedAssistance },
            { label: "Pending", value: metrics.pendingAssistance },
            {
              label: "Acceptance rate",
              value: pct(metrics.acceptanceRate),
            },
          ]}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Downstream Conversion"
        description="From durable suggestion_id / task_id links only."
      >
        <MetricGrid
          items={[
            { label: "Suggestions created", value: metrics.suggestionsCreated },
            { label: "Tasks created", value: metrics.tasksCreated },
            { label: "Suggestions applied", value: metrics.suggestionsApplied },
            { label: "Tasks completed", value: metrics.tasksCompleted },
          ]}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Recommendation Operations"
        description="Conversion via editorial_tasks source_type=ai-recommendation. Descriptive — not success claims."
      >
        <MetricGrid
          items={[
            {
              label: "Live recommendations",
              value: recommendationMetrics.liveRecommendations,
            },
            {
              label: "Converted to tasks",
              value: recommendationMetrics.convertedToTasks,
            },
            {
              label: "Tasks still open",
              value: recommendationMetrics.tasksStillOpen,
            },
            {
              label: "Tasks completed",
              value: recommendationMetrics.tasksCompleted,
            },
          ]}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Suggestion Outcomes"
        description="Applied only when mutation_revision_id is stored."
      >
        <MetricGrid
          items={[
            { label: "Pending", value: suggestionMetrics.pending },
            { label: "Accepted", value: suggestionMetrics.accepted },
            { label: "Rejected", value: suggestionMetrics.rejected },
            { label: "Applied (revision)", value: suggestionMetrics.applied },
            {
              label: "Accepted advisory",
              value: suggestionMetrics.acceptedAdvisory,
            },
            { label: "Expired", value: suggestionMetrics.expired },
          ]}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Assistance Types"
        description="Operational acceptance rates — not quality judgments."
      >
        <AssistanceTypeTable rows={overview.assistancePerformance} />
      </IntelligenceSection>

      <IntelligenceSection
        title="Recent Assistance Outcomes"
        description="Provenance preserved per row."
      >
        <OutcomeList items={overview.recentOutcomes.slice(0, 24)} />
      </IntelligenceSection>

      <IntelligenceSection
        title="Recommendation Conversions"
        description="Historical task links included even when live recommendation no longer resolves."
      >
        <RecommendationConversionList
          items={overview.recommendationConversions.slice(0, 24)}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Suggestion Detail"
        description="Revision relationship reported only when stored."
      >
        <SuggestionOutcomeList
          items={overview.suggestionOutcomes.slice(0, 24)}
        />
      </IntelligenceSection>
    </div>
  );
}

function AssistanceTypeTable({ rows }: { rows: AssistanceTypePerformance[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--subtle)]">
          <tr>
            <th className="py-2 pr-3 font-semibold">Type</th>
            <th className="py-2 pr-3 font-semibold">Generated</th>
            <th className="py-2 pr-3 font-semibold">Accepted</th>
            <th className="py-2 pr-3 font-semibold">Rejected</th>
            <th className="py-2 pr-3 font-semibold">Rate</th>
            <th className="py-2 font-semibold">Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.assistanceType} className="border-t border-[var(--line)]">
              <td className="py-2 pr-3 text-[var(--ink)]">{row.assistanceType}</td>
              <td className="py-2 pr-3">{row.generated}</td>
              <td className="py-2 pr-3">{row.accepted}</td>
              <td className="py-2 pr-3">{row.rejected}</td>
              <td className="py-2 pr-3">{pct(row.acceptanceRate)}</td>
              <td className="py-2">
                <SignalBadge
                  label={signalLabel(row.signal)}
                  tone={signalTone(row.signal)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutcomeList({ items }: { items: AIOutcomeViewModel[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No assistance outcomes yet.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={`${item.sourceType}:${item.sourceId}`}
          className="rounded-md bg-[var(--canvas)] px-3 py-2 ring-1 ring-[var(--line)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SignalBadge label={item.outcome} tone={outcomeTone(item.outcome)} />
            <span className="text-sm font-medium text-[var(--ink)]">
              {item.assistanceType ?? item.sourceType}
            </span>
            <span className="text-xs text-[var(--subtle)]">
              {item.entityType}/{item.entityId}
            </span>
          </div>
          <ProvenanceLine outcome={item} />
        </li>
      ))}
    </ul>
  );
}

function RecommendationConversionList({
  items,
}: {
  items: RecommendationOutcomeViewModel[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No recommendation → task links observed.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={`${item.recommendationId}:${item.taskId ?? "none"}`}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <SignalBadge label={item.conversion} />
          <span className="font-mono text-xs text-[var(--muted)]">
            {item.recommendationId.slice(0, 40)}
            {item.recommendationId.length > 40 ? "…" : ""}
          </span>
          {item.taskId ? (
            <span className="text-xs text-[var(--subtle)]">
              task {item.taskId.slice(0, 8)} · {item.taskStatus}
            </span>
          ) : (
            <span className="text-xs text-[var(--subtle)]">no task</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function SuggestionOutcomeList({
  items,
}: {
  items: SuggestionOutcomeViewModel[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No suggestion outcomes yet.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.suggestionId}
          className="rounded-md bg-[var(--canvas)] px-3 py-2 text-sm ring-1 ring-[var(--line)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SignalBadge label={item.outcome} tone={outcomeTone(item.outcome)} />
            <span className="text-[var(--ink)]">{item.status}</span>
            <span className="text-xs text-[var(--subtle)]">
              {item.entityType}/{item.entityId}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--subtle)]">
            {item.provenance
              .map(
                (hop) =>
                  `${hop.kind}:${hop.id.slice(0, 8)} (${hop.status ?? "—"})`,
              )
              .join(" → ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Read-only workspace summary — no AI execution controls.
 */
export function AIEntityOutcomesPanel({
  summary,
}: {
  summary: EntityAIOutcomeSummary;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="text-sm font-semibold text-[var(--ink)]">AI Outcomes</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Observational summary from assistance → suggestion/task evidence.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-[var(--subtle)]">Assistance outputs</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.assistanceCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--subtle)]">Accepted</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.acceptedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--subtle)]">Rejected</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.rejectedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--subtle)]">Pending</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.pendingCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--subtle)]">Tasks completed</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.tasksCompleted}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--subtle)]">Suggestions applied</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {summary.suggestionsApplied}
          </dd>
        </div>
      </dl>
      {summary.outcomes.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
          {summary.outcomes.slice(0, 8).map((outcome) => (
            <li key={outcome.sourceId} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SignalBadge
                  label={outcome.outcome}
                  tone={outcomeTone(outcome.outcome)}
                />
                <span className="text-[var(--ink)]">
                  {outcome.assistanceType ?? "assistance"}
                </span>
              </div>
              <ProvenanceLine outcome={outcome} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No AI assistance outcomes for this entity yet.
        </p>
      )}
    </section>
  );
}
