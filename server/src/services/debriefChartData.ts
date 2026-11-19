import Team from "../models/teams";
import Product from "../models/products";
import Decision from "../models/decisions";
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import GlobalInput from "../models/globalInputs";
import { buildDebriefSeries, type DebriefPayload } from "./debriefSeries";
import { ALL_KEYS, FULFILMENT_RATE, measureLabel } from "./debriefDimensions";
import { groupByRound, openingCashFrom } from "./roundReport";

/** Turn a chart's bindings into the rows its shape plots. One builder, two callers: the preview and the slide. */

export interface ChartRow {
  /** A label, or a number when `xAxis` is bound to a measure (a scatter). */
  x: string | number | null;
  y: number | null;
  series: string;
  /** !important the measure's KEY, so a pivot matches by key, never by its display label. */
  measure: string;
}

/** One combo row per x and series: `y` is yAxis[0] (the bar), `marker` is yAxis[1], `ratio` is their quotient. */
export interface ComboRow {
  x: string | number | null;
  series: string;
  y: number | null;
  marker: number | null;
  ratio: number | null;
  barName: string;
  markerName: string;
}

export interface ChartDatasets {
  rows: ChartRow[];
  [name: string]: unknown[];
}

export interface BuildRowsArgs {
  payload:   DebriefPayload;
  xAxis:     string | null;
  /** One or more measures. See `toMeasures` for why the type is this wide. */
  yAxis:     string | string[] | null;
  grouping:  string | null;
  /** Narrows every row to one notebook, the `each` instances. */
  productId: string | null;
  /** Narrows every row to one global input item, the `eachItem` instances. */
  inputId?:  string | null;
  /** Emit one row per bound measure in every cell, keeping the chart's own grouping. Only the combo asks. */
  allMeasures?: boolean;
}

/** !important the only place `yAxis`'s shape is interpreted; never index it directly. */
export const toMeasures = (yAxis: string | string[] | null | undefined): string[] => {
  if (Array.isArray(yAxis)) return yAxis.filter((m): m is string => !!m);
  return yAxis ? [yAxis] : [];
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const sum = (vals: (number | null)[]): number | null => {
  const hit = vals.filter((v): v is number => v !== null);
  return hit.length ? hit.reduce((a, b) => a + b, 0) : null;
};

/** Which slice of a team's round a row reads; what makes a dimension a pivot. */
interface Slice {
  productId?: string;
  /** The `eachItem` instance's item; the instance floor, like `productId`. */
  inputId?:   string;
  lever?:     string;
  spec?:      string;
  /** Which of the chart's measures this row reads. Only meaningful once more
   *  than one is bound. */
  measure?:   string;
}

/** One key of an operator-keyed map, or the sum of every key when nothing pivots. */
function keyedTotal(map: any, key: string): number | null {
  if (key !== ALL_KEYS) return num(map?.[key]);
  const values = Object.values(map ?? {});
  // A team with no levers at all is a GAP, not a zero, same rule as `num`.
  if (values.length === 0) return null;
  return sum(values.map(num));
}

/** Measures a channel item splits by its share of each notebook's sales; any other measure on an item is a gap. */
const ITEM_SPLIT = new Map([
  ["customersObtained", "customersObtained"], ["byProduct.customersObtained", "customersObtained"],
  ["unitsSold", "unitsSold"],                 ["byProduct.unitsSold", "unitsSold"],
  ["revenue", "revenue"],                     ["byProduct.revenue", "revenue"],
]);

/** !important the slice overrides the measure's own key, so a `lever` axis reads each in turn. */
function measure(
  teamBlock: any,
  field: string,
  slice: Slice,
  products: DebriefPayload["products"],
): number | null {
  if (!teamBlock) return null;

  // Per notebook, because each notebook carries its own channel shares.
  const inputId = slice.inputId;
  if (inputId) {
    const base = ITEM_SPLIT.get(field);
    if (!base) return null;
    const blocks: any[] = slice.productId
      ? [teamBlock.byProduct?.[slice.productId]]
      : Object.values(teamBlock.byProduct ?? {});
    return sum(blocks.map((b) => {
      const share = b?.channelShare?.[inputId];
      const v = num(b?.[base]);
      return share == null || v === null ? null : v * share;
    }));
  }

  const at = (prefix: string) =>
    field.startsWith(prefix) ? field.slice(prefix.length) : null;

  // A ratio of sums, so an overall chart divides the totals instead of adding rates; no demand means no value
  if (field === FULFILMENT_RATE) {
    const blocks: any[] = slice.productId
      ? [teamBlock.byProduct?.[slice.productId]]
      : Object.values(teamBlock.byProduct ?? {});
    const fulfilled = sum(blocks.map((b) => (b?.unitsSold == null ? null : num(b.unitsSold))));
    const demand = sum(blocks.map((b) => (b?.customersObtained == null ? null : num(b.customersObtained))));
    return fulfilled !== null && demand ? fulfilled / demand : null;
  }

  const perProduct = at("byProduct.");
  if (perProduct) {
    // An `overall` chart bound to a per-notebook measure SUMS the notebooks.
    // That is what the old "Revenue by notebook" totals did.
    if (!slice.productId) {
      const blocks = Object.values(teamBlock.byProduct ?? {}) as any[];
      return sum(blocks.map((b) => num(b?.[perProduct])));
    }
    return num(teamBlock.byProduct?.[slice.productId]?.[perProduct]);
  }

  const lever = at("energyByLever.");
  if (lever !== null) return keyedTotal(teamBlock.energyByLever, slice.lever ?? lever);

  const cost = at("costByCategory.");
  if (cost !== null) return keyedTotal(teamBlock.costByCategory, slice.lever ?? cost);

  const spec = at("spec.");
  if (spec !== null) {
    // Spec values are stored by `fieldId`, and a chart binds by `key`, the
    // same axis carries a different fieldId on every notebook.
    const key = slice.spec ?? spec;
    const wanted = slice.productId
      ? products.filter((p) => p.productId === slice.productId)
      : products;
    return sum(wanted.map((p) => {
      const f = p.fields.find((x) => x.key === key);
      return f ? num(teamBlock.byProduct?.[p.productId]?.fieldValues?.[f.fieldId]) : null;
    }));
  }

  return num(teamBlock[field]);
}

/** One value a dimension expands to: what to print, and what it pivots on. */
interface DimValue { label: string; slice: Slice }

const ONE = (label: string): DimValue[] => [{ label, slice: {} }];

/** The dimension names; anything else in `xAxis` or `grouping` is a measure field. */
const DIMENSIONS = new Set(["team", "round", "product", "lever", "spec", "measure"]);

/** The operator-keyed map a measure reads, so a `lever` axis offers that map's
 *  own keys rather than the union of two unrelated ones. */
const mapForMeasure = (yAxis: string): "costByCategory" | "energyByLever" =>
  yAxis.startsWith("costByCategory.") ? "costByCategory" : "energyByLever";

/** Rows for one chart: the cross of `xAxis` and `grouping`. Teams are always iterated. */
export function buildChartRows({
  payload, xAxis, yAxis, grouping, productId, inputId = null, allMeasures = false,
}: BuildRowsArgs): ChartRow[] {
  const rows: ChartRow[] = [];
  const measures = toMeasures(yAxis);
  if (measures.length === 0) return rows;

  // !important several measures with nothing naming them fall back to `grouping: measure`.
  const group = allMeasures
    // !important for the combo the measures are bar and marker ROLES, never a series.
    ? (grouping === "measure" ? null : grouping)
    : grouping ?? (measures.length > 1 ? "measure" : null);

  // X bound to a measure makes this a scatter: nothing expands along the axis.
  const xIsMeasure = !!xAxis && !DIMENSIONS.has(xAxis);

  const here = payload.rounds.find((r) => r.roundNumber === payload.roundNumber) ?? null;

  // ROUND on an axis means every round, not just this one, it is the only
  // binding that reads the whole run.
  const overRounds = xAxis === "round" || group === "round";
  const scope = overRounds ? payload.rounds : here ? [here] : [];

  // Lever and spec keys are operator free text, collected from the payload.
  const whichMap = mapForMeasure(measures[0]);
  const leverKeys: string[] = [];
  for (const r of scope) {
    for (const t of payload.teams) {
      for (const k of Object.keys((r.teams[t.teamId] as any)?.[whichMap] ?? {})) {
        if (!leverKeys.includes(k)) leverKeys.push(k);
      }
    }
  }

  const specKeys = new Map<string, string>();
  for (const p of payload.products) {
    for (const f of p.fields) if (!specKeys.has(f.key)) specKeys.set(f.key, f.label);
  }

  for (const round of scope) {
    for (const team of payload.teams) {
      const block = round.teams[team.teamId];

      const expand = (dim: string | null): DimValue[] => {
        if (dim === "round")   return ONE(`Round ${round.roundNumber + 1}`);
        if (dim === "lever")   return leverKeys.map((k) => ({ label: k, slice: { lever: k } }));
        if (dim === "spec")    return [...specKeys].map(([k, l]) => ({ label: l, slice: { spec: k } }));
        if (dim === "measure") {
          return measures.map((m) => ({ label: measureLabel(m), slice: { measure: m } }));
        }
        if (dim === "product") {
          // A per-notebook INSTANCE is already narrowed to one notebook, so the
          // axis names that one rather than fanning out again.
          if (productId) {
            const p = payload.products.find((x) => x.productId === productId);
            return [{ label: p?.productName ?? "—", slice: { productId } }];
          }
          return payload.products.map((p) => ({
            label: p.productName,
            slice: { productId: p.productId },
          }));
        }
        return ONE(team.teamName); // `team`, and the default for an unbound slot
      };

      // A measure-bound x does not expand, it is read per row, like y.
      const xValues: DimValue[] = xIsMeasure ? [{ label: "", slice: {} }] : expand(xAxis);

      for (const xv of xValues) {
        for (const gv of expand(group)) {
          // The instance's own notebook is the floor: a dimension may narrow
          // further, never widen past it.
          const slice: Slice = {
            productId: productId ?? undefined,
            inputId:   inputId ?? undefined,
            ...xv.slice,
            ...gv.slice,
          };
          // !important a measure-grouped cell already names its measure; otherwise the combo reads every one.
          const cellMeasures = allMeasures && !slice.measure ? measures : [slice.measure ?? measures[0]];
          for (const m of cellMeasures) {
            rows.push({
              x: xIsMeasure
                ? measure(block, xAxis as string, slice, payload.products)
                : xv.label,
              y: measure(block, m, slice, payload.products),
              series: gv.label,
              measure: m,
            });
          }
        }
      }
    }
  }

  return rows;
}

/** Pivot all-measure rows to one row per x and series; the ratio is bar / marker, null when the marker is missing or zero. */
export function toComboRows(rows: ChartRow[], measures: string[]): ComboRow[] {
  const [barKey, markerKey] = measures;
  if (!barKey || !markerKey) return [];

  // !important keyed by x AND series, so each team (or notebook) under one x keeps its own bar.
  const byCell = new Map<string, ComboRow>();
  for (const r of rows) {
    const key = `${String(r.x)}|${r.series}`;
    const row = byCell.get(key) ?? {
      x: r.x, series: r.series, y: null, marker: null, ratio: null,
      barName: measureLabel(barKey), markerName: measureLabel(markerKey),
    };
    if (r.measure === barKey) row.y = r.y;
    if (r.measure === markerKey) row.marker = r.y;
    byCell.set(key, row);
  }

  for (const row of byCell.values()) {
    row.ratio = row.y != null && row.marker ? row.y / row.marker : null;
  }
  return [...byCell.values()];
}

/** Every named dataset a shape may bind: `@rows` for all, `@combo` for the combo. One call, both callers. */
export function chartDatasets(args: BuildRowsArgs): ChartDatasets {
  return {
    rows:  buildChartRows(args),
    // The chart's own x and grouping, with every bound measure read in each cell.
    combo: toComboRows(buildChartRows({ ...args, allMeasures: true }), toMeasures(args.yAxis)),
  };
}

/** One drawable instance of a configured chart. */
export interface ChartInstanceRef {
  /** null = the all-notebooks summary, and an `overall` chart's only entry. */
  productId:   string | null;
  productName: string | null;
  /** Set only on an `eachItem` instance. */
  inputId:     string | null;
  inputLabel:  string | null;
}

/** Customers obtained for one notebook, summed over every team, in the payload's own round. */
const notebookDemand = (payload: DebriefPayload, productId: string): number => {
  const here = payload.rounds.find((r) => r.roundNumber === payload.roundNumber);
  if (!here) return 0;
  return payload.teams.reduce((total, t) => {
    const v = (here.teams[t.teamId] as any)?.byProduct?.[productId]?.customersObtained;
    return total + (v == null ? 0 : num(v) ?? 0);
  }, 0);
};

/** !important the one definition of `scope`; both the preview and the slide call it. */
export const chartInstances = (
  scope: "overall" | "each" | "eachItem",
  products: readonly { productId: string; productName: string }[],
  // A fulfilment chart has no notebook instance where nobody had demand
  binding?: { payload: DebriefPayload; measures: string[]; categories?: string[] },
): ChartInstanceRef[] => {
  const noItem = { inputId: null, inputLabel: null };
  // !important matched by container category, never by item key, so a new sim's containers fan out unchanged.
  if (scope === "eachItem") {
    const wanted = binding?.categories ?? [];
    return (binding?.payload.items ?? [])
      .filter((it) => wanted.includes(it.category))
      .map((it) => ({ productId: null, productName: null, inputId: it.inputId, inputLabel: it.label }));
  }
  if (scope !== "each") return [{ productId: null, productName: null, ...noItem }];
  const needsDemand = !!binding && binding.measures.includes(FULFILMENT_RATE);
  return products
    .filter((p) => !needsDemand || notebookDemand(binding!.payload, p.productId) > 0)
    .map((p) => ({ productId: p.productId, productName: p.productName, ...noItem }));
};

/** The round's figures for the preview, loaded once. Ungated: an admin sees a chart before it is scored. */
export async function loadPreviewPayload(args: {
  simulationId: string;
  roundNumber:  number;
}): Promise<DebriefPayload> {
  const simulation = await Simulation.findById(args.simulationId).lean();
  if (!simulation) throw new Error("Simulation not found.");
  const simulationTypeId = (simulation as { simulationTypeId?: unknown }).simulationTypeId;

  const [teams, products, decisions, playerConfig, globalInputs] = await Promise.all([
    Team.find({ simulationId: args.simulationId }).lean(),
    Product.find({ simulationTypeId }).lean(),
    Decision.find({ simulationId: args.simulationId, roundNumber: { $lte: args.roundNumber } }).lean(),
    PlayerConfig.findOne({ simulationTypeId }).lean(),
    GlobalInput.find({ simulationTypeId }).lean(),
  ]);

  if (teams.length === 0) throw new Error("No teams on this simulation.");

  return buildDebriefSeries({
    simulationId: String(args.simulationId),
    roundNumber:  args.roundNumber,
    you:          null,
    teams:        teams as never,
    products:     products as never,
    byRound:      groupByRound(decisions) as never,
    cashSeed:     openingCashFrom(playerConfig),
    globalInputs: globalInputs as never,
  });
}
