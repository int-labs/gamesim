import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================================
// Interfaces
// ============================================================

export interface DriverYearData {
  [year: string]: number;
}

export interface DriverInterface extends Document {
  productId: Types.ObjectId;
  buId:      Types.ObjectId;
  years:     DriverYearData;
}

// ============================================================
// Schema
// ============================================================

const driverSchema = new Schema<DriverInterface>(
  {
    productId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Product",
      index:    true,
    },
    buId: {
      type:     Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    years: {
      type:    Schema.Types.Mixed, // { [year]: value }
      default: null,
      validate: {
        validator: (v: any) =>
          v === null ||
          (typeof v === "object" &&
            Object.entries(v).every(
              ([k, val]) => typeof k === "string" && typeof val === "number"
            )),
        message: "years must be a record of numeric values keyed by year string",
      },
    },
  },
  { timestamps: false } // drivers are static reference data, no need for timestamps
);

// One driver entry per product per business unit
driverSchema.index(
  { productId: 1, buId: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const Driver = mongoose.model<DriverInterface>(
  "Driver",
  driverSchema,
  "drivers"
);

export default Driver;