import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * THE CLIENT-SIDE HALF OF A ROUND'S LEADERBOARD FIGURES.
 *
 * Every metric the competitor report ranks on comes from one of two places, and
 * `LeaderboardConfig` decides which per metric:
 *
 *   origin: 'server'  →  `calcFinancials`, saved on `Decision.scored`
 *   origin: 'client'  →  HERE
 *
 * A client metric exists only because the browser is the only place it can be
 * computed — the insight questions are answered there and nowhere else. It is
 * SELF-REPORTED: the server stores what it is told. Nothing `calcFinancials`
 * can compute may be configured this way.
 *
 * ── WHAT THIS USED TO BE ────────────────────────────────────────────────────
 * A fixed rubric — `total` / `netProfit` / `inventory` / `insight` /
 * `netDollar` / `cleanliness` / `route` / `obligationMet` / `insightsCorrect` /
 * `insightsTotal` — computed by the player's own engine and clamped on arrival.
 * Those fields were WRITE-ONLY: nothing in the server, the admin console or the
 * player ever read one back. They were dropped on 2026-09-21 along with the
 * clamping, and `metrics` is the first thing on this document anything actually
 * consumes. Documents written before that date keep the old fields; nothing
 * reads them, so no migration is needed.
 *
 * One row per `simulation × team × round`, upserted — a team replaying a round
 * overwrites its own report rather than accumulating.
 */

export interface TeamRunReportInterface extends Document {
  simulationId: Types.ObjectId;
  teamId:       Types.ObjectId;
  roundNumber:  number;

  /**
   * CLIENT-ORIGIN LEADERBOARD METRICS, raw.
   *
   * Keyed by the `source` of every `LeaderboardConfig` metric whose `origin` is
   * "client" — the SERVER declares which keys exist, the client fills them in.
   * Values are stored AS SUBMITTED, not scored into a rubric: insight is the
   * count of correct answers, not a 0..25 band.
   *
   * This is what lets a metric the server cannot compute sit on the same
   * leaderboard as one it can. The insight questions are answered in the
   * browser and nowhere else, so no server-side calculation could produce them
   * — but the key set is still configuration, not something the client invents.
   *
   * SELF-REPORTED, and therefore never a home for anything `calcFinancials`
   * computes. See the note on LeaderboardConfig.METRIC_ORIGINS.
   */
  metrics:      Record<string, number>;

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

    // Mixed, not a fixed shape: the key set is LeaderboardConfig's, so adding a
    // client metric must not need a schema change here.
    metrics:  { type: Schema.Types.Mixed, default: {} },

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
