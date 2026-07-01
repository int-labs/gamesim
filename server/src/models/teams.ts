import mongoose, { Document, Schema, Types } from "mongoose";

export interface TeamInterface extends Document {
  simulationId: Types.ObjectId;
  teamName:     string;
  teamLeader?:  string;
  score?:       number;
  marketShare?: number;
  createdAt:    Date;
  updatedAt:    Date;
}

const TeamSchema = new Schema<TeamInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    teamName:     { type: String, required: true },
    teamLeader:   { type: String },
    score:        { type: Number },
    marketShare:  { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model<TeamInterface>("Team", TeamSchema, "teams");