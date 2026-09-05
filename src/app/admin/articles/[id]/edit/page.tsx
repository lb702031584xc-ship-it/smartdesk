import { notFound } from "next/navigation";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { ArticleMetadataEditor } from "@/components/admin/ArticleMetadataEditor";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import {
  getAdminArticle,
  getAdminWriteMode,
  listAdminArticleIds,
} from "@/lib/admin";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminArticleIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

/**
 * Phase 35 — controlled Article metadata editor.
 * Editorial + SEO only. No Markdown / products / publishing.
 */
export default async function AdminArticleMetadataEditPage({
  params,
}: PageProps) {
  const { id } = await params;
  const [record, workspace] = await Promise.all([
    getAdminArticle(id),
    getEditorialWorkspace("article", id),
  ]);
  if (!record || !workspace) notFound();

  const writeMode = getAdminWriteMode();

  return (
    <EditorialWorkspaceShell
      entityType="article"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="edit"
      listHref="/admin/articles"
      listLabel="Articles"
    >
      <AdminWriteBanner writeMode={writeMode} />
      <ArticleMetadataEditor
        article={record.article}
        version={record.version}
        writeMode={writeMode}
      />
    </EditorialWorkspaceShell>
  );
}
