import { BalanceSheetConfigInterface } from "../models/balanceSheetConfig";
import {
  BALANCE_SHEET_FIELD_REGISTRY,
  BalanceSheetFieldDefinition,
  BalanceSheetInterface,
} from "../models/projections";

export type BalanceSheetCategory =
  | "assets"
  | "liabilities"
  | "equity"
  | "others";

export interface BalanceSheetValues {
  assets?: Record<string, number>;
  liabilities?: Record<string, number>;
  equity?: Record<string, number>;
  others?: Record<string, number>;
}

export interface BalanceSheetFieldWithLabel {
  fieldKey: string;
  label: string;
  value: number;
  // Formatting options from config
  type?: "money" | "number" | "text" | "empty";
  bold?: boolean;
  indented?: boolean;
  addSpaceAbove?: boolean;
}

export interface TransformedBalanceSheet {
  segmentId?: string;
  productId?: string;
  assets: BalanceSheetFieldWithLabel[];
  liabilities: BalanceSheetFieldWithLabel[];
  equity: BalanceSheetFieldWithLabel[];
  others: BalanceSheetFieldWithLabel[];
}

export class BalanceSheetFieldHelper {
  static getValue(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory,
    fieldKey: string
  ): number {
    const categories = this.getCategoriesMap(balanceSheet, category);
    return categories[fieldKey] || 0;
  }

  static setValue(
    balanceSheet: BalanceSheetInterface,
    values: BalanceSheetValues
  ): void {
    // Set assets
    if (values.assets) {
      Object.entries(values.assets).forEach(([fieldKey, value]) => {
        balanceSheet.assets[fieldKey] = value;
      });
    }

    // Set liabilities
    if (values.liabilities) {
      Object.entries(values.liabilities).forEach(([fieldKey, value]) => {
        balanceSheet.liabilities[fieldKey] = value;
      });
    }

    // Set equity
    if (values.equity) {
      Object.entries(values.equity).forEach(([fieldKey, value]) => {
        balanceSheet.equity[fieldKey] = value;
      });
    }

    // Set others
    if (values.others) {
      Object.entries(values.others).forEach(([fieldKey, value]) => {
        balanceSheet.others[fieldKey] = value;
      });
    }
  }

  // Keep the old method for backward compatibility
  static setSingleValue(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory,
    fieldKey: string,
    value: number
  ): void {
    const categories = this.getCategoriesMap(balanceSheet, category);
    categories[fieldKey] = value;
  }

  static getSortedFields(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory
  ): Array<{ fieldKey: string; label: string; value: number; order: number }> {
    const categories = this.getCategoriesMap(balanceSheet, category);
    const registryFields = this.getAllFieldsFromRegistry(category);

    return registryFields.map((fieldDef, index) => ({
      fieldKey: fieldDef.fieldKey,
      label: fieldDef.label,
      value: categories[fieldDef.fieldKey] || 0,
      order: index + 1, // Use array index + 1 as order
    }));
  }

  static getAllFieldsFromRegistry(
    category: BalanceSheetCategory
  ): BalanceSheetFieldDefinition[] {
    return BALANCE_SHEET_FIELD_REGISTRY[
      category.toUpperCase() as keyof typeof BALANCE_SHEET_FIELD_REGISTRY
    ];
  }

  static getFieldFromRegistry(
    category: BalanceSheetCategory,
    fieldKey: string
  ): BalanceSheetFieldDefinition | null {
    const registryFields = this.getAllFieldsFromRegistry(category);
    return registryFields.find((field) => field.fieldKey === fieldKey) || null;
  }

  static getFieldLabel(
    category: BalanceSheetCategory,
    fieldKey: string
  ): string {
    const registryInfo = this.getFieldFromRegistry(category, fieldKey);
    return registryInfo?.label || fieldKey;
  }

  static getFieldOrder(
    category: BalanceSheetCategory,
    fieldKey: string
  ): number {
    const registryFields = this.getAllFieldsFromRegistry(category);
    const index = registryFields.findIndex(
      (field) => field.fieldKey === fieldKey
    );
    return index >= 0 ? index + 1 : 999; // Return array index + 1, or 999 if not found
  }

  static removeField(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory,
    fieldKey: string
  ): void {
    const categories = this.getCategoriesMap(balanceSheet, category);
    delete categories[fieldKey];
  }

  static hasField(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory,
    fieldKey: string
  ): boolean {
    const categories = this.getCategoriesMap(balanceSheet, category);
    return fieldKey in categories;
  }

  static getFieldCount(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory
  ): number {
    const categories = this.getCategoriesMap(balanceSheet, category);
    return Object.keys(categories).length;
  }

  // New helper methods for working with arrays
  static getFieldKeysFromRegistry(category: BalanceSheetCategory): string[] {
    return this.getAllFieldsFromRegistry(category).map(
      (field) => field.fieldKey
    );
  }

  static getLabelsFromRegistry(category: BalanceSheetCategory): string[] {
    return this.getAllFieldsFromRegistry(category).map((field) => field.label);
  }

  static getFieldByOrder(
    category: BalanceSheetCategory,
    order: number
  ): BalanceSheetFieldDefinition | null {
    const registryFields = this.getAllFieldsFromRegistry(category);
    const index = order - 1; // Convert order to array index
    return registryFields[index] || null;
  }

  static getNextOrder(category: BalanceSheetCategory): number {
    const registryFields = this.getAllFieldsFromRegistry(category);
    return registryFields.length + 1; // Next order is array length + 1
  }

  private static getCategoriesMap(
    balanceSheet: BalanceSheetInterface,
    category: BalanceSheetCategory
  ): Record<string, number> {
    switch (category) {
      case "assets":
        return balanceSheet.assets;
      case "liabilities":
        return balanceSheet.liabilities;
      case "equity":
        return balanceSheet.equity;
      case "others":
        return balanceSheet.others;
    }
  }

  private static transformCategory(
    categories: Record<string, number>,
    category: keyof typeof BALANCE_SHEET_FIELD_REGISTRY,
    dynamicFields?: Array<{ fieldKey: string; label: string }>
  ): BalanceSheetFieldWithLabel[] {
    const fieldDefs = dynamicFields ?? BALANCE_SHEET_FIELD_REGISTRY[category];

    return (
      fieldDefs?.map((fieldDef: any) => ({
        fieldKey: fieldDef.fieldKey,
        label: fieldDef.label,
        value: categories[fieldDef.fieldKey] || 0,
        type: fieldDef.type,
        bold: fieldDef.bold,
        indented: fieldDef.indented,
        addSpaceAbove: fieldDef.addSpaceAbove,
      })) || []
    );
  }

  static transformBalanceSheet(
    balanceSheet: BalanceSheetInterface,
    config?: BalanceSheetConfigInterface | null
  ): TransformedBalanceSheet {
    const useDynamic = !!config?.groups;

    return {
      segmentId: balanceSheet.segmentId?.toString(),
      productId: balanceSheet.productId?.toString(),
      assets: this.transformCategory(
        balanceSheet.assets,
        "ASSETS",
        useDynamic ? config?.groups?.ASSETS : undefined
      ),
      liabilities: this.transformCategory(
        balanceSheet.liabilities,
        "LIABILITIES",
        useDynamic ? config?.groups?.LIABILITIES : undefined
      ),
      equity: this.transformCategory(
        balanceSheet.equity,
        "EQUITY",
        useDynamic ? config?.groups?.EQUITY : undefined
      ),
      others: this.transformCategory(
        balanceSheet.others,
        "OTHERS" as any, // Cast because OTHERS is not in static registry yet
        useDynamic ? config?.groups?.OTHERS : undefined
      ),
    };
  }

  static transformBalanceSheetArray(
    balanceSheets: BalanceSheetInterface[],
    config?: BalanceSheetConfigInterface | null
  ): TransformedBalanceSheet[] {
    return balanceSheets.map((balanceSheet) =>
      this.transformBalanceSheet(balanceSheet, config)
    );
  }
}
