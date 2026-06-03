import { PnLConfigInterface } from "../models/pnlConfig";
import { PnLInterface } from "../models/projections";

// Default banking PNL labels (fallback when no config exists)
const DEFAULT_PNL_FIELDS: Array<{
  fieldKey: string;
  label: string;
  type?: "number" | "percentage" | "money" | "empty";
  bold?: boolean;
  indented?: boolean;
  hideIfFalsy?: boolean;
  addSpaceAbove?: boolean;
  decimalDigit?: number;
}> = [
  { fieldKey: "Interest Income", label: "Interest Income", type: "money" },
  { fieldKey: "Interest Expense", label: "Interest Expense", type: "money" },
  {
    fieldKey: "Net Interest Income",
    label: "Net Interest Income",
    bold: true,
    type: "money",
  },
  { fieldKey: "Fees Income", label: "Fees Income", type: "money" },
  {
    fieldKey: "Other Non-Interest Income Total",
    label: "Other Non-Interest Income Total",
    type: "money",
  },
  {
    fieldKey: "Non-Interest Income",
    label: "Non-Interest Income",
    bold: true,
    type: "money",
  },
  {
    fieldKey: "Total Revenue",
    label: "Total Revenue",
    bold: true,
    type: "money",
  },
  {
    fieldKey: "Staff Costs",
    label: "Staff Costs",
    type: "money",
    indented: true,
  },
  {
    fieldKey: "Other Operating Expenses",
    label: "Other Operating Expenses",
    type: "money",
    indented: true,
  },
  {
    fieldKey: "Total Expenses",
    label: "Total Expenses",
    bold: true,
    type: "money",
  },
  {
    fieldKey: "Provisions",
    label: "Provisions",
    bold: true,
    type: "money",
    addSpaceAbove: true,
  },
  {
    fieldKey: "Profit Before Tax",
    label: "Profit Before Tax",
    type: "money",
    addSpaceAbove: true,
  },
  {
    fieldKey: "Income Tax Expense",
    label: "Income Tax Expense",
    type: "money",
  },
  {
    fieldKey: "Profit After Tax",
    label: "Profit After Tax",
    bold: true,
    type: "money",
  },
  { fieldKey: "Capital Charge", label: "Capital Charge", type: "money" },
  {
    fieldKey: "Risk Adjusted Profit",
    label: "Risk Adjusted Profit",
    bold: true,
    type: "money",
  },
  { fieldKey: "Dividends", label: "Dividends", type: "money" },
  {
    fieldKey: "Retained Earnings",
    label: "Retained Earnings",
    bold: true,
    type: "money",
  },
];

export interface PnLFieldWithMetadata {
  fieldKey: string;
  label: string;
  value: number;
  type?: "number" | "percentage" | "money" | "empty";
  bold?: boolean;
  indented?: boolean;
  hideIfFalsy?: boolean;
  addSpaceAbove?: boolean;
  decimalDigit?: number;
}

export interface TransformedPnL {
  segmentId: string;
  productId?: string;
  fields: PnLFieldWithMetadata[];
}

export interface PnLValues {
  [fieldKey: string]: number;
}

export class PnLFieldHelper {
  static setValue(pnl: PnLInterface, values: PnLValues): void {
    // List of known banking field keys
    const bankingFieldKeys = DEFAULT_PNL_FIELDS.map((f) => f.fieldKey);

    Object.entries(values).forEach(([fieldKey, value]) => {
      // Check if it's a known banking field
      const isBankingField = bankingFieldKeys.includes(fieldKey);

      // console.log(`pnlfieldhelper setValue FieldKey: ${fieldKey}, isBanking: ${isBankingField}, storing in: ${isBankingField ? 'direct property' : 'customFields'}`);

      if (isBankingField) {
        // Set on the object directly (for backward compatibility)
        (pnl as any)[fieldKey] = value;
      } else {
        // Store in customFields for new simulation types
        if (!pnl.customFields) {
          pnl.customFields = {};
        }
        pnl.customFields[fieldKey] = value;
      }
    });
  }

  static transformPnL(
    pnl: PnLInterface,
    config?: PnLConfigInterface | null
  ): TransformedPnL {
    const useDynamic = !!config?.fields && config.fields.length > 0;
    const fieldDefs = useDynamic ? config!.fields : DEFAULT_PNL_FIELDS;

    // console.log(
    //   "transformPnL received pnl object:",
    //   JSON.stringify(pnl, null, 2)
    // );
    // console.log("transformPnL pnl.customFields:", pnl.customFields);
    // console.log("transformPnL pnl.customFields type:", typeof pnl.customFields);
    // console.log(
    //   "transformPnL pnl.customFields instanceof Map:",
    //   pnl.customFields instanceof Map
    // );
    // console.log("transformPnL pnl keys:", Object.keys(pnl));

    // If customFields is a Map, convert it to a plain object
    let customFieldsObj: Record<string, number> | undefined;
    if (pnl.customFields instanceof Map) {
      customFieldsObj = Object.fromEntries(pnl.customFields);
      // console.log("transformPnL converted Map to object:", customFieldsObj);
    } else {
      customFieldsObj = pnl.customFields;
    }

    const fields: PnLFieldWithMetadata[] = fieldDefs.map((fieldDef) => {
      // First check direct property, then customFields, then default to 0
      const value =
        (pnl as any)[fieldDef.fieldKey] ??
        customFieldsObj?.[fieldDef.fieldKey] ??
        0;

      return {
        fieldKey: fieldDef.fieldKey,
        label: fieldDef.label,
        value,
        type: fieldDef.type,
        bold: fieldDef.bold,
        indented: fieldDef.indented,
        hideIfFalsy: fieldDef.hideIfFalsy,
        addSpaceAbove: fieldDef.addSpaceAbove,
        decimalDigit: fieldDef.decimalDigit,
      };
    });

    return {
      segmentId: pnl.segmentId?.toString() ?? "global",
      productId: pnl.productId?.toString(),
      fields,
    };
  }

  static transformPnLArray(
    pnls: PnLInterface[],
    config?: PnLConfigInterface | null
  ): TransformedPnL[] {
    return pnls.map((pnl) => this.transformPnL(pnl, config));
  }
}
