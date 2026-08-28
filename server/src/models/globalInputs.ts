import mongoose, { Document, Schema, Types } from "mongoose";

export interface GlobalInputImpactSelection {
  productId: Types.ObjectId;
  value:     number;
}

export interface GlobalInputImpact {
  type:       "relative" | "absolute";
  value:      number;
  selections?: GlobalInputImpactSelection[];
}

export interface GlobalInputItem {
  _id?:             Types.ObjectId;
  key:              string;
  label:            string;
  description:      string | null;
  minPossibleValue: number | null;
  maxPossibleValue: number | null;
  minDelta:         number | null;
  maxDelta:         number | null;
  cost:             number;
  energy:           number;
  productsImpacted: Types.ObjectId[];
  impacts:          Record<string, GlobalInputImpact>;
  impactLevel:      string | null;
  options:          Record<string, number>;
}

export interface GlobalInputInterface extends Document {
  simulationTypeId: Types.ObjectId;
  category:         string;
  key:              string;
  label:            string;
  type:             string;          // radio | checkbox | slider — drives UI presentation
  description:      string | null;
  maxSelections:    number | null;
  inputs:           GlobalInputItem[];
  createdAt:        Date;
  updatedAt:        Date;
}

const isValidSelection = (s: any): boolean =>
  s &&
  typeof s === "object" &&
  (typeof s.productId === "string" || s.productId instanceof Types.ObjectId) &&
  typeof s.value === "number";

const impactsValidator = {
  validator: (v: any) =>
    v == null ||
    (typeof v === "object" &&
      !Array.isArray(v) &&
      Object.entries(v).every(
        ([k, val]: [string, any]) =>
          typeof k === "string" &&
          val &&
          typeof val === "object" &&
          ["relative", "absolute"].includes(val.type) &&
          typeof val.value === "number" &&
          (val.selections == null ||
            (Array.isArray(val.selections) && val.selections.every(isValidSelection)))
      )),
  message:
    "impacts must be a record of { type: 'relative' | 'absolute', value: number, selections?: { productId, value }[] }",
};

const globalInputItemSchema = new Schema<GlobalInputItem>(
  {
    key:              { type: String, required: true },
    label:            { type: String, required: true },
    description:      { type: String, default: null },
    minPossibleValue: { type: Number, default: null },
    maxPossibleValue: { type: Number, default: null },
    minDelta:         { type: Number, default: null },
    maxDelta:         { type: Number, default: null },
    cost:             { type: Number, required: true, default: 0 },
    energy:           { type: Number, required: true, default: 0 },
    productsImpacted: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    impacts:          { type: Schema.Types.Mixed, default: {}, validate: impactsValidator },
    impactLevel:      { type: String, default: null },
    options:          { type: Schema.Types.Mixed, default: {} },
  }
);

const globalInputSchema = new Schema<GlobalInputInterface>(
  {
    simulationTypeId: { type: Schema.Types.ObjectId, required: true, ref: "SimulationType", index: true },
    category:         { type: String, required: true },
    key:              { type: String, required: true },
    label:            { type: String, required: true },
    description:      { type: String, default: null },
    type:             { type: String, required: true, default: "checkbox" },
    maxSelections:    { type: Number, default: null },
    inputs: {
      type: [globalInputItemSchema],
      default: [],
      validate: {
        validator: (items: GlobalInputItem[]) => {
          const keys = items.map(i => i.key);
          return keys.length === new Set(keys).size;
        },
        message: "inputs[] contains duplicate keys — each item key must be unique within this global input.",
      },
    },
  },
  { timestamps: true }
);

globalInputSchema.index({ simulationTypeId: 1, key: 1 }, { unique: true });

const GlobalInput = mongoose.model<GlobalInputInterface>("GlobalInput", globalInputSchema, "globalInputs");

export default GlobalInput;