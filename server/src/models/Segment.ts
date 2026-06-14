import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================================
// Interfaces
// ============================================================

export interface SegmentField {
  key:      string;
  label:    string;
  type:     string;
  order:    number;
  required: boolean;
}

export interface SegmentInterface extends Document {
  simulationTypeId: Types.ObjectId;
  name:             string;
  description:      string;
  key:              string;
  active:           boolean;
  fields:           SegmentField[];
  icon:             string | null;
  order:            number;
  createdAt:        Date;
  updatedAt:        Date;
}

// ============================================================
// Sub-schemas
// ============================================================

const segmentFieldSchema = new Schema(
  {
    key:      { type: String, required: true },
    label:    { type: String, required: true },
    type:     { type: String, required: true, enum: ["number", "percentage", "currency", "text"] },
    order:    { type: Number, default: 0 },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

// ============================================================
// Schema
// ============================================================

const segmentSchema = new Schema<SegmentInterface>(
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
    description: {
      type:    String,
      default: null,
    },
    key: {
      type:     String,
      required: true,
    },
    active: {
      type:    Boolean,
      default: true,
    },
    fields: {
      type:    [segmentFieldSchema],
      default: [],
    },
    icon: {
      type:    String,
      default: null,
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// One key per simulation type — prevents duplicate segment keys
segmentSchema.index(
  { simulationTypeId: 1, key: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const Segment = mongoose.model<SegmentInterface>(
  "Segment",
  segmentSchema,
  "segments"
);

export default Segment;