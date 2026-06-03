import mongoose, { Document, Schema } from "mongoose";

export interface BaseInputInterface extends Document {
  key: string;
  name: string;
  description: string;
  // for full-set inputs
  type:
    | "numerical-dropdown"
    | "single-select"
    | "multiple-select"
    | "percentage"
    | "plain-number"
    | "money"
    | "text-dropdown"
    | "slider"
    | "text-slider";
  defaultValue?: string;
  min?: number;
  max?: number;
  // Slider customization for full-set numerical-dropdown
  minPossibleValue?: number; // Minimum possible final value (default: 1)
  maxPossibleValue?: number; // Maximum possible final value (default: 20)
  minDelta?: number; // Minimum delta change (default: -2)
  maxDelta?: number; // Maximum delta change (default: 5)
  // full-set slider behavior: delta = 0-based slider, absoluteCurrent = handle = current value, min/max = prev + minDelta/maxDelta
  sliderMode?: "delta" | "absoluteCurrent";
  // If true, show a history chart next to the full-set sliders
  showHistoryChart?: boolean;
  // for selectable-set inputs
  cost?: number;
  energy?: number;
  // for full-set inputs
  costs?: Array<{
    selectedValue: number;
    cost: number;
    mode?: "delta" | "cumulative";
  }>;
  energyMultiplier?: number;
  // energyCosts can be either delta-based (changeValue) or cumulative level-based (levelValue)
  // Detection: if first entry has levelValue, use cumulative mode; otherwise use delta mode
  energyCosts?: Array<{
    changeValue?: number;
    levelValue?: number;
    cost: number;
  }>;
  productsImpacted: Array<mongoose.Types.ObjectId>;
  reductionFactors?: Array<number>;
  impactMap?: Record<string, number[] | ImpactDetail>;
  impacts?: Record<
    string,
    {
      type: "absolute" | "relative";
      value: number;
    }
  >;
  impactLevel: "product" | "segment" | "global";
  // for varied inputs (similar to ProductField)
  minValue?: number;
  maxValue?: number;
  minMode?: "static" | "percentage-of-prev";
  maxMode?: "static" | "percentage-of-prev";
  minPercentOfPrev?: number;
  maxPercentOfPrev?: number;
  decimalDigits?: number;
  options?: Array<{ label: string; value: string; numericValue?: number }>;
  isConsumingEnergy?: boolean;
  consumptionMultiplier?: number;
  isIncurringCost?: boolean;
  // Label for input field
  label?: string;
  // If true, input is delta but stored value is accumulated (prev + delta)
  isAccumulating?: boolean;
  // Calculated values configuration
  calculatedValues?: Array<{
    label: string;
    position: "left" | "right" | "top" | "bottom";
    formula: string;
    format?: "number" | "currency" | "percentage";
    prefix?: string;
    suffix?: string;
    decimalDigits?: number;
    style?: {
      color?: string;
      fontWeight?: "normal" | "bold" | "600" | "700" | "800";
      fontSize?: number | string;
    };
  }>;
}

export interface ImpactDetail {
  value?: number;
  values?: number[];
  mode?: "permanent" | "per-round";
  productsImpacted?: mongoose.Types.ObjectId[];
}

export interface IGlobalInput {
  _id: mongoose.Types.ObjectId;
  simulationTypeId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  description?: string;
  type: "full-set" | "selectable-set" | "varied";
  inputs: BaseInputInterface[];
  order: number;
  translations?: Array<{
    languageCode: string;
    keys: Array<{ key: string; value: string }>;
  }>;
}

const InputSchema = new Schema<BaseInputInterface>(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    // FullSet fields (and varied fields)
    type: {
      type: String,
      enum: [
        "numerical-dropdown",
        "single-select",
        "multiple-select",
        "percentage",
        "plain-number",
        "money",
        "text-dropdown",
        "slider",
        "text-slider",
      ],
    },
    defaultValue: { type: String },
    min: { type: Number },
    max: { type: Number },
    // Slider customization for full-set numerical-dropdown
    minPossibleValue: { type: Number, default: 1 },
    maxPossibleValue: { type: Number, default: 20 },
    minDelta: { type: Number, default: -2 },
    maxDelta: { type: Number, default: 5 },
    sliderMode: {
      type: String,
      enum: ["delta", "absoluteCurrent"],
      default: "delta",
    },
    showHistoryChart: { type: Boolean, default: false },
    // selectable-set fields
    cost: { type: Number },
    energy: { type: Number },
    // full-set fields
    costs: {
      type: [
        {
          selectedValue: Number,
          cost: Number,
          mode: {
            type: String,
            enum: ["delta", "cumulative"],
            default: "cumulative",
          },
        },
      ],
    },
    energyMultiplier: { type: Number },
    // energyCosts supports both changeValue (delta-based) and levelValue (cumulative-based)
    energyCosts: {
      type: [
        {
          changeValue: Number,
          levelValue: Number,
          cost: Number,
          mode: {
            type: String,
            enum: ["delta", "cumulative"],
            default: "delta",
          },
        },
      ],
    },
    productsImpacted: { type: [Schema.Types.ObjectId], ref: "Product" },
    reductionFactors: { type: [Number], default: [] },
    impactMap: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v: any) {
          return (
            typeof v === "object" &&
            Object.values(v).every(
              (item) =>
                (Array.isArray(item) &&
                  item.every((val) => typeof val === "number")) ||
                (typeof item === "object" &&
                  (typeof (item as any).value === "number" ||
                    (Array.isArray((item as any).values) &&
                      (item as any).values.every(
                        (val: any) => typeof val === "number"
                      ))) &&
                  (typeof (item as any).mode === "undefined" ||
                    ["permanent", "per-round"].includes((item as any).mode)) &&
                  (typeof (item as any).productsImpacted === "undefined" ||
                    Array.isArray((item as any).productsImpacted)))
            )
          );
        },
        message:
          "impactMap must be a record of number arrays or ImpactDetail objects",
      },
    },
    impacts: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v: any) {
          return (
            typeof v === "object" &&
            Object.keys(v).every(
              (key) =>
                typeof v[key] === "object" &&
                typeof v[key].type === "string" &&
                typeof v[key].value === "number"
            )
          );
        },
        message: "impacts must be a record of numeric values",
      },
    }, // or Map, or a more specific schema
    impactLevel: {
      type: String,
      enum: ["product", "segment", "global"],
      default: "global",
    },
    // for varied inputs (similar to ProductField)
    minValue: { type: Number, required: false },
    maxValue: { type: Number, required: false },
    // validation modes for varied plain-number
    minMode: {
      type: String,
      enum: ["static", "percentage-of-prev"],
      required: false,
    },
    maxMode: {
      type: String,
      enum: ["static", "percentage-of-prev"],
      required: false,
    },
    minPercentOfPrev: { type: Number, required: false },
    maxPercentOfPrev: { type: Number, required: false },
    // Decimal digits for plain-number fields
    decimalDigits: { type: Number, required: false },
    options: {
      type: [
        {
          label: { type: String, required: true },
          value: { type: String, required: true },
          numericValue: { type: Number, required: false },
        },
      ],
      required: false,
      default: [],
    },
    isConsumingEnergy: { type: Boolean, required: false, default: false },
    consumptionMultiplier: { type: Number, required: false, default: 1 },
    isIncurringCost: { type: Boolean, required: false, default: false },
    // Label for input field
    label: { type: String, required: false },
    // If true, input is delta but stored value is accumulated (prev + delta)
    isAccumulating: { type: Boolean, required: false, default: false },
    // Calculated values configuration
    calculatedValues: {
      type: [
        {
          label: { type: String, required: true },
          position: {
            type: String,
            enum: ["left", "right", "top", "bottom"],
            required: true,
          },
          formula: { type: String, required: true },
          format: {
            type: String,
            enum: ["number", "currency", "percentage"],
            required: false,
          },
          prefix: { type: String, required: false },
          suffix: { type: String, required: false },
          decimalDigits: { type: Number, required: false },
          style: {
            color: { type: String, required: false },
            fontWeight: {
              type: String,
              enum: ["normal", "bold", "600", "700", "800"],
              required: false,
            },
            fontSize: { type: Schema.Types.Mixed, required: false },
          },
        },
      ],
      required: false,
      default: [],
    },
  },
  { _id: false }
);

const GlobalInputSchema = new Schema<IGlobalInput>(
  {
    simulationTypeId: {
      type: Schema.Types.ObjectId,
      ref: "SimulationType",
      required: true,
    },
    name: {
      type: String,
      required: true,
      default: "",
    },
    key: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["full-set", "selectable-set", "varied"],
      required: true,
      default: "full-set",
    },
    inputs: [InputSchema],
    order: { type: Number, required: false, default: 0 },
    translations: {
      type: [
        {
          languageCode: { type: String, required: true },
          keys: [
            {
              key: { type: String, required: true },
              value: { type: String, required: false, default: "" },
            },
          ],
        },
      ],
      required: false,
      default: [],
    },
  },
  { timestamps: true }
);

const GlobalInput = mongoose.model<IGlobalInput>(
  "GlobalInput",
  GlobalInputSchema,
  "globalInputs"
);

export default GlobalInput;
