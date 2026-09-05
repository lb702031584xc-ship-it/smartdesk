import { siteConfig } from "@/lib/site";

type AffiliateButtonProps = {
  href: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "light";
};

function withAffiliateTag(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("tag")) {
      parsed.searchParams.set("tag", siteConfig.affiliateTag);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const variants = {
  primary:
    "bg-[var(--ink)] !text-white hover:bg-[var(--accent-soft)]",
  secondary:
    "border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink)]",
  ghost:
    "bg-transparent text-[var(--ink)] underline-offset-4 hover:underline",
  light:
    "bg-white text-[var(--ink)] hover:bg-white/90",
};

export function AffiliateButton({
  href,
  label = "Check price on Amazon",
  className = "",
  variant = "primary",
}: AffiliateButtonProps) {
  return (
    <a
      href={withAffiliateTag(href)}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 ${variants[variant]} ${className}`}
    >
      {label}
    </a>
  );
}
