import mongoose from "mongoose";

export interface YearRangeConfig {
  startYear: number;
  endYear: number;
  baseYear: number;
}

// First, let's add the interfaces for past data
interface PastProductDataField {
  key: string;
  value: number;
  textValue?: string;
  subProductKey?: string;
  complexValues?: Array<{
    optionKey: string;
    tab: string;
    itemKey: string;
    value: number;
    textValue?: string;
  }>;
}

interface PastSegmentDataField {
  key: string;
  value: number;
  textValue?: string;
  complexValues?: Array<{
    optionKey: string;
    tab: string;
    itemKey: string;
    value: number;
    textValue?: string;
  }>;
}

interface PastProductData {
  productId: mongoose.Types.ObjectId;
  segmentId: mongoose.Types.ObjectId;
  fields: PastProductDataField[];
}

interface PastSegmentData {
  segmentId: mongoose.Types.ObjectId;
  fields: PastSegmentDataField[];
}

interface PastGlobalData {
  globalInputId: mongoose.Types.ObjectId;
  key: string;
  value: number;
}

interface PastOutputData {
  productId: mongoose.Types.ObjectId;
  key: string;
  value: number;
}

interface PastYearData {
  year: number;
  productData: PastProductData[];
  segmentData: PastSegmentData[];
  globalData: PastGlobalData[];
  outputs: PastOutputData[];
}

export interface SimulationConstant {
  key: string;
  label: string;
  value: number;
}

// Update the SimulationTypeInterface
export interface SimulationTypeInterface extends mongoose.Document {
  name: string;
  description: string;
  yearRange: YearRangeConfig;
  pastData: PastYearData[];
  comparisonRoundOffset?: number;
  maxEnergy?: number;
  maxEnergyPerRound?: number[];
  constants: SimulationConstant[];
  disallowEnergyOveruse?: boolean;
}

// Define YearRange as its own schema
const yearRangeSchema = new mongoose.Schema<YearRangeConfig>(
  {
    startYear: { type: Number, required: true },
    endYear: { type: Number, required: true },
    baseYear: { type: Number, required: true },
  },
  { _id: false }
);

// Add custom validator to yearRangeSchema using pre 'validate' hook or custom method
yearRangeSchema.pre("validate", function (next) {
  if (this.startYear >= this.endYear) {
    return next(new Error("Start year must be less than end year"));
  }
  if (!(this.startYear < this.baseYear && this.baseYear < this.endYear)) {
    return next(new Error("Base year must be between start year and end year"));
  }
  next();
});

// Create schemas for the new structures
const pastProductDataFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: Number, required: true },
    textValue: { type: String, required: false },
    subProductKey: { type: String, required: false },
    complexValues: {
      type: [
        {
          optionKey: { type: String, required: true },
          tab: { type: String, required: true },
          itemKey: { type: String, required: true },
          value: { type: Number, required: true },
          textValue: { type: String, required: false },
        },
      ],
      required: false,
      default: undefined,
    },
  },
  { _id: false }
);

const pastProductDataSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    fields: [pastProductDataFieldSchema],
  },
  { _id: false }
);

const pastSegmentDataFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: Number, required: true },
    textValue: { type: String, required: false },
    complexValues: {
      type: [
        {
          optionKey: { type: String, required: true },
          tab: { type: String, required: true },
          itemKey: { type: String, required: true },
          value: { type: Number, required: true },
          textValue: { type: String, required: false },
        },
      ],
      required: false,
      default: undefined,
    },
  },
  { _id: false }
);

const pastSegmentDataSchema = new mongoose.Schema(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    fields: [pastSegmentDataFieldSchema],
  },
  { _id: false }
);

const pastGlobalDataSchema = new mongoose.Schema(
  {
    globalInputId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "GlobalInput",
    },
    key: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const pastOutputSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    key: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const pastYearDataSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    productData: [pastProductDataSchema],
    segmentData: [pastSegmentDataSchema],
    globalData: [pastGlobalDataSchema],
    outputs: [pastOutputSchema],
  },
  { _id: false }
);

export interface SimulationTypeOutput {
  key: string;
  name: string;
  aggregationType: "sum" | "average";
  unit?: string;
  description?: string;
}

const simulationTypeOutputSchema = new mongoose.Schema<SimulationTypeOutput>(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    aggregationType: { type: String, enum: ["sum", "average"], required: true },
    unit: { type: String },
    description: { type: String },
  },
  { _id: false }
);

export interface WinningMetricConfig {
  key: string; // e.g., "revenue", "traffic", "visitorEngagement"
  label: string; // Display name: "Revenue", "Traffic", "Visitor Engagement"
  format: "money" | "percentage" | "number"; // Display format
  source: "pnl" | "bizperf" | "csat" | "esat" | "custom"; // Where value comes from
  sourceField?: string; // Field key in source (e.g., "Total Revenue", "Risk Adjusted Profit")
  aggregationType: "sum" | "average"; // How to aggregate across segments
  order: number; // Display order
  globalTooltip?: string;
  segmentTooltip?: string;
  showCompanyLevel?: boolean; // Default true, toggle for showing metric at enterprise level
  showSegmentLevel?: boolean; // Default true, toggle for showing metric at segment level
  styles?: Record<string, string>;
  decimalPlaces?: number; // Customized decimal places (0-3)
  weight?: number;
  calcImpact?: "immediate" | "delayed";
  useAutoChangeUnit?: boolean;
}

const winningMetricConfigSchema = new mongoose.Schema<WinningMetricConfig>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    format: {
      type: String,
      enum: ["money", "percentage", "number"],
      required: true,
    },
    source: {
      type: String,
      enum: ["pnl", "bizperf", "csat", "esat", "custom"],
      required: true,
    },
    sourceField: { type: String, required: false },
    aggregationType: { type: String, enum: ["sum", "average"], required: true },
    order: { type: Number, required: true },
    globalTooltip: { type: String },
    segmentTooltip: { type: String },
    showCompanyLevel: { type: Boolean, required: false, default: true },
    showSegmentLevel: { type: Boolean, required: false, default: true },
    styles: { type: Map, of: String, required: false },
    decimalPlaces: { type: Number, required: false, default: 2 },
    weight: { type: Number, required: false, default: 0 },
    calcImpact: {
      type: String,
      enum: ["immediate", "delayed"],
      required: false,
      default: "immediate",
    },
    useAutoChangeUnit: { type: Boolean, required: false, default: false },
  },
  { _id: false }
);

export interface LanguageTranslation {
  languageCode: string;
  languageName: string;
  keys: Array<{ key: string; value: string }>;
}

const languageTranslationSchema = new mongoose.Schema<LanguageTranslation>(
  {
    languageCode: { type: String, required: true },
    languageName: { type: String, required: true },
    keys: {
      type: [
        {
          key: { type: String, required: true },
          value: { type: String, required: false, default: "" },
        },
      ],
      required: true,
      default: [],
    },
  },
  { _id: false }
);

export interface TierConfig {
  name: string;
  levelKey: string;
  rounds: number;
  selectedSegments: string[];
  selectedProducts: string[];
}

const tierConfigSchema = new mongoose.Schema<TierConfig>(
  {
    name: { type: String, required: true },
    levelKey: { type: String, required: true },
    rounds: { type: Number, required: true },
    selectedSegments: { type: [String], required: true },
    selectedProducts: { type: [String], required: true },
  },
  { _id: false }
);

// Update SimulationTypeInterface
export interface SimulationTypeInterface extends mongoose.Document {
  name: string;
  description: string;
  brandName?: string;
  businessUnitSeparatorLabel?: string;
  hideCompanyLevelAndEnterpriseMenu?: boolean;
  hideProductIfOnlyOne?: boolean;
  yearRange: YearRangeConfig;
  pastData: PastYearData[];
  outputs: SimulationTypeOutput[];
  winningMetrics?: WinningMetricConfig[]; // Customizable winning metrics configuration
  translations?: LanguageTranslation[]; // Dynamic translation configuration
  reportPlacement?: {
    bizperf?: "product" | "enterprise" | "both" | "none";
    pnl?:
      | "product"
      | "enterprise"
      | "both"
      | "none"
      | Array<"product" | "enterprise" | "both" | "none">;
    balanceSheet?: "product" | "enterprise" | "both" | "none";
    cashflow?: "product" | "enterprise" | "both" | "none";
  };
  reportLevel?: {
    bizperf?: "global" | "segment" | "product" | "subproduct";
    pnl?: "global" | "segment" | "product" | "subproduct";
    balanceSheet?: "global" | "segment" | "product" | "subproduct";
    cashflow?: "global" | "segment" | "product" | "subproduct";
  };
  segmentKpiPrefix?: string;
  overallKpiPrefix?: string;
  financialLabels?: {
    pnl?: string;
    balanceSheet?: string;
    cashflow?: string;
  };
  currency?: string; // ISO 4217 code, e.g. "USD", "IDR". Defaults to "USD" when unset.
  preRounds?: number; // Number of negative pre-rounds (e.g. 1 means round -1 and 0 exist). Defaults to 0.
  tiers?: TierConfig[];
  showSegmentTag?: boolean; // Default setting for showing segment name tag above product title
  defaultHideUnselected?: boolean; // Default setting for hiding unselected segments and products
  maxEnergy?: number;
  maxEnergyPerRound?: number[];
  constants: SimulationConstant[];
  disallowEnergyOveruse?: boolean;
}

// Update the simulationTypeSchema
const simulationTypeSchema = new mongoose.Schema<SimulationTypeInterface>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    brandName: { type: String, required: false, default: "LIFE Bank" },
    businessUnitSeparatorLabel: {
      type: String,
      required: false,
      default: "BUSINESS UNIT",
    },
    hideCompanyLevelAndEnterpriseMenu: {
      type: Boolean,
      required: false,
      default: false,
    },
    hideProductIfOnlyOne: {
      type: Boolean,
      required: false,
      default: false,
    },
    yearRange: { type: yearRangeSchema, required: true },
    pastData: {
      type: [pastYearDataSchema],
      required: true,
      default: [], // Default to empty array if not provided
    },
    outputs: {
      type: [simulationTypeOutputSchema],
      required: true,
      default: [],
    },
    winningMetrics: {
      type: [winningMetricConfigSchema],
      required: false,
      default: undefined, // null/undefined means use default metrics (revenue, profit, csat, esat)
    },
    translations: {
      type: [languageTranslationSchema],
      required: false,
      default: [],
    },
    reportPlacement: {
      type: Object,
      required: false,
      default: {
        bizperf: "product",
        pnl: "product",
        balanceSheet: "product",
        cashflow: "product",
      },
      validate: {
        validator: function (value: any) {
          if (!value || typeof value !== "object") return true;

          const allowed = ["product", "enterprise", "both", "none"];

          // Validate pnl
          if (value.pnl !== undefined) {
            if (typeof value.pnl === "string") {
              if (!allowed.includes(value.pnl)) {
                return false;
              }
            } else if (Array.isArray(value.pnl)) {
              if (
                value.pnl.length === 0 ||
                !value.pnl.every((p: any) => allowed.includes(p))
              ) {
                return false;
              }
            } else {
              return false;
            }
          }

          // Other fields
          const otherFields = ["bizperf", "balanceSheet", "cashflow"];
          return otherFields.every((field) => {
            const v = (value as any)[field];
            return v === undefined || allowed.includes(v);
          });
        },
        message:
          "reportPlacement values must be 'product', 'enterprise', 'both', or 'none'.",
      },
    },
    reportLevel: {
      type: Object,
      required: false,
      default: {
        bizperf: "product",
        pnl: "product",
        balanceSheet: "product",
        cashflow: "product",
      },
    },
    segmentKpiPrefix: { type: String, required: false, default: "Segment" },
    overallKpiPrefix: { type: String, required: false, default: "Overall" },
    financialLabels: {
      type: Object,
      required: false,
      default: {
        pnl: "IN $ MILLIONS",
        balanceSheet: "In $ millions",
        cashflow: "In $ millions",
      },
    },
    currency: { type: String, required: false, default: "USD" },
    comparisonRoundOffset: { type: Number, required: false, default: 1 },
    preRounds: { type: Number, required: false, default: 0 },
    showSegmentTag: { type: Boolean, required: false, default: false },
    defaultHideUnselected: { type: Boolean, required: false, default: false },
    tiers: { type: [tierConfigSchema], required: false, default: [] },
    maxEnergy: { type: Number, required: false, default: 100 },
    maxEnergyPerRound: { type: [Number], required: false, default: [] },
    constants: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          value: { type: Number, required: true, default: 0 },
        },
      ],
      default: [],
    },
    disallowEnergyOveruse: { type: Boolean, required: false, default: false },
  },
  { timestamps: true }
);

// Add validation for pastData
simulationTypeSchema.pre("validate", function (next) {
  // Existing validations
  if (this.yearRange.startYear >= this.yearRange.endYear) {
    return next(new Error("Start year must be less than end year"));
  }
  if (
    !(
      this.yearRange.startYear < this.yearRange.baseYear &&
      this.yearRange.baseYear < this.yearRange.endYear
    )
  ) {
    return next(new Error("Base year must be between start year and end year"));
  }

  // Validate pastData years are before baseYear
  if (this.pastData.length > 0) {
    for (const yearData of this.pastData) {
      if (yearData.year > this.yearRange.baseYear) {
        return next(new Error("Past data years must be before base year"));
      }
    }
  }

  next();
});

simulationTypeSchema.virtual("segments", {
  ref: "Segment",
  localField: "_id",
  foreignField: "simulationTypeId",
  justOne: false,
});

simulationTypeSchema.virtual("globalInputs", {
  ref: "GlobalInput",
  localField: "_id",
  foreignField: "simulationTypeId",
  justOne: false,
});

simulationTypeSchema.set("toJSON", { virtuals: true });
simulationTypeSchema.set("toObject", { virtuals: true });

const SimulationType = mongoose.model(
  "SimulationType",
  simulationTypeSchema,
  "simulationTypes"
);

export default SimulationType;
