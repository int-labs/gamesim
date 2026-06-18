import mongoose, { Document, Schema, Types } from "mongoose";

// ---------- Inputs sub-schema
// Strictly typed to product-level baseVariables only.
// Global inputs are excluded — they are simulation-wide constants
// read from the globalInputs collection at calculation time.
// Extend this sub-schema as baseVariables fields are confirmed.
const DecisionInputsSchema = new Schema(
  {
    // ----------------------------------------------------------------
    // Product-level input variables submitted by the team.
    // Add fields here as baseVariables structure is finalized.
    // Example:
    //   price:          { type: Number, required: true },
    //   marketingSpend: { type: Number, required: true },
    //   r_and_d:        { type: Number, required: true },
    // ----------------------------------------------------------------
  },
  { _id: false, strict: false } // strict: false temporarily until fields are confirmed
);

// ---------- Decision document interface
export interface IDecision extends Document {
  simulationId: Types.ObjectId;
  teamId:       Types.ObjectId;
  roundNumber:  number;
  productId:    Types.ObjectId;
  segmentId:    Types.ObjectId;
  subProductKey:  string;
  inputs:       Record<string, number>;
  createdAt:    Date;
  updatedAt:    Date;
}

// ---------- Decision schema
const DecisionSchema = new Schema<IDecision>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    teamId:       { type: Schema.Types.ObjectId, ref: "Team",       required: true },
    roundNumber:  { type: Number,                                    required: true },
    productId:    { type: Schema.Types.ObjectId, ref: "Product",    required: true },
    segmentId:    { type: Schema.Types.ObjectId, ref: "Segment",    required: true },
    inputs:       { type: DecisionInputsSchema,                      required: true },
    subProductKey: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// ---------- Compound unique index
// One decision document per team per product per segment per round per simulation.
// Insert only — no resubmission after a decision is locked.
DecisionSchema.index(
  { simulationId: 1, teamId: 1, roundNumber: 1, productId: 1, segmentId: 1, subProductKey: 1 },
  { unique: true }
);

export default mongoose.model<IDecision>("Decision", DecisionSchema);