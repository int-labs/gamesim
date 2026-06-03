import mongoose from "mongoose";

export interface CashflowFieldDefinition {
  fieldKey: string; // must be consistent for data lookup
  label: string;    // display name, editable in admin
  order?: number;   // optional for UI order
  // Formatting options
  type?: "money" | "number" | "text" | "empty"; // Display type (default: "money")
  bold?: boolean; // Whether field should be bold (default: false)
  backgroundColor?: string; // Background color (hex code, default: transparent)
  indented?: boolean; // Whether field should be indented (default: false)
  hasBottomBorder?: boolean; // Whether field should have bottom border (default: false)
  showValue?: boolean; // Whether to show value or just display as empty line (default: true)
}

export interface CashflowConfigInterface {
    simulationTypeId: mongoose.Types.ObjectId;
  groups: {
    OPERATING: CashflowFieldDefinition[];
    INVESTING: CashflowFieldDefinition[];
    FINANCING: CashflowFieldDefinition[];
    GENERAL: CashflowFieldDefinition[];
  };
  showGroupHeaders?: {
    OPERATING?: boolean;
    INVESTING?: boolean;
    FINANCING?: boolean;
    GENERAL?: boolean;
  };
}

const cashflowFieldSchema = new mongoose.Schema<CashflowFieldDefinition>(
  {
    fieldKey: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, required: false },
    // Formatting options
    type: { type: String, enum: ["money", "number", "text", "empty"], required: false },
    bold: { type: Boolean, required: false },
    backgroundColor: { type: String, required: false },
    indented: { type: Boolean, required: false },
    hasBottomBorder: { type: Boolean, required: false },
    showValue: { type: Boolean, required: false },
  },
  { _id: false }
);

const cashflowConfigSchema = new mongoose.Schema<CashflowConfigInterface>(
  {
    simulationTypeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    groups: {
      OPERATING: { type: [cashflowFieldSchema], default: [] },
      INVESTING: { type: [cashflowFieldSchema], default: [] },
      FINANCING: { type: [cashflowFieldSchema], default: [] },
      GENERAL: { type: [cashflowFieldSchema], default: [] },
    },
    showGroupHeaders: {
      OPERATING: { type: Boolean, default: true },
      INVESTING: { type: Boolean, default: true },
      FINANCING: { type: Boolean, default: true },
      GENERAL: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const CashflowConfig = mongoose.model<CashflowConfigInterface>(
  "CashflowConfig",
  cashflowConfigSchema
);

export default CashflowConfig;
