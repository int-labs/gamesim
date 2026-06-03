import mongoose from "mongoose";

export interface BizPerfFieldDefinition {
  fieldKey: string; // must be consistent for data lookup (e.g., "Total Number of Accounts")
  label: string; // display name, editable in admin
  type?: "number" | "percentage" | "money" | "empty"; // display type
  bold?: boolean; // whether to display as bold
  indented?: boolean; // whether to indent
  hideIfFalsy?: boolean; // hide if all values are zero
  addSpaceAbove?: boolean; // add space above this row
  order?: number; // optional for UI order
  decimalDigit?: number; // number of decimal places to display
}

export interface BizPerfConfigInterface {
  simulationTypeId: mongoose.Types.ObjectId;
  fields: BizPerfFieldDefinition[];
  valueHeaderPrefix?: string;
  changeHeaderPrefix?: string;
}

const bizperfFieldSchema = new mongoose.Schema<BizPerfFieldDefinition>(
  {
    fieldKey: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["number", "percentage", "money", "empty"],
      required: false,
    },
    bold: { type: Boolean, required: false },
    indented: { type: Boolean, required: false },
    hideIfFalsy: { type: Boolean, required: false },
    addSpaceAbove: { type: Boolean, required: false },
    order: { type: Number, required: false },
    decimalDigit: { type: Number, required: false, default: 0, min: 0, max: 3 },
  },
  { _id: false }
);

const bizperfConfigSchema = new mongoose.Schema<BizPerfConfigInterface>(
  {
    simulationTypeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    fields: { type: [bizperfFieldSchema], default: [] },
    valueHeaderPrefix: { type: String, required: false, default: "Year" },
    changeHeaderPrefix: { type: String, required: false, default: "YoY" },
  },
  { timestamps: true }
);

const BizPerfConfig = mongoose.model<BizPerfConfigInterface>(
  "BizPerfConfig",
  bizperfConfigSchema
);

export default BizPerfConfig;
