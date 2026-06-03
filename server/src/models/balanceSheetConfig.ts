import mongoose from "mongoose";

export interface BalanceSheetFieldDefinition {
  fieldKey: string; // must stay consistent for lookup in projections/results
  label: string; // editable for display
  order?: number; // optional UI ordering
  // Formatting options
  type?: "money" | "number" | "text" | "empty";
  bold?: boolean;
  indented?: boolean;
  addSpaceAbove?: boolean;
}

export interface BalanceSheetConfigInterface {
  simulationTypeId: mongoose.Types.ObjectId;
  groups: {
    ASSETS: BalanceSheetFieldDefinition[];
    LIABILITIES: BalanceSheetFieldDefinition[];
    EQUITY: BalanceSheetFieldDefinition[];
    OTHERS: BalanceSheetFieldDefinition[];
  };
}

const balanceSheetFieldSchema =
  new mongoose.Schema<BalanceSheetFieldDefinition>(
    {
      fieldKey: { type: String, required: true },
      label: { type: String, required: true },
      order: { type: Number, required: false },
      type: { type: String, required: false, default: "money" },
      bold: { type: Boolean, required: false, default: false },
      indented: { type: Boolean, required: false, default: false },
      addSpaceAbove: { type: Boolean, required: false, default: false },
    },
    { _id: false }
  );

const balanceSheetConfigSchema =
  new mongoose.Schema<BalanceSheetConfigInterface>(
    {
      simulationTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      groups: {
        ASSETS: { type: [balanceSheetFieldSchema], default: [] },
        LIABILITIES: { type: [balanceSheetFieldSchema], default: [] },
        EQUITY: { type: [balanceSheetFieldSchema], default: [] },
        OTHERS: { type: [balanceSheetFieldSchema], default: [] },
      },
    },
    { timestamps: true }
  );

const BalanceSheetConfig = mongoose.model<BalanceSheetConfigInterface>(
  "BalanceSheetConfig",
  balanceSheetConfigSchema
);

export default BalanceSheetConfig;
