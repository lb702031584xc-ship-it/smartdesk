import { notFound } from "next/navigation";
import { ArticleHistoryClient } from "@/components/admin/ArticleHistoryClient";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import {
  getAdminArticle,
  getAdminWriteMode,
  listAdminArticleIds,
} from "@/lib/admin";
import { listArticleRevisionItems } from "@/lib/admin/revision-store";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminArticleIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

export default async function AdminArticleHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const [record, workspace] = await Promise.all([
    getAdminArticle(id),
    getEditorialWorkspace("article", id),
  ]);
  if (!record || !workspace) notFound();

  const revisions = await listArticleRevisionItems(id);
  const writeMode = getAdminWriteMode();

  return (
    <EditorialWorkspaceShell
      entityType="article"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="history"
      listHref="/admin/articles"
      listLabel="Articles"
    >
      <AdminWriteBanner writeMode={writeMode} />
      <ArticleHistoryClient
        articleId={id}
        title={record.article.identity.title}
        currentVersion={record.version}
        revisions={revisions}
      />
    </EditorialWorkspaceShell>
  );
}
