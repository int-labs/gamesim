// Builds the design tokens (tokens/**/*.tokens.json, DTCG format) with Style Dictionary into the
// Tailwind theme, the text-role and gradient utilities, a TypeScript token map and the class
// merger configuration.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import StyleDictionary from "style-dictionary";
import { HEADER, ROOT } from "./paths.mjs";

// ---------------------------------------------------------------------------------------------
// Token path to CSS variable. "theme" variables go inside Tailwind's @theme, where they create
// utilities; "root" variables are plain custom properties with no utilities of their own.
// ---------------------------------------------------------------------------------------------
const THEME_GROUPS = {
  color: (p) => `--color-${dropDefault(p).join("-")}`,
  spacing: (p) => `--spacing-${escapeDecimal(p[0])}`,
  radius: (p) => `--radius-${p[0]}`,
  breakpoint: (p) => `--breakpoint-${p[0]}`,
  container: (p) => `--container-${p[0]}`,
  tracking: (p) => `--tracking-${p[0]}`,
  leading: (p) => `--leading-${p[0]}`,
  shadow: (p) => `--shadow-${p[0]}`,
  "inset-shadow": (p) => `--inset-shadow-${p[0]}`,
  "drop-shadow": (p) => `--drop-shadow-${p[0]}`,
  blur: (p) => `--blur-${p[0]}`,
  ease: (p) => `--ease-${p[0]}`,
  // Tailwind resolves duration-<name> from --transition-duration-* and z-<name> from --z-index-*.
  duration: (p) => `--transition-duration-${p[0]}`,
  layer: (p) => `--z-index-${p[0]}`,
};

function cssVar(token) {
  const [group, ...rest] = token.path;
  if (group in THEME_GROUPS) return { name: THEME_GROUPS[group](rest), scope: "theme" };
  if (group === "font" && rest[0] === "family") return { name: `--font-${rest[1]}`, scope: "theme" };
  if (group === "font" && rest[0] === "weight") return { name: `--font-weight-${rest[1]}`, scope: "theme" };
  if (group === "text") {
    const [key, part] = rest;
    return { name: part === "size" ? `--text-${key}` : `--text-${key}--${part}`, scope: "theme" };
  }
  if (group === "palette") return { name: `--palette-${rest.join("-")}`, scope: "root" };
  if (group === "gradient") return { name: `--gradient-${rest[0]}`, scope: "root" };
  if (group === "component") return { name: `--${rest.join("-")}`, scope: "root" };
  return null; // spring and stagger (TypeScript only) and typography roles (utilities)
}

function dropDefault(parts) {
  return parts.filter((part, i) => !(part === "DEFAULT" && i === parts.length - 1));
}

function escapeDecimal(key) {
  // Token keys cannot contain dots, so 0_5 stands for 0.5; Tailwind needs the dot escaped.
  return key.replace("_", "\\.");
}

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------
function quoteFamily(name) {
  return /^[a-z-]+$/i.test(name) && !/\d/.test(name) ? name : `"${name}"`;
}

function shadowToCss(value) {
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map((l) => `${l.inset ? "inset " : ""}${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color}`)
    .join(", ");
}

// A drop-shadow() filter takes no spread and no inset.
function dropShadowToCss(value) {
  const layers = Array.isArray(value) ? value : [value];
  return layers.map((l) => `${l.offsetX} ${l.offsetY} ${l.blur} ${l.color}`).join(", ");
}

function valueToCss(token, value = token.$value) {
  switch (token.$type) {
    case "fontFamily":
      return Array.isArray(value) ? value.map(quoteFamily).join(", ") : quoteFamily(value);
    case "cubicBezier":
      return `cubic-bezier(${value.join(", ")})`;
    case "shadow":
      return token.path?.[0] === "drop-shadow" ? dropShadowToCss(value) : shadowToCss(value);
    default:
      return String(value);
  }
}

const SINGLE_REF = /^\{([^{}]+)\}$/;

// A token whose value is exactly one reference becomes var(--referenced), so the palette link stays
// visible in the output and a theme can override one layer; anything else is written resolved.
function refVar(ref, byPath) {
  if (typeof ref !== "string") return null;
  const match = ref.match(SINGLE_REF);
  if (!match) return null;
  const target = byPath.get(match[1]);
  const targetVar = target && cssVar(target);
  return targetVar ? `var(${targetVar.name})` : null;
}

function refOrValue(ref, resolved, type, byPath) {
  return refVar(ref, byPath) ?? valueToCss({ $type: type }, resolved);
}

function cssValue(token, byPath) {
  return refVar(token.original.$value, byPath) ?? valueToCss(token);
}

function indexByPath(dictionary) {
  const byPath = new Map();
  for (const token of dictionary.allTokens) byPath.set(token.path.join("."), token);
  return byPath;
}

function describe(token) {
  return token.$description ? ` /* ${token.$description.replace(/\*\//g, "* /")} */` : "";
}

/** Keys of one token group, in source order (for example keysOf(d, "shadow") or keysOf(d, "font", "weight")). */
function keysOf(dictionary, ...prefix) {
  const keys = [];
  for (const token of dictionary.allTokens) {
    if (prefix.every((part, i) => token.path[i] === part)) {
      const key = token.path[prefix.length];
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------------------------
StyleDictionary.registerFormat({
  name: "stratagem/theme-css",
  format: ({ dictionary }) => {
    const byPath = indexByPath(dictionary);
    const theme = [];
    const root = [];
    for (const token of dictionary.allTokens) {
      const target = cssVar(token);
      if (!target) continue;
      const line = `  ${target.name}: ${cssValue(token, byPath)};`;
      if (target.scope === "theme") theme.push(line);
      else root.push(line + (token.path[0] === "component" ? describe(token) : ""));
    }
    return [
      `/* ${HEADER} */`,
      "",
      "/* Tailwind theme, locked: '--*: initial' removes every Tailwind default, so only these tokens",
      "   exist as utilities (bg-red-500, p-13 or text-base-color, for example, do not). 'static' emits",
      "   every variable even when no utility uses it, because components read them directly. */",
      "@theme static {",
      "  --*: initial;",
      "  --default-font-family: var(--font-body);",
      "  --default-mono-font-family: var(--font-mono);",
      "  --default-transition-duration: var(--transition-duration-fast);",
      "  --default-transition-timing-function: var(--ease-standard);",
      ...theme,
      "}",
      "",
      "/* Primitive palette, component measurements and gradients: plain custom properties, readable",
      "   everywhere but never utilities of their own. */",
      ":root {",
      ...root,
      "}",
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "stratagem/utilities-css",
  format: ({ dictionary }) => {
    const byPath = indexByPath(dictionary);
    const out = [`/* ${HEADER} */`, ""];
    for (const token of dictionary.allTokens) {
      if (token.path[0] === "typography") {
        const ref = token.original.$value;
        const val = token.$value;
        const ext = token.$extensions?.["com.stratagem"] ?? {};
        out.push(`/* ${token.$description ?? ""} */`);
        out.push(`@utility type-${token.path[1]} {`);
        out.push(`  font-family: ${refOrValue(ref.fontFamily, val.fontFamily, "fontFamily", byPath)};`);
        out.push(`  font-weight: ${refOrValue(ref.fontWeight, val.fontWeight, "fontWeight", byPath)};`);
        out.push(`  font-size: ${refOrValue(ref.fontSize, val.fontSize, "dimension", byPath)};`);
        out.push(`  line-height: ${refOrValue(ref.lineHeight, val.lineHeight, "number", byPath)};`);
        out.push(`  letter-spacing: ${refOrValue(ref.letterSpacing, val.letterSpacing, "dimension", byPath)};`);
        if (ext.textTransform) out.push(`  text-transform: ${ext.textTransform};`);
        if (ext.fontStyle) out.push(`  font-style: ${ext.fontStyle};`);
        out.push("}", "");
      }
      if (token.path[0] === "gradient") {
        out.push(`/* ${token.$description ?? ""} */`);
        out.push(`@utility bg-gradient-${token.path[1]} {`, `  background-image: var(--gradient-${token.path[1]});`, "}", "");
      }
    }
    return out.join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "stratagem/tokens-ts",
  format: ({ dictionary }) => {
    const tree = {};
    for (const token of dictionary.allTokens) {
      let node = tree;
      for (const part of token.path.slice(0, -1)) {
        node[part] ??= {};
        node = node[part];
      }
      let value = token.$value;
      if (token.$type === "shadow") value = valueToCss(token);
      else if (token.$type === "fontFamily") value = valueToCss(token);
      else if (token.$type === "typography") {
        value = {
          fontFamily: valueToCss({ $type: "fontFamily" }, value.fontFamily),
          fontWeight: value.fontWeight,
          fontSize: value.fontSize,
          lineHeight: value.lineHeight,
          letterSpacing: value.letterSpacing,
        };
      }
      node[token.path[token.path.length - 1]] = value;
    }
    return [
      `// ${HEADER}`,
      "// Resolved values of every token, for code that cannot read CSS variables (charts, canvas, motion).",
      "// Prefer the CSS variables and utilities in components: they follow theme overrides.",
      "",
      `export const tokens = ${JSON.stringify(tree, null, 2)} as const;`,
      "",
      "export type Tokens = typeof tokens;",
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "stratagem/merge-config-ts",
  format: ({ dictionary }) => {
    const keys = (...prefix) => keysOf(dictionary, ...prefix);
    const config = {
      extend: {
        // Scales whose token names differ from Tailwind's defaults, so the merger knows, for
        // example, that shadow-card and shadow-lg conflict.
        theme: {
          shadow: keys("shadow"),
          "inset-shadow": keys("inset-shadow"),
          "drop-shadow": keys("drop-shadow"),
          blur: keys("blur"),
          ease: keys("ease"),
          leading: keys("leading"),
          tracking: keys("tracking"),
          radius: keys("radius"),
          text: keys("text"),
          font: keys("font", "family"),
          "font-weight": keys("font", "weight"),
          breakpoint: keys("breakpoint"),
          container: keys("container"),
        },
        classGroups: {
          z: [{ z: keys("layer") }],
          duration: [{ duration: keys("duration") }],
          "type-role": [{ type: keys("typography") }],
          "bg-image": [{ "bg-gradient": keys("gradient") }],
        },
        // A text role sets family, size, weight, line height and letter spacing at once, so it
        // replaces any earlier class for those; a later text-lg still refines a role.
        conflictingClassGroups: {
          "type-role": ["font-family", "font-size", "font-weight", "leading", "tracking"],
        },
      },
    };
    return [
      `// ${HEADER}`,
      "// Teaches the class merger (tailwind-variants' built-in tailwind-merge) the token names.",
      'import type { TWMergeConfig } from "tailwind-variants";',
      "",
      `export const twMergeConfig: TWMergeConfig = ${JSON.stringify(config, null, 2)};`,
      "",
    ].join("\n");
  },
});

StyleDictionary.registerFormat({
  name: "stratagem/reference-ts",
  format: ({ dictionary }) => {
    const rows = dictionary.allTokens.map((token) => {
      const target = cssVar(token);
      const original = token.original.$value;
      let value = token.$value;
      if (token.$type === "shadow" || token.$type === "fontFamily" || token.$type === "cubicBezier") value = valueToCss(token);
      else if (token.$type === "typography") value = `${value.fontWeight} ${value.fontSize}/${value.lineHeight}`;
      return {
        name: token.path.join("."),
        type: token.$type ?? "",
        cssVariable: target?.name ?? null,
        utility: target?.scope === "theme",
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
        reference: typeof original === "string" && SINGLE_REF.test(original) ? original.slice(1, -1) : null,
        description: token.$description ?? null,
      };
    });
    return [
      `// ${HEADER}`,
      "// Every token with its CSS variable, resolved value and source reference, for the Tokens page.",
      "",
      `export const tokenReference = ${JSON.stringify(rows, null, 2)} as const;`,
      "",
    ].join("\n");
  },
});

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------
const OUTPUTS = [
  { path: "src/styles/generated/theme.css", format: "stratagem/theme-css" },
  { path: "src/styles/generated/utilities.css", format: "stratagem/utilities-css" },
  { path: "src/tokens/generated/tokens.ts", format: "stratagem/tokens-ts" },
  { path: "src/lib/generated/merge-config.ts", format: "stratagem/merge-config-ts" },
  { path: "stories/generated/token-reference.ts", format: "stratagem/reference-ts" },
];

/** Builds the token outputs in a temporary folder and returns their contents. */
export async function generateTokens() {
  const tmp = await mkdtemp(path.join(tmpdir(), "ds-tokens-"));
  try {
    const sd = new StyleDictionary({
      source: [path.join(ROOT, "tokens/**/*.tokens.json")],
      usesDtcg: true,
      // Silent success output; a warning (a token collision, for example) still fails the build.
      log: { verbosity: "silent", warnings: "error" },
      platforms: Object.fromEntries(
        OUTPUTS.map((output, i) => [
          `p${i}`,
          {
            // Full-path names keep Style Dictionary's collision check meaningful (the formats
            // derive CSS variable names from token paths themselves).
            transforms: ["name/kebab"],
            buildPath: tmp + path.sep,
            files: [{ destination: `${i}.out`, format: output.format }],
          },
        ]),
      ),
    });
    await sd.buildAllPlatforms();
    return Promise.all(
      OUTPUTS.map(async (output, i) => ({ path: output.path, content: await readFile(path.join(tmp, `${i}.out`), "utf8") })),
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
