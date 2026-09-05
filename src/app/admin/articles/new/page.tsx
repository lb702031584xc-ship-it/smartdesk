import Link from "next/link";
import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { blankArticleV1 } from "@/lib/admin/blank-article";
import {
  articleCreateDisabledReason,
  getAdminWriteMode,
  isArticleCreateEnabled,
  listAdminArticles,
  listAdminProducts,
} from "@/lib/admin";
import { suggestArticleSlug } from "@/lib/admin/article-id";
import type { ArticleV1Type, ArticleSearchIntent } from "@/types/article-v1";

export default async function AdminNewArticlePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const writeMode = getAdminWriteMode();
  const createEnabled = isArticleCreateEnabled();
  const articles = await listAdminArticles();
  const products = await listAdminProducts();
  const productOptions = products.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category,
    rating: item.rating,
  }));

  // Prefill from planning opportunity query params
  const blank = blankArticleV1();
  const aiTitle = typeof params.ai_title === "string" ? params.ai_title : undefined;
  const aiType = typeof params.ai_type === "string" ? params.ai_type : undefined;
  const aiIntent = typeof params.ai_intent === "string" ? params.ai_intent : undefined;
  const aiCategory = typeof params.ai_category === "string" ? params.ai_category : undefined;
  const aiKeyword = typeof params.ai_keyword === "string" ? params.ai_keyword : undefined;
  const aiProductsParam = typeof params.ai_products === "string" ? params.ai_products : undefined;

  if (aiTitle) {
    const slug = suggestArticleSlug(aiTitle);
    blank.identity.title = aiTitle;
    blank.identity.id = slug;
    blank.identity.slug = slug;
  }
  if (aiType) blank.classification.type = aiType as ArticleV1Type;
  if (aiIntent) blank.editorial.intent = aiIntent as ArticleSearchIntent;
  if (aiCategory) blank.classification.category = aiCategory;
  if (aiKeyword) blank.seo = { ...blank.seo, primaryKeyword: aiKeyword };
  if (aiProductsParam) {
    blank.products = {
      ...blank.products,
      primary: aiProductsParam.split(",").filter(Boolean).map((id) => ({ productId: id })),
    };
  }

  return (
    <div>
      <Link
        href="/admin/articles"
        className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
      >
        ← Articles
      </Link>
      <AdminWriteBanner writeMode={writeMode} />
      {!createEnabled ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {articleCreateDisabledReason()}
        </p>
      ) : null}
      <ArticleEditorForm
        mode="create"
        article={blank}
        productOptions={productOptions}
        writeMode={writeMode}
        sourceFile=".json"
        existingArticleIds={articles.map((item) => item.id)}
        existingArticleSlugs={articles.map((item) => item.slug)}
        createEnabled={createEnabled}
        createDisabledReason={articleCreateDisabledReason()}
      />
    </div>
  );
}
