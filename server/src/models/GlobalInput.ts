import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================================
// Interfaces
// ============================================================

export interface GlobalInputEntry {
  year: string;
  value: number;
}

export interface GlobalInputInterface extends Document {
  simulationTypeId: Types.ObjectId;
  name:             string;
  key:              string;
  type:             string;
  inputs:           GlobalInputEntry[];
  order:            number;
  createdAt:        Date;
  updatedAt:        Date;
}

// ============================================================
// Sub-schemas
// ============================================================

const globalInputEntrySchema = new Schema(
  {
    year:  { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

// ============================================================
// Schema
// ============================================================

const globalInputSchema = new Schema<GlobalInputInterface>(
  {
    simulationTypeId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "SimulationType",
      index:    true,
    },
    name: {
      type:     String,
      required: true,
    },
    key: {
      type:     String,
      required: true,
    },
    type: {
      type:     String,
      required: true,
      enum:     ["percentage", "number", "currency", "rate"],
    },
    inputs: {
      type:    [globalInputEntrySchema],
      default: [],
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// One key per simulation type — prevents duplicate global input keys
globalInputSchema.index(
  { simulationTypeId: 1, key: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const GlobalInput = mongoose.model<GlobalInputInterface>(
  "GlobalInput",
  globalInputSchema,
  "globalInputs"
);

export default GlobalInput;