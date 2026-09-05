import { AffiliateButton } from "@/components/AffiliateButton";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ComparisonTable } from "@/components/article/ComparisonTable";
import { FAQ } from "@/components/article/FAQ";
import { InternalLinks } from "@/components/article/InternalLinks";
import { ProductCard } from "@/components/article/ProductCard";
import { WinnerBox } from "@/components/article/WinnerBox";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";

type ComparisonTemplateProps = {
  article: ResolvedArticle;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

export function ComparisonTemplate({
  article,
  categoryName,
  categoryHref,
  relatedPosts = [],
}: ComparisonTemplateProps) {
  const products = article.resolvedProducts;
  const winner =
    products.find((product) => product.id === article.winnerId) ?? products[0];
  const winnerIndex = winner
    ? products.findIndex((product) => product.id === winner.id)
    : undefined;

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

      {article.comparisonRows && article.comparisonRows.length > 0 ? (
        <section className="mt-12" aria-labelledby="comparison-table">
          <h2
            id="comparison-table"
            className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]"
          >
            Side-by-side comparison
          </h2>
          <div className="mt-5">
            <ComparisonTable
              headers={products.map((product) => product.name)}
              rows={article.comparisonRows}
              highlightIndex={winnerIndex}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {products.map((product) => (
              <AffiliateButton
                key={product.id}
                href={product.amazonUrl}
                label={`${product.name.split(" ")[0]} on Amazon`}
                variant="secondary"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-14 space-y-8" aria-labelledby="compared-products">
        <h2
          id="compared-products"
          className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]"
        >
          Product details
        </h2>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} layout="split" />
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
