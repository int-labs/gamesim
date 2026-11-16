// Generates every file under src/**/generated/ from its source:
//
//   tokens/**/*.tokens.json   ->  src/styles/generated/theme.css        Tailwind theme, locked to the tokens
//                                 src/styles/generated/utilities.css    type-* and bg-gradient-* utilities
//                                 src/tokens/generated/tokens.ts        resolved values for TypeScript
//                                 src/lib/generated/merge-config.ts     token names for the class merger
//   tailwindcss/preflight.css ->  src/styles/generated/preflight.css    the reset, scoped to [data-ds-root]
//   the font files            ->  src/styles/generated/font-fallbacks.css  metric-matched fallback faces
//
// Usage: node scripts/generate.mjs            write the files
//        node scripts/generate.mjs --check    fail when a committed file is out of date (CI)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateFontFallbacks } from "./generators/font-fallbacks.mjs";
import { ROOT } from "./generators/paths.mjs";
import { generatePreflight } from "./generators/preflight.mjs";
import { generateTokens } from "./generators/tokens.mjs";

const CHECK = process.argv.includes("--check");

const files = [...(await generateTokens()), await generatePreflight(), await generateFontFallbacks()];

if (CHECK) {
  const stale = [];
  for (const file of files) {
    const committed = await readFile(path.join(ROOT, file.path), "utf8").catch(() => null);
    if (committed !== file.content) stale.push(file.path);
  }
  if (stale.length > 0) {
    console.error(`Out of date: ${stale.join(", ")}. Run npm run generate and commit the result.`);
    process.exitCode = 1;
  } else {
    console.log(`All ${files.length} generated files are up to date.`);
  }
} else {
  for (const file of files) {
    const target = path.join(ROOT, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
  console.log(`Generated ${files.map((file) => file.path).join(", ")}.`);
}
