// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "@tailwindcss/node";
import postcss, { type AtRule } from "postcss";

const ENTRY = path.join(import.meta.dirname, "../../src/styles/index.css");

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(await readFile(ENTRY, "utf8"), {
    base: path.dirname(ENTRY),
    shouldRewriteUrls: true,
    onDependency: () => {},
  });
  return compiler.build(candidates);
}

/** The class selector Tailwind writes for a candidate (a leading digit is escaped as a code point). */
function selectorOf(candidate: string): string {
  const escaped = candidate.replace(/[.:/[\]()#%!,]/g, (char) => `\\${char}`);
  return /^\d/.test(escaped) ? `.\\3${escaped[0]} ${escaped.slice(1)}` : `.${escaped}`;
}

function hasClass(css: string, candidate: string): boolean {
  return css.includes(selectorOf(candidate));
}

describe("the Tailwind theme is locked to the tokens", () => {
  it("generates the token utilities", async () => {
    const allowed = [
      "bg-primary", "bg-surface-page", "text-fg-primary", "border-line", "border-line-strong", "ring-focus-ring",
      "p-4", "p-3.5", "p-px", "gap-2.5", "w-96", "size-5", "rounded-xl", "rounded-4xl", "rounded-full",
      "shadow-card", "shadow-sm", "inset-shadow-glass", "blur-overlay", "backdrop-blur-overlay",
      "text-2xs", "text-md", "text-5xl", "text-6xl", "font-body", "font-display", "font-semibold", "leading-display", "tracking-wide",
      "duration-fast", "duration-shake", "ease-standard", "ease-recoil", "z-modal", "z-celebration",
      "type-body", "type-overline", "bg-gradient-wordmark", "max-w-7xl", "md:flex", "3xl:grid",
    ];
    const css = await build(allowed);
    for (const candidate of allowed) expect(hasClass(css, candidate), candidate).toBe(true);
  });

  it("does not generate Tailwind's default scales or off-token values", async () => {
    const blocked = [
      "bg-red-500", "text-slate-900", "bg-white", "bg-black", "border-gray-200", "p-13", "w-137", "m-15",
      "shadow-2xl", "rounded-5xl", "text-7xl", "font-sans", "font-serif", "leading-relaxed",
      "tracking-tighter", "blur-3xl", "ease-in", "4xl:flex", "max-w-8xl",
    ];
    const css = await build(blocked);
    for (const candidate of blocked) expect(hasClass(css, candidate), candidate).toBe(false);
  });

  it("puts the theme variables in the theme layer", async () => {
    const css = await build([]);
    const themeLayer = css.slice(css.indexOf("@layer theme {"));
    expect(css.indexOf("@layer theme {")).toBeGreaterThan(-1);
    expect(themeLayer).toContain("--color-primary: var(--palette-brand-pink);");
    expect(themeLayer).toContain("--palette-brand-pink: #f9137d;");
  });

  it("orders the layers so MUI sits below the design system's components and utilities", async () => {
    const css = await build([]);
    expect(css).toContain("@layer theme, base, mui, components, utilities;");
  });
});

describe("the reset and base styles", () => {
  it("apply only inside [data-ds-root]", async () => {
    const root = postcss.parse(await build([]));
    const baseLayers = root.nodes.filter((node): node is AtRule => node.type === "atrule" && node.name === "layer" && node.params === "base");
    expect(baseLayers.length).toBeGreaterThan(0);
    let rules = 0;
    for (const layer of baseLayers) {
      // No rule of the reset or the base styles targets bare elements: they would restyle legacy MUI screens.
      layer.walkRules((rule) => {
        rules += 1;
        for (const selector of rule.selectors) expect(selector).toContain("[data-ds-root]");
      });
    }
    expect(rules).toBeGreaterThan(20);
  });
});

describe("the fonts", () => {
  it("self-hosts Source Sans 3, Poppins and Noto Sans Thai, with metric-matched fallbacks", async () => {
    const css = await build([]);
    expect(css).toMatch(/font-family: 'Source Sans 3 Variable'/);
    expect(css).toMatch(/font-family: 'Poppins'/);
    expect(css).toMatch(/font-family: 'Noto Sans Thai Variable'/);
    expect(css).toContain('font-family: "Source Sans 3 Fallback"');
    expect(css).toContain('font-family: "Poppins Fallback"');
    for (const weight of [300, 400, 500, 600, 800, 900]) {
      expect(css, `Poppins ${weight}`).toContain(`poppins-latin-${weight}-normal.woff2`);
    }
  });

  it("names the fallback right after each web font", async () => {
    const css = await build([]);
    expect(css).toContain('--font-body: "Source Sans 3 Variable", "Source Sans 3", "Source Sans 3 Fallback"');
    expect(css).toContain('--font-display: Poppins, "Poppins Fallback"');
  });
});

describe("the motion variants", () => {
  it("honour both the system setting and the Reduce effects switch", async () => {
    const css = await build(["motion-reduce:hidden", "motion-safe:transition"]);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain('.motion-reduce\\:hidden:where([data-motion="reduced"], [data-motion="reduced"] *)');
    expect(css).toContain('.motion-safe\\:transition:where(:not([data-motion="reduced"], [data-motion="reduced"] *))');
  });
});
