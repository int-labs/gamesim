import mongoose, { Document, Schema, Types } from "mongoose";
import type { ScoredMetrics } from "../sim/calcFinancials";

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
    // `cost` is retained ONLY so pre-existing decisions still read. New writes
    // populate costTreatment; nothing reads `cost` except the legacy branch of
    // readCostTreatment() in sim/calcFinancials.ts.
    cost:              { type: Number, default: 0 },
    costTreatment: {
      cogs: { type: Number, default: 0 },
      opex: { type: Number, default: 0 },
    },
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
    /**
     * Units the team commits to producing this round, for THIS product.
     *
     * Its own property, deliberately OUTSIDE `fields[]`. Every entry in
     * `fields[]` is addressed by a Product field `_id` and feeds `dynamicPrice`
     * (VoC), `dynamicCost`, or the `inventoryQty` ceiling — production feeds
     * none of them. It is a decision about execution, not a property of the
     * product the customer perceives.
     *
     * Read RAW. `getDecisionInput` applies `calcDiminishingReturnsCostFactor`,
     * and that bell curve exists for the `inventoryQty` ceiling; applying it to
     * a quantity the player typed would silently change the number.
     *
     * null = not stated, and `calcFinancials` builds NOTHING — production is a
     * decision. The planner shows the same zero for an untouched line.
     */
    produced: { type: Number, default: null },
    // FLAT array of field entries — one level, not two. The previous
    // `[{ type: [DecisionFieldSchema] … }]` had an extra outer [ ], which made
    // Mongoose wrap every entry in its own inner array on save: a body of
    // [{fieldId, value}, {fieldId, value}] persisted as [[{…}], [{…}]]. Both
    // readers expect it flat — sim/calcMarketModel.ts:168 and
    // sim/calcFinancials.ts:187/276/283/297 do
    // `fields.find(f => f.fieldId.equals(…))` — so f.fieldId was undefined and
    // POST /rounds/:id/calculate threw a TypeError. No client payload could
    // work around it, since the nesting happened at save time.
    // Decisions written BEFORE this fix are still stored nested and stay
    // unreadable: clear them with DELETE /decisions?simulationId=&roundNumber=
    // and have the teams resubmit (no data migration needed).
    fields: { type: [DecisionFieldSchema], required: true, default: [] },
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
  /** Legacy total. Read only via `readCostTreatment`; new writes use costTreatment. */
  cost:              number;
  costTreatment:     { cogs: number; opex: number };
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
    /** Units to produce this round. null = not stated ⇒ nothing is built. */
    produced: number | null;
    fields: { fieldId: Types.ObjectId; value: number | string | null; imageAssets: Types.ObjectId[]; }[];
  }[];
  initiativeInputs: { 
    name: string; 
    details: string | null; 
    costConsumption: number; 
    energyConsumption: number; 
  }[];
  globalInputs:     IDecisionGlobalInput[];
  /** OFFICIAL scored outcome per productId. Written only by the round close;
   *  absent until calculated. Also the immutable carry-forward source for
   *  `closingStock`. See ../../README.md#the-four-collections */
  scored?:          Record<string, ScoredMetrics> | null;
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
    globalInputs: { type: [decisionGlobalInputSchema], required: true, default: [] },
    // null = not scored yet, which differs from an empty object.
    scored:       { type: Schema.Types.Mixed, default: null },
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