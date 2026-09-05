import Link from "next/link";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { ArticleListClient } from "@/components/admin/ArticleListClient";
import { getAdminWriteMode, listAdminArticles } from "@/lib/admin";

export default async function AdminArticlesPage() {
  const articles = await listAdminArticles();
  const writeMode = getAdminWriteMode();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)]">Articles</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{articles.length} Article V1 records</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white"
        >
          New Article
        </Link>
      </div>
      <AdminWriteBanner writeMode={writeMode} />
      <ArticleListClient articles={articles} />
    </div>
  );
}
