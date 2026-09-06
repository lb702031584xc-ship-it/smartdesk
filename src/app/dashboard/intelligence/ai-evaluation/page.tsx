import { getAIQualityAnalytics } from "@/lib/ai-evaluation";
import { AIQualityAnalyticsPanel } from "@/components/intelligence/AIQualityAnalyticsPanel";
import type { AIAssistanceType } from "@/types/ai-assistance";
import type {
  AIFeedbackDisposition,
  AIFeedbackReason,
} from "@/types/ai-feedback";
import type { EvaluationTimeRange } from "@/types/ai-evaluation";
import { AI_FEEDBACK_DISPOSITIONS, AI_FEEDBACK_REASONS } from "@/types/ai-feedback";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    range?: string;
    type?: string;
    disposition?: string;
    reason?: string;
  }>;
};

function parseRange(value: string | undefined): EvaluationTimeRange {
  if (value === "7d" || value === "30d" || value === "all") return value;
  return "all";
}

function parseType(value: string | undefined): AIAssistanceType | "all" {
  if (
    value === "seo" ||
    value === "content-improvement" ||
    value === "product-editorial" ||
    value === "internal-link"
  ) {
    return value;
  }
  return "all";
}

function parseDisposition(
  value: string | undefined,
): AIFeedbackDisposition | "all" | "no-feedback" {
  if (value === "no-feedback") return value;
  if (
    value &&
    (AI_FEEDBACK_DISPOSITIONS as readonly string[]).includes(value)
  ) {
    return value as AIFeedbackDisposition;
  }
  return "all";
}

function parseReason(value: string | undefined): AIFeedbackReason | "all" {
  if (value && (AI_FEEDBACK_REASONS as readonly string[]).includes(value)) {
    return value as AIFeedbackReason;
  }
  return "all";
}

/**
 * Phase 46 — AI Quality Analytics / Evaluation Dataset dashboard.
 */
export default async function AIEvaluationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const type = parseType(params.type);
  const disposition = parseDisposition(params.disposition);
  const reason = parseReason(params.reason);

  const analytics = await getAIQualityAnalytics({
    timeRange: range,
    assistanceType: type,
    disposition,
    reason,
  });

  return (
    <AIQualityAnalyticsPanel
      analytics={analytics}
      active={{ range, type, disposition, reason }}
    />
  );
}
