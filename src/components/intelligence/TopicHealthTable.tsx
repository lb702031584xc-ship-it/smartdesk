import React from "react";
import type { TopicHealthViewModel } from "@/types/content-dashboard";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
  topicCoverageLabel,
  topicCoverageTone,
} from "@/components/intelligence/SignalBadge";

type TopicHealthTableProps = {
  topics: TopicHealthViewModel[];
};

export function TopicHealthTable({ topics }: TopicHealthTableProps) {
  if (topics.length === 0) {
    return (
      <IntelligenceSection title="Topic Health">
        <IntelligenceEmptyState message="No topics found in the content graph." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Topic Health"
      description="Coverage derived from parentTopic / category clusters."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--subtle)]">
            <tr>
              <th className="px-2 py-2 font-semibold">Topic</th>
              <th className="px-2 py-2 font-semibold">Articles</th>
              <th className="px-2 py-2 font-semibold">Products</th>
              <th className="px-2 py-2 font-semibold">Coverage</th>
              <th className="px-2 py-2 font-semibold">Expansion</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.topic} className="border-b border-[var(--line)]">
                <td className="px-2 py-3 font-medium text-[var(--ink)]">{topic.topic}</td>
                <td className="px-2 py-3 text-[var(--muted)]">{topic.articleCount}</td>
                <td className="px-2 py-3 text-[var(--muted)]">{topic.productCount}</td>
                <td className="px-2 py-3">
                  <SignalBadge
                    label={topicCoverageLabel(topic.coverageStatus)}
                    tone={topicCoverageTone(topic.coverageStatus)}
                  />
                </td>
                <td className="px-2 py-3">
                  <SignalBadge
                    label={topic.expansionSignal ? "Yes" : "No"}
                    tone={topic.expansionSignal ? "warn" : "ok"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </IntelligenceSection>
  );
}
