import mongoose, { Document, Schema, Types } from "mongoose";

// Generic team-round decision envelope, additive alongside the existing
// per-product `Decision` model (models/decisions.ts) — deliberately not the
// same collection, since that model's shape is banking/FMCG-specific and
// still "NOT FINALIZED" for that vertical. This one carries an opaque
// `payload` validated per-engine (see simulation-engines/finlit) rather than
// a fixed product/segment shape, and supports draft -> submitted -> locked
// in place instead of insert-only.
export type TeamRoundDecisionStatus = "draft" | "submitted" | "locked";

export interface TeamRoundDecisionInterface extends Document {
  simulationId: Types.ObjectId;
  roundId: Types.ObjectId;
  teamId: Types.ObjectId;
  engineKey: string;
  status: TeamRoundDecisionStatus;
  payload: Record<string, any>;
  version: number;
  configVersion: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamRoundDecisionSchema = new Schema<TeamRoundDecisionInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    engineKey: { type: String, required: true },
    status: { type: String, enum: ["draft", "submitted", "locked"], required: true, default: "draft" },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
    version: { type: Number, required: true, default: 0 },
    configVersion: { type: String, required: true },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// One decision document per team per round — mutated in place through
// draft/submitted/locked, unlike the legacy Decision model's insert-only index.
TeamRoundDecisionSchema.index({ simulationId: 1, roundId: 1, teamId: 1 }, { unique: true });

export default mongoose.model<TeamRoundDecisionInterface>(
  "TeamRoundDecision",
  TeamRoundDecisionSchema,
  "teamRoundDecisions"
);
