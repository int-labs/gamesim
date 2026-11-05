import Team from "../models/teams";
import Product from "../models/products";
import Decision from "../models/decisions";
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import { buildDebriefSeries, type DebriefPayload } from "./debriefSeries";
import { ALL_KEYS, measureLabel } from "./debriefDimensions";
import { groupByRound, openingCashFrom } from "./roundReport";

/** Turn a chart's bindings into the rows its shape plots. One builder, two callers: the preview and the slide. */

export interface ChartRow {
  /** A label, or a number when `xAxis` is bound to a measure (a scatter). */
  x: string | number | null;
  y: number | null;
  series: string;
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

/** !important the slice overrides the measure's own key, so a `lever` axis reads each in turn. */
function measure(
  teamBlock: any,
  field: string,
  slice: Slice,
  products: DebriefPayload["products"],
): number | null {
  if (!teamBlock) return null;

  const at = (prefix: string) =>
    field.startsWith(prefix) ? field.slice(prefix.length) : null;

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
  payload, xAxis, yAxis, grouping, productId,
}: BuildRowsArgs): ChartRow[] {
  const rows: ChartRow[] = [];
  const measures = toMeasures(yAxis);
  if (measures.length === 0) return rows;

  // !important several measures with nothing naming them fall back to `grouping: measure`.
  const group = grouping ?? (measures.length > 1 ? "measure" : null);

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
            ...xv.slice,
            ...gv.slice,
          };
          rows.push({
            x: xIsMeasure
              ? measure(block, xAxis as string, slice, payload.products)
              : xv.label,
            y: measure(block, slice.measure ?? measures[0], slice, payload.products),
            series: gv.label,
          });
        }
      }
    }
  }

  return rows;
}

/** One drawable instance of a configured chart. */
export interface ChartInstanceRef {
  /** null = the all-notebooks summary, and an `overall` chart's only entry. */
  productId:   string | null;
  productName: string | null;
}

/** !important the one definition of `scope`; both the preview and the slide call it. */
export const chartInstances = (
  scope: "overall" | "each",
  products: readonly { productId: string; productName: string }[],
): ChartInstanceRef[] =>
  scope === "each"
    ? products.map((p) => ({ productId: p.productId, productName: p.productName }))
    : [{ productId: null, productName: null }];

/** The round's figures for the preview, loaded once. Ungated: an admin sees a chart before it is scored. */
export async function loadPreviewPayload(args: {
  simulationId: string;
  roundNumber:  number;
}): Promise<DebriefPayload> {
  const simulation = await Simulation.findById(args.simulationId).lean();
  if (!simulation) throw new Error("Simulation not found.");
  const simulationTypeId = (simulation as { simulationTypeId?: unknown }).simulationTypeId;

  const [teams, products, decisions, playerConfig] = await Promise.all([
    Team.find({ simulationId: args.simulationId }).lean(),
    Product.find({ simulationTypeId }).lean(),
    Decision.find({ simulationId: args.simulationId, roundNumber: { $lte: args.roundNumber } }).lean(),
    PlayerConfig.findOne({ simulationTypeId }).lean(),
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
  });
}
