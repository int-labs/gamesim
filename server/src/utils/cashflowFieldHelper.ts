import { CashflowConfigInterface } from "../models/cashflowConfig";
import {
  CASHFLOW_FIELD_REGISTRY,
  CashflowFieldDefinition,
  CashflowInterface,
} from "../models/projections";

export type CashflowActivityType =
  | "operating"
  | "investing"
  | "financing"
  | "general";

export interface CashflowValues {
  operating?: Record<string, number>;
  investing?: Record<string, number>;
  financing?: Record<string, number>;
  general?: Record<string, number>;
}

export interface CashflowFieldWithLabel {
  fieldKey: string;
  label: string;
  value: number;
  // Formatting options
  type?: "money" | "number" | "text" | "empty";
  bold?: boolean;
  backgroundColor?: string;
  indented?: boolean;
  hasBottomBorder?: boolean;
  showValue?: boolean;
}

export interface TransformedCashflow {
  segmentId: string;
  productId?: string;
  operating: CashflowFieldWithLabel[];
  investing: CashflowFieldWithLabel[];
  financing: CashflowFieldWithLabel[];
  general: CashflowFieldWithLabel[];
}

export class CashflowFieldHelper {
  static getValue(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType,
    fieldKey: string
  ): number {
    const activities = this.getActivitiesMap(cashflow, activityType);
    return activities[fieldKey] || 0;
  }

  static setValue(cashflow: CashflowInterface, values: CashflowValues): void {
    // Set operating activities
    if (values.operating) {
      Object.entries(values.operating).forEach(([fieldKey, value]) => {
        cashflow.operatingActivities[fieldKey] = value;
      });
    }

    // Set investing activities
    if (values.investing) {
      Object.entries(values.investing).forEach(([fieldKey, value]) => {
        cashflow.investingActivities[fieldKey] = value;
      });
    }

    // Set financing activities
    if (values.financing) {
      Object.entries(values.financing).forEach(([fieldKey, value]) => {
        cashflow.financingActivities[fieldKey] = value;
      });
    }

    // Set general activities
    if (values.general) {
      Object.entries(values.general).forEach(([fieldKey, value]) => {
        cashflow.generalActivities[fieldKey] = value;
      });
    }
  }

  // Keep the old method for backward compatibility
  static setSingleValue(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType,
    fieldKey: string,
    value: number
  ): void {
    const activities = this.getActivitiesMap(cashflow, activityType);
    activities[fieldKey] = value;
  }

  static getSortedFields(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType
  ): Array<{ fieldKey: string; label: string; value: number; order: number }> {
    const activities = this.getActivitiesMap(cashflow, activityType);
    const registryFields = this.getAllFieldsFromRegistry(activityType);

    return registryFields.map((fieldDef, index) => ({
      fieldKey: fieldDef.fieldKey,
      label: fieldDef.label,
      value: activities[fieldDef.fieldKey] || 0,
      order: index + 1, // Use array index + 1 as order
    }));
  }

  static getAllFieldsFromRegistry(
    activityType: CashflowActivityType
  ): CashflowFieldDefinition[] {
    return CASHFLOW_FIELD_REGISTRY[
      activityType.toUpperCase() as keyof typeof CASHFLOW_FIELD_REGISTRY
    ];
  }

  static getFieldFromRegistry(
    activityType: CashflowActivityType,
    fieldKey: string
  ): CashflowFieldDefinition | null {
    const registryFields = this.getAllFieldsFromRegistry(activityType);
    return registryFields.find((field) => field.fieldKey === fieldKey) || null;
  }

  static getFieldLabel(
    activityType: CashflowActivityType,
    fieldKey: string
  ): string {
    const registryInfo = this.getFieldFromRegistry(activityType, fieldKey);
    return registryInfo?.label || fieldKey;
  }

  static getFieldOrder(
    activityType: CashflowActivityType,
    fieldKey: string
  ): number {
    const registryFields = this.getAllFieldsFromRegistry(activityType);
    const index = registryFields.findIndex(
      (field) => field.fieldKey === fieldKey
    );
    return index >= 0 ? index + 1 : 999; // Return array index + 1, or 999 if not found
  }

  static removeField(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType,
    fieldKey: string
  ): void {
    const activities = this.getActivitiesMap(cashflow, activityType);
    delete activities[fieldKey];
  }

  static hasField(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType,
    fieldKey: string
  ): boolean {
    const activities = this.getActivitiesMap(cashflow, activityType);
    return fieldKey in activities;
  }

  static getFieldCount(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType
  ): number {
    const activities = this.getActivitiesMap(cashflow, activityType);
    return Object.keys(activities).length;
  }

  // New helper methods for working with arrays
  static getFieldKeysFromRegistry(
    activityType: CashflowActivityType
  ): string[] {
    return this.getAllFieldsFromRegistry(activityType).map(
      (field) => field.fieldKey
    );
  }

  static getLabelsFromRegistry(activityType: CashflowActivityType): string[] {
    return this.getAllFieldsFromRegistry(activityType).map(
      (field) => field.label
    );
  }

  static getFieldByOrder(
    activityType: CashflowActivityType,
    order: number
  ): CashflowFieldDefinition | null {
    const registryFields = this.getAllFieldsFromRegistry(activityType);
    const index = order - 1; // Convert order to array index
    return registryFields[index] || null;
  }

  static getNextOrder(activityType: CashflowActivityType): number {
    const registryFields = this.getAllFieldsFromRegistry(activityType);
    return registryFields.length + 1; // Next order is array length + 1
  }

  private static getActivitiesMap(
    cashflow: CashflowInterface,
    activityType: CashflowActivityType
  ): Record<string, number> {
    switch (activityType) {
      case "operating":
        return cashflow.operatingActivities;
      case "investing":
        return cashflow.investingActivities;
      case "financing":
        return cashflow.financingActivities;
      case "general":
        return cashflow.generalActivities;
    }
  }

  private static transformActivity(
    activities: Record<string, number>,
    activityType: keyof typeof CASHFLOW_FIELD_REGISTRY | "GENERAL",
    dynamicFields?: Array<CashflowFieldDefinition>
  ): CashflowFieldWithLabel[] {
    const fieldDefs =
      dynamicFields ??
      (activityType !== "GENERAL" ? CASHFLOW_FIELD_REGISTRY[activityType] : []);

    return (
      fieldDefs?.map((fieldDef) => ({
        fieldKey: fieldDef.fieldKey,
        label: fieldDef.label,
        value: activities[fieldDef.fieldKey] || 0,
        // Pass through formatting options
        type: fieldDef.type,
        bold: fieldDef.bold,
        backgroundColor: fieldDef.backgroundColor,
        indented: fieldDef.indented,
        hasBottomBorder: fieldDef.hasBottomBorder,
        showValue: fieldDef.showValue,
      })) || []
    );
  }

  static transformCashflow(
    cashflow: CashflowInterface,
    config?: CashflowConfigInterface | null
  ): TransformedCashflow {
    const useDynamic = !!config?.groups;

    return {
      segmentId: cashflow.segmentId?.toString() ?? "global",
      productId: cashflow.productId?.toString(),
      operating: this.transformActivity(
        cashflow.operatingActivities,
        "OPERATING",
        useDynamic ? config?.groups?.OPERATING : undefined
      ),
      investing: this.transformActivity(
        cashflow.investingActivities,
        "INVESTING",
        useDynamic ? config?.groups?.INVESTING : undefined
      ),
      financing: this.transformActivity(
        cashflow.financingActivities,
        "FINANCING",
        useDynamic ? config?.groups?.FINANCING : undefined
      ),
      general: this.transformActivity(
        cashflow.generalActivities,
        "GENERAL",
        useDynamic ? config?.groups?.GENERAL : undefined
      ),
    };
  }

  static transformCashflowArray(
    cashflows: CashflowInterface[],
    config?: CashflowConfigInterface | null
  ): TransformedCashflow[] {
    return cashflows.map((cashflow) =>
      this.transformCashflow(cashflow, config)
    );
  }
}
