import { JsonLd } from "@/components/article/JsonLd";
import { ArticleTemplateRenderer } from "@/components/article/templates/ArticleTemplateRenderer";
import { NativeArticleMetadata } from "@/components/article/native/NativeArticleMetadata";
import { viewModelToLegacyResolvedArticle } from "@/lib/article-renderer";
import { buildArticleJsonLd } from "@/lib/seo";
import type { ArticleMeta } from "@/types/article";
import type { ArticleViewModel } from "@/types/article-view-model";

type NativeArticleRendererProps = {
  view: ArticleViewModel;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

/**
 * Native ArticleV1 renderer.
 *
 * Data path is native (ArticleViewModel). Presentation reuses existing templates
 * via a parity bridge so public HTML/SEO stay identical — no UI redesign.
 */
export function NativeArticleRenderer({
  view,
  categoryName,
  categoryHref,
  relatedPosts = [],
}: NativeArticleRendererProps) {
  const legacyArticle = viewModelToLegacyResolvedArticle(view);

  return (
    <>
      <JsonLd data={buildArticleJsonLd(legacyArticle)} />
      <NativeArticleMetadata view={view} />
      <ArticleTemplateRenderer
        article={legacyArticle}
        categoryName={categoryName}
        categoryHref={categoryHref}
        relatedPosts={relatedPosts}
      />
    </>
  );
}
