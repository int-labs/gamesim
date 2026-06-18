import mongoose, { Document, Schema, Types } from "mongoose";
import Segment from "./segment";

// ============================================================
// Interfaces
// ============================================================

export interface ProductField {
  key:      string;
  label:    string;
  type:     string;
  order:    number;
  required: boolean;
}

export interface SubProduct {
  key:         string;
  label:       string;
  description: string | null;
  order:       number;
  active:      boolean;
}

export interface ProductInterface extends Document {
  simulationTypeId:     Types.ObjectId;
  segmentId:            Types.ObjectId;
  productName:          string;
  productType:          string | null;
  active:               boolean;
  baseVariables:        Record<string, number> | null;
  fields:               ProductField[];
  chargeoffCoefficient: number | null;
  useChargeoff:         boolean;
  order:                number;
  chartPosition:        string | null;
  description:          string | null;
  displayDescription:   string | null;
  displayTitle:         string | null;
  productScopedColumns: string[];
  subProducts:          SubProduct[];
  createdAt:            Date;
  updatedAt:            Date;
}

// ============================================================
// Sub-schemas
// ============================================================

const productFieldSchema = new Schema(
  {
    key:      { type: String, required: true },
    label:    { type: String, required: true },
    type:     { type: String, required: true, enum: ["number", "percentage", "currency", "text"] },
    order:    { type: Number, default: 0 },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const subProductSchema = new Schema(
  {
    key:         { type: String, required: true },
    label:       { type: String, required: true },
    description: { type: String, default: null },
    order:       { type: Number, default: 0 },
    active:      { type: Boolean, default: true },
  },
  { _id: false }
);

// ============================================================
// Schema
// ============================================================

const productSchema = new Schema<ProductInterface>(
  {
    simulationTypeId: { type: Schema.Types.ObjectId, required: true, ref: "SimulationType", index: true },
    segmentId:        { type: Schema.Types.ObjectId, required: true, ref: "Segment", index: true },
    productName:      { type: String, required: true },
    productType:      { type: String, default: null },
    active:           { type: Boolean, default: true },
    baseVariables:    { type: Schema.Types.Mixed, default: null },
    fields:           { type: [productFieldSchema], default: [] },
    chargeoffCoefficient: { type: Number, default: null },
    useChargeoff:         { type: Boolean, default: false },
    order:                { type: Number, default: 0 },
    chartPosition:        { type: String, default: null },
    description:          { type: String, default: null },
    displayDescription:   { type: String, default: null },
    displayTitle:         { type: String, default: null },
    productScopedColumns: { type: [String], default: [] },
    subProducts:          { type: [subProductSchema], default: [] },
  },
  { timestamps: true }
);

// ============================================================
// Pre-save hook
// ============================================================

productSchema.pre("save", async function (next) {
  if (this.active === false) return next();

  try {
    const segment = await Segment.findById(this.segmentId);

    if (!segment) {
      return next(new Error(`Segment with ID "${this.segmentId}" does not exist.`));
    }

    if (!segment.active) {
      return next(new Error(`Cannot activate product — parent segment "${segment.name}" is inactive.`));
    }

    next();
  } catch (err: any) {
    next(err);
  }
});

// ============================================================
// Model export
// ============================================================

export default mongoose.model<ProductInterface>("Product", productSchema);