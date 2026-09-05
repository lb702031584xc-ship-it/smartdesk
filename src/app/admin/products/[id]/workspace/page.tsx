import { notFound } from "next/navigation";
import { EditorialWorkflowPanel } from "@/components/admin/EditorialWorkflowPanel";
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
import { buildWorkspaceAIContext } from "@/lib/ai-context";
import { getEntityOperationalSummary } from "@/lib/ai-operational-intelligence";
import { getEntityTasks } from "@/lib/editorial-tasks";
import { listAdminProductIds } from "@/lib/admin";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";
import { getWorkflowStatus } from "@/lib/editorial-workflow";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminProductIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

/**
 * Phase 38 — unified product editorial workspace.
 * Composes workflow, activity, changes, and links to controlled edit paths.
 */
export default async function AdminProductWorkspacePage({ params }: PageProps) {
  const { id } = await params;
  const [
    workspace,
    suggestions,
    recommendations,
    tasks,
    assistance,
    context,
    aiOutcomes,
  ] = await Promise.all([
    getEditorialWorkspace("product", id),
    getSuggestionsForEntity("product", id),
    getEntityRecommendations("product", id),
    getEntityTasks("product", id),
    getAssistanceForEntity("product", id),
    buildWorkspaceAIContext("product", id),
    getEntityOperationalSummary("product", id),
  ]);
  if (!workspace) notFound();

  const { email } = await requireAdmin();
  const workflow = (await getWorkflowStatus("product", id)) ?? null;

  return (
    <EditorialWorkspaceShell
      entityType="product"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="overview"
      listHref="/admin/products"
      listLabel="Products"
    >
      <WorkspaceStatusPanel workspace={workspace} />
      <AIContextSummaryPanel context={context} />
      <AIEntityOutcomesPanel summary={aiOutcomes} />
      <AIAssistanceEntityPanel
        entityType="product"
        entityId={id}
        items={assistance}
      />
      <EditorialTaskEntityPanel
        tasks={tasks}
        entityType="product"
        entityId={id}
        actorEmail={email}
      />
      <AIRecommendationEntityPanel recommendations={recommendations} />
      <AISuggestionEntityPanel suggestions={suggestions} />
      <WorkspaceLinksPanel links={workspace.links} />
      <EditorialWorkflowPanel
        entityType="product"
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
