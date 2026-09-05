import { ArticleHeader } from "@/components/article/ArticleHeader";
import { FAQ } from "@/components/article/FAQ";
import { InternalLinks } from "@/components/article/InternalLinks";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";

type GuideTemplateProps = {
  article: ResolvedArticle;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

export function GuideTemplate({
  article,
  categoryName,
  categoryHref,
  relatedPosts = [],
}: GuideTemplateProps) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
      <ArticleHeader
        article={article}
        categoryName={categoryName}
        categoryHref={categoryHref}
      />

      <div
        className="prose prose-smartdesk mt-10 max-w-none prose-headings:font-[family-name:var(--font-display)]"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />

      <div className="mt-14">
        <FAQ items={article.faq} />
      </div>

      <InternalLinks
        className="mt-14"
        links={article.related}
        posts={relatedPosts}
      />
    </article>
  );
}
