import mongoose, { Document, Schema, Types } from "mongoose";
import type { ScoredMetrics } from "../sim/calcFinancials";

  // ---------- Field entry sub-schema (per-product decision input)
const DecisionFieldSchema = new Schema(
  {
    fieldId:     { type: Schema.Types.ObjectId, required: true },
    value:       { type: Schema.Types.Mixed, default: null },
    /**
     * The chosen option's DISPLAY NAME, snapshotted at submission.
     *
     * `value` is a SCORE, which is what the money path needs and what a reader
     * cannot interpret — "8" says nothing, "Hard Cover" says everything. The
     * reports print this instead.
     *
     * Snapshotted, not looked up: renaming an option later must not rewrite
     * what a finished round says the team chose. Absent on fields with no
     * option table (`selling_price`, `projected_market_share`), which the
     * reports render from `value` instead.
     */
    name:        { type: String, default: null },
    imageAssets: { type: [Schema.Types.ObjectId], ref: "ImageAsset", default: [] },
  },
  { _id: false }
);

/**
 * The COGS/OpEx split of a globalInput's cost, as a SINGLE-NESTED SCHEMA with
 * `default: undefined` — deliberately, so ABSENT MEANS ABSENT.
 *
 * This was an inline nested path with `default: 0` on both legs. Mongoose then
 * materialised `{ cogs: 0, opex: 0 }` on every entry, including the ones the
 * client submits without a treatment — and `readCostTreatment` tests
 * `gi.costTreatment` for PRESENCE, so a truthy all-zero object took the explicit
 * branch and booked the whole of globalInput spend to neither side of the Gross
 * Profit line. Operating Expenses read 0.00 on every scored round.
 *
 * An inline nested path cannot express this: Mongoose materialises one as a
 * truthy `{}` on the document instance even when it is absent in Mongo. A
 * single-nested schema is genuinely `undefined` until written.
 */
const costTreatmentSchema = new Schema(
  {
    cogs: { type: Number, required: true },
    opex: { type: Number, required: true },
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
    costTreatment:     { type: costTreatmentSchema, default: undefined },
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
  /** ABSENT when the submitter sent no treatment — `readCostTreatment` then
   *  books `cost` as a period cost. Never defaulted; see costTreatmentSchema. */
  costTreatment?:    { cogs: number; opex: number };
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
    fields: {
      fieldId: Types.ObjectId;
      value: number | string | null;
      /** The chosen option's display name, snapshotted. Null on fields with no
       *  option table. See DecisionFieldSchema. */
      name: string | null;
      imageAssets: Types.ObjectId[];
    }[];
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
  /**
   * CLIENT-ORIGIN LEADERBOARD METRICS for this round — insight answers and
   * anything else only the browser can compute.
   *
   * Keyed by the `source` of every `LeaderboardConfig` metric with
   * `origin: 'client'`. The SERVER declares the keys; the player fills them.
   *
   * ── WHY IT LIVES HERE AND NOT ON THE DECISION INPUTS ────────────────────
   * It is an OUTCOME of the round, not a choice, so it is written AFTER
   * submission — the same way `scored` is. The decision INPUTS stay immutable;
   * `POST /decisions` is still insert-only and this is never part of its body.
   * It could not be: the insight questions are asked during the evaluation,
   * which happens after the decision has already been posted.
   *
   * On the Decision rather than on `TeamRunReport` so one document per
   * `simulation × team × round` carries both halves of the leaderboard, and the
   * report reads them from a single place.
   *
   * SELF-REPORTED — the server stores what it is told. Never put anything
   * `calcFinancials` can compute in here.
   */
  clientMetrics?:   Record<string, number> | null;
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
    // null = the team has reported none yet. Mixed, because the key set is
    // LeaderboardConfig's — adding a client metric must not need a migration.
    clientMetrics: { type: Schema.Types.Mixed, default: null },
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