import type { Metadata } from "next";
import type { MetadataRoute } from "next";
import type { Article, ArticleMeta, ResolvedArticle } from "@/types/article";
import type { Product, ResolvedProduct } from "@/types/product";
import { categories } from "@/lib/categories";
import { getAllArticles, getArticleSlugs } from "@/lib/articles";
import { absoluteUrl, siteConfig } from "@/lib/site";

function resolveArticleCanonical(article: ArticleMeta): string {
  const provided = article.seoCanonical?.trim();
  if (provided) return provided;
  return `/blog/${article.slug}`;
}

export function buildArticleMetadata(article: ArticleMeta): Metadata {
  const path = `/blog/${article.slug}`;
  const url = absoluteUrl(path);
  const metadataTitle = article.seoTitle?.trim() || article.title;
  const canonical = resolveArticleCanonical(article);

  return {
    title: metadataTitle,
    description: article.description,
    keywords: article.tags,
    authors: [{ name: article.author ?? siteConfig.author }],
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      title: metadataTitle,
      description: article.description,
      url,
      publishedTime: article.date,
      modifiedTime: article.updated ?? article.date,
      tags: article.tags,
      siteName: siteConfig.name,
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description: article.description,
    },
    robots: {
      index: article.noindex !== true,
      follow: true,
    },
  };
}

function toProductNode(product: ResolvedProduct | Product, fallbackDescription: string) {
  const priceRange =
    "priceRange" in product && product.priceRange
      ? product.priceRange
      : "priceLabel" in product
        ? String((product as ResolvedProduct).priceLabel ?? "")
        : undefined;

  return {
    "@type": "Product" as const,
    name: product.name,
    image: product.image ? absoluteUrl(product.image) : undefined,
    description:
      ("summary" in product && product.summary) ||
      product.bestFor ||
      product.description ||
      fallbackDescription,
    brand: {
      "@type": "Brand" as const,
      name: product.brand || siteConfig.name,
    },
    aggregateRating: {
      "@type": "AggregateRating" as const,
      ratingValue: product.rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
    },
    offers: {
      "@type": "Offer" as const,
      url: product.amazonUrl,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      price: priceRange?.replace(/[^0-9.]/g, "") || undefined,
    },
  };
}

export function buildArticleJsonLd(article: ResolvedArticle | Article) {
  const url = absoluteUrl(`/blog/${article.slug}`);
  const resolvedProducts =
    "resolvedProducts" in article
      ? article.resolvedProducts
      : [];
  const products = resolvedProducts.map((product) =>
    toProductNode(product, article.description),
  );

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: article.title,
      description: article.description,
      datePublished: article.date,
      dateModified: article.updated ?? article.date,
      author: {
        "@type": "Organization",
        name: article.author ?? siteConfig.author,
      },
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
      },
      mainEntityOfPage: url,
      image: article.coverImage
        ? absoluteUrl(article.coverImage)
        : absoluteUrl("/images/guide-placeholder.svg"),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteConfig.url,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Guides",
          item: absoluteUrl("/blog"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: url,
        },
      ],
    },
  ];

  if (article.type === "best" && products.length > 0) {
    graph.push({
      "@type": "ItemList",
      name: article.title,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: product,
      })),
    });
  }

  if (article.type === "review" && products[0]) {
    const reviewProduct =
      "resolvedProduct" in article && article.resolvedProduct
        ? article.resolvedProduct
        : resolvedProducts[0];

    graph.push({
      "@type": "Review",
      itemReviewed: products[0],
      reviewRating: {
        "@type": "Rating",
        ratingValue: reviewProduct?.rating ?? 0,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        "@type": "Organization",
        name: article.author ?? siteConfig.author,
      },
      reviewBody: reviewProduct?.verdict ?? article.description,
    });
  }

  if (article.type === "comparison" && products.length > 0) {
    graph.push(...products);
  }

  const faq = article.faq ?? article.faqs ?? [];
  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;

  const staticRoutes = [
    "",
    "/blog",
    "/reviews",
    "/best-products",
    "/about",
    "/contact",
    "/privacy",
    "/affiliate-disclosure",
  ].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const categoryRoutes = categories.map((category) => ({
    url: `${base}/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const allArticles = await getAllArticles();
  const articleRoutes = allArticles.map((article) => ({
    url: `${base}/blog/${article.slug}`,
    lastModified: new Date(article.updated ?? article.date),
    changeFrequency: "monthly" as const,
    priority: article.type === "best" ? 0.8 : 0.6,
  }));

  const known = new Set(articleRoutes.map((route) => route.url));
  const slugs = await getArticleSlugs();
  for (const slug of slugs) {
    const url = `${base}/blog/${slug}`;
    if (!known.has(url)) {
      articleRoutes.push({
        url,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return [...staticRoutes, ...categoryRoutes, ...articleRoutes];
}
