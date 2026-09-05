import React, { type ReactNode } from "react";
import type {
  ProductCoverageStatus,
} from "@/types/content-dashboard";
import type { TopicCoverageLevel } from "@/types/content-intelligence";

type SignalBadgeProps = {
  label: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
};

const TONE_CLASS: Record<NonNullable<SignalBadgeProps["tone"]>, string> = {
  neutral: "bg-[var(--canvas)] text-[var(--muted)] ring-[var(--line)]",
  ok: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  warn: "bg-amber-50 text-amber-950 ring-amber-200",
  bad: "bg-red-50 text-red-900 ring-red-200",
};

export function SignalBadge({ label, tone = "neutral" }: SignalBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export function topicCoverageTone(
  status: TopicCoverageLevel,
): SignalBadgeProps["tone"] {
  if (status === "good") return "ok";
  if (status === "thin") return "warn";
  return "bad";
}

export function topicCoverageLabel(status: TopicCoverageLevel): string {
  if (status === "good") return "Healthy";
  if (status === "thin") return "Thin";
  if (status === "needs-expansion") return "Needs Expansion";
  return "Empty";
}

export function productCoverageTone(
  status: ProductCoverageStatus,
): SignalBadgeProps["tone"] {
  if (status === "covered") return "ok";
  if (status === "thin") return "warn";
  return "bad";
}

export function productCoverageLabel(status: ProductCoverageStatus): string {
  if (status === "covered") return "Strong";
  if (status === "thin") return "Thin";
  return "Missing Content";
}

type IntelligenceSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function IntelligenceSection({
  title,
  description,
  children,
}: IntelligenceSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="mb-4 border-b border-[var(--line)] pb-3">
        <h2 className="text-lg font-semibold text-[var(--ink)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function IntelligenceEmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-[var(--line)] bg-[var(--canvas)] px-4 py-6 text-center text-sm text-[var(--muted)]">
      {message}
    </p>
  );
}
