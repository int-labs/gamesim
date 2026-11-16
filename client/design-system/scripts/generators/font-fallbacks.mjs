// Metric-matched fallback faces: Arial (or its metric twin Liberation Sans on Linux), resized and
// re-spaced to the metrics of each web font, so text keeps its size and line breaks while the web
// font loads and nothing moves when it arrives. The font stacks in
// tokens/primitives/typography.tokens.json name these faces right after each web font.
import { pathToFileURL } from "node:url";
import { generateFontFace, getMetricsForFamily, readMetrics } from "fontaine";
import { HEADER, installedVersion, resolveFromRoot } from "./paths.mjs";

const FACES = [
  { name: "Source Sans 3 Fallback", file: "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2" },
  { name: "Poppins Fallback", file: "@fontsource/poppins/files/poppins-latin-400-normal.woff2" },
];

// local() matches a font's full name or PostScript name; Liberation Sans shares Arial's metrics.
const LOCAL_SOURCES = 'local("Arial"), local("ArialMT"), local("Liberation Sans")';

export async function generateFontFallbacks() {
  const arial = await getMetricsForFamily("Arial");
  if (!arial) throw new Error("fontaine has no metrics for Arial.");
  const faces = [];
  for (const face of FACES) {
    const metrics = await readMetrics(pathToFileURL(resolveFromRoot(face.file)));
    if (!metrics) throw new Error(`Could not read the metrics of ${face.file}.`);
    const css = generateFontFace(metrics, { name: face.name, font: "Arial", metrics: arial });
    if (!css.includes('src: local("Arial");')) throw new Error("fontaine changed its output; update the src rewrite.");
    faces.push(`/* ${face.file.split("/").pop()} */`, css.replace('src: local("Arial");', `src: ${LOCAL_SOURCES};`).trim(), "");
  }
  return {
    path: "src/styles/generated/font-fallbacks.css",
    content: [`/* ${HEADER} */`, `/* Metrics computed with fontaine ${await installedVersion("fontaine")}. */`, "", ...faces].join("\n"),
  };
}
