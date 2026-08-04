import { Request, Response } from "express";
import TeamRunReport from "../models/TeamRunReport";
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

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Keep a rubric component inside the range the design PDF fixes for it. */
const clamp = (v: unknown, max: number): number =>
  Math.min(Math.max(num(v), 0), max);

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
          // Clamped to the rubric's own ranges rather than trusted: the client
          // computes these, and a debrief showing 340/100 would be worse than
          // showing nothing.
          total: clamp(b.total, 100),
          netProfit: clamp(b.netProfit, 50),
          inventory: clamp(b.inventory, 25),
          insight: clamp(b.insight, 25),

          // Not clamped — a real run can end deeply negative, and hiding that
          // would remove the most instructive outcome in the room.
          netDollar: num(b.netDollar),
          cleanliness: Math.min(Math.max(num(b.cleanliness), 0), 1),

          route: b.route === "self" || b.route === "investor" ? b.route : null,
          obligationMet: typeof b.obligationMet === "boolean" ? b.obligationMet : null,
          insightsCorrect: num(b.insightsCorrect),
          insightsTotal: num(b.insightsTotal),

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

    const rows = await TeamRunReport.find(filter).sort({ total: -1 });
    res.status(200).json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load run reports." });
  }
};
