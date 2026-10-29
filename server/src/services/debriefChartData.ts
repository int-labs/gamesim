import Team from "../models/teams";
import Product from "../models/products";
import Decision from "../models/decisions";
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import { buildDebriefSeries, type DebriefPayload } from "./debriefSeries";
import { ALL_KEYS, measureLabel } from "./debriefDimensions";
import { groupByRound, openingCashFrom } from "./roundReport";

/**
 * Turn a chart's BINDINGS into the rows its shape plots.
 *
 * ── ONE BUILDER, TWO CALLERS ────────────────────────────────────────────────
 * The preview and the real slide must come through here, or the operator
 * approves one chart and the team is shown another. If those two ever disagree,
 * a second row builder has appeared somewhere and that is the bug.
 *
 * ⚠ IT READS THE DEBRIEF PAYLOAD, not the database. `debriefSeries` stays the
 * single place a figure is derived; this file only reshapes what that emits
 * into `{x, y, series}` rows. A measure that is not on the payload cannot be
 * plotted, which is why `debriefDimensions` describes the payload rather than
 * the schema.
 */

export interface ChartRow {
  /**
   * A LABEL, or a NUMBER when `xAxis` is bound to a measure.
   *
   * A scatter needs both axes quantitative — "price vs units sold" has no
   * categorical axis at all. Which one a shape expects is the shape's business:
   * it declares `"type": "nominal"` or `"quantitative"` on the x encoding.
   */
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
  /** Narrows every row to one notebook — the `each` instances. */
  productId: string | null;
}

/**
 * The measures a chart plots, however they were stored.
 *
 * ⚠ THE ONLY PLACE `yAxis`'s SHAPE IS INTERPRETED. It was a single string until
 * 2026-10-27 and documents written before that still hold one, so every reader
 * comes through here rather than each deciding for itself what a bare string
 * means.
 */
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

/**
 * WHICH SLICE OF A TEAM'S ROUND a row is reading.
 *
 * Filled in by whichever dimensions `xAxis` and `grouping` name. It is what
 * makes a dimension a PIVOT rather than a label: binding x to `lever` does not
 * merely write lever names along the axis, it reads the measure AT that lever.
 */
interface Slice {
  productId?: string;
  lever?:     string;
  spec?:      string;
  /** Which of the chart's measures this row reads. Only meaningful once more
   *  than one is bound. */
  measure?:   string;
}

/**
 * One key of an operator-keyed map, or the sum of every key.
 *
 * Summing when nothing pivots mirrors what `byProduct.*` already does above:
 * an unsliced chart over a per-member measure totals its members.
 */
function keyedTotal(map: any, key: string): number | null {
  if (key !== ALL_KEYS) return num(map?.[key]);
  const values = Object.values(map ?? {});
  // A team with no levers at all is a GAP, not a zero — same rule as `num`.
  if (values.length === 0) return null;
  return sum(values.map(num));
}

/**
 * Read one measure for one team, through a slice.
 *
 * ⚠ THE SLICE OVERRIDES THE MEASURE'S OWN KEY. `energyByLever.marketing` on a
 * chart whose x is `lever` reads each lever in turn, not marketing — the suffix
 * is what the field means when nothing is pivoting on it. Without that rule
 * "Energy allocation" could only ever be authored as one chart per lever.
 *
 * Returns null rather than 0 for anything missing: a team that did not play a
 * round is a GAP, and zero would draw as a real value at the floor.
 */
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
    // Spec values are stored by `fieldId`, and a chart binds by `key` — the
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

/**
 * The dimension names. Anything else in `xAxis` or `grouping` is a MEASURE
 * field, which is how a quantitative axis is told from a categorical one — the
 * registry hands out these six names and nothing else that is categorical.
 */
const DIMENSIONS = new Set(["team", "round", "product", "lever", "spec", "measure"]);

/** The operator-keyed map a measure reads, so a `lever` axis offers that map's
 *  own keys rather than the union of two unrelated ones. */
const mapForMeasure = (yAxis: string): "costByCategory" | "energyByLever" =>
  yAxis.startsWith("costByCategory.") ? "costByCategory" : "energyByLever";

/**
 * Rows for one chart.
 *
 * `x` and `grouping` are CATEGORICAL and `y` is the measure. Both categorical
 * slots expand, so a chart is the cross of whatever they name — and an unbound
 * slot falls back to the team rather than refusing, because a half-configured
 * chart is meant to render as-is.
 *
 * ⚠ TEAMS ARE ALWAYS ITERATED. The debrief is a cross-team comparison; a chart
 * that named neither team nor round would otherwise collapse every team into
 * one row and quietly show the first one's figures.
 */
export function buildChartRows({
  payload, xAxis, yAxis, grouping, productId,
}: BuildRowsArgs): ChartRow[] {
  const rows: ChartRow[] = [];
  const measures = toMeasures(yAxis);
  if (measures.length === 0) return rows;

  // ⚠ SEVERAL MEASURES AND NOTHING NAMING THEM would draw them on top of one
  // another at the same x, with the same series — indistinguishable, and the
  // operator would read it as a broken chart rather than an unfinished one. The
  // series becomes the measure instead, which is the only reading that shows
  // every value the chart was bound to.
  const group = grouping ?? (measures.length > 1 ? "measure" : null);

  // X BOUND TO A MEASURE makes this a scatter: the axis carries a number, not
  // a label, and nothing expands along it — one point per row the other
  // dimensions produce.
  const xIsMeasure = !!xAxis && !DIMENSIONS.has(xAxis);

  const here = payload.rounds.find((r) => r.roundNumber === payload.roundNumber) ?? null;

  // ROUND on an axis means every round, not just this one — it is the only
  // binding that reads the whole run.
  const overRounds = xAxis === "round" || group === "round";
  const scope = overRounds ? payload.rounds : here ? [here] : [];

  // Lever and spec keys are OPERATOR FREE TEXT, collected from the payload
  // rather than from a list — the same rule the old breakdowns followed, or
  // renaming one on the console silently drops a whole band.
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

      // A measure-bound x does not expand — it is read per row, like y.
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

/**
 * WHAT A STORED CHART FANS OUT TO — the one definition of `scope`.
 *
 * ⚠ BOTH THE PREVIEW AND THE REAL SLIDE CALL THIS. They did not, and the
 * preview quietly rendered one chart where the slide shipped several. A second
 * reading of what "each" means is exactly the bug this guards.
 *
 *   overall  ONE chart over every notebook at once.
 *   each     ONE PER NOTEBOOK. N, not N + 1 — there is no summary.
 *
 * ⚠ `each` CARRIED A SUMMARY UNTIL 2026-10-27. Owner's ruling: a section that
 * wants both an overall figure and a per-notebook breakdown is TWO ENTRIES,
 * not one chart with a special extra instance. The two answer different
 * questions, they want different copy, and an operator who wants only the
 * breakdown should not have to leave a summary deliberately unwritten to hide
 * it.
 *
 * The consequence to know: a description written against the old summary
 * instance of an `each` chart (`productId: null`) no longer has a row that
 * reaches it. Nothing deletes it; it is simply unreachable.
 */
export const chartInstances = (
  scope: "overall" | "each",
  products: readonly { productId: string; productName: string }[],
): ChartInstanceRef[] =>
  scope === "each"
    ? products.map((p) => ({ productId: p.productId, productName: p.productName }))
    : [{ productId: null, productName: null }];

/**
 * The round's figures, for the preview — LOADED ONCE.
 *
 * Mirrors `roundDebriefControllers`' own load deliberately: the preview is an
 * ADMIN tool and carries no team gate, so it must not reuse the player's
 * controller, which refuses an uncalculated round. An operator configuring a
 * chart needs to see it before the round is scored.
 *
 * ⚠ IT RETURNS THE PAYLOAD, NOT ROWS. A `scope: "each"` chart previews N + 1
 * instances and they all read the same round; building rows in here would
 * re-query the database once per notebook.
 */
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
