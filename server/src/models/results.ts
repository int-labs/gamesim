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
  /**
   * teamId → MARKET FIT: normalised `productScore`, summing to 1 across the
   * teams competing for this product.
   *
   * Called `marketShares` until 2026-09-24 and it never was one. It is the
   * ALLOCATION — what a team's decisions earn it of the available market —
   * not a share of the customers won. The real market share is
   * `customersObtained / Σ customersObtained` and lives on
   * `Decision.scored[productId]`, because only the round close has every
   * competitor's figures.
   */
  marketFit:      Record<string, number>;
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
    marketFit: {
      type:    Schema.Types.Mixed,  // { [teamId]: marketFit }
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