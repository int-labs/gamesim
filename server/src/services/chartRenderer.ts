import * as vega from "vega";
import * as vegaLite from "vega-lite";

/** Render a stored Vega-Lite spec to SVG server-side, so the player never receives a spec. */

/** !important a deny list, not an allow list: keys that execute, fetch, or introduce data we did not supply. */
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

/** Walk the spec and refuse anything executable, naming the path. */
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

/** !important the only binding mechanism; an unknown name yields no rows rather than throwing. */
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

/** A loader that refuses everything: the second lock behind the `url` deny. */
const refusingLoader = () =>
  ({
    load:   () => Promise.reject(new Error("Chart specs may not load external data.")),
    sanitize: () => Promise.reject(new Error("Chart specs may not load external data.")),
    http:   () => Promise.reject(new Error("Chart specs may not load external data.")),
    file:   () => Promise.reject(new Error("Chart specs may not load external data.")),
  }) as unknown as vega.Loader;

export interface ChartLabels {
  /** The chart's own name, drawn as the title. */
  title?: string | null;
  x?: string | null;
  y?: string | null;
}

/** Name the chart and its axes from the configuration; a shape cannot know what it plots. */
function applyLabels(node: any, labels: ChartLabels): any {
  if (!node || typeof node !== "object") return node;

  const out = { ...node };
  if (!("title" in out) && labels.title) out.title = labels.title;

  // !important keyed on the row field, not the channel: horizontal bar swaps them.
  const titleFor = (enc: any): string | null | undefined =>
    enc?.field === "x" ? labels.x : enc?.field === "y" ? labels.y : null;

  const label = (encoding: any) => {
    const next = { ...encoding };
    for (const channel of ["x", "y"] as const) {
      const enc = next[channel];
      if (!enc || typeof enc !== "object") continue;
      const text = titleFor(enc);
      // Only when we HAVE a name for it, an unbound axis keeps the shape's
      // own choice rather than being blanked.
      if (text) next[channel] = { ...enc, title: text };
    }
    return next;
  };

  if (out.encoding) out.encoding = label(out.encoding);
  if (Array.isArray(out.layer)) {
    out.layer = out.layer.map((l: any) =>
      l && typeof l === "object" && l.encoding ? { ...l, encoding: label(l.encoding) } : l,
    );
  }
  return out;
}

export interface RenderChartArgs {
  /** The stored shape, parsed. */
  spec: unknown;
  /** `@name` → rows. */
  datasets?: Record<string, unknown[]>;
  /** The chart's name and what its axes are bound to. */
  labels?: ChartLabels;
}

/** Spec + rows to SVG. Throws `UnsafeSpecError` for executable surface. */
export async function renderChartToSvg({
  spec,
  datasets = {},
  labels,
}: RenderChartArgs): Promise<string> {
  assertSafeSpec(spec);

  // Labels are our own strings, applied after the safety check.
  const bound = applyLabels(bindDatasets(spec, datasets), labels ?? {});

  // Vega-Lite to Vega, then `renderer: "none"` + `toSVG`. No DOM, no canvas.
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
