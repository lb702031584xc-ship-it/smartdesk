import Link from "next/link";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";
import { EvaluationExportButtons } from "@/components/intelligence/EvaluationExportButtons";
import type { AIQualityAnalyticsViewModel } from "@/types/ai-evaluation";
import type { AIAssistanceType } from "@/types/ai-assistance";
import type { AIFeedbackDisposition, AIFeedbackReason } from "@/types/ai-feedback";
import type { EvaluationTimeRange } from "@/types/ai-evaluation";

function MetricGrid({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-3"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--subtle)]">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-[var(--ink)] text-white"
          : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--canvas)]"
      }`}
    >
      {label}
    </Link>
  );
}

function buildFilterHref(base: {
  range: string;
  type: string;
  disposition: string;
  reason: string;
}): string {
  const params = new URLSearchParams();
  if (base.range !== "all") params.set("range", base.range);
  if (base.type !== "all") params.set("type", base.type);
  if (base.disposition !== "all") params.set("disposition", base.disposition);
  if (base.reason !== "all") params.set("reason", base.reason);
  const q = params.toString();
  return q
    ? `/dashboard/intelligence/ai-evaluation?${q}`
    : "/dashboard/intelligence/ai-evaluation";
}

export function AIQualityAnalyticsPanel({
  analytics,
  active,
}: {
  analytics: AIQualityAnalyticsViewModel;
  active: {
    range: EvaluationTimeRange;
    type: AIAssistanceType | "all";
    disposition: AIFeedbackDisposition | "all" | "no-feedback";
    reason: AIFeedbackReason | "all";
  };
}) {
  const { overview, byAssistanceType, byReason, outcomeLinkage, editBurden } =
    analytics;

  return (
    <div className="space-y-8">
      <IntelligenceSection
        title="AI Quality Analytics (Phase 46)"
        description="Evaluation Dataset metrics. Analytics ≠ Optimization. No single AI quality score. Rates show (count / total); low sample is labeled."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["all", "All time"],
              ["7d", "7 days"],
              ["30d", "30 days"],
            ] as const
          ).map(([id, label]) => (
            <FilterChip
              key={id}
              label={label}
              active={active.range === id}
              href={buildFilterHref({ ...active, range: id })}
            />
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip
            label="All types"
            active={active.type === "all"}
            href={buildFilterHref({ ...active, type: "all" })}
          />
          {(
            [
              "seo",
              "content-improvement",
              "product-editorial",
              "internal-link",
            ] as const
          ).map((id) => (
            <FilterChip
              key={id}
              label={id}
              active={active.type === id}
              href={buildFilterHref({ ...active, type: id })}
            />
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip
            label="All dispositions"
            active={active.disposition === "all"}
            href={buildFilterHref({ ...active, disposition: "all" })}
          />
          {(
            [
              "accepted-as-is",
              "accepted-with-edits",
              "rejected",
              "not-actionable",
              "no-feedback",
            ] as const
          ).map((id) => (
            <FilterChip
              key={id}
              label={id}
              active={active.disposition === id}
              href={buildFilterHref({ ...active, disposition: id })}
            />
          ))}
        </div>
        <MetricGrid
          items={[
            { label: "Assistances", value: overview.assistanceCount },
            { label: "Eligible", value: overview.eligibleCount },
            { label: "Feedback coverage", value: overview.coverage.label },
            { label: "No feedback", value: overview.noFeedbackCount },
            { label: "Accepted as-is", value: overview.acceptedAsIs.label },
            {
              label: "Accepted w/ edits",
              value: overview.acceptedWithEdits.label,
            },
            { label: "Rejected", value: overview.rejected.label },
            { label: "Not actionable", value: overview.notActionable.label },
          ]}
        />
        <p className="mt-3 text-xs text-[var(--subtle)]">
          {analytics.metricDefinitions.coverage}{" "}
          {analytics.metricDefinitions.lowSample}
        </p>
        <div className="mt-4">
          <EvaluationExportButtons
            filters={{
              timeRange: active.range,
              assistanceType: active.type,
              disposition: active.disposition,
              reason: active.reason,
            }}
          />
        </div>
      </IntelligenceSection>

      <IntelligenceSection
        title="By assistance type"
        description="Coverage and disposition rates per type. Denominator for disposition rates = feedback count for that type."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--subtle)]">
              <tr>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Assistances</th>
                <th className="py-2 pr-3">Feedback</th>
                <th className="py-2 pr-3">Coverage</th>
                <th className="py-2 pr-3">As-is</th>
                <th className="py-2 pr-3">Edited</th>
                <th className="py-2 pr-3">Rejected</th>
                <th className="py-2">Not actionable</th>
              </tr>
            </thead>
            <tbody>
              {byAssistanceType.map((row) => (
                <tr
                  key={row.assistanceType}
                  className="border-t border-[var(--line)]"
                >
                  <td className="py-2 pr-3">{row.assistanceType}</td>
                  <td className="py-2 pr-3">{row.assistanceCount}</td>
                  <td className="py-2 pr-3">{row.feedbackCount}</td>
                  <td className="py-2 pr-3">{row.coverage.label}</td>
                  <td className="py-2 pr-3">{row.acceptedAsIs.label}</td>
                  <td className="py-2 pr-3">{row.acceptedWithEdits.label}</td>
                  <td className="py-2 pr-3">{row.rejected.label}</td>
                  <td className="py-2">{row.notActionable.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </IntelligenceSection>

      <IntelligenceSection
        title="By reason"
        description="Reason distribution among feedback rows (not among all assistances)."
      >
        {byReason.length === 0 ? (
          <IntelligenceEmptyState message="No feedback reasons in this filter window." />
        ) : (
          <ul className="space-y-2">
            {byReason.map((row) => (
              <li
                key={row.reason}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <SignalBadge label={row.reason} />
                <span className="text-[var(--ink)]">{row.label}</span>
                {row.topAssistanceType ? (
                  <span className="text-xs text-[var(--subtle)]">
                    top type: {row.topAssistanceType}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </IntelligenceSection>

      <IntelligenceSection
        title="Outcome linkage"
        description="Explicit IDs only. Unknown linkage ≠ failure. Accepted ≠ success. Task completed ≠ AI success."
      >
        <MetricGrid
          items={[
            { label: "Explicit linkage", value: outcomeLinkage.explicitCount },
            { label: "Unknown linkage", value: outcomeLinkage.unknownCount },
            {
              label: "Suggestion conversion",
              value: outcomeLinkage.suggestionConversion.label,
            },
            {
              label: "Task conversion",
              value: outcomeLinkage.taskConversion.label,
            },
            {
              label: "Task completion",
              value: outcomeLinkage.taskCompletion.label,
            },
            {
              label: "Suggestion applied",
              value: outcomeLinkage.suggestionApplied.label,
            },
          ]}
        />
      </IntelligenceSection>

      <IntelligenceSection
        title="Edit burden proxy"
        description={editBurden.note}
      >
        <MetricGrid
          items={[
            { label: "Available", value: editBurden.availableCount },
            { label: "Unavailable", value: editBurden.unavailableCount },
            {
              label: "Avg char Δ",
              value:
                editBurden.averageCharacterDelta === null
                  ? "n/a"
                  : editBurden.averageCharacterDelta,
            },
          ]}
        />
        {editBurden.availableCount === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Not available with current linkage for filtered records.
          </p>
        ) : null}
      </IntelligenceSection>

      <IntelligenceSection
        title="Evaluation records"
        description="One row per assistance. Feedback events do not duplicate rows."
      >
        {analytics.records.length === 0 ? (
          <IntelligenceEmptyState message="No evaluation records for these filters." />
        ) : (
          <ul className="space-y-2">
            {analytics.records.slice(0, 40).map((record) => (
              <li key={record.assistanceId}>
                <Link
                  href={`/dashboard/intelligence/ai-evaluation/${record.assistanceId}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:bg-[var(--canvas)]"
                >
                  <SignalBadge label={record.assistanceType} />
                  <span className="font-medium text-[var(--ink)]">
                    {record.entityType}/{record.entityId}
                  </span>
                  <span className="text-[var(--muted)]">
                    {record.feedback.disposition ??
                      (record.feedback.noFeedback ? "no-feedback" : "—")}
                  </span>
                  <span className="text-xs text-[var(--subtle)]">
                    {record.attribution.linkage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </IntelligenceSection>
    </div>
  );
}
