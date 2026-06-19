import mongoose, { Document, Schema, Types } from "mongoose";

interface Output {
  key:             string;
  name:            string;
  aggregationType: "sum" | "average" | "min" | "max" | "count";
  unit:            string;
  description:     string;
  source:          "pnl" | "bizperf" | "csat" | "custom";
  format:          "money" | "percentage" | "number";
  order:           number;
  styles?:         Record<string, string>;
}

interface ReportPlacement {
  cashflow:     "product" | "global";
  pnl:          "product" | "global";
  balancesheet: "product" | "global";
  bizperf:      "product" | "global";
}

export interface SimulationTypeInterface extends Document {
  name:            string;
  description?:    string;
  yearRange:       Record<string, any>;
  pastData:        Record<string, any>;
  outputs:         Output[];
  brandName?:      string;
  reportPlacement: ReportPlacement;
  createdAt:       Date;
  updatedAt:       Date;
}

const OutputSchema = new Schema<Output>(
  {
    key:             { type: String, required: true },
    name:            { type: String, required: true },
    aggregationType: { type: String, enum: ["sum", "average", "min", "max", "count"], required: true },
    unit:            { type: String, required: true },
    description:     { type: String, required: true },
    source:          { type: String, enum: ["pnl", "bizperf", "csat", "custom"], required: true },
    format:          { type: String, enum: ["money", "percentage", "number"], required: true },
    order:           { type: Number, required: true, default: 0 },
    styles:          { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const ReportPlacementSchema = new Schema<ReportPlacement>(
  {
    cashflow:     { type: String, enum: ["product", "global"] },
    pnl:          { type: String, enum: ["product", "global"] },
    balancesheet: { type: String, enum: ["product", "global"] },
    bizperf:      { type: String, enum: ["product", "global"] },
  },
  { _id: false }
);

const SimulationTypeSchema = new Schema<SimulationTypeInterface>(
  {
    name:            { type: String, required: true },
    description:     { type: String },
    yearRange:       { type: Schema.Types.Mixed },
    pastData:        { type: Schema.Types.Mixed },
    outputs:         { type: [OutputSchema], default: [] },
    brandName:       { type: String },
    reportPlacement: { type: ReportPlacementSchema },
  },
  { timestamps: true }
);

export default mongoose.model<SimulationTypeInterface>("SimulationType", SimulationTypeSchema);