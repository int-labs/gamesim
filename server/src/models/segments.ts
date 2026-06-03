import mongoose from "mongoose";

export interface SegmentField {
  key: string;
  label: string;
  type:
    | "percentage"
    | "plain-number"
    | "money"
    | "numerical-dropdown"
    | "text-dropdown"
    | "slider"
    | "text-slider"
    | "complex-checkbox"
    | "budget-allocation";
  minValue?: number;
  maxValue?: number;
  /**
   * only for text-dropdown
   */
  options?: Array<{
    label: string;
    value: string;
    numericValue?: string;
  }>;
  impactMultipliers?: Array<number>;
  description?: string;
  isConsumingEnergy?: boolean;
  consumptionMultiplier?: number;
  energyCosts?: Array<{ changeValue: number; cost: number }>;
  isIncurringCost?: boolean;
  costs?: Array<{ selectedValue: number; cost: number }>;
  isCostRatio?: boolean;
  costRatioOf?: string;
  resetEachRound?: boolean;
  complexCheckboxConfig?: {
    maxSelection?: number;
    maxSelectionByRound?: Array<{ round: number; maxSelection: number }>;
    tagsConfig?: Array<{
      key: string;
      label: string;
      tagBgColor?: string;
      tagTextColor?: string;
    }>;
    options: Array<{
      optionKey: string;
      optionLabel: string;
      tag?: string;
      tagBgColor?: string;
      tagTextColor?: string;
      tagKeys?: string[];
      description?: string;
      cost?: number;
      energy?: number;
      visibleRounds?: number[];
      tabsName?: string;
      tabs: Array<{
        name: string;
        tabKey?: string;
        items: Array<{
          key: string;
          label: string;
          description?: string;
          prefix?: string;
          energyCost?: number;
          type?: "numerical" | "text-dropdown";
          options?: Array<{
            _id: string;
            label: string;
            value: string;
            numericValue?: number;
          }>;
          costs?: Array<{
            selectedValue: number;
            cost: number;
          }>;
          energyCosts?: Array<{
            changeValue: number;
            cost: number;
          }>;
          costDecimalDigits?: number;
        }>;
      }>;
    }>;
  };
  hideLabel?: boolean;
  budgetAllocationConfig?: {
    budgetPerRound: Array<{ round: number; budget: number }>;
    isBiRoundCycle?: boolean;
  };
}

export interface SegmentInterface extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  simulationTypeId: mongoose.Types.ObjectId;
  key: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  fields: SegmentField[];
  translations?: Array<{
    languageCode: string;
    keys: Array<{ key: string; value: string }>;
  }>;
  order: number;
  sidebarIconName?: string;
}

const SegmentFieldSchema = new mongoose.Schema<SegmentField>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, required: false },
  minValue: { type: Number, required: false },
  maxValue: { type: Number, required: false },
  isConsumingEnergy: { type: Boolean, required: false, default: false },
  consumptionMultiplier: { type: Number, required: false, default: 1 },
  energyCosts: {
    type: [
      {
        changeValue: { type: Number, required: true },
        cost: { type: Number, required: true },
      },
    ],
    required: false,
    default: [],
  },
  isIncurringCost: { type: Boolean, required: false, default: false },
  costs: {
    type: [
      {
        selectedValue: { type: Number, required: true },
        cost: { type: Number, required: true },
      },
    ],
    required: false,
    default: [],
  },
  isCostRatio: { type: Boolean, required: false, default: false },
  costRatioOf: { type: String, required: false, default: "" },
  impactMultipliers: {
    type: [Number],
    required: false,
    default: [],
  },
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
  resetEachRound: { type: Boolean, required: false, default: false },
  complexCheckboxConfig: {
    maxSelection: { type: Number, required: false },
    maxSelectionByRound: [
      {
        round: { type: Number, required: true },
        maxSelection: { type: Number, required: true },
      },
    ],
    tagsConfig: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        tagBgColor: { type: String, required: false },
        tagTextColor: { type: String, required: false },
      },
    ],
    options: [
      {
        optionKey: { type: String, required: true },
        optionLabel: { type: String, required: true },
        tag: { type: String, required: false },
        tagBgColor: { type: String, required: false },
        tagTextColor: { type: String, required: false },
        tagKeys: { type: [String], required: false, default: [] },
        description: { type: String, required: false },
        cost: { type: Number, required: false },
        energy: { type: Number, required: false },
        visibleRounds: { type: [Number], required: false },
        tabsName: { type: String, required: false },
        tabs: [
          {
            name: { type: String, required: true },
            tabKey: { type: String, required: false },
            items: [
              {
                key: { type: String, required: true },
                label: { type: String, required: true },
                description: { type: String, required: false },
                prefix: { type: String, required: false },
                energyCost: { type: Number, required: false },
                type: {
                  type: String,
                  enum: ["numerical", "text-dropdown"],
                  default: "numerical",
                  required: false,
                },
                options: [
                  {
                    label: { type: String, required: true },
                    value: { type: String, required: true },
                    numericValue: { type: Number, required: false },
                  },
                ],
                costs: [
                  {
                    selectedValue: { type: Number, required: true },
                    cost: { type: Number, required: true },
                  },
                ],
                energyCosts: [
                  {
                    changeValue: { type: Number, required: true },
                    cost: { type: Number, required: true },
                  },
                ],
                costDecimalDigits: {
                  type: Number,
                  required: false,
                  default: 0,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  hideLabel: { type: Boolean, required: false, default: false },
  budgetAllocationConfig: {
    budgetPerRound: [
      {
        round: { type: Number, required: true },
        budget: { type: Number, required: true },
      },
    ],
    isBiRoundCycle: { type: Boolean, required: false, default: false },
  },
});

const segmentSchema = new mongoose.Schema<SegmentInterface>(
  {
    simulationTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SimulationType",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, required: false, default: "" },
    description: { type: String, required: true, default: "" },
    active: { type: Boolean, required: true, default: true },
    fields: { type: [SegmentFieldSchema], default: [] },
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
    order: { type: Number, default: 0 },
    sidebarIconName: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

segmentSchema.virtual("simulationType", {
  ref: "SimulationType",
  localField: "simulationTypeId",
  foreignField: "_id",
  justOne: true, // Retrieve one document
});

segmentSchema.index({ _id: 1, key: 1 }, { unique: true });

const Segment = mongoose.model("Segment", segmentSchema, "segments");

export default Segment;
