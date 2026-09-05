import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeading } from "@/components/SectionHeading";
import { getAllProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Best Products",
  description:
    "Best office gear for small home offices—desks, chairs, lighting, and organizers.",
  alternates: { canonical: "/best-products" },
};

export default async function BestProductsPage() {
  const products = await getAllProducts();

  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="Best Products"
        title="Best office gear for small spaces"
        description="A curated shortlist of Amazon-ready picks for apartments and compact rooms."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-[var(--subtle)]">
        As an Amazon Associate, we earn from qualifying purchases.
      </p>
    </Container>
  );
}
