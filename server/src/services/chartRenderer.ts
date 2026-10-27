import * as vega from "vega";
import * as vegaLite from "vega-lite";

/**
 * Render a stored Vega-Lite spec to SVG, server-side.
 *
 * ── WHY THE SERVER DRAWS ────────────────────────────────────────────────────
 * The player never receives a spec, only finished SVG. That is the whole
 * security argument: there is no interpreter in the player, so a stored spec
 * cannot do anything there. The grammar exists in exactly two places that are
 * ours — the console that writes it and this file that resolves it.
 *
 * ⚠ A SPEC IS NOT INERT. JSON makes it feel safer than markup, but Vega's
 * grammar carries executable surface: `transform: [{calculate}]`, `expr`,
 * `signal`, and `data.url`, which the loader would FETCH from this server.
 * `assertSafeSpec` below is the boundary, and unlike sanitising markup it is a
 * key walk with no parser quirks to lose to.
 */

/**
 * Keys that execute, fetch, or introduce data we did not supply.
 *
 * A DENY LIST, not an allow list, on purpose: Vega-Lite's legitimate surface is
 * enormous (encodings, scales, axes, legends, layers, resolve, config…) and an
 * allow list would reject valid specs constantly, which teaches whoever is
 * authoring to work around the check rather than within it.
 */
const DENIED_KEYS = new Set([
  "transform",  // calculate / filter expressions
  "expr",       // expression anywhere a value is accepted
  "signal",
  "signals",
  "params",     // can carry expressions and selections
  "selection",
  "on",         // event streams
  "datasets",   // named data we did not supply
  "url",        // the loader would fetch it, from this server
  "loader",
]);

/** Bound data is named `@something` and resolved from what the caller supplies;
 *  an inline array is static and passes through. */
const DATASET_PREFIX = "@";

export class UnsafeSpecError extends Error {}

/**
 * Walk the spec and refuse anything executable, naming the path.
 *
 * The path matters: "spec is invalid" sends an author hunting, and these specs
 * are hand-written.
 */
export function assertSafeSpec(node: unknown, path = "spec"): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertSafeSpec(v, `${path}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (DENIED_KEYS.has(key)) {
      throw new UnsafeSpecError(`${path}.${key} is not allowed in a chart shape.`);
    }
    assertSafeSpec(value, `${path}.${key}`);
  }
}

/**
 * Replace every `{ values: "@name" }` with the rows the caller supplied.
 *
 * ⚠ THIS IS THE ONLY BINDING MECHANISM, and it is deliberately not a language:
 * a name lookup, nothing evaluated. It exists because a layered chart needs
 * more than one dataset — the VoC plot draws its weight line from two
 * endpoints while its bubbles come from every team × spec row — and inlining
 * those would make the shape round-specific rather than reusable.
 *
 * An unknown name resolves to an EMPTY array rather than throwing: a chart
 * missing one layer's data is still readable, and a half-configured chart is
 * meant to render as-is.
 */
function bindDatasets(node: any, datasets: Record<string, unknown[]>): any {
  if (Array.isArray(node)) return node.map((v) => bindDatasets(v, datasets));
  if (!node || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "values" && typeof value === "string" && value.startsWith(DATASET_PREFIX)) {
      out[key] = datasets[value.slice(1)] ?? [];
      continue;
    }
    out[key] = bindDatasets(value, datasets);
  }
  return out;
}

/**
 * A loader that refuses everything.
 *
 * `url` is denied above, so nothing should reach this — it is the second lock,
 * because a Vega release that resolves a URL through a key we have not denied
 * would otherwise turn this server into a fetcher on behalf of whoever can
 * write a spec.
 */
const refusingLoader = () =>
  ({
    load:   () => Promise.reject(new Error("Chart specs may not load external data.")),
    sanitize: () => Promise.reject(new Error("Chart specs may not load external data.")),
    http:   () => Promise.reject(new Error("Chart specs may not load external data.")),
    file:   () => Promise.reject(new Error("Chart specs may not load external data.")),
  }) as unknown as vega.Loader;

export interface RenderChartArgs {
  /** The stored shape, parsed. */
  spec: unknown;
  /** `@name` → rows. */
  datasets?: Record<string, unknown[]>;
}

/**
 * Spec + rows → SVG string.
 *
 * Throws `UnsafeSpecError` for a spec that carries executable surface, and a
 * plain Error for one Vega-Lite cannot compile. The caller decides whether that
 * is a 400 (the author's spec) or a 500.
 */
export async function renderChartToSvg({
  spec,
  datasets = {},
}: RenderChartArgs): Promise<string> {
  assertSafeSpec(spec);

  const bound = bindDatasets(spec, datasets);

  // Compile Vega-Lite → Vega, then render. `renderer: "none"` builds the scene
  // graph without a DOM; `toSVG` serialises it. No canvas is involved, which is
  // why this needs no native module.
  const compiled = vegaLite.compile(bound as any).spec;

  const view = new vega.View(vega.parse(compiled), {
    renderer: "none",
    loader: refusingLoader(),
    // Vega logs scale and encoding warnings to stderr otherwise, once per
    // chart per team per round.
    logLevel: vega.Error,
  });

  try {
    return await view.toSVG();
  } finally {
    // Views hold timers and dataflow state. Not finalising leaks them for every
    // chart rendered, and a debrief renders many.
    view.finalize();
  }
}
