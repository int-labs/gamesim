/** GET /round-debrief: the player-facing cross-team comparison, gated on `Decision.scored`. */

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
import { buildChartRows, chartInstances, toMeasures } from "../services/debriefChartData";
import { renderChartToSvg } from "../services/chartRenderer";
import { axisLabel, measureLabel } from "../services/debriefDimensions";
import { groupByRound, openingCashFrom } from "../services/roundReport";
import TeamRunReport from "../models/teamRunReport";
import LeaderboardConfig, { type LeaderboardMetric } from "../models/leaderboardConfig";
import { scoreAllRounds } from "../services/leaderboard";
import type { ScoredLeaderboard } from "../services/reportMatrix";

interface TokenUser {
  id?:     string;
  role?:   string;
  teamId?: string;
}

/** One chart instance with this round's copy joined on. !important not one per stored chart: `scope: each` fans out. */
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
  /** The gallery shape's identity only. !important `shape` is never on the wire. */
  chartStyle: { _id: string; name: string; category: string } | null;
  /** Set means the client draws it; `svg` is null and the bindings are inert. */
  clientChart: string | null;
  xAxis:      string | null;
  /** ALWAYS AN ARRAY on the wire, however the document stores it. */
  yAxis:      string[];
  grouping:   string | null;
  description: string | null;
  resolved:    boolean;
  /** Null when the chart has no shape or its spec will not render. */
  svg: string | null;
}

/** The wire shape: the numbers plus the round's charts. */
/** One team's cell in a metric's column. */
interface LeaderboardScoreDto {
  value:  number | null;
  rank:   number | null;
  points: number | null;
}

/** One metric, ranked across the teams that have a figure for it this round. */
interface LeaderboardBlockDto {
  metricKey: string;
  label:     string;
  format:    LeaderboardMetric["format"];
  weight:    number;
  /** teamId → that team's cell. */
  scores: Record<string, LeaderboardScoreDto>;
}

/** !important the cumulative half is POINTS ONLY; everything else is this round's. */
interface LeaderboardDto {
  blocks: LeaderboardBlockDto[];
  /** teamId → points across every round up to this one. */
  totals: Record<string, number>;
  /** teamId → placing on those totals, ties sharing the better one. */
  standing: Record<string, number>;
}

/** Maps do not survive `JSON.stringify`, so the wire shape is plain objects. */
const toLeaderboardDto = (b: ScoredLeaderboard | null): LeaderboardDto | null =>
  b == null ? null : {
    blocks: b.round.blocks.map((blk) => ({
      metricKey: blk.metricKey,
      label:     blk.label,
      format:    blk.format,
      weight:    blk.weight,
      scores:    Object.fromEntries(blk.scores),
    })),
    totals:   Object.fromEntries(b.totals),
    standing: Object.fromEntries(b.standing),
  };

interface RoundDebriefResponse extends DebriefPayload {
  charts: DebriefChartDto[];
  /** Null when the operator has configured no metrics. */
  leaderboard: LeaderboardDto | null;
}

/** The type's charts with this round's descriptions joined on; no charts is an empty debrief. */
const resolveCharts = async (
  simulationId: string,
  simulationTypeId: unknown,
  roundNumber: number,
  teamId: string | null,
  /** The notebooks come off `payload.products`, the same list the preview
   *  fans out over, so the two cannot disagree about what `each` produces. */
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

  // !important keyed by the pair as strings: two ObjectIds for one value are different identities.
  const key = (chartId: unknown, productId: unknown) =>
    `${String(chartId)}:${productId ? String(productId) : ""}`;

  const byInstance = new Map<string, string>();
  for (const n of notes) {
    if (n.chartId) byInstance.set(key(n.chartId, n.productId), n.body ?? "");
  }

  const out: DebriefChartDto[] = [];
  // Every render in flight at once, awaited before this returns.
  const drawing: Promise<void>[] = [];

  for (const c of charts as any[]) {
    const style = c.chartStyle ?? null;

    // Parsed once per chart, not per instance.
    let spec: unknown = null;
    // A client-drawn chart is never compiled here even if a shape was also picked.
    if (style?.shape && !c.clientChart) {
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
      clientChart: c.clientChart ?? null,
      xAxis:    c.xAxis ?? null,
      // Normalised ONCE, here, so neither client has to know that older
      // documents hold a bare string.
      yAxis:    toMeasures(c.yAxis),
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

      // Every chart is drawn, described or not. `resolved` reports whether
      // anyone wrote about it; it does not decide visibility.
      if (spec === null) return;

      // !important THE SAME ROW BUILDER THE PREVIEW USES. That is the whole guarantee
      // behind the preview: what the operator approved is what the team reads.
      const rows = buildChartRows({
        payload,
        xAxis:    base.xAxis,
        yAxis:    base.yAxis,
        grouping: base.grouping,
        productId,
      });

      drawing.push(
        renderChartToSvg({
          spec,
          datasets: { rows },
          // Axes only, no title: every surface draws the chart's name as its own heading.
          labels: {
            x: axisLabel(base.xAxis),
            y: base.yAxis.map(measureLabel).join(" · ") || null,
          },
        })
          .then((svg) => { dto.svg = svg; })
          // !important swallowed: one unrenderable shape must not fail the debrief for every team.
          .catch(() => { dto.svg = null; }),
      );
    };

    // !important the same fan-out the preview uses, over the same notebook list.
    for (const inst of chartInstances(base.scope, payload.products)) {
      instance(inst.productId, inst.productName);
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

    // Checked before anything loads, so a refused caller cannot infer existence.
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
      // !important the gate is `scored`, not `Round.status`; calculate and close are separate actions.
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
    // Derived, never a parameter: a simulation belongs to exactly one type.
    const simulationTypeId = (simulation as { simulationTypeId?: unknown }).simulationTypeId;

    // No GlobalInput load: the decision snapshots every lever figure the debrief needs.
    const [teams, products, allDecisions, playerConfig, allRunReports, lbConfig] =
      await Promise.all([
        Team.find({ simulationId }).lean(),
        Product.find({ simulationTypeId }).lean(),
        // EVERY round up to this one: the progress lines and the cash walk both
        // need the run, not the round.
        Decision.find({ simulationId, roundNumber: { $lte: round } }).lean(),
        PlayerConfig.findOne({ simulationTypeId }).lean(),
        // The leaderboard's client-origin half, and the metrics that rank on it.
        TeamRunReport.find({ simulationId, roundNumber: { $lte: round } }).lean(),
        LeaderboardConfig.findOne({ simulationTypeId }).lean(),
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
      payload,
    );

    // Same scorer the round reports run, so the two cannot disagree on points.
    const byRoundDecisions = groupByRound(allDecisions);
    const board = scoreAllRounds(
      (lbConfig as { metrics?: LeaderboardMetric[] } | null)?.metrics ?? [],
      round,
      teams.map((t) => String((t as { _id: unknown })._id)),
      byRoundDecisions as never,
      groupByRound(allRunReports) as never,
    );

    const body: RoundDebriefResponse = {
      ...payload,
      charts,
      leaderboard: toLeaderboardDto(board),
    };
    res.status(200).json(body);
  } catch (err: unknown) {
    res.status(500).json({
      message: (err as { message?: string })?.message ?? "Failed to build the round debrief.",
    });
  }
};
