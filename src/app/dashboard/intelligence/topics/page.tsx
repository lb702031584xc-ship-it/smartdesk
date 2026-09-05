import { TopicHealthTable } from "@/components/intelligence/TopicHealthTable";
import { getTopicHealthViewModels } from "@/lib/content-dashboard";

export default async function IntelligenceTopicsPage() {
  const topics = await getTopicHealthViewModels();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">Topic Health</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Topic clusters from Content Graph. Expansion signals are informational only.
        </p>
      </div>
      <TopicHealthTable topics={topics} />
    </div>
  );
}
