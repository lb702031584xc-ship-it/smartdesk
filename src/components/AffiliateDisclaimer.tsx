import Link from "next/link";

export function AffiliateDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        We may earn a commission from qualifying Amazon purchases.{" "}
        <Link href="/affiliate-disclosure" className="underline underline-offset-2">
          Learn more
        </Link>
        .
      </p>
    );
  }

  return (
    <aside className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
      <strong className="font-semibold text-[var(--ink)]">Affiliate note:</strong>{" "}
      SmartDeskSetup is reader-supported. When you buy through links on this site,
      we may earn an Amazon Associates commission at no extra cost to you. See our{" "}
      <Link
        href="/affiliate-disclosure"
        className="font-medium text-[var(--ink)] underline underline-offset-2"
      >
        Affiliate Disclosure
      </Link>
      .
    </aside>
  );
}
