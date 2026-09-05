import { notFound } from "next/navigation";
import { EditorialWorkflowPanel } from "@/components/admin/EditorialWorkflowPanel";
import { ContentStructurePanel } from "@/components/editorial/ContentStructurePanel";
import { AISuggestionEntityPanel } from "@/components/intelligence/AISuggestionPanels";
import { AIRecommendationEntityPanel } from "@/components/intelligence/AIRecommendationPanels";
import {
  AIAssistanceEntityPanel,
  AIContextSummaryPanel,
} from "@/components/intelligence/AIAssistancePanels";
import { AIEntityOutcomesPanel } from "@/components/intelligence/AIOperationalPanels";
import { EditorialTaskEntityPanel } from "@/components/editorial/EditorialTaskPanels";
import {
  WorkspaceActivityPanel,
  WorkspaceChangesPanel,
  WorkspaceLinksPanel,
  WorkspaceStatusPanel,
} from "@/components/editorial/EditorialWorkspacePanels";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getEditorialWorkflowRoles } from "@/lib/admin/auth-config";
import { getSuggestionsForEntity } from "@/lib/ai-suggestions";
import { getEntityRecommendations } from "@/lib/ai-recommendation-resolver";
import { getAssistanceForEntity } from "@/lib/ai-assistance";
import { getFeedbackForAssistance } from "@/lib/ai-feedback";
import { buildWorkspaceAIContext } from "@/lib/ai-context";
import { getEntityOperationalSummary } from "@/lib/ai-operational-intelligence";
import { getEntityTasks } from "@/lib/editorial-tasks";
import { listAdminArticleIds } from "@/lib/admin";
import { buildContentEditorViewModel } from "@/lib/content-editor";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";
import { getWorkflowStatus } from "@/lib/editorial-workflow";
import type { AIAssistanceFeedbackViewModel } from "@/types/ai-feedback";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminArticleIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

/**
 * Phase 38 — unified article editorial workspace.
 * Composes workflow, activity, changes, and links to controlled edit paths.
 */
export default async function AdminArticleWorkspacePage({ params }: PageProps) {
  const { id } = await params;
  const [
    workspace,
    contentEditor,
    suggestions,
    recommendations,
    tasks,
    assistance,
    context,
    aiOutcomes,
  ] = await Promise.all([
    getEditorialWorkspace("article", id),
    buildContentEditorViewModel(id),
    getSuggestionsForEntity("article", id),
    getEntityRecommendations("article", id),
    getEntityTasks("article", id),
    getAssistanceForEntity("article", id),
    buildWorkspaceAIContext("article", id),
    getEntityOperationalSummary("article", id),
  ]);
  if (!workspace || !contentEditor) notFound();

  const { email } = await requireAdmin();
  const workflow = (await getWorkflowStatus("article", id)) ?? null;

  const feedbackByAssistanceId: Record<string, AIAssistanceFeedbackViewModel> =
    {};
  await Promise.all(
    assistance.map(async (item) => {
      const fb = await getFeedbackForAssistance(item.id);
      if (fb) feedbackByAssistanceId[item.id] = fb;
    }),
  );

  return (
    <EditorialWorkspaceShell
      entityType="article"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="overview"
      listHref="/admin/articles"
      listLabel="Articles"
    >
      <WorkspaceStatusPanel workspace={workspace} />
      <ContentStructurePanel editor={contentEditor} />
      <AIContextSummaryPanel context={context} />
      <AIEntityOutcomesPanel summary={aiOutcomes} />
      <AIAssistanceEntityPanel
        entityType="article"
        entityId={id}
        items={assistance}
        feedbackByAssistanceId={feedbackByAssistanceId}
      />
      <EditorialTaskEntityPanel
        tasks={tasks}
        entityType="article"
        entityId={id}
        actorEmail={email}
      />
      <AIRecommendationEntityPanel recommendations={recommendations} />
      <AISuggestionEntityPanel suggestions={suggestions} />
      <WorkspaceLinksPanel links={workspace.links} />
      <EditorialWorkflowPanel
        entityType="article"
        entityId={id}
        entityLabel={workspace.entityName}
        initialWorkflow={workflow}
        roles={getEditorialWorkflowRoles(email)}
      />
      <WorkspaceActivityPanel workspace={workspace} />
      <WorkspaceChangesPanel workspace={workspace} />
    </EditorialWorkspaceShell>
  );
}
