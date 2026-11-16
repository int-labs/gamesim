// @vitest-environment node
import { generatePreflight, scopeSelector } from "./preflight.mjs";

describe("scopeSelector", () => {
  it.each([
    ["*", ":where([data-ds-root], [data-ds-root] *)"],
    ["::before", ":where([data-ds-root], [data-ds-root] *)::before"],
    ["::placeholder", ":where([data-ds-root], [data-ds-root] *)::placeholder"],
    ["html", ":where([data-ds-root])"],
    [":host", ":where([data-ds-root])"],
    ["h1", ":where([data-ds-root]) h1"],
    ["abbr:where([title])", ":where([data-ds-root]) abbr:where([title])"],
    [":where(select:is([multiple], [size])) optgroup", ":where([data-ds-root]) :where(select:is([multiple], [size])) optgroup"],
  ])("%s", (selector, scoped) => {
    expect(scopeSelector(selector)).toBe(scoped);
  });
});

describe("generatePreflight", () => {
  it("scopes every rule of Tailwind's preflight", async () => {
    const { content } = await generatePreflight();
    const selectors = content.match(/^[^@\s/*}][^{]*\{/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(20);
    for (const selector of selectors) expect(selector).toContain("[data-ds-root]");
  });
});
