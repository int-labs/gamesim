import mongoose from "mongoose";

export interface PnLFieldDefinition {
  fieldKey: string; // must be consistent for data lookup (e.g., "Interest Income")
  label: string; // display name, editable in admin
  type?: "number" | "percentage" | "money" | "empty"; // display type
  bold?: boolean; // whether to display as bold
  indented?: boolean; // whether to indent
  hideIfFalsy?: boolean; // hide if all values are zero
  addSpaceAbove?: boolean; // add space above this row
  order?: number; // optional for UI order
  decimalDigit?: number; // number of decimal places to display
}

export interface PnLConfigInterface {
  simulationTypeId: mongoose.Types.ObjectId;
  fields: PnLFieldDefinition[];
}

const pnlFieldSchema = new mongoose.Schema<PnLFieldDefinition>(
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

const pnlConfigSchema = new mongoose.Schema<PnLConfigInterface>(
  {
    simulationTypeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    fields: { type: [pnlFieldSchema], default: [] },
  },
  { timestamps: true }
);

const PnLConfig = mongoose.model<PnLConfigInterface>(
  "PnLConfig",
  pnlConfigSchema
);

export default PnLConfig;
