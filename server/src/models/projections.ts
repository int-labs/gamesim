import mongoose, { Document } from "mongoose";
import Decision from "./decisions"; // Import the Decision model
import { ProductInterface } from "./products";

export interface BusinessPerformanceInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  subProductKey?: string;
  "Total Number of Accounts"?: number;
  "Loan to Deposit Ratio (Aggregated)"?: number;
  "Cost to Income Ratio"?: number;
  "Market Share"?: number;
  "Average Deposits"?: number;
  "Average Loans"?: number;
  "Average Credits"?: number;
  "Average Transactions"?: number;
  "Average Assets"?: number;
  "Average Deals"?: number;
  "Non Performing Loan (Aggregated)"?: number;
  "Non Performing Loan - Loan"?: number;
  "Non Performing Loan - Credit Card"?: number;
  "Account Acquisition Cost"?: number;
  "Transaction Processed"?: number;
  "Revenue Per Account"?: number;
  customFields?: Record<string, number>; // Bridging field for custom fields (e.g., FMCG)
}

// Define the PnL interface
export interface PnLInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  subProductKey?: string;
  product?: ProductInterface;
  "Total Number of Accounts"?: number;
  "Avg Deposits per Account"?: number;
  "Total Deposits"?: number;
  "Interest Rate Paid"?: number;
  "Interest Income"?: number;
  "Interest Expense"?: number;
  "Net Interest Income"?: number;
  "Fees Income"?: number;
  "Other Non-Interest Income Total"?: number;
  "Non-Interest Income"?: number;
  "% Non-Interest Income"?: number;
  "Total Revenue"?: number;
  "Revenue Per Account"?: number;
  "Central Bank Compliance"?: number;
  "Internal Liquidity"?: number;
  "Avg Loans per Customer"?: number;
  "Total Loans"?: number;
  "Total Number of Cards"?: number;
  "Avg Balance per Customer"?: number;
  "Total Balance"?: number;
  "Staff Costs"?: number;
  "Other Operating Expenses"?: number;
  "Total Expenses"?: number;
  "Profit Before Tax"?: number;
  "Profit After Tax"?: number;
  Provisions?: number;
  "% Interest Income"?: number;
  "Sales & Marketing"?: number;
  "Back Office Expense"?: number;
  "Channel and Service"?: number;
  "Strategic Initiatives & Other Costs"?: number;
  "Non-Interest Expense"?: number;
  "Net Income Before Tax"?: number;
  Tax?: number;
  "Income Tax Expense"?: number;
  "Net Income After Tax"?: number;
  "Capital Charge"?: number;
  "Risk Adjusted Profit"?: number;
  Dividends?: number;
  "Retained Earnings"?: number;
  // used but not displayed under pnl
  "Business Risk Capital"?: number;
  "Credit Risk Capital"?: number;
  customFields?: Record<string, number>; // Bridging field for custom fields (e.g., FMCG)
}

export const BALANCE_SHEET_FIELD_REGISTRY: Record<
  string,
  BalanceSheetFieldDefinition[]
> = {
  // Assets
  ASSETS: [
    {
      fieldKey: "cashAndCashEquivalents",
      label: "Cash and Cash Equivalents",
    },
    {
      fieldKey: "loansAndAdvancesToCustomers",
      label: "Loans and Advances to Customers",
    },
    {
      fieldKey: "investments",
      label: "Investments",
    },
    {
      fieldKey: "fixedAssets",
      label: "Fixed Assets",
    },
    {
      fieldKey: "otherAssets",
      label: "Other Assets",
    },
    {
      fieldKey: "totalAssets",
      label: "Total Assets",
    },
  ],
  LIABILITIES: [
    {
      fieldKey: "customerDeposits",
      label: "Customer Deposits",
    },
    {
      fieldKey: "borrowings",
      label: "Borrowings",
    },
    {
      fieldKey: "provisions",
      label: "Provisions",
    },
    {
      fieldKey: "totalLiabilities",
      label: "Total liabilities",
    },
  ],
  EQUITY: [
    {
      fieldKey: "shareCapital",
      label: "Share capital",
    },
    {
      fieldKey: "retainedEarnings",
      label: "Retained earnings",
    },
    {
      fieldKey: "reserves",
      label: "Reserves",
    },
    {
      fieldKey: "otherEquityInstruments",
      label: "Other equity instruments",
    },
    {
      fieldKey: "totalEquity",
      label: "Total equity",
    },
  ],
} as const;

export interface BalanceSheetFieldDefinition {
  fieldKey: string;
  label: string;
}

export interface BalanceSheetInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  others: Record<string, number>;
  // assets: {
  //   cashAndCashEquivalents: number;
  //   loansAndAdvances: number;
  //   investments: number;
  //   fixedAssets: number;
  // };
  // liabilities: {
  //   deposits: number;
  //   borrowings: number;
  //   otherLiabilities: number;
  // };
  // equity: {
  //   shareCapital: number;
  //   retainedEarnings: number;
  // };
}

const balanceSheetSchema = new mongoose.Schema<BalanceSheetInterface>({
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "Segment",
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "Product",
  },
  assets: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  liabilities: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  equity: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  others: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
});

export const CASHFLOW_FIELD_REGISTRY: Record<
  string,
  CashflowFieldDefinition[]
> = {
  // Operating Activities
  OPERATING: [
    {
      fieldKey: "profitBeforeTax",
      label: "Profit Before Tax",
    },
    {
      fieldKey: "provisions",
      label: "Provisions",
    },
    {
      fieldKey: "depreciation",
      label: "Depreciation/Amortization",
    },
    {
      fieldKey: "workingCapitalChange",
      label: "Change in Working Capital",
    },
    {
      fieldKey: "strategicInvestments",
      label: "Strategic Operating Investments",
    },
    {
      fieldKey: "netChangeInCustomerDeposits",
      label: "Net Change in Customer Deposits",
    },
    {
      fieldKey: "netChangeInLoansAndAdvancesToCustomers",
      label: "Net Change in Loans & Advances to Customers",
    },
    {
      fieldKey: "taxPaid",
      label: "Tax Paid",
    },
  ],
  INVESTING: [
    {
      fieldKey: "capex",
      label: "Capital Expenditures",
    },
    {
      fieldKey: "atmDeployment",
      label: "ATM Deployment/Disposal",
    },
    {
      fieldKey: "investmentChanges",
      label: "Investment Changes",
    },
  ],
  FINANCING: [
    {
      fieldKey: "debtIssuance",
      label: "Debt Issuance/Repayment",
    },
    {
      fieldKey: "equityTransactions",
      label: "Equity Transactions",
    },
    {
      fieldKey: "dividendPaid",
      label: "Dividend Paid",
    },
  ],
} as const;

export interface CashflowFieldDefinition {
  fieldKey: string;
  label: string;
  order?: number;
  // Formatting options
  type?: "money" | "number" | "text" | "empty"; // Display type (default: "money")
  bold?: boolean; // Whether field should be bold (default: false)
  backgroundColor?: string; // Background color (hex code, default: transparent)
  indented?: boolean; // Whether field should be indented (default: false)
  hasBottomBorder?: boolean; // Whether field should have bottom border (default: false)
  showValue?: boolean; // Whether to show value or just display as empty line (default: true)
}

export interface CashflowInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  operatingActivities: Record<string, number>;
  investingActivities: Record<string, number>;
  financingActivities: Record<string, number>;
  generalActivities: Record<string, number>;
  // // Field metadata for flexibility
  // operatingFieldMetadata: Map<
  //   string,
  //   {
  //     label: string;
  //     order: number;
  //   }
  // >;
  // investingFieldMetadata: Map<
  //   string,
  //   {
  //     label: string;
  //     order: number;
  //   }
  // >;
  // financingFieldMetadata: Map<
  //   string,
  //   {
  //     label: string;
  //     order: number;
  //   }
  // >;
}

// Update the schema
const cashflowSchema = new mongoose.Schema<CashflowInterface>({
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "Segment",
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: "Product",
  },
  operatingActivities: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  investingActivities: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  financingActivities: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  generalActivities: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    default: new Map(),
  },
  // operatingFieldMetadata: {
  //   type: mongoose.Schema.Types.Map,
  //   of: {
  //     label: String,
  //     order: Number,
  //   },
  //   default: new Map(),
  // },
  // investingFieldMetadata: {
  //   type: mongoose.Schema.Types.Map,
  //   of: {
  //     label: String,
  //     order: Number,
  //   },
  //   default: new Map(),
  // },
  // financingFieldMetadata: {
  //   type: mongoose.Schema.Types.Map,
  //   of: {
  //     label: String,
  //     order: Number,
  //   },
  //   default: new Map(),
  // },
});

cashflowSchema.virtual("product", {
  ref: "Product",
  localField: "productId",
  foreignField: "_id",
  justOne: true,
});

cashflowSchema.set("toObject", { virtuals: true });
cashflowSchema.set("toJSON", { virtuals: true });

export interface ProjectionKPIInterface {
  segmentId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId; // ← ADD THIS
  revenue?: number;
  csat?: number;
  esat?: number;
  cir?: number;
  profit?: number;
  /**
   * @deprecated due to business logic update, keep it first just in case later it will be used
   */
  brandEquity?: number;
  customFields?: Record<string, number>;
}

export interface ChargeOffRow {
  minCredit: number | string;
  frequency: string;
  normDist: string;
  customerCount: number;
  expectedChargeOffs: string;
  consumerAllocation: string;
  expectedDefaultCount: number;
}

export interface ChargeOffInterface {
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  table: ChargeOffRow[];
}

export interface MarketMetrics {
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  marketChurn: number;
  endingCustomers: number;
  grossAdds: number;
  customerChurn: number;
  startingCustomers: number;
  marketGrowthRate: number;
  marketShare: number;
}

// Define the Projection interface
export interface ProjectionInterface extends Document {
  decisionId: mongoose.Types.ObjectId;
  simulationId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  roundNumber?: number;
  /**
   * @deprecated in favor of kpi
   */
  projections: number[];
  kpi: Array<ProjectionKPIInterface>;
  bizperf: BusinessPerformanceInterface[];
  pnl: Array<PnLInterface>;
  balanceSheet: BalanceSheetInterface[];
  cashflow: CashflowInterface[];
  marketMetrics: MarketMetrics[];
  chargeOffs: ChargeOffInterface[];
  createdAt?: Date;
}

const pnlSchema = new mongoose.Schema<PnLInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Segment",
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Product",
    },
    subProductKey: {
      type: String,
      required: false,
    },
    "Total Number of Accounts": { type: Number },
    "Avg Deposits per Account": { type: Number },
    "Total Deposits": { type: Number },
    "Interest Rate Paid": { type: Number },
    "Interest Income": { type: Number },
    "Interest Expense": { type: Number },
    "Net Interest Income": { type: Number },
    "Fees Income": { type: Number },
    "Other Non-Interest Income Total": { type: Number },
    "Non-Interest Income": { type: Number },
    "% Non-Interest Income": { type: Number },
    "Total Revenue": { type: Number },
    "Revenue Per Account": { type: Number },
    "Central Bank Compliance": { type: Number },
    "Internal Liquidity": { type: Number },
    "Avg Loans per Customer": { type: Number },
    "Total Loans": { type: Number },
    "Total Number of Cards": { type: Number },
    "Avg Balance per Customer": { type: Number },
    "Total Balance": { type: Number },
    "% Interest Income": { type: Number },
    "Sales & Marketing": { type: Number },
    "Back Office Expense": { type: Number },
    "Channel and Service": { type: Number },
    "Staff Costs": { type: Number },
    "Other Operating Expenses": { type: Number },
    "Total Expenses": { type: Number },
    "Strategic Initiatives & Other Costs": { type: Number },
    "Non-Interest Expense": { type: Number },
    "Net Income Before Tax": { type: Number },
    Tax: { type: Number },
    "Income Tax Expense": { type: Number },
    "Profit Before Tax": { type: Number },
    "Profit After Tax": { type: Number },
    Provisions: { type: Number },
    "Net Income After Tax": { type: Number },
    "Capital Charge": { type: Number },
    "Risk Adjusted Profit": { type: Number },
    Dividends: { type: Number },
    "Retained Earnings": { type: Number },
    "Business Risk Capital": { type: Number },
    "Credit Risk Capital": { type: Number },
    customFields: {
      type: mongoose.Schema.Types.Map,
      of: Number,
      required: false,
    },
  },
  { _id: false }
);

pnlSchema.virtual("product", {
  ref: "Product",
  localField: "productId",
  foreignField: "_id",
  justOne: true,
});

pnlSchema.set("toObject", { virtuals: true });
pnlSchema.set("toJSON", { virtuals: true });

// Define the Projection schema
const projectionSchema = new mongoose.Schema<ProjectionInterface>(
  {
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Decision ID is required"],
      ref: "Decision", // Reference to the Decision model
    },
    simulationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Simulation ID is required"],
      ref: "Simulation", // Reference to the Simulation model
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Team ID is required"],
      ref: "Team", // Reference to the Team model
    },
    roundNumber: Number,
    projections: {
      type: [Number],
      required: [true, "Projections are required"],
    },
    kpi: {
      type: [
        new mongoose.Schema<ProjectionKPIInterface>({
          segmentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Segment",
          },
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            ref: "Product",
          },
          revenue: { type: Number, default: 0 },
          csat: { type: Number, default: 0 },
          esat: { type: Number, default: 0 },
          cir: { type: Number, default: 0 },
          profit: { type: Number, default: 0 },
          brandEquity: { type: Number, default: 0 },
          customFields: {
            type: mongoose.Schema.Types.Map,
            of: Number,
            required: false,
          },
        }),
      ],
    },
    bizperf: {
      type: [
        new mongoose.Schema<BusinessPerformanceInterface>(
          {
            segmentId: {
              type: mongoose.Schema.Types.ObjectId,
              required: false,
              ref: "Segment",
            },
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              required: false,
              ref: "Product",
            },
            subProductKey: {
              type: String,
              required: false,
            },
            "Total Number of Accounts": { type: Number },
            "Loan to Deposit Ratio (Aggregated)": { type: Number },
            "Cost to Income Ratio": { type: Number },
            "Market Share": { type: Number },
            "Average Deposits": { type: Number },
            "Average Loans": { type: Number },
            "Average Credits": { type: Number },
            "Average Transactions": { type: Number },
            "Average Assets": { type: Number },
            "Average Deals": { type: Number },
            "Non Performing Loan (Aggregated)": { type: Number },
            "Non Performing Loan - Loan": { type: Number },
            "Non Performing Loan - Credit Card": { type: Number },
            "Account Acquisition Cost": { type: Number },
            "Transaction Processed": { type: Number },
            "Revenue Per Account": { type: Number },
            customFields: {
              type: mongoose.Schema.Types.Map,
              of: Number,
              required: false,
            },
          },
          { _id: false }
        ),
      ],
      required: true,
    },
    pnl: {
      type: [pnlSchema],
      required: true,
    },

    balanceSheet: {
      type: [balanceSheetSchema],
      required: true,
      default: [],
    },
    cashflow: {
      type: [cashflowSchema],
      required: true,
      default: [],
    },
    marketMetrics: {
      type: [
        new mongoose.Schema<MarketMetrics>(
          {
            segmentId: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              ref: "Segment",
            },
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              ref: "Product",
            },
            marketChurn: { type: Number, default: 0 },
            endingCustomers: { type: Number, default: 0 },
            grossAdds: { type: Number, default: 0 },
            customerChurn: { type: Number, default: 0 },
            startingCustomers: { type: Number, default: 0 },
            marketGrowthRate: { type: Number, default: 0 },
            marketShare: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
    },
    chargeOffs: {
      type: [
        new mongoose.Schema(
          {
            segmentId: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              ref: "Segment",
            },
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              ref: "Product",
            },
            table: {
              type: [
                {
                  minCredit: {
                    type: mongoose.Schema.Types.Mixed,
                    required: true,
                    validate: {
                      validator: function (v: any) {
                        if (typeof v === "string") {
                          return true;
                        }
                        return typeof v === "number" && !isNaN(v);
                      },
                      message: "Value must be a valid number or numeric string",
                    },
                  },
                  frequency: {
                    type: String,
                    required: true,
                    minLength: 0,
                    default: "",
                  },
                  normDist: { type: String, required: true },
                  customerCount: { type: String, required: true },
                  expectedChargeOffs: { type: String, required: true },
                },
              ],
              required: false,
            },
          },
          { _id: false }
        ),
      ],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-save hook to validate decisionId
projectionSchema.pre("save", async function (next) {
  const projection = this;

  try {
    // Validate if the decision exists
    const decisionExists = await Decision.exists({
      _id: projection.decisionId,
    });
    if (!decisionExists) {
      throw new Error(
        `Decision with ID ${projection.decisionId} does not exist.`
      );
    }

    next();
  } catch (error) {
    if (error instanceof Error) {
      next(error);
    } else {
      next(new Error("An unexpected error occurred."));
    }
  }
});

projectionSchema.virtual("decision", {
  ref: "Decision",
  localField: "decisionId",
  foreignField: "_id",
  justOne: true, // Retrieve one document
});

projectionSchema.set("toObject", { virtuals: true });
projectionSchema.set("toJSON", { virtuals: true });

// Create and export the Projection model
const Projection = mongoose.model<ProjectionInterface>(
  "Projection",
  projectionSchema
);

export default Projection;
