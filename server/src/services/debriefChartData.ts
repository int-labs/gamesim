import Team from "../models/teams";
import Product from "../models/products";
import Decision from "../models/decisions";
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import { buildDebriefSeries, type DebriefPayload } from "./debriefSeries";
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
  x: string;
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
  yAxis:     string | null;
  grouping:  string | null;
  /** Narrows every row to one notebook — the `each` instances. */
  productId: string | null;
}

/** `byProduct.revenue` → `revenue`; everything else is returned unchanged. */
const productField = (field: string): string | null =>
  field.startsWith("byProduct.") ? field.slice("byProduct.".length) : null;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Read one measure for one team, honouring the `byProduct.` prefix and the
 * dotted map paths (`energyByLever.marketing`).
 *
 * Returns null rather than 0 for anything missing: a team that did not play a
 * round is a GAP, and zero would draw as a real value at the floor.
 */
function measure(
  teamBlock: any,
  field: string,
  productId: string | null,
): number | null {
  if (!teamBlock) return null;

  const perProduct = productField(field);
  if (perProduct) {
    if (!productId) {
      // An `overall` chart bound to a per-notebook measure sums the notebooks.
      // That is the only sensible reading, and it is what the old
      // "Revenue by notebook" totals did.
      const blocks = Object.values(teamBlock.byProduct ?? {}) as any[];
      const vals = blocks.map((b) => num(b?.[perProduct])).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }
    return num(teamBlock.byProduct?.[productId]?.[perProduct]);
  }

  // Dotted paths into the operator-keyed maps.
  if (field.includes(".")) {
    const [head, ...rest] = field.split(".");
    return num((teamBlock as any)[head]?.[rest.join(".")]);
  }

  return num(teamBlock[field]);
}

/**
 * Rows for one chart.
 *
 * `x` and `grouping` are CATEGORICAL — team, round or notebook — and `y` is the
 * measure. An unbound slot falls back to something sensible rather than
 * refusing: a half-configured chart is meant to render as-is.
 */
export function buildChartRows({
  payload, xAxis, yAxis, grouping, productId,
}: BuildRowsArgs): ChartRow[] {
  const here = payload.rounds.find((r) => r.roundNumber === payload.roundNumber) ?? null;
  const productName = new Map(payload.products.map((p) => [p.productId, p.productName]));
  const rows: ChartRow[] = [];

  if (!yAxis) return rows;

  // ROUND on an axis means every round, not just this one — it is the only
  // binding that reads the whole run.
  const overRounds = xAxis === "round" || grouping === "round";
  const scope = overRounds ? payload.rounds : here ? [here] : [];

  for (const round of scope) {
    for (const team of payload.teams) {
      const block = round.teams[team.teamId];

      const label = (dim: string | null): string => {
        if (dim === "round")   return `Round ${round.roundNumber + 1}`;
        if (dim === "product") return productId ? (productName.get(productId) ?? "—") : "All";
        return team.teamName; // `team`, and the default for an unbound slot
      };

      if (xAxis === "product" && !productId) {
        // One row per notebook — the breakdown an `overall` chart bound to the
        // notebook axis is asking for.
        for (const p of payload.products) {
          rows.push({
            x: p.productName,
            y: measure(block, yAxis, p.productId),
            series: label(grouping),
          });
        }
        continue;
      }

      rows.push({
        x: label(xAxis),
        y: measure(block, yAxis, productId),
        series: label(grouping),
      });
    }
  }

  return rows;
}

/**
 * Load a round and build its rows — the preview's entry point.
 *
 * Mirrors `roundDebriefControllers`' own load deliberately: the preview is an
 * ADMIN tool and carries no team gate, so it must not reuse the player's
 * controller, which refuses an uncalculated round. An operator configuring a
 * chart needs to see it before the round is scored.
 */
export async function buildPreviewDatasets(args: {
  simulationId: string;
  roundNumber:  number;
  xAxis:        string | null;
  yAxis:        string | null;
  grouping:     string | null;
  productId:    string | null;
}): Promise<ChartDatasets> {
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

  const payload = buildDebriefSeries({
    simulationId: String(args.simulationId),
    roundNumber:  args.roundNumber,
    you:          null,
    teams:        teams as never,
    products:     products as never,
    byRound:      groupByRound(decisions) as never,
    cashSeed:     openingCashFrom(playerConfig),
  });

  return { rows: buildChartRows({ payload, ...args }) };
}
