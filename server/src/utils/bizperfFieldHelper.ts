import { BizPerfConfigInterface } from "../models/bizperfConfig";
import { BusinessPerformanceInterface } from "../models/projections";

// Default banking bizperf labels (fallback when no config exists)
// These match the hardcoded labels in SegmentBizperf.tsx
// Note: fieldKey and label are the same because the data uses labels as keys
const DEFAULT_BIZPERF_FIELDS: Array<{
  fieldKey: string;
  label: string;
  type?: "number" | "percentage" | "money" | "empty";
  bold?: boolean;
  indented?: boolean;
  hideIfFalsy?: boolean;
  addSpaceAbove?: boolean;
  decimalDigit?: number;
}> = [
  {
    fieldKey: "Total Number of Accounts",
    label: "Total Number of Accounts",
    type: "number",
  },
  {
    fieldKey: "Average Loans",
    label: "Average Loans",
    type: "money",
    hideIfFalsy: false,
  },
  {
    fieldKey: "Average Credits",
    label: "Average Credits",
    type: "money",
    hideIfFalsy: true,
  },
  {
    fieldKey: "Transaction Processed",
    label: "Transaction Processed",
    type: "number",
    hideIfFalsy: true,
    addSpaceAbove: true,
  },
  { fieldKey: "Market Share", label: "Market Share", type: "percentage" },
  {
    fieldKey: "Cost to Income Ratio",
    label: "Cost to Income Ratio",
    type: "percentage",
  },
  {
    fieldKey: "Loan to Deposit Ratio (Aggregated)",
    label: "Loan to Deposit Ratio (Aggregated)",
    type: "percentage",
  },
  {
    fieldKey: "Non Performing Loan (Aggregated)",
    label: "Non Performing Loan (Aggregated)",
    type: "percentage",
    hideIfFalsy: true,
  },
  {
    fieldKey: "Account Acquisition Cost",
    label: "Account Acquisition Cost",
    type: "money",
    addSpaceAbove: true,
  },
  {
    fieldKey: "Revenue Per Account",
    label: "Revenue Per Account",
    type: "money",
  },
];

export interface BizPerfFieldWithMetadata {
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

export interface TransformedBizPerf {
  segmentId: string;
  productId?: string;
  fields: BizPerfFieldWithMetadata[];
}

export interface BizPerfValues {
  [fieldKey: string]: number;
}

export class BizPerfFieldHelper {
  static setValue(
    bizperf: BusinessPerformanceInterface,
    values: BizPerfValues
  ): void {
    // List of known banking field keys
    const bankingFieldKeys = DEFAULT_BIZPERF_FIELDS.map((f) => f.fieldKey);

    Object.entries(values).forEach(([fieldKey, value]) => {
      // Check if it's a known banking field
      const isBankingField = bankingFieldKeys.includes(fieldKey);

      if (isBankingField) {
        // Set on the object directly (for backward compatibility)
        (bizperf as any)[fieldKey] = value;
      } else {
        // Store in customFields for new simulation types
        if (!bizperf.customFields) {
          bizperf.customFields = {};
        }
        bizperf.customFields[fieldKey] = value;
      }
    });
  }

  static transformBizPerf(
    bizperf: BusinessPerformanceInterface,
    config?: BizPerfConfigInterface | null
  ): TransformedBizPerf {
    const useDynamic = !!config?.fields && config.fields.length > 0;
    const fieldDefs = useDynamic ? config!.fields : DEFAULT_BIZPERF_FIELDS;

    const fields: BizPerfFieldWithMetadata[] = fieldDefs.map((fieldDef) => {
      // First check direct property, then customFields, then default to 0
      const value =
        (bizperf as any)[fieldDef.fieldKey] ??
        bizperf.customFields?.[fieldDef.fieldKey] ??
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
      segmentId: bizperf.segmentId?.toString() ?? "global",
      productId: bizperf.productId?.toString(),
      fields,
    };
  }

  static transformBizPerfArray(
    bizperfs: BusinessPerformanceInterface[],
    config?: BizPerfConfigInterface | null
  ): TransformedBizPerf[] {
    return bizperfs.map((bizperf) => this.transformBizPerf(bizperf, config));
  }
}
