import mongoose, { Document, Schema, Types } from "mongoose";

// Generic team-round result envelope — the durable, server-computed output of
// finalizing a round, additive alongside the existing product/segment-scoped
// `Results` model (models/Results.ts). `payload` holds the engine's own result
// shape (for FinLit: FinlitPhaseResult) — deliberately not forced into the
// competitive product/segment schema, since the semantics differ.
export interface TeamRoundResultInterface extends Document {
  simulationId: Types.ObjectId;
  roundId: Types.ObjectId;
  roundNumber: number;
  teamId: Types.ObjectId;
  engineKey: string;
  engineVersion: string;
  configVersion: string;
  decisionId: Types.ObjectId;
  payload: Record<string, any>;
  finalizedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamRoundResultSchema = new Schema<TeamRoundResultInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
    roundNumber: { type: Number, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    engineKey: { type: String, required: true },
    engineVersion: { type: String, required: true },
    configVersion: { type: String, required: true },
    decisionId: { type: Schema.Types.ObjectId, ref: "TeamRoundDecision", required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    finalizedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// One result per team per round — finalize is idempotent by checking this
// index rather than relying on a duplicate-key race.
TeamRoundResultSchema.index({ simulationId: 1, roundId: 1, teamId: 1 }, { unique: true });

export default mongoose.model<TeamRoundResultInterface>(
  "TeamRoundResult",
  TeamRoundResultSchema,
  "teamRoundResults"
);
