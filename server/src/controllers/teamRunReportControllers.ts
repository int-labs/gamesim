import { Request, Response } from "express";
import TeamRunReport from "../models/teamRunReport";
import { ROLES } from "../constants/roles";

/**
 * A team's own run outcome: the player writes it, the facilitator reads it.
 *
 * Same identity rule as `/team-progress` — `teamId` and `simulationId` come
 * from the token and any the caller sends are ignored, so a team can neither
 * write nor read another team's report. That matters here because these
 * numbers appear in the debrief: a team able to forge one could show the room
 * a run it never had.
 */

/**
 * Client-origin leaderboard metrics, kept RAW but not kept blindly.
 *
 * Dropped rather than coerced: a non-finite value, or a key that could not be a
 * configured `source`, is a bug at the sender and storing a 0 for it would read
 * as a team that scored nothing. Values are NOT clamped — the server has no
 * range for an operator-declared metric, and inventing one would rewrite it.
 *
 * The key shape mirrors CLIENT_SOURCE_PATTERN in models/leaderboardConfig.ts.
 * It is checked here too so a forged key cannot reach a Mixed field, which
 * accepts anything by definition.
 */
const CLIENT_METRIC_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const sanitiseMetrics = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!CLIENT_METRIC_KEY.test(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
};

/** PUT /run-reports — the player posts this once its 90-day run ends. */
export const putRunReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, teamId, simulationId } = (req as any).user ?? {};

    if (role !== ROLES.TEAM || !teamId || !simulationId) {
      res.status(403).json({ message: "Only a signed-in team can file a run report." });
      return;
    }

    const b = req.body ?? {};
    if (typeof b.roundNumber !== "number" || !Number.isFinite(b.roundNumber)) {
      res.status(400).json({ message: "roundNumber is required." });
      return;
    }

    const report = await TeamRunReport.findOneAndUpdate(
      { simulationId, teamId, roundNumber: b.roundNumber },
      {
        $set: {
          // Client-origin leaderboard metrics, RAW. Only finite numbers survive
          // and only keys the config could legitimately declare — the values
          // are not clamped, because the server does not know what range a
          // configured metric has, and inventing one would silently rewrite it.
          //
          // The fixed rubric that used to sit here — total / netProfit /
          // inventory / insight / netDollar / cleanliness / route /
          // obligationMet / insightsCorrect / insightsTotal — was write-only and
          // was dropped on 2026-09-21 with its clamping. See the model.
          metrics: sanitiseMetrics(b.metrics),

          shopName: typeof b.shopName === "string" ? b.shopName.slice(0, 80) : null,
          endedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ data: report });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to file the run report." });
  }
};

/**
 * GET /run-reports?simulationId=&roundNumber= — the cohort's outcomes.
 *
 * Staff read everyone. A team reads only itself, which is what lets the player
 * show a team its own filed report without exposing the room.
 */
export const getRunReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = (req as any).user ?? {};
    const { roundNumber } = req.query;

    const isTeam = caller.role === ROLES.TEAM;
    const simulationId = isTeam ? caller.simulationId : req.query.simulationId;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const filter: Record<string, unknown> = { simulationId };
    if (isTeam) filter.teamId = caller.teamId;
    if (roundNumber !== undefined) filter.roundNumber = Number(roundNumber);

    // By round, then most recent. It sorted `{ total: -1 }` — a rubric field
    // that no longer exists, so every document compared equal and the order was
    // whatever Mongo returned.
    const rows = await TeamRunReport.find(filter).sort({ roundNumber: 1, endedAt: -1 });
    res.status(200).json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load run reports." });
  }
};
