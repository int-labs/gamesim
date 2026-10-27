import Product from "../models/products";
import GlobalInput from "../models/globalInputs";

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
  source: "team" | "round" | "product" | "lever" | "cost" | "spec";
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
];

export interface DebriefDimensions {
  categorical: DebriefDimension[];
  measures:    DebriefDimension[];
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

  return { categorical, measures };
};
