import Link from "next/link";
import { auth } from "@/auth";
import { EditorialTaskQueuePanel } from "@/components/editorial/EditorialTaskPanels";
import { getTaskQueue } from "@/lib/editorial-tasks";
import type { EditorialTaskSourceType } from "@/types/editorial-task";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";

type PageProps = {
  searchParams: Promise<{ source?: string }>;
};

const SOURCE_FILTERS: { id: EditorialTaskSourceType | "all"; label: string }[] =
  [
    { id: "all", label: "All sources" },
    { id: "ai-recommendation", label: "AI Recommendation" },
    { id: "ai-suggestion", label: "AI Suggestion" },
    { id: "ai-assistance", label: "AI Assistance" },
    { id: "manual", label: "Manual" },
  ];

/**
 * Phase 42 — Editorial task operations dashboard.
 */
export default async function EditorialTasksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sourceParam = params.source ?? "all";
  const sourceFilter =
    sourceParam === "ai-recommendation" ||
    sourceParam === "ai-suggestion" ||
    sourceParam === "ai-assistance" ||
    sourceParam === "manual"
      ? sourceParam
      : "all";

  const session = await auth();
  const queue = await getTaskQueue(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Editorial Tasks
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Track operational work from AI recommendations, suggestions, or manual
          follow-ups. Completing a task confirms human work is done — it does
          not mutate content or bypass workflow.
        </p>
      </div>

      <IntelligenceSection title="Filter by source">
        <ul className="flex flex-wrap gap-2 text-sm">
          {SOURCE_FILTERS.map((filter) => {
            const active = sourceFilter === filter.id;
            const href =
              filter.id === "all"
                ? "/dashboard/editorial/tasks"
                : `/dashboard/editorial/tasks?source=${filter.id}`;
            return (
              <li key={filter.id}>
                <Link
                  href={href}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    active
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
                  }`}
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </IntelligenceSection>

      <EditorialTaskQueuePanel
        queue={queue}
        actorEmail={session?.user?.email ?? undefined}
        sourceFilter={sourceFilter}
      />

      <IntelligenceSection title="Task flow" description="Governance preserved.">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>AI Recommendation or Suggestion → Create Editorial Task</li>
          <li>Assign and update status (open → in-progress → review → completed)</li>
          <li>Perform actual edits via controlled mutation paths</li>
          <li>Complete task when operational work is confirmed — no auto-accept</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/recommendations"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Recommendations queue
          </Link>
          {" · "}
          <Link
            href="/dashboard/intelligence/ai"
            className="text-[var(--muted)] underline-offset-2 hover:underline"
          >
            AI suggestions
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
