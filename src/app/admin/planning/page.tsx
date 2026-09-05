import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { computeCoverageInventory } from "@/lib/admin/editorial-coverage";
import { EditorialPlanningPanel } from "@/components/admin/EditorialPlanningPanel";

export default async function AdminPlanningPage() {
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const inventory = computeCoverageInventory(articles, products);

  const productNames = new Map(products.map((p) => [p.id, p.identity.name]));
  const articleTitles = new Map(articles.map((a) => [a.identity.id, a.identity.title]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-[var(--ink)]">Editorial Planning</h1>
      <EditorialPlanningPanel
        inventory={inventory}
        productNames={Object.fromEntries(productNames)}
        articleTitles={Object.fromEntries(articleTitles)}
      />
    </div>
  );
}
