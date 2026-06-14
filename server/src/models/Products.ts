import mongoose, { Document, Schema, Types } from "mongoose";

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
  simulationTypeId:       Types.ObjectId;
  segmentId:              Types.ObjectId;
  productName:            string;
  baseVariables:          Record<string, number> | null;
  fields:                 ProductField[];
  chargeoffCoefficient:   number | null;
  useChargeoff:           boolean;
  order:                  number;
  chartPosition:          string | null;
  description:            string | null;
  displayDescription:     string | null;
  displayTitle:           string | null;
  productScopedColumns:   string[];
  subProducts:            SubProduct[];
  // Merged from productTypes
  productTypeKey:         string | null;
  productTypeName:        string | null;
  productTypeDescription: string | null;
  productTypeActive:      boolean;
  createdAt:              Date;
  updatedAt:              Date;
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
    simulationTypeId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "SimulationType",
      index:    true,
    },
    segmentId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Segment",
      index:    true,
    },
    productName: {
      type:     String,
      required: true,
    },
    baseVariables: {
      type:    Schema.Types.Mixed, // { [variableKey]: number }
      default: null,
    },
    fields: {
      type:    [productFieldSchema],
      default: [],
    },
    chargeoffCoefficient: {
      type:    Number,
      default: null,
    },
    useChargeoff: {
      type:    Boolean,
      default: false,
    },
    order: {
      type:    Number,
      default: 0,
    },
    chartPosition: {
      type:    String,
      default: null,
    },
    description: {
      type:    String,
      default: null,
    },
    displayDescription: {
      type:    String,
      default: null,
    },
    displayTitle: {
      type:    String,
      default: null,
    },
    productScopedColumns: {
      type:    [String],
      default: [],
    },
    subProducts: {
      type:    [subProductSchema],
      default: [],
    },
    // Merged from productTypes
    productTypeKey: {
      type:    String,
      default: null,
    },
    productTypeName: {
      type:    String,
      default: null,
    },
    productTypeDescription: {
      type:    String,
      default: null,
    },
    productTypeActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One product name per segment per simulation type
productSchema.index(
  { simulationTypeId: 1, segmentId: 1, productName: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const Product = mongoose.model<ProductInterface>(
  "Product",
  productSchema,
  "products"
);

export default Product;