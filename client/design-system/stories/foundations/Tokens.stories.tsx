import type { Meta, StoryObj } from "@storybook/react-vite";
import { useDeferredValue, useState } from "react";
import { Text } from "../../src";
import { tokenReference } from "../generated/token-reference";
import { Code, DocPage } from "./docs";

const meta = {
  title: "Foundations/Tokens",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function TokenTable() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const rows = deferred
    ? tokenReference.filter((token) =>
        [token.name, token.cssVariable ?? "", token.value, token.description ?? ""].some((text) => text.toLowerCase().includes(deferred)),
      )
    : tokenReference;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <Text as="span" variant="label" tone="primary">
          Search {tokenReference.length} tokens
        </Text>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="primary, spacing, --sidebar-width"
          className="h-(--input-height-md) w-full max-w-md rounded-lg border border-line bg-surface-card px-4 type-body-lg text-fg-primary placeholder:text-fg-subtle"
        />
      </label>
      <Text variant="caption" tone="muted">
        {rows.length} shown. Utility: the token also creates Tailwind classes (bg-, p-, rounded-, and so on); otherwise read it as a CSS variable.
      </Text>
      <table className="w-full border-collapse rounded-2xl bg-surface-card shadow-xs">
        <thead className="bg-surface-header-subtle">
          <tr>
            {["Token", "CSS variable", "Value", "Utility", "Description"].map((heading) => (
              <th key={heading} scope="col" className="px-5 py-3 text-start type-body font-semibold text-fg-subtle">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((token) => (
            <tr key={token.name} className="border-t border-line align-top">
              <td className="px-5 py-2 type-body text-fg-primary">{token.name}</td>
              <td className="px-5 py-2">{token.cssVariable ? <Code>{token.cssVariable}</Code> : null}</td>
              <td className="px-5 py-2 type-body text-fg-body">
                {token.reference ? (
                  <>
                    {token.reference}
                    <br />
                  </>
                ) : null}
                <Text as="span" variant="caption" tone="muted">
                  {token.value}
                </Text>
              </td>
              <td className="px-5 py-2 type-body text-fg-body">{token.utility ? "yes" : ""}</td>
              <td className="px-5 py-2 type-caption text-fg-muted">{token.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Reference: Story = {
  // Generated data, not a visual: rendered and checked for accessibility, but not screenshotted.
  tags: ["no-screenshot"],
  render: () => (
    <DocPage
      title="Token reference"
      intro="Every token, generated from tokens/**/*.tokens.json. Primitives come from the Figma file; the semantic and component tiers point at them."
    >
      <TokenTable />
    </DocPage>
  ),
};
