/**
 * GET /round-debrief?simulationId=&roundNumber=
 *
 * The PLAYER-FACING debrief: the cross-team comparison a team sees in limbo,
 * after the round is calculated and before it confirms the next phase.
 *
 * ── WHY A TEAM MAY READ OTHER TEAMS HERE, WHEN `/reports/:kind` FORBIDS IT ──
 * That rule exists to stop a team reading rivals' decisions BEFORE the round is
 * debriefed, which would let it play against their submissions. The gate below
 * is the same rule, not an exception to it: a team gets the comparison only for
 * a round whose `status === "Completed"`, i.e. one the operator has already
 * calculated and closed. Nothing about a LIVE round is reachable through here.
 *
 * Distinct from `GET /debriefs`, which is the operator's authored markdown
 * wrap-up for the whole simulation. Same word, different artefact.
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import Team from "../models/teams";
import Product from "../models/products";
import Decision from "../models/decisions";
import RoundNote from "../models/roundNote";
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import { ROLES } from "../constants/roles";
import DebriefChartModel from "../models/debriefChart";
import { buildDebriefSeries, type DebriefPayload } from "../services/debriefSeries";
import { buildChartRows } from "../services/debriefChartData";
import { renderChartToSvg } from "../services/chartRenderer";
import { groupByRound, openingCashFrom } from "../services/roundReport";

interface TokenUser {
  id?:     string;
  role?:   string;
  teamId?: string;
}

/**
 * ONE CHART INSTANCE with this round's copy joined on — THE WIRE SHAPE.
 *
 * ⚠ NOT one per stored chart. A `scope: "each"` row fans out to N + 1 entries:
 * one per notebook plus an all-notebooks summary. `_id` repeats across them and
 * `productId` is what tells them apart, so anything keying by `_id` alone will
 * collapse a whole notebook breakdown into one.
 */
interface DebriefChartDto {
  _id:        string;
  /** The notebook this instance is for; null = summary, or an `overall` chart. */
  productId:   string | null;
  /** Carried so a reader need not re-join the product list to label it. */
  productName: string | null;
  name:       string;
  category:   string;
  order:      number;
  scope:      "overall" | "each";
  /**
   * The gallery shape's IDENTITY, not its shape.
   *
   * ⚠ `shape` IS DELIBERATELY NOT ON THE WIRE. It is a Vega-Lite spec, and the
   * whole security argument is that the player holds no interpreter and no
   * grammar — only `svg` below. Putting it back here would hand every team the
   * thing the server exists to resolve on their behalf.
   */
  chartStyle: { _id: string; name: string; category: string } | null;
  xAxis:      string | null;
  yAxis:      string | null;
  grouping:   string | null;
  description: string | null;
  resolved:    boolean;
  /**
   * THE FINISHED PICTURE for this instance, drawn here.
   *
   * Null when the chart has no shape, when its spec will not render, or when it
   * is unresolved and therefore never drawn at all. A null is a slide with copy
   * and no figure, never a failed request.
   */
  svg: string | null;
}

/**
 * The wire shape: the numbers, plus the round's RESOLVED charts.
 *
 * `charts` is assembled HERE rather than inside `buildDebriefSeries`, which is
 * pure and emits nothing but figures. Mirrored by hand into both clients'
 * `types.ts`.
 */
interface RoundDebriefResponse extends DebriefPayload {
  charts: DebriefChartDto[];
}

/**
 * The simulation type's charts, with this round's descriptions joined on.
 *
 * A type with NO charts returns an empty array, which is an empty debrief — the
 * starting state of a type nobody has configured.
 *
 * ⚠ THE TEAM FILTER IS RE-APPLIED HERE. `getRoundNotes` narrows a team token to
 * the general notes plus its own, and none of that comes along with a query
 * written in this file — without the same rule, a description targeted at one
 * team is served to every team on the simulation.
 *
 * A team-targeted note WINS over a general one for the same chart: the find is
 * sorted `teamId: 1`, which puts `null` first in BSON order, so the specific
 * row overwrites the general one as the map is filled.
 */
const resolveCharts = async (
  simulationId: string,
  simulationTypeId: unknown,
  roundNumber: number,
  teamId: string | null,
  products: { _id: unknown; productName?: string }[],
  payload: DebriefPayload,
): Promise<DebriefChartDto[]> => {
  const filter: Record<string, unknown> = {
    simulationId,
    roundNumber,
    chartId: { $ne: null },
  };
  // null teamId = staff, who read every note. A team reads general + its own.
  if (teamId) filter.$or = [{ teamId: null }, { teamId }];

  const [charts, notes] = await Promise.all([
    DebriefChartModel.find({ simulationTypeId })
      .sort({ order: 1 })
      .populate("chartStyle")
      .lean(),
    RoundNote.find(filter).sort({ teamId: 1 }).lean(),
  ]);

  // KEYED BY THE PAIR, as strings. `chartId`/`productId` are ObjectIds and two
  // ObjectIds for the same value are different object identities, so a Map
  // keyed on them would never hit. The empty half means "the summary".
  const key = (chartId: unknown, productId: unknown) =>
    `${String(chartId)}:${productId ? String(productId) : ""}`;

  const byInstance = new Map<string, string>();
  for (const n of notes) {
    if (n.chartId) byInstance.set(key(n.chartId, n.productId), n.body ?? "");
  }

  const out: DebriefChartDto[] = [];
  // Every instance's render, in flight at once. Awaited before this returns, so
  // the mutation of each `dto.svg` below has settled by the time anyone reads
  // the array.
  const drawing: Promise<void>[] = [];

  for (const c of charts as any[]) {
    const style = c.chartStyle ?? null;

    // PARSED ONCE PER CHART, not once per instance — a `scope: "each"` row would
    // otherwise re-parse the same text N + 1 times. A shape that is not JSON is
    // an authoring fault the preview already shows; here it just means no
    // picture.
    let spec: unknown = null;
    if (style?.shape) {
      try { spec = JSON.parse(style.shape); } catch { spec = null; }
    }

    const base = {
      _id:      String(c._id),
      name:     c.name,
      category: c.category,
      order:    c.order,
      scope:    (c.scope ?? "overall") as "overall" | "each",
      chartStyle: style
        ? {
            _id:      String(style._id),
            name:     style.name,
            category: style.category,
          }
        : null,
      xAxis:    c.xAxis ?? null,
      yAxis:    c.yAxis ?? null,
      grouping: c.grouping ?? null,
    };

    const instance = (productId: string | null, productName: string | null) => {
      const description = byInstance.get(key(c._id, productId)) ?? null;
      const dto: DebriefChartDto = {
        ...base,
        productId,
        productName,
        description,
        resolved: description !== null,
        svg: null,
      };
      out.push(dto);

      // AN UNRESOLVED CHART IS NEVER DRAWN. The slide hides it, so rendering it
      // would be a Vega compile and an SVG serialisation per team per round for
      // a picture nobody sees — and a debrief has many instances.
      if (!dto.resolved || spec === null) return;

      // ⚠ THE SAME ROW BUILDER THE PREVIEW USES. That is the whole guarantee
      // behind the preview: what the operator approved is what the team reads.
      const rows = buildChartRows({
        payload,
        xAxis:    base.xAxis,
        yAxis:    base.yAxis,
        grouping: base.grouping,
        productId,
      });

      drawing.push(
        renderChartToSvg({ spec, datasets: { rows } })
          .then((svg) => { dto.svg = svg; })
          // SWALLOWED ON PURPOSE. One unrenderable shape must not fail the
          // debrief for every team on the simulation — the slide degrades to
          // copy without a figure. The place a bad spec is meant to be legible
          // is `POST /debrief-charts/preview`, which reports the reason to the
          // author before it is ever saved.
          .catch(() => { dto.svg = null; }),
      );
    };

    // THE SUMMARY ALWAYS EXISTS, for both scopes — for `overall` it is the only
    // instance, for `each` it is the all-notebooks chart that sits alongside
    // the per-notebook ones.
    instance(null, null);

    if (base.scope === "each") {
      for (const p of products) {
        instance(String(p._id), p.productName ?? null);
      }
    }
  }

  await Promise.all(drawing);
  return out;
};

export const getRoundDebrief = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    const user = (req as { user?: TokenUser }).user ?? {};

    if (!simulationId || !mongoose.isValidObjectId(String(simulationId))) {
      res.status(400).json({ message: "A valid simulationId is required." });
      return;
    }
    const round = Number(roundNumber);
    if (!Number.isInteger(round) || round < 0) {
      // 0-BASED on the server; the client's `phase` is 1-based and converts at
      // its own seam. See the round-numbering note in the player client.
      res.status(400).json({ message: "roundNumber must be a non-negative integer." });
      return;
    }

    const isTeam = user.role === ROLES.TEAM;

    // ── The gate ────────────────────────────────────────────────────────────
    // Checked BEFORE anything is loaded, so a refused caller cannot infer what
    // exists from a timing difference or an error further down.
    if (isTeam) {
      if (!user.teamId) {
        res.status(403).json({ message: "Team token carries no team." });
        return;
      }
      const onSimulation = await Team.exists({ _id: user.teamId, simulationId });
      if (!onSimulation) {
        res.status(403).json({ message: "That team is not on this simulation." });
        return;
      }
      // THE GATE IS `scored`, NOT `Round.status`.
      //
      // Status and "has been calculated" are independent: `POST /rounds/:id/
      // calculate` runs the calculation WITHOUT touching status, `/end` does
      // both, and `PATCH /:id/status` sets status with no calculation at all.
      // Gating on status was wrong in both directions — it refused a round that
      // had been calculated but not ended, and admitted one marked Completed
      // with nothing scored, which renders an empty debrief.
      //
      // `scored` is the stronger signal AND the safer one: `roundCalculation`
      // is its only writer, so it cannot be set out of band, an open round's
      // decisions never carry it, and its presence is precisely the condition
      // "there is something to show".
      const calculated = await Decision.exists({
        simulationId,
        roundNumber: round,
        scored: { $ne: null },
      });
      if (!calculated) {
        // 404, not 403: a team asking early should learn that there is no
        // debrief yet, not that one exists and is being withheld.
        res.status(404).json({ message: `Round ${round} has not been calculated yet.` });
        return;
      }
    }

    const simulation = await Simulation.findById(simulationId).lean();
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }
    // DERIVED, never a parameter. A simulation belongs to exactly one type, so
    // `simulationId` already determines this — asking the caller for it would
    // add a value the request cannot contradict and the server would have to
    // look up regardless.
    const simulationTypeId = (simulation as { simulationTypeId?: unknown }).simulationTypeId;

    // No GlobalInput load: the decision snapshots every lever figure the
    // debrief needs (energy, category, options), and reading the live config
    // would let an operator edit rewrite a finished round.
    const [teams, products, allDecisions, playerConfig] = await Promise.all([
      Team.find({ simulationId }).lean(),
      Product.find({ simulationTypeId }).lean(),
      // EVERY round up to this one: the progress lines and the cash walk both
      // need the run, not the round.
      Decision.find({ simulationId, roundNumber: { $lte: round } }).lean(),
      PlayerConfig.findOne({ simulationTypeId }).lean(),
    ]);

    if (teams.length === 0) {
      res.status(404).json({ message: "No teams on this simulation." });
      return;
    }

    const payload = buildDebriefSeries({
      simulationId: String(simulationId),
      roundNumber:  round,
      you:          isTeam ? String(user.teamId) : null,
      teams:        teams as never,
      products:     products as never,
      byRound:      groupByRound(allDecisions) as never,
      cashSeed:     openingCashFrom(playerConfig),
    });

    const charts = await resolveCharts(
      String(simulationId),
      simulationTypeId,
      round,
      isTeam ? String(user.teamId) : null,
      products as never,
      payload,
    );

    const body: RoundDebriefResponse = { ...payload, charts };
    res.status(200).json(body);
  } catch (err: unknown) {
    res.status(500).json({
      message: (err as { message?: string })?.message ?? "Failed to build the round debrief.",
    });
  }
};
