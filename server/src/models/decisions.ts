import mongoose, { Document, Schema, Types } from "mongoose";

  // ---------- Field entry sub-schema (per-product decision input)
const DecisionFieldSchema = new Schema(
  {
    fieldId:     { type: Schema.Types.ObjectId, required: true },
    value:       { type: Schema.Types.Mixed, default: null },
    imageAssets: { type: [Schema.Types.ObjectId], ref: "ImageAsset", default: [] },
  },
  { _id: false }
);

// source GlobalInputItem don't retroactively change submitted decisions.
const decisionGlobalInputSchema = new Schema(
  {
    globalInputItemId: { type: Schema.Types.ObjectId, required: true },
    category:          { type: String, required: true },
    key:               { type: String, required: true },
    label:             { type: String, required: true },
    description:       { type: String, default: null },
    selectedStepKey:   { type: String, default: null },
    cost:              { type: Number, default: 0 },
    energy:            { type: Number, default: 0 },
    productsImpacted:  { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    impacts:           { type: Schema.Types.Mixed, default: {} },
    impactLevel:       { type: String, default: null },
    options:           { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// ---------- Per-product inputs sub-schema
const DecisionProductInputSchema = new Schema(
  {
    productId:   { type: Schema.Types.ObjectId, ref: "Product", required: true },
    segmentId:   { type: Schema.Types.ObjectId, ref: "Segment", required: true },
    productName: { type: String, required: true },
    fields: [{ type: [DecisionFieldSchema], required: true, default: []}]
  },
  { _id: false }
);

// ---------- Initiative input sub-schema (full embedded snapshot)
const DecisionInitiativeInputSchema = new Schema(
  {
    name:              { type: String, required: true },
    details:           { type: String, default: null },
    costConsumption:   { type: Number, required: true, default: 0 },
    energyConsumption: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

// ---------- Decision document interface
export interface IDecisionGlobalInput {
  globalInputItemId: Types.ObjectId;
  category:          string;        // inherited from parent container
  key:               string;
  label:             string;
  description:       string | null;
  selectedStepKey:   string | null;
  cost:              number;
  energy:            number;
  productsImpacted:  Types.ObjectId[];
  impacts:           Record<string, { type: "relative" | "absolute"; value: number }>;
  impactLevel:       string | null;
  options:           Record<string, number>;
}

export interface IDecision extends Document {
  simulationId:     Types.ObjectId;
  teamId:           Types.ObjectId;
  roundNumber:      number;
  inputs:           { 
    productId: Types.ObjectId; 
    segmentId: Types.ObjectId; 
    productName: string; 
    fields: { fieldId: Types.ObjectId; value: number | string | null; imageAssets: Types.ObjectId[]; }[]; 
  }[];
  initiativeInputs: { 
    name: string; 
    details: string | null; 
    costConsumption: number; 
    energyConsumption: number; 
  }[];
  globalInputs:     IDecisionGlobalInput[];
  createdAt:        Date;
  updatedAt:        Date;
}
// ---------- Decision schema
const DecisionSchema = new Schema<IDecision>(
  {
    simulationId:     { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    teamId:           { type: Schema.Types.ObjectId, ref: "Team",       required: true },
    roundNumber:      { type: Number,                                    required: true },
    inputs:           { type: [DecisionProductInputSchema],              required: true, default: [] },
    initiativeInputs: { type: [DecisionInitiativeInputSchema],           required: true, default: [] },
    globalInputs: { type: [decisionGlobalInputSchema], required: true, default: [] }
  },
  {
    timestamps: true,
  }
);

// ---------- Compound unique index

DecisionSchema.index(
  { simulationId: 1, teamId: 1, roundNumber: 1 },
  { unique: true }
);

export default mongoose.model<IDecision>("Decision", DecisionSchema, "decisions");