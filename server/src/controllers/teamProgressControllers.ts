import { Request, Response } from "express";
import TeamProgress from "../models/teamProgress";
import { ROLES } from "../constants/roles";

/**
 * Live progress: the player writes, the operator reads.
 *
 * ── IDENTITY COMES FROM THE TOKEN, NEVER THE BODY ───────────────────────────
 * A team's JWT carries `{ role: "team", teamId, simulationId }`. This route
 * takes both ids from there and ignores any the caller sends, so one team
 * cannot write — or fake — another team's progress. That matters more here
 * than on most routes: a facilitator makes live decisions off this view, and a
 * team that could write a rival's row could hide that it is stuck.
 */

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * PUT /team-progress — heartbeat from a playing team.
 *
 * Upserts one row per `simulation × team × round`. The player calls this on a
 * day-tick, fire-and-forget: a failure here must never interrupt a run, so the
 * response is deliberately small and the player ignores it.
 */
export const putTeamProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, teamId, simulationId } = (req as any).user ?? {};

    if (role !== ROLES.TEAM || !teamId || !simulationId) {
      res.status(403).json({ message: "Only a signed-in team can report progress." });
      return;
    }

    const { roundNumber, day, phase, cash, energy, lines, shopName, ended } = req.body ?? {};

    if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber)) {
      res.status(400).json({ message: "roundNumber is required." });
      return;
    }

    const progress = await TeamProgress.findOneAndUpdate(
      { simulationId, teamId, roundNumber },
      {
        $set: {
          day: num(day),
          phase: num(phase),
          cash: num(cash),
          energy: num(energy),
          lines: num(lines),
          shopName: typeof shopName === "string" ? shopName.slice(0, 80) : null,
          ended: ended === true,
          lastSeenAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ data: progress });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to record progress." });
  }
};

/**
 * GET /team-progress?simulationId=&roundNumber= — the operator's live view.
 *
 * Staff only. A team asking for this would be asking for every rival's cash
 * position mid-round, which is exactly the information the game is about
 * discovering — so it is refused rather than filtered down to their own row.
 */
export const getTeamProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = (req as any).user ?? {};
    if (role === ROLES.TEAM) {
      res.status(403).json({ message: "Live progress is for facilitators." });
      return;
    }

    const { simulationId, roundNumber } = req.query;
    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const filter: Record<string, unknown> = { simulationId };
    if (roundNumber !== undefined) filter.roundNumber = Number(roundNumber);

    const rows = await TeamProgress.find(filter).sort({ lastSeenAt: -1 });
    res.status(200).json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load progress." });
  }
};
