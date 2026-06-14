import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================================
// Interface
// ============================================================

export interface ResultsInterface extends Document {
  simulationId:   Types.ObjectId;
  roundNumber:    number;
  productId:      Types.ObjectId;
  segmentId:      Types.ObjectId;
  weightedScores: Record<string, number>;
  marketShares:   Record<string, number>;
  createdAt:      Date;
  updatedAt:      Date;
}

// ============================================================
// Schema
// ============================================================

const resultsSchema = new Schema<ResultsInterface>(
  {
    simulationId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Simulation",
      index:    true,
    },
    roundNumber: {
      type:     Number,
      required: true,
    },
    productId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Product",
    },
    segmentId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Segment",
    },
    weightedScores: {
      type:    Schema.Types.Mixed,  // { [teamId]: score }
      default: {},
    },
    marketShares: {
      type:    Schema.Types.Mixed,  // { [teamId]: marketShare }
      default: {},
    },
  },
  { timestamps: true }
);

// Compound index: one results document per product+segment+round per simulation
resultsSchema.index(
  { simulationId: 1, roundNumber: 1, productId: 1, segmentId: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const Results = mongoose.model<ResultsInterface>("Results", resultsSchema, "results");

export default Results;