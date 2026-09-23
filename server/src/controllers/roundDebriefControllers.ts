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
import Simulation from "../models/simulations";
import PlayerConfig from "../models/playerConfig";
import { ROLES } from "../constants/roles";
import { buildDebriefSeries } from "../services/debriefSeries";
import { groupByRound, openingCashFrom } from "../services/roundReport";

interface TokenUser {
  id?:     string;
  role?:   string;
  teamId?: string;
}

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

    res.status(200).json(payload);
  } catch (err: unknown) {
    res.status(500).json({
      message: (err as { message?: string })?.message ?? "Failed to build the round debrief.",
    });
  }
};
