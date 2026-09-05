import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeading } from "@/components/SectionHeading";
import { getAllProducts, getFeaturedProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "Honest reviews of compact desks, chairs, and accessories for small home offices.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const reviewed = await getFeaturedProducts(4);
  const total = (await getAllProducts()).length;

  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="Reviews"
        title="Honest takes on compact office gear"
        description="Pros, cons, and best-fit notes for products that earn space in a small room."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {reviewed.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <p className="mt-10 text-sm text-[var(--muted)]">
        Looking for the full shortlist?{" "}
        <Link href="/best-products" className="font-semibold text-[var(--ink)] underline underline-offset-4">
          Browse best products
        </Link>
        . We currently feature {total} researched picks.
      </p>
    </Container>
  );
}
