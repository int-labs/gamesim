// Building blocks of the foundations pages. They use the design system itself, so these pages are
// also its first visual test.
import type { ReactNode } from "react";
import { Heading, Text } from "../../src";
import { tokenReference } from "../generated/token-reference";

export type TokenRow = (typeof tokenReference)[number];

/** Tokens whose name starts with the prefix ("color.surface."), in source order. */
export function tokensUnder(prefix: string): TokenRow[] {
  return tokenReference.filter((token) => token.name.startsWith(prefix));
}

export function DocPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="flex max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Heading level={1}>{title}</Heading>
        <Text variant="body-lg" tone="muted">
          {intro}
        </Text>
      </header>
      {children}
    </article>
  );
}

export function DocSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading level={2} variant="heading">
          {title}
        </Heading>
        {description ? <Text tone="muted">{description}</Text> : null}
      </div>
      {children}
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-surface-panel px-1 type-caption font-mono text-fg-body">{children}</code>;
}

/** A labelled block of the documentation grid. */
export function Specimen({ label, meta, children }: { label: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-card p-4">
      {children}
      <div className="flex flex-col gap-0.5">
        <Text variant="label" tone="primary" weight="semibold">
          {label}
        </Text>
        {meta ? (
          <Text as="div" variant="caption" tone="muted">
            {meta}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
