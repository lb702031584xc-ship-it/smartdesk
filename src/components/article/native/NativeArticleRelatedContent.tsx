import Link from "next/link";
import type { ArticleViewRelatedArticle } from "@/types/article-view-model";

type NativeArticleRelatedContentProps = {
  relatedArticles: ArticleViewRelatedArticle[];
};

/**
 * Related articles from Content Graph (ID-resolved), not raw href-only lists.
 */
export function NativeArticleRelatedContent({
  relatedArticles,
}: NativeArticleRelatedContentProps) {
  if (relatedArticles.length === 0) return null;

  return (
    <section className="mt-14 border-t border-[var(--line)] pt-10" aria-labelledby="native-related">
      <h2
        id="native-related"
        className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]"
      >
        Related guides
      </h2>
      <ul className="mt-5 space-y-3">
        {relatedArticles.map((item) => (
          <li key={item.id}>
            <Link
              href={`/blog/${item.slug}`}
              className="text-base font-medium text-[var(--ink)] hover:underline"
            >
              {item.title}
            </Link>
            {item.summary ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{item.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
