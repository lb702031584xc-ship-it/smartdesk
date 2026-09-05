import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${siteConfig.name} editorial team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
        Contact
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)]">
        Say hello
      </h1>
      <p className="mt-6 text-base leading-relaxed text-[var(--muted)]">
        Questions about a guide, a product pick, or a partnership? Email us at{" "}
        <a
          href={`mailto:${siteConfig.email}`}
          className="font-medium text-[var(--ink)] underline underline-offset-4"
        >
          {siteConfig.email}
        </a>
        .
      </p>
    </Container>
  );
}
