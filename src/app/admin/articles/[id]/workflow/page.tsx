import { notFound } from "next/navigation";
import { EditorialWorkflowPanel } from "@/components/admin/EditorialWorkflowPanel";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getEditorialWorkflowRoles } from "@/lib/admin/auth-config";
import { listAdminArticleIds } from "@/lib/admin";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";
import { getWorkflowStatus } from "@/lib/editorial-workflow";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminArticleIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

export default async function AdminArticleWorkflowPage({ params }: PageProps) {
  const { id } = await params;
  const workspace = await getEditorialWorkspace("article", id);
  if (!workspace) notFound();

  const { email } = await requireAdmin();
  const workflow = (await getWorkflowStatus("article", id)) ?? null;

  return (
    <EditorialWorkspaceShell
      entityType="article"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="workflow"
      listHref="/admin/articles"
      listLabel="Articles"
    >
      <EditorialWorkflowPanel
        entityType="article"
        entityId={id}
        entityLabel={workspace.entityName}
        initialWorkflow={workflow}
        roles={getEditorialWorkflowRoles(email)}
      />
    </EditorialWorkspaceShell>
  );
}
