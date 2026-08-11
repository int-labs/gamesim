import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * How a team's own 90-day run finished.
 *
 * ── THIS IS NOT THE COMPETITIVE SCORE ───────────────────────────────────────
 * The platform already has two authoritative numbers, and this is neither:
 *
 *   `Results`      — how teams compared (calcMarketModel: weighted score, share)
 *   `Projections`  — the server's financials (calcFinancials)
 *
 * This is the third, different thing: what the PLAYER's own FinLit engine
 * produced for that team — the rubric from the design PDF (Net Profit 50 ·
 * Inventory Cleanliness 25 · Insight 25). The two models genuinely differ and
 * always will; that is documented, not a defect. Storing this does not make it
 * authoritative for anything competitive, and nothing scores from it.
 *
 * It exists because the debrief and the standings were arguing about teams
 * without ever seeing what those teams actually experienced. A team that
 * finished with $6,700 and a clean inventory knows it; until now the console
 * did not.
 *
 * One row per `simulation × team × round`, upserted — a team replaying a round
 * overwrites its own report rather than accumulating.
 */

export interface TeamRunReportInterface extends Document {
  simulationId: Types.ObjectId;
  teamId:       Types.ObjectId;
  roundNumber:  number;

  /** The rubric, all as the player computed them. */
  total:        number;  // 0..100
  netProfit:    number;  // 0..50
  inventory:    number;  // 0..25
  insight:      number;  // 0..25

  /** Raw net profit in dollars — the number a team actually quotes. */
  netDollar:    number;
  /** 0..1 — how little of the run was spent over- or under-stocked. */
  cleanliness:  number;

  route:        string | null;   // 'self' | 'investor'
  obligationMet: boolean | null; // investor route only
  insightsCorrect: number;
  insightsTotal:   number;

  /** The team's own company name, as they chose it. */
  shopName:     string | null;
  endedAt:      Date;
  createdAt:    Date;
  updatedAt:    Date;
}

const teamRunReportSchema = new Schema<TeamRunReportInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, required: true, ref: "Simulation", index: true },
    teamId:       { type: Schema.Types.ObjectId, required: true, ref: "Team", index: true },
    roundNumber:  { type: Number, required: true },

    total:     { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    inventory: { type: Number, default: 0 },
    insight:   { type: Number, default: 0 },

    netDollar:   { type: Number, default: 0 },
    cleanliness: { type: Number, default: 0 },

    route:           { type: String, default: null },
    obligationMet:   { type: Boolean, default: null },
    insightsCorrect: { type: Number, default: 0 },
    insightsTotal:   { type: Number, default: 0 },

    shopName: { type: String, default: null },
    endedAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

teamRunReportSchema.index(
  { simulationId: 1, teamId: 1, roundNumber: 1 },
  { unique: true }
);

export default mongoose.model<TeamRunReportInterface>(
  "TeamRunReport",
  teamRunReportSchema,
  "teamRunReports"
);
