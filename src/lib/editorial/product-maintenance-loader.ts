import { listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { buildProductMaintenanceQueue } from "@/lib/editorial/product-maintenance";

export async function loadProductMaintenanceQueueData() {
  const products = await listProductsV1();
  const articles = await listArticlesV1();
  return buildProductMaintenanceQueue({ products, articles });
}
