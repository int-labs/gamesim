import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * What a team is doing RIGHT NOW, while the round is open.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The console could see submitted `Decision`s and nothing else. That answers
 * "who is finished" but not the question a facilitator actually has mid-round:
 * *who needs help*. A team stuck on day 12 with no hires and $180 left looks
 * identical, from the console, to a team that has not opened the app.
 *
 * So the player heartbeats a small summary of its local run here. This is
 * DELIBERATELY not the game state:
 *
 *   • It is a read-only projection FOR THE OPERATOR. Nothing scores from it,
 *     nothing is restored from it, and losing it costs a facilitator a live
 *     view for a few seconds and nothing else.
 *   • The player's Zustand store remains the single source of truth for the
 *     run, exactly as `notebook-pixel-sim/CLAUDE.md` describes. Making this
 *     authoritative would mean a network round-trip inside the day-tick, which
 *     is the last place that should be able to fail.
 *   • It is upserted per `simulationId × teamId × roundNumber`, so a team's
 *     row is overwritten in place rather than accumulating a time series. The
 *     history a debrief needs already lives in `Results` / `Projections`.
 *
 * `lastSeenAt` is what makes "idle" distinguishable from "playing" — the
 * console reads staleness, not just the numbers.
 */

export interface TeamProgressInterface extends Document {
  simulationId: Types.ObjectId;
  teamId:       Types.ObjectId;
  roundNumber:  number;

  /** 1..90 in the notebook sim; whatever the game's day counter is elsewhere. */
  day:          number;
  phase:        number;
  /** Cash on hand and energy left — the two numbers a facilitator scans for. */
  cash:         number;
  energy:       number;
  /** How many product lines the team is running. Zero on day 5 is a red flag. */
  lines:        number;
  /** The team's chosen company name, which is what they call themselves. */
  shopName:     string | null;
  /** True once the player's local run has finished (day 90). */
  ended:        boolean;

  lastSeenAt:   Date;
  createdAt:    Date;
  updatedAt:    Date;
}

const teamProgressSchema = new Schema<TeamProgressInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, required: true, ref: "Simulation", index: true },
    teamId:       { type: Schema.Types.ObjectId, required: true, ref: "Team", index: true },
    roundNumber:  { type: Number, required: true },

    day:      { type: Number, default: 0 },
    phase:    { type: Number, default: 0 },
    cash:     { type: Number, default: 0 },
    energy:   { type: Number, default: 0 },
    lines:    { type: Number, default: 0 },
    shopName: { type: String, default: null },
    ended:    { type: Boolean, default: false },

    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One row per team per round — the heartbeat upserts against this.
teamProgressSchema.index(
  { simulationId: 1, teamId: 1, roundNumber: 1 },
  { unique: true }
);

export default mongoose.model<TeamProgressInterface>(
  "TeamProgress",
  teamProgressSchema,
  "teamProgress"
);
