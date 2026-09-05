import type { TopicCluster } from "@/types/content-graph";

type NativeArticleTopicNavigationProps = {
  topic: TopicCluster | null;
};

/**
 * Topic cluster foundation display (topicId only — no AI copy).
 * Exposed for native path / future navigation; does not auto-insert body links.
 */
export function NativeArticleTopicNavigation({
  topic,
}: NativeArticleTopicNavigationProps) {
  if (!topic) return null;

  return (
    <aside
      className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] px-5 py-4 text-sm text-[var(--muted)]"
      aria-label="Topic cluster"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
        Topic
      </p>
      <p className="mt-1 font-medium text-[var(--ink)]">{topic.topicId}</p>
      <p className="mt-1">
        {topic.articleIds.length} articles · {topic.productIds.length} products
      </p>
    </aside>
  );
}
