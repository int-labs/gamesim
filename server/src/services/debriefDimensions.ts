import Product from "../models/products";
import GlobalInput from "../models/globalInputs";
import { CLIENT_CHARTS, type ClientChart } from "../constants/clientCharts";

/**
 * WHAT A CHART MAY PLOT, for one simulation type.
 *
 * The operator's X / Y / grouping selects read this. They were free text, and a
 * typo saved fine and then silently never resolved — the worst failure mode on
 * that page, because the person who hits it is the one least able to diagnose
 * it.
 *
 * ── WHY IT TAKES A simulationTypeId ─────────────────────────────────────────
 * Most of this list is fixed by the model, but not all of it: the notebooks
 * come from that type's Products, and the lever and cost keys are OPERATOR FREE
 * TEXT that does not exist until the GlobalInputs are authored. A global list
 * would offer dimensions half of which no sim has.
 *
 * ⚠ IT DESCRIBES THE DEBRIEF PAYLOAD, not the database. Every `field` here is a
 * path a chart row actually carries, so `debriefSeries` and this file move
 * together — adding a figure there without adding it here leaves it unplottable,
 * and the reverse offers a dimension that resolves to nothing.
 */

export interface DebriefDimension {
  /** What the renderer binds to. Stored verbatim in `DebriefChart.xAxis` etc. */
  field: string;
  label: string;
  /** Which slot it can fill. `categorical` divides, `measure` is plotted. */
  kind: "categorical" | "measure";
  /** Where the value lives, so the expander knows which rows to build. */
  source: "team" | "round" | "product" | "lever" | "cost" | "spec" | "measure";
}

/** Fixed by the model — the team-level figures on `DebriefTeamRound`. */
const TEAM_MEASURES: DebriefDimension[] = [
  { field: "revenue",           label: "Revenue",            kind: "measure", source: "team" },
  { field: "cogs",              label: "COGS",               kind: "measure", source: "team" },
  { field: "grossProfit",       label: "Gross profit",       kind: "measure", source: "team" },
  { field: "operatingExpenses", label: "Operating expenses", kind: "measure", source: "team" },
  { field: "netProfit",         label: "Net profit",         kind: "measure", source: "team" },
  { field: "unitsSold",         label: "Units sold",         kind: "measure", source: "team" },
  { field: "customersObtained", label: "Customers obtained", kind: "measure", source: "team" },
  { field: "energy",            label: "Energy spent",       kind: "measure", source: "team" },
  { field: "cashOpening",       label: "Cash at open",       kind: "measure", source: "team" },
  { field: "cashClosing",       label: "Cash at close",      kind: "measure", source: "team" },
];

/** Fixed by the model — the per-notebook figures on `DebriefTeamProduct`. */
const PRODUCT_MEASURES: DebriefDimension[] = [
  { field: "byProduct.revenue",           label: "Revenue (notebook)",      kind: "measure", source: "product" },
  { field: "byProduct.unitsSold",         label: "Units sold (notebook)",   kind: "measure", source: "product" },
  { field: "byProduct.produced",          label: "Produced",                kind: "measure", source: "product" },
  { field: "byProduct.inventoryQty",      label: "Capacity",                kind: "measure", source: "product" },
  { field: "byProduct.closingStock",      label: "Closing stock",           kind: "measure", source: "product" },
  { field: "byProduct.customersObtained", label: "Customers (notebook)",    kind: "measure", source: "product" },
  { field: "byProduct.marketFit",         label: "Market fit",              kind: "measure", source: "product" },
  { field: "byProduct.marketShare",       label: "Market share",            kind: "measure", source: "product" },
  { field: "byProduct.grossProfit",       label: "Gross profit (notebook)", kind: "measure", source: "product" },
  { field: "byProduct.netProfit",         label: "Net profit (notebook)",   kind: "measure", source: "product" },
  { field: "byProduct.sellingPrice",      label: "Selling price",           kind: "measure", source: "product" },
  // ⚠ `dynamicPrice`, NOT `productScore`. The 0..1 `productScore` is a
  // different number on the same object — how the asking price sits against
  // dynamicPrice — and labelling it "product score" on a player surface has
  // been wrong once already.
  { field: "byProduct.dynamicPrice",      label: "Product score",           kind: "measure", source: "product" },
];

/** The things a chart can divide BY. */
const CATEGORICALS: DebriefDimension[] = [
  { field: "team",    label: "Team",     kind: "categorical", source: "team" },
  { field: "round",   label: "Round",    kind: "categorical", source: "round" },
  { field: "product", label: "Notebook", kind: "categorical", source: "product" },
  // The chart's OWN measures as an axis — "units sold vs customers obtained" is
  // one chart divided by measure, not two charts. Offered always: with a single
  // measure bound it is a one-value dimension, which is harmless.
  { field: "measure", label: "Measure",  kind: "categorical", source: "measure" },
];

/** Every fixed measure's display name, by field. The lever, cost and spec
 *  measures are not here — their labels come from the operator's own keys, so
 *  `measureLabel` falls back to the key after the dot. */
const STATIC_LABELS = new Map(
  [...TEAM_MEASURES, ...PRODUCT_MEASURES].map((d) => [d.field, d.label] as const),
);

/**
 * A measure's display name — what a chart prints when the SERIES is the
 * measure.
 *
 * Synchronous and registry-free on purpose: `buildChartRows` is pure and has
 * only the payload, and a label is not worth making it async for. The fallback
 * is the key after the dot, which is what an operator named the lever or spec
 * anyway.
 */
export const measureLabel = (field: string): string => {
  const hit = STATIC_LABELS.get(field);
  if (hit) return hit;
  const dot = field.indexOf(".");
  return dot >= 0 ? field.slice(dot + 1) : field;
};

/**
 * What to PRINT ON AN AXIS bound to this field — categorical or measure.
 *
 * ⚠ THE AXIS TITLE IS A PROPERTY OF THE BINDING, NOT OF THE SHAPE. A shape is
 * reused by every chart that picks it and cannot know whether its x is teams
 * or notebooks, which is why the gallery specs name no axes and the renderer
 * fills them in per chart.
 */
export const axisLabel = (field: string | null | undefined): string | null => {
  if (!field) return null;
  const dim = CATEGORICALS.find((d) => d.field === field);
  return dim ? dim.label : measureLabel(field);
};

export interface DebriefDimensions {
  categorical: DebriefDimension[];
  measures:    DebriefDimension[];
  /** The charts the player draws itself. Served rather than hardcoded in the
   *  console, so the two cannot drift into offering different keys. */
  clientCharts: ClientChart[];
}

/**
 * The fixed dimensions plus the ones this type's own configuration creates.
 *
 * Lever and cost keys are read from the type's GlobalInputs rather than from a
 * round's decisions: a dimension should be offerable before anyone has played,
 * and a decision-derived list would differ round to round.
 */
export const buildDebriefDimensions = async (
  simulationTypeId: string,
): Promise<DebriefDimensions> => {
  const [products, globalInputs] = await Promise.all([
    Product.find({ simulationTypeId }).lean(),
    GlobalInput.find({ simulationTypeId }).lean(),
  ]);

  // Spec axes — per notebook, so the same field key can carry a different
  // meaning on each. Deduped by key, because every notebook declares its own
  // copy of the shared ones and the picker wants one row per axis.
  const specs = new Map<string, string>();
  for (const p of products as any[]) {
    for (const f of p.fields ?? []) {
      if (f?.key && !specs.has(f.key)) specs.set(f.key, f.label ?? f.key);
    }
  }

  // `category` on a GlobalInput is the lever CONTAINER — the same string
  // `energyByLever` and `costByCategory` are keyed by on the wire.
  const levers = new Map<string, string>();
  for (const g of globalInputs as any[]) {
    const key = g?.category;
    if (key && !levers.has(key)) levers.set(key, g.label ?? key);
  }

  const measures: DebriefDimension[] = [
    ...TEAM_MEASURES,
    ...PRODUCT_MEASURES,
    ...[...specs].map(([key, label]): DebriefDimension => ({
      field: `spec.${key}`,
      label: `${label} (spec)`,
      kind: "measure",
      source: "spec",
    })),
    ...[...levers].map(([key, label]): DebriefDimension => ({
      field: `energyByLever.${key}`,
      label: `Energy — ${label}`,
      kind: "measure",
      source: "lever",
    })),
    ...[...levers].map(([key, label]): DebriefDimension => ({
      field: `costByCategory.${key}`,
      label: `Cost — ${label}`,
      kind: "measure",
      source: "cost",
    })),
  ];

  const categorical: DebriefDimension[] = [
    ...CATEGORICALS,
    ...(levers.size > 0
      ? [{ field: "lever", label: "Lever", kind: "categorical" as const, source: "lever" as const }]
      : []),
    ...(specs.size > 0
      ? [{ field: "spec", label: "Spec", kind: "categorical" as const, source: "spec" as const }]
      : []),
  ];

  return { categorical, measures, clientCharts: CLIENT_CHARTS };
};
