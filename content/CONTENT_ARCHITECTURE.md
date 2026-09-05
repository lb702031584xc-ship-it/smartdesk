# SmartDeskSetup content architecture

Scalable CMS for SEO articles, product data, and Amazon affiliate links.

Designed for **500+ articles** without embedding product data in every Markdown file.

## Folder structure

```text
content/
  products/                 # JSON product database (one file per product)
    flexispot-compact.json
    branch-ergonomic-chair.json
  posts/                    # Markdown articles (one file per article)
    best-standing-desks-small-apartments.md
    flexispot-compact-standing-desk-review.md

src/
  types/
    product.ts
    article.ts
  lib/
    products.ts             # Product loaders (cached)
    articles.ts             # Article loaders (cached)
    resolve-products.ts     # Merge product JSON + article overrides
    seo.ts                  # metadata + schema.org + sitemap helpers
  components/article/       # Editorial UI primitives + templates
```

## 1. Markdown article system

Frontmatter contract:

```yaml
title: string
slug: string                 # optional; defaults to filename
type: best | review | comparison | guide
category: desks | chairs | monitors | storage | lighting
description: string
date: YYYY-MM-DD
products:                    # product IDs or refs
  - id: flexispot-compact
    rank: 1
    badge: Best Overall
faq:
  - question: ...
    answer: ...
```

### Article types → layouts

| `type` | Template | Layout |
|---|---|---|
| `best` | RankingTemplate | Winner + ranked ProductCards |
| `review` | ReviewTemplate | Verdict + RatingBox + ProsCons |
| `comparison` | ComparisonTemplate | ComparisonTable + details |
| `guide` | GuideTemplate | Editorial Markdown body |

Articles **reference products by ID**. Catalog fields (name, brand, amazonUrl, pros/cons) live in JSON.

## 2. Product database (JSON)

Each `content/products/*.json` file:

```json
{
  "id": "flexispot-compact",
  "name": "FlexiSpot Compact Standing Desk",
  "brand": "FlexiSpot",
  "category": "desks",
  "image": "/products/desk.svg",
  "rating": 4.7,
  "priceRange": "From $229",
  "pros": ["..."],
  "cons": ["..."],
  "amazonUrl": "https://www.amazon.com/s?k=..."
}
```

Optional fields: `description`, `bestFor`, `featured`.

## 3. Product loader functions

```ts
import {
  getAllProducts,
  getProductById,
  getProductsByIds,
  getProductsByCategory,
  getFeaturedProducts,
  requireProduct,
} from "@/lib/products";
```

Loaders cache products in memory after first read (safe for build-time SSG at 500+ scale).

## 4. Article loader functions

```ts
import {
  getAllArticles,        // meta only (fast listings)
  getArticleBySlug,      // full HTML
  getResolvedArticle,    // HTML + resolved products
  getArticlesByType,
  getArticlesByCategory,
} from "@/lib/articles";
```

Listing pages use `getAllArticles()` so Markdown bodies are not parsed for index routes.

## 5. Reusable components

Import from `@/components/article`:

- `ProductCard`
- `AffiliateButton`
- `RatingBox`
- `ProsCons`
- `ComparisonTable`
- `FAQ`
- `ArticleHeader`
- `WinnerBox`
- `InternalLinks`
- `JsonLd`

## 6. SEO system

```ts
import {
  buildArticleMetadata,
  buildArticleJsonLd,
  buildSitemap,
} from "@/lib/seo";
```

- **Metadata**: title, description, canonical, Open Graph, Twitter
- **Sitemap**: `/sitemap.xml` via `src/app/sitemap.ts`
- **Schema.org**: Article + BreadcrumbList + ItemList/Review/Product + FAQPage

## Scaling notes (500+ articles)

1. Keep **one product JSON per SKU** — update Amazon URLs once, reuse everywhere.
2. Keep article frontmatter lean — only IDs + editorial overrides (`rank`, `badge`, `verdict`).
3. Use cached meta index for blog/category listings.
4. Render article HTML only in `[slug]` routes.
5. Prefer SSG (`generateStaticParams`) — Next.js builds pages at compile time.

## Example articles

- `/blog/best-standing-desks-small-apartments` → `type: best`
- `/blog/flexispot-compact-standing-desk-review` → `type: review`
- `/blog/standing-desk-vs-writing-desk` → `type: comparison`
