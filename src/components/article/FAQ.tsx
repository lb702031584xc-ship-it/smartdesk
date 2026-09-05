"use client";

import { useState } from "react";
import type { FaqItem } from "@/types/article";

type FAQProps = {
  items: FaqItem[];
  title?: string;
  className?: string;
};

export function FAQ({
  items,
  title = "Frequently asked questions",
  className = "",
}: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!items.length) return null;

  return (
    <section className={className} aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[var(--ink)] sm:text-3xl"
      >
        {title}
      </h2>
      <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;

          return (
            <div key={item.question}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium text-[var(--ink)] transition hover:opacity-70"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span>{item.question}</span>
                  <span aria-hidden className="text-xl text-[var(--subtle)]">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="pb-4 text-sm leading-relaxed text-[var(--muted)]"
              >
                {item.answer}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
