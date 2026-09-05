import type { ArticleViewModel } from "@/types/article-view-model";

type NativeArticleMetadataProps = {
  view: ArticleViewModel;
};

/**
 * Compact publishing / SEO metadata strip for native path (debug + future chrome).
 * Not shown as a redesign of the public template — used by native shell when needed.
 */
export function NativeArticleMetadata({ view }: NativeArticleMetadataProps) {
  return (
    <dl className="sr-only">
      <dt>Slug</dt>
      <dd>{view.article.identity.slug}</dd>
      <dt>Status</dt>
      <dd>{view.publishing.status}</dd>
      <dt>Canonical</dt>
      <dd>{view.seo.canonical}</dd>
      <dt>Meta title</dt>
      <dd>{view.seo.metaTitle}</dd>
    </dl>
  );
}
