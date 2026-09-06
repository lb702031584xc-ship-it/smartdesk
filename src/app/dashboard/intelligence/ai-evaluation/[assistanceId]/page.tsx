import { notFound } from "next/navigation";
import { buildEvaluationRecord } from "@/lib/ai-evaluation";
import { AIEvaluationDetailPanel } from "@/components/intelligence/AIEvaluationDetailPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ assistanceId: string }>;
};

/**
 * Phase 46 — single Evaluation Record detail / trace.
 */
export default async function AIEvaluationDetailPage({ params }: PageProps) {
  const { assistanceId } = await params;
  const record = await buildEvaluationRecord(assistanceId);
  if (!record) notFound();
  return <AIEvaluationDetailPanel record={record} />;
}
