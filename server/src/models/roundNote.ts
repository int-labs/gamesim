import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Facilitator notes attached to a round.
 *
 * These are the running commentary an operator leaves as a simulation plays —
 * "why Team Beta's share collapsed", "remember the supplier event hit here".
 * They're read alongside that round's results.
 *
 * TARGETING: `teamId: null` means every team sees it. A specific teamId makes
 * it private feedback for that team — a team token only ever receives the
 * general notes plus its own (see the controller), never another team's.
 *
 * Several notes per round are allowed on purpose, so the index is NOT unique.
 */

export interface RoundNoteInterface extends Document {
  simulationId: Types.ObjectId;
  roundNumber: number;
  teamId: Types.ObjectId | null;
  /**
   * Which debrief chart this note describes — a `DEBRIEF_CHARTS` **name**, not
   * its `id`; see constants/debriefCharts.ts for why the ordinal is not a join
   * key. `null` is the free-standing facilitator note, which renders in its own
   * panel rather than against a chart.
   */
  chartId: string | null;
  title: string;
  /** Markdown. Rendered as plain text until a renderer is wired in. */
  body: string;
  imageAssetId: Types.ObjectId | null;
  authorUserId: Types.ObjectId | null;
  /** Pinned notes sort first, regardless of age. */
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roundNoteSchema = new Schema<RoundNoteInterface>(
  {
    simulationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Simulation",
      index: true,
    },
    roundNumber: { type: Number, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    // NOT an enum: the catalogue lives in constants/debriefCharts.ts and an
    // enum here would mean a migration every time a slide is added.
    chartId: { type: String, default: null, trim: true, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", maxlength: 5000 },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roundNoteSchema.index({ simulationId: 1, roundNumber: 1, teamId: 1 });

export default mongoose.model<RoundNoteInterface>("RoundNote", roundNoteSchema, "roundNotes");
