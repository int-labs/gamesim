import mongoose from "mongoose";
import { SegmentInterface } from "./segments";

// ===== Interfaces =====

export interface ProductOutputFormulaVariable {
  key: string;
  type:
    | "previousDecision"
    | "currentOutput"
    | "previousOutput"
    | "coefficient"
    | "constant";
  description: string;
}

export interface ProductSimulationParam {
  key: string;
  label: string;
  value: number;
  subProductKey?: string; // Optional: specify for a channel
}

export interface ProductUnlockPrerequisite {
  level: "product" | "segment" | "global";
  targetId: mongoose.Types.ObjectId;
  targetName?: string;
  fieldKey: string;
  operator: ">=" | "<=" | "==" | ">" | "<" | "!=";
  value: number;
}

export interface ProductFieldOptionPrerequisite {
  level: "product" | "segment" | "global";
  targetId: mongoose.Types.ObjectId;
  targetName?: string;
  fieldKey: string;
  operator: ">=" | "<=" | "==" | ">" | "<" | "!=";
  value: number;
}

export interface ProductFieldVisibilityCondition {
  level: "product" | "segment" | "global";
  targetId: mongoose.Types.ObjectId;
  targetName?: string;
  fieldKey: string;
  operator: ">=" | "<=" | "==" | ">" | "<" | "!=";
  value: number;
}

export interface ProductOutputFormula {
  key: string;
  formula: string;
  variables: ProductOutputFormulaVariable[];
}

export interface ReadonlyItemConfig {
  formula?: string;
  prefix?: string;
  suffix?: string;
  position?: "left" | "center" | "right" | "space-between";
  visibleIf?: string;
  style?: {
    textColor?: string;
    backgroundColor?: string;
    fontSize?: string;
    border?: string;
    padding?: string;
  };
}

export interface ProductField {
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
    | "readonly"
    | "complex-checkbox"
    | "plain-number-with-calculated-values"
    | "budget-allocation";
  scope?: "product" | "subproduct"; // Product-level (single value) or Subproduct-level (mirrored)
  groupTitle?: string;
  minValue?: number;
  maxValue?: number;
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
  readonlyTypeConfig?: {
    formula?: string;
    prefix?: string;
    textColor?: string;
    showSecondaryValue?: boolean;
    secondaryFormula?: string;
    secondaryPrefix?: string;
    secondaryTextColor?: string;
    items?: ReadonlyItemConfig[];
  };
  /**
   * only for text-dropdown
   */
  options?: Array<{
    _id: string;
    label: string;
    value: string;
    numericValue?: number;
    prerequisites?: ProductFieldOptionPrerequisite[];
  }>;
  isConsumingEnergy?: boolean;
  consumptionMultiplier?: number;
  energyCosts?: Array<{
    changeValue: number;
    cost: number;
    subProductKey?: string;
  }>;
  isIncurringCost?: boolean;
  costs?: Array<{
    selectedValue: number;
    cost: number;
    subProductKey?: string;
  }>;
  costDecimalDigits?: number;
  minDecimalDigits?: number;
  maxDecimalDigits?: number;
  subproductValidation?: {
    targetValue?: number;
    operator: "==" | "<=" | ">=" | "<" | ">";
    message?: string;
  };
  subproductGapConfig?: {
    enabled: boolean;
    targetValue: number;
    enforceMax: boolean;
    showFillButton: boolean;
  };
  validation?: {
    mode: "static" | "delta" | "percentage_of_value";
    minChange?: number;
    maxChange?: number;
    minChangePercentage?: number;
    maxChangePercentage?: number;
  };
  visibilityConditions?: ProductFieldVisibilityCondition[];
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
            _id: string; // generated
            label: string;
            value: string;
            numericValue?: number;
            prerequisites?: ProductFieldOptionPrerequisite[];
          }>;
          costs?: Array<{
            selectedValue: number;
            cost: number;
            subProductKey?: string;
          }>;
          energyCosts?: Array<{
            changeValue: number;
            cost: number;
            subProductKey?: string;
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

// Keep this as-is
type BaseVariablesInterface = {
  availableMarket: number;
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  interestRateRisk?: number;
  interestRateSpread?: number;
  averageDepositBalance?: number;
  minDeposit?: number;
  maxDeposit?: number;
  churnRate?: number;
  growthRate?: number;
  feesRate?: number;
  serviceQualityScore?: number;
  digitalEngagementRate?: number;
  marketShare: number;
  accountSize?: number;
  accountMoney?: number;
  dormantAccMultiplier?: number;
  dormantFee?: number;
  txnService?: number;
  serviceVolumeMultiplier?: number;
  centralBankLiquidityCompliance?: number;
  centralBankLiquidityInterestRate?: number;
  internalLiquidity?: number;
  internalLiquidityInterestRate?: number;
  averageLoanBalance?: number;
  minLoanAmount?: number;
  maxLoanAmount?: number;
  defaultRate?: number;
  loanTermAverage?: number;
  riskWeight?: number;
  processingFeeRate?: number;
  prepaymentRate?: number;
  approvalRate?: number;
  averageCreditBalance?: number;
  minCreditLimit?: number;
  maxCreditLimit?: number;
  rewardProgramCostRate?: number;
  fraudRate?: number;
  retentionRate?: number;
  averageFeeIncome?: number;
  foreignTransactionRate?: number;
  investmentRisk?: number;
  averageReturnRate?: number;
  minInvestment?: number;
  managementFeeRate?: number;
  commissionRate?: number;
  fundDiversificationScore?: number;
  redemptionRate?: number;
  averageInvestorAge?: number;
  taxEfficiency?: number;
  cofRate?: number;
  nonInterestIncomeperDepo?: number;
  nonInterestIncomeperDepoFix?: number;
  creditAccMultiplier?: number;
  loanAccMultiplier?: number;
  investmentAccMultiplier?: number;
  startingCust?: number;
  riskAppetiteSegmentation?: {
    lowRisk: number;
    moderateRisk: number;
    highRisk: number;
  };
};

export interface ChargeoffCoefficientInterface {
  mean: number;
  stdDev: number;
  start: number;
  step: number;
  end: number;
}

export interface ProductInterface extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  simulationTypeId: mongoose.Types.ObjectId;
  segmentId: mongoose.Types.ObjectId;
  segmentReference: SegmentInterface;
  productBu: string;
  productName: string;
  description?: string;
  displayTitle?: string;
  displayDescription?: string;
  outputs: ProductOutputFormula[];
  fields: ProductField[];
  selectedGlobalInputs: Array<{
    globalInputId: mongoose.Types.ObjectId;
    name: string;
    inputs: Array<{ key: string; label: string }>;
  }>;
  baseVariables: BaseVariablesInterface;
  useChargeoff?: boolean;
  chargeoffCoefficient: ChargeoffCoefficientInterface;
  order: number;
  subProducts: Array<{ key: string; name: string }>;
  chartPosition?: string;
  unlockPrerequisites?: ProductUnlockPrerequisite[];
  unlockCost?: number;
  productScopedColumns?: number; // 1 | 2 | 3
  simulationParams: ProductSimulationParam[];
  fieldGroups?: Array<{
    title: string;
    order: number;
    backgroundColor?: string;
    description?: string;
    descriptionByRound?: Array<{ round: number; description: string }>;
  }>;
  translations?: Array<{
    languageCode: string;
    keys: Array<{ key: string; value: string }>;
  }>;
  decisionsPlacement?: "normal" | "reportLevel";
  titleStyle?: Record<string, string>;
  descriptionStyle?: Record<string, string>;
  showSegmentTag?: boolean;
  productImageUrl?: string;
  segmentTagStyle?: Record<string, string>;
  segmentTagTextStyle?: Record<string, string>;
}

const chargeoffCoefficientSchema =
  new mongoose.Schema<ChargeoffCoefficientInterface>(
    {
      mean: { type: Number, required: true, default: 0 },
      stdDev: { type: Number, required: true, default: 0 },
      start: { type: Number, required: true, default: 0 },
      step: { type: Number, required: true, default: 0 },
      end: { type: Number, required: true, default: 0 },
    },
    { _id: false }
  );

const unlockPrerequisiteSchema = new mongoose.Schema<ProductUnlockPrerequisite>(
  {
    level: {
      type: String,
      enum: ["product", "segment", "global"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetName: { type: String, required: false },
    fieldKey: { type: String, required: true },
    operator: {
      type: String,
      enum: [">=", "<=", "==", ">", "<", "!="],
      required: true,
    },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const optionPrerequisiteSchema =
  new mongoose.Schema<ProductFieldOptionPrerequisite>(
    {
      level: {
        type: String,
        enum: ["product", "segment", "global"],
        required: true,
      },
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      targetName: { type: String, required: false },
      fieldKey: { type: String, required: true },
      operator: {
        type: String,
        enum: [">=", "<=", "==", ">", "<", "!="],
        required: true,
      },
      value: { type: Number, required: true },
    },
    { _id: false }
  );

const fieldVisibilityConditionSchema =
  new mongoose.Schema<ProductFieldVisibilityCondition>(
    {
      level: {
        type: String,
        enum: ["product", "segment", "global"],
        required: true,
      },
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      targetName: { type: String, required: false },
      fieldKey: { type: String, required: true },
      operator: {
        type: String,
        enum: [">=", "<=", "==", ">", "<", "!="],
        required: true,
      },
      value: { type: Number, required: true },
    },
    { _id: false }
  );

const productFieldOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    numericValue: { type: Number, required: false },
    prerequisites: {
      type: [optionPrerequisiteSchema],
      required: false,
      default: [],
    },
  },
  { _id: true }
);

// ===== Schemas =====

const productOutputFormulaVariableSchema =
  new mongoose.Schema<ProductOutputFormulaVariable>(
    {
      key: { type: String, required: true },
      type: {
        type: String,
        enum: [
          "previousDecision",
          "previousOutput",
          "coefficient",
          "constant",
          "currentOutput",
        ],
        required: true,
      },
      description: { type: String, required: true },
    },
    { _id: false }
  );

const productOutputFormulaSchema = new mongoose.Schema<ProductOutputFormula>(
  {
    key: { type: String, required: true },
    formula: { type: String, required: true },
    variables: {
      type: [productOutputFormulaVariableSchema],
      required: true,
      default: [],
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema<ProductInterface>(
  {
    simulationTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "SimulationType",
      index: true,
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    productBu: { type: String, required: false, default: "" },
    productName: { type: String, required: true, default: "" },
    description: { type: String, default: "" },
    displayTitle: { type: String, default: "" },
    displayDescription: { type: String, default: "" },
    baseVariables: {
      availableMarket: { type: Number, required: true, default: 0 },
      customerAcquisitionCost: { type: Number, required: true, default: 0 },
      customerLifetimeValue: { type: Number, required: true, default: 0 },
      interestRateRisk: Number,
      interestRateSpread: Number,
      averageDepositBalance: Number,
      minDeposit: Number,
      maxDeposit: Number,
      churnRate: Number,
      growthRate: Number,
      feesRate: Number,
      serviceQualityScore: Number,
      digitalEngagementRate: Number,
      marketShare: { type: Number, required: true, default: 0 },
      accountSize: Number,
      accountMoney: Number,
      dormantAccMultiplier: Number,
      dormantFee: Number,
      txnService: Number,
      serviceVolumeMultiplier: Number,
      centralBankLiquidityCompliance: Number,
      centralBankLiquidityInterestRate: Number,
      internalLiquidity: Number,
      internalLiquidityInterestRate: Number,
      averageLoanBalance: Number,
      minLoanAmount: Number,
      maxLoanAmount: Number,
      defaultRate: Number,
      loanTermAverage: Number,
      riskWeight: Number,
      processingFeeRate: Number,
      prepaymentRate: Number,
      approvalRate: Number,
      averageCreditBalance: Number,
      minCreditLimit: Number,
      maxCreditLimit: Number,
      rewardProgramCostRate: Number,
      fraudRate: Number,
      retentionRate: Number,
      averageFeeIncome: Number,
      foreignTransactionRate: Number,
      investmentRisk: Number,
      averageReturnRate: Number,
      minInvestment: Number,
      managementFeeRate: Number,
      commissionRate: Number,
      fundDiversificationScore: Number,
      redemptionRate: Number,
      averageInvestorAge: Number,
      taxEfficiency: Number,
      cofRate: Number,
      nonInterestIncomeperDepo: Number,
      nonInterestIncomeperDepoFix: Number,
      creditAccMultiplier: Number,
      loanAccMultiplier: Number,
      investmentAccMultiplier: Number,
      startingCust: Number,
      riskAppetiteSegmentation: {
        lowRisk: Number,
        moderateRisk: Number,
        highRisk: Number,
      },
    },
    outputs: { type: [productOutputFormulaSchema], default: [] },
    fields: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        description: { type: String, required: false },
        type: {
          type: String,
          required: true,
          enum: [
            "percentage",
            "plain-number",
            "money",
            "numerical-dropdown",
            "text-dropdown",
            "slider",
            "text-slider",
            "readonly",
            "complex-checkbox",
            "plain-number-with-calculated-values",
          ],
        },
        calculatedValues: {
          type: [
            {
              label: String,
              position: {
                type: String,
                enum: ["left", "right", "top", "bottom"],
              },
              formula: String,
              format: {
                type: String,
                enum: ["number", "currency", "percentage"],
              },
              prefix: String,
              suffix: String,
              decimalDigits: Number,
              style: {
                color: String,
                fontWeight: String,
                fontSize: mongoose.Schema.Types.Mixed,
              },
            },
          ],
          required: false,
        },
        readonlyTypeConfig: {
          formula: { type: String, required: false },
          prefix: { type: String, required: false },
          textColor: { type: String, required: false },
          showSecondaryValue: {
            type: Boolean,
            required: false,
            default: false,
          },
          secondaryFormula: { type: String, required: false },
          secondaryPrefix: { type: String, required: false },
          secondaryTextColor: { type: String, required: false },
          layoutTemplate: { type: String, required: false },
          width: { type: Number, required: false },
          items: [
            {
              formula: { type: String, required: false },
              prefix: { type: String, required: false },
              suffix: { type: String, required: false },
              position: {
                type: String,
                enum: ["left", "center", "right", "space-between"],
                required: false,
              },
              visibleIf: { type: String, required: false },
              style: {
                textColor: { type: String, required: false },
                backgroundColor: { type: String, required: false },
                fontSize: { type: String, required: false },
                border: { type: String, required: false },
                padding: { type: String, required: false },
              },
            },
          ],
        },
        scope: {
          type: String,
          enum: ["product", "subproduct"],
          default: "subproduct",
          required: false,
        },
        groupTitle: { type: String, required: false },
        minValue: { type: Number, required: false },
        maxValue: { type: Number, required: false },
        options: {
          type: [productFieldOptionSchema],
          required: false,
          default: [],
        },
        isConsumingEnergy: { type: Boolean, required: false, default: false },
        consumptionMultiplier: { type: Number, required: false, default: 1 },
        energyCosts: {
          type: [{ changeValue: Number, cost: Number, subProductKey: String }],
          required: false,
          default: [],
        },
        isIncurringCost: { type: Boolean, required: false, default: false },
        costs: {
          type: [
            { selectedValue: Number, cost: Number, subProductKey: String },
          ],
          required: false,
          default: [],
        },
        costDecimalDigits: { type: Number, required: false, default: 0 },
        minDecimalDigits: { type: Number, required: false, default: 0 },
        maxDecimalDigits: { type: Number, required: false, default: 0 },
        subproductValidation: {
          targetValue: { type: Number, required: false },
          operator: {
            type: String,
            enum: ["==", "<=", ">=", "<", ">"],
            required: false,
          },
          message: { type: String, required: false },
        },
        subproductGapConfig: {
          enabled: { type: Boolean, required: false, default: false },
          targetValue: { type: Number, required: false },
          enforceMax: { type: Boolean, required: false, default: false },
          showFillButton: { type: Boolean, required: false, default: false },
        },
        validation: {
          mode: {
            type: String,
            enum: ["static", "delta", "percentage_of_value"],
            required: false,
          },
          minChange: { type: Number, required: false },
          maxChange: { type: Number, required: false },
          minChangePercentage: { type: Number, required: false },
          maxChangePercentage: { type: Number, required: false },
        },
        visibilityConditions: {
          type: [fieldVisibilityConditionSchema],
          required: false,
          default: [],
        },
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
                      options: {
                        type: [productFieldOptionSchema],
                        required: false,
                        default: [],
                      },
                      costs: {
                        type: [
                          {
                            selectedValue: Number,
                            cost: Number,
                            subProductKey: String,
                          },
                        ],
                        required: false,
                        default: [],
                      },
                      energyCosts: {
                        type: [
                          {
                            changeValue: Number,
                            cost: Number,
                            subProductKey: String,
                          },
                        ],
                        required: false,
                        default: [],
                      },
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
      },
    ],
    selectedGlobalInputs: {
      type: [
        {
          globalInputId: mongoose.Schema.Types.ObjectId,
          name: String,
          inputs: [{ key: String, label: String }],
        },
      ],
      default: [],
    },
    useChargeoff: { type: Boolean, required: false, default: false },
    chargeoffCoefficient: {
      type: chargeoffCoefficientSchema,
      required: false,
      default: {},
    },
    order: { type: Number, required: false, default: 999 },
    subProducts: { type: [{ key: String, name: String }], default: [] },
    chartPosition: { type: String, required: false, default: "right" },
    productScopedColumns: { type: Number, enum: [1, 2, 3], default: 1 },
    unlockPrerequisites: {
      type: [unlockPrerequisiteSchema],
      required: false,
      default: [],
    },
    unlockCost: { type: Number, required: false, default: 0 },
    simulationParams: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          value: { type: Number, required: true, default: 0 },
          subProductKey: { type: String, required: false },
        },
      ],
      default: [],
    },
    fieldGroups: {
      type: [
        {
          title: String,
          order: Number,
          backgroundColor: String,
          description: String,
          descriptionByRound: [{ round: Number, description: String }],
        },
      ],
      default: [],
    },
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
    decisionsPlacement: {
      type: String,
      required: false,
      default: "normal",
      enum: ["normal", "reportLevel"],
    },
    titleStyle: { type: Map, of: String, required: false, default: undefined },
    descriptionStyle: {
      type: Map,
      of: String,
      required: false,
      default: undefined,
    },
    showSegmentTag: { type: Boolean, required: false, default: undefined },
    productImageUrl: { type: String, required: false, default: "" },
    segmentTagStyle: {
      type: Map,
      of: String,
      required: false,
      default: undefined,
    },
    segmentTagTextStyle: {
      type: Map,
      of: String,
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

// ===== Virtuals =====
productSchema.virtual("simulationType", {
  ref: "SimulationType",
  localField: "simulationTypeId",
  foreignField: "_id",
  justOne: true,
});

productSchema.virtual("segmentReference", {
  ref: "Segment",
  localField: "segmentId",
  foreignField: "_id",
  justOne: true,
});

productSchema.set("toObject", { virtuals: true });
productSchema.set("toJSON", { virtuals: true });

// ===== Model Export =====
const Product = mongoose.model<ProductInterface>(
  "Product",
  productSchema,
  "products"
);
export default Product;
