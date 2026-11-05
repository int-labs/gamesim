import Product from "../models/products";
import GlobalInput from "../models/globalInputs";
import { CLIENT_CHARTS, type ClientChart } from "../constants/clientCharts";

/** !important one definition of the "every key" suffix; lives here because debriefChartData imports from this module. */
export const ALL_KEYS = "*";

/** What a chart may plot, per simulation type. The operator's X / Y / grouping selects read this. */

export interface DebriefDimension {
  /** What the renderer binds to. Stored verbatim in `DebriefChart.xAxis` etc. */
  field: string;
  label: string;
  /** Which slot it can fill. `categorical` divides, `measure` is plotted. */
  kind: "categorical" | "measure";
  /** Where the value lives, so the expander knows which rows to build. */
  source: "team" | "round" | "product" | "lever" | "cost" | "spec" | "measure";
}

/** Fixed by the model, the team-level figures on `DebriefTeamRound`. */
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

/** Fixed by the model, the per-notebook figures on `DebriefTeamProduct`. */
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
  // !important `dynamicPrice`, not `productScore`; they are different numbers on the same object.
  { field: "byProduct.dynamicPrice",      label: "Product score",           kind: "measure", source: "product" },
];

/** The things a chart can divide BY. */
const CATEGORICALS: DebriefDimension[] = [
  { field: "team",    label: "Team",     kind: "categorical", source: "team" },
  { field: "round",   label: "Round",    kind: "categorical", source: "round" },
  { field: "product", label: "Notebook", kind: "categorical", source: "product" },
  // The chart's own measures as an axis: one chart divided by measure, not two charts.
  { field: "measure", label: "Measure",  kind: "categorical", source: "measure" },
];

/** Every fixed measure's display name; lever, cost and spec labels come from the operator. */
const STATIC_LABELS = new Map(
  [...TEAM_MEASURES, ...PRODUCT_MEASURES].map((d) => [d.field, d.label] as const),
);

/** A measure's display name. Synchronous and registry-free on purpose. */
export const measureLabel = (field: string): string => {
  const hit = STATIC_LABELS.get(field);
  if (hit) return hit;
  const dot = field.indexOf(".");
  return dot >= 0 ? field.slice(dot + 1) : field;
};

/** !important the axis title is a property of the binding, not of the shape. */
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

/** The fixed dimensions plus the ones this type's own configuration creates. */
export const buildDebriefDimensions = async (
  simulationTypeId: string,
): Promise<DebriefDimensions> => {
  const [products, globalInputs] = await Promise.all([
    Product.find({ simulationTypeId }).lean(),
    GlobalInput.find({ simulationTypeId }).lean(),
  ]);

  // Spec axes are per notebook, deduped by key.
  const specs = new Map<string, string>();
  for (const p of products as any[]) {
    for (const f of p.fields ?? []) {
      if (f?.key && !specs.has(f.key)) specs.set(f.key, f.label ?? f.key);
    }
  }

  // `category` on a GlobalInput is the lever CONTAINER, the same string
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
    // !important totals first; without them every cost measure is a single category.
    ...(levers.size > 0
      ? [
          {
            field: `energyByLever.${ALL_KEYS}`,
            label: "Energy — all levers",
            kind: "measure" as const,
            source: "lever" as const,
          },
          {
            field: `costByCategory.${ALL_KEYS}`,
            label: "Cost — all categories",
            kind: "measure" as const,
            source: "cost" as const,
          },
        ]
      : []),
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
