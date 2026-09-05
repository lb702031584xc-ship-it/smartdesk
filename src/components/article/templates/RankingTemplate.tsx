import { AffiliateButton } from "@/components/AffiliateButton";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { FAQ } from "@/components/article/FAQ";
import { InternalLinks } from "@/components/article/InternalLinks";
import { ProductCard } from "@/components/article/ProductCard";
import { WinnerBox } from "@/components/article/WinnerBox";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";

type RankingTemplateProps = {
  article: ResolvedArticle;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

export function RankingTemplate({
  article,
  categoryName,
  categoryHref,
  relatedPosts = [],
}: RankingTemplateProps) {
  const products = [...article.resolvedProducts].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
  );
  const winner =
    products.find((product) => product.id === article.winnerId) ?? products[0];

  return (
    <article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-16">
      <ArticleHeader
        article={article}
        categoryName={categoryName}
        categoryHref={categoryHref}
      />

      {winner ? (
        <div className="mt-10">
          <WinnerBox product={winner} reason={article.winnerReason} />
        </div>
      ) : null}

      {article.methodology ? (
        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--ink)]">
            How we chose
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {article.methodology}
          </p>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="quick-picks">
        <h2
          id="quick-picks"
          className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]"
        >
          Quick picks
        </h2>
        <ol className="mt-5 space-y-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
            >
              <div>
                <p className="font-medium text-[var(--ink)]">
                  {product.rank ? `${product.rank}. ` : ""}
                  {product.name}
                </p>
                {product.badge ? (
                  <p className="text-sm text-[var(--muted)]">{product.badge}</p>
                ) : null}
              </div>
              <AffiliateButton
                href={product.amazonUrl}
                label="View on Amazon"
                variant="secondary"
              />
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 space-y-8" aria-labelledby="ranked-products">
        <h2
          id="ranked-products"
          className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)] sm:text-3xl"
        >
          The best options, ranked
        </h2>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} showRank layout="split" />
        ))}
      </section>

      {article.contentHtml ? (
        <div
          className="prose prose-smartdesk mt-14 max-w-none prose-headings:font-[family-name:var(--font-display)]"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      ) : null}

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
