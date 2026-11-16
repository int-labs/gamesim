// Tailwind's Preflight (its CSS reset), rewritten to apply only inside elements marked
// [data-ds-root]. Apps without MUI put the attribute on <html>, so the reset covers the whole page;
// while MUI is still present, each migrated screen puts it on its own root, and legacy screens
// keep the browser defaults they were built on.
//
// Every selector is wrapped in :where(), so the scoped rules keep Preflight's specificity.
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import { HEADER, installedVersion, resolveFromRoot } from "./paths.mjs";

const SCOPE = "[data-ds-root]";
const ROOT = `:where(${SCOPE})`;
const ROOT_AND_DESCENDANTS = `:where(${SCOPE}, ${SCOPE} *)`;

export function scopeSelector(selector) {
  const s = selector.trim();
  if (s === "*") return ROOT_AND_DESCENDANTS;
  if (s === "html" || s === ":host") return ROOT;
  if (s.startsWith("::")) return ROOT_AND_DESCENDANTS + s; // a pseudo-element of any element
  return `${ROOT} ${s}`;
}

export async function generatePreflight() {
  const source = await readFile(resolveFromRoot("tailwindcss/preflight.css"), "utf8");
  const root = postcss.parse(source);
  root.walkRules((rule) => {
    rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
  });
  return {
    path: "src/styles/generated/preflight.css",
    content: [
      `/* ${HEADER} */`,
      `/* Source: tailwindcss ${await installedVersion("tailwindcss")} preflight.css, scoped to ${SCOPE} (see scripts/generators/preflight.mjs). */`,
      "",
      root.toString().trim(),
      "",
    ].join("\n"),
  };
}
