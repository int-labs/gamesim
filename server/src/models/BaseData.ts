import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================================
// Interfaces
// ============================================================

export interface MarketData {
  segments: Array<{
    segmentId: Types.ObjectId;
    products: Array<{
      productId: Types.ObjectId;
      yearlyData: Record<string, { marketSize: number }>;
      subProducts?: Array<{
        key: string;
        yearlyData: Record<string, { marketSize: number }>;
      }>;
    }>;
  }>;
}

export interface MarketModelField {
  key: string;
  label: string;
  formula?: string;
  type?: string;
  coefficients: Record<string, number>;
  direction: number;
  tightening: number;
  elasticity?: number;
  level?: "global" | "segment" | "product" | "subproduct" | "dynamic";
}

export interface MarketModel {
  segments: Array<{
    segmentId: Types.ObjectId;
    products: Array<{
      productId: Types.ObjectId;
      fields: MarketModelField[];
      segmentFields: MarketModelField[];
      globalFields: MarketModelField[];
      subProducts?: Array<{ key: string; fields: MarketModelField[] }>;
    }>;
  }>;
}

export interface CSATDriver {
  level: "global" | "segment" | "product";
  key: string;
  label: string;
  productId: Types.ObjectId | null;
  globalInputId: Types.ObjectId | null;
  choiceKey: string | null;
  coefficients: Record<string, number>;
}

export interface CSATMarketModel {
  segments: Array<{
    segmentId: Types.ObjectId;
    drivers: CSATDriver[];
  }>;
}

export interface BaseDataInterface extends Document {
  simulationTypeId: Types.ObjectId;
  constants?: Record<string, unknown>;
  marketData: MarketData;
  marketModel: MarketModel;
  csatMarketModel: CSATMarketModel;
  createdAt: Date;
  updatedAt: Date;
  // Helper methods
  getCoefficientsForProduct(
    segmentId: Types.ObjectId,
    productId: Types.ObjectId,
    fieldKey: string,
    year: number,
    subProductKey?: string,
    level?: string
  ): number | null;
  getAvailableYears(): string[];
}

// ============================================================
// Sub-schemas
// ============================================================

const coefficientsValidator = {
  validator: (v: any) =>
    v &&
    typeof v === "object" &&
    Object.entries(v).every(
      ([k, val]) => typeof k === "string" && typeof val === "number"
    ),
  message: "coefficients must be a record of numeric values",
};

const marketDataProductSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    yearlyData: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
      validate: {
        validator: (v: any) =>
          v &&
          typeof v === "object" &&
          Object.entries(v).every(
            ([k, val]: [string, any]) =>
              typeof k === "string" &&
              typeof val === "object" &&
              val !== null &&
              typeof val.marketSize === "number"
          ),
        message: "yearlyData must contain marketSize per year",
      },
    },
    subProducts: {
      type: [
        {
          key:        { type: String, required: true },
          yearlyData: { type: Schema.Types.Mixed, required: true, default: {} },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const marketDataSegmentSchema = new Schema(
  {
    segmentId: { type: Schema.Types.ObjectId, required: true, ref: "Segment" },
    products:  { type: [marketDataProductSchema], required: true, default: [] },
  },
  { _id: false }
);

const marketModelFieldSchema = new Schema(
  {
    key:          { type: String, required: true },
    label:        { type: String, required: true },
    formula:      { type: String },
    type:         { type: String },
    level:        { type: String, enum: ["global", "segment", "product", "subproduct", "dynamic"] },
    direction:    { type: Number, required: true, default: 1 },
    tightening:   { type: Number, required: true, default: 3.0 },
    elasticity:   { type: Number, default: 1.0 },
    coefficients: { type: Schema.Types.Mixed, required: true, default: {}, validate: coefficientsValidator },
  },
  { _id: false }
);

const marketModelProductSchema = new Schema(
  {
    productId:     { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    fields:        { type: [marketModelFieldSchema], required: true, default: [] },
    segmentFields: { type: [marketModelFieldSchema], required: true, default: [] },
    globalFields:  { type: [marketModelFieldSchema], required: true, default: [] },
    subProducts: {
      type: [
        {
          key:    { type: String, required: true },
          fields: { type: [marketModelFieldSchema], required: true, default: [] },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const marketModelSegmentSchema = new Schema(
  {
    segmentId: { type: Schema.Types.ObjectId, required: true, ref: "Segment" },
    products:  { type: [marketModelProductSchema], required: true, default: [] },
  },
  { _id: false }
);

const csatDriverSchema = new Schema(
  {
    level:         { type: String, required: true, enum: ["global", "segment", "product"] },
    key:           { type: String, required: true },
    label:         { type: String, required: true },
    productId:     { type: Schema.Types.ObjectId, ref: "Product", default: null },
    globalInputId: { type: Schema.Types.ObjectId, ref: "GlobalInput", default: null },
    choiceKey:     { type: String, default: null },
    coefficients:  { type: Schema.Types.Mixed, required: true, default: {}, validate: coefficientsValidator },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: auto-populate globalInput when queried
csatDriverSchema.virtual("globalInput", {
  ref:          "GlobalInput",
  localField:   "globalInputId",
  foreignField: "_id",
  justOne:      true,
});

const csatSegmentSchema = new Schema(
  {
    segmentId: { type: Schema.Types.ObjectId, required: true, ref: "Segment" },
    drivers:   { type: [csatDriverSchema], required: true, default: [] },
  },
  { _id: false }
);

// ============================================================
// Root schema
// ============================================================

const baseDataSchema = new Schema<BaseDataInterface>(
  {
    simulationTypeId: { type: Schema.Types.ObjectId, required: true, ref: "SimulationType", index: true },
    constants:        { type: Schema.Types.Mixed, default: {} },
    marketData:       { segments: { type: [marketDataSegmentSchema], required: true, default: [] } },
    marketModel:      { segments: { type: [marketModelSegmentSchema], required: true, default: [] } },
    csatMarketModel:  { segments: { type: [csatSegmentSchema], required: true, default: [] } },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ============================================================
// Helper methods
// ============================================================

baseDataSchema.methods.getCoefficientsForProduct = function (
  segmentId: Types.ObjectId,
  productId: Types.ObjectId,
  fieldKey: string,
  year: number,
  subProductKey?: string,
  level?: string
) {
  const segment = this.marketModel.segments.find((s: any) => s.segmentId.equals(segmentId));
  if (!segment) return null;

  const product = segment.products.find((p: any) => p.productId.equals(productId));
  if (!product) return null;

  let fields = product.fields;

  if (subProductKey && product.subProducts) {
    const sub = product.subProducts.find((sp: any) => sp.key === subProductKey);
    if (sub) fields = sub.fields;
  }

  const field = fields.find(
    (f: any) => f.key === fieldKey && (!level || (f.level ?? "product") === level)
  );
  if (!field) return null;

  return field.coefficients[year.toString()] ?? null;
};

baseDataSchema.methods.getAvailableYears = function () {
  const years = new Set<string>();

  this.marketData.segments.forEach((seg: any) =>
    seg.products.forEach((prod: any) =>
      Object.keys(prod.yearlyData).forEach((y: string) => years.add(y))
    )
  );

  this.marketModel.segments.forEach((seg: any) =>
    seg.products.forEach((prod: any) =>
      prod.fields.forEach((field: any) =>
        Object.keys(field.coefficients).forEach((y: string) => years.add(y))
      )
    )
  );

  return Array.from(years).sort((a, b) => Number(a) - Number(b));
};

// ============================================================
// Model export
// ============================================================

const BaseData = mongoose.model<BaseDataInterface>("BaseData", baseDataSchema, "baseData");

export default BaseData;