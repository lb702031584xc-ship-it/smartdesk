"use client";

import { FormEvent, useState } from "react";
import { Container } from "@/components/Container";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("success");
    setEmail("");
  }

  return (
    <section aria-labelledby="newsletter-heading" className="py-16 sm:py-20">
      <Container>
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--ink)] px-6 py-12 text-white sm:px-10 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="newsletter-heading"
              className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight sm:text-4xl"
            >
              Get small-space setup ideas
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Occasional emails with new guides, product updates, and layout
              ideas for compact home offices. No spam.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status === "success") setStatus("idle");
                }}
                placeholder="you@example.com"
                className="h-12 w-full rounded-full border border-white/15 bg-white/10 px-5 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/40 sm:max-w-sm"
              />
              <button
                type="submit"
                className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-[var(--ink)] transition hover:bg-white/90"
              >
                Subscribe
              </button>
            </form>

            <p
              className="mt-4 min-h-5 text-sm text-white/65"
              role="status"
              aria-live="polite"
            >
              {status === "success"
                ? "Thanks — you’re on the list."
                : "Unsubscribe anytime. We respect your inbox."}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
