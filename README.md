# SmartDeskSetup

SEO-focused affiliate site for compact home office setups, built with Next.js 15, TypeScript, Tailwind CSS, and a Markdown blog.

## Features

- Fast App Router pages with static generation for posts and categories
- Markdown blog in `content/posts`
- Category pages with product recommendations
- Amazon affiliate CTA buttons (`rel="nofollow sponsored"`)
- Privacy Policy and Affiliate Disclosure pages
- `sitemap.xml` and `robots.txt`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```text
content/posts/          Markdown guides
public/products/        Product illustration assets
src/app/                Routes (home, blog, category, legal)
src/components/         Header, cards, affiliate CTA
src/lib/                Content helpers and site config
```

## Affiliate tag

Update `affiliateTag` in `src/lib/site.ts` with your Amazon Associates tag before publishing.

## Scripts

- `npm run dev` — local development (Turbopack)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
