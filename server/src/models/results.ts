import mongoose from "mongoose";
import { DecisionInterface } from "./decisions";
import { CashflowInterface } from "./projections";
import { TeamInterface } from "./teams";

// Interfaces
export interface TeamScore {
  teamId: mongoose.Types.ObjectId;
  originalDecisionValue: number;
  originalDecisionValueString?: string;
  score: number;
}

export interface TeamMarketShare {
  teamId: mongoose.Types.ObjectId;
  value: number;
}

export interface CSATScoreInterface {
  teamId: mongoose.Types.ObjectId;
  openingCSAT: number;
  closingCSAT: number;
}

export interface ESATScoreInterface {
  teamId: mongoose.Types.ObjectId;
  openingESAT: number;
  closingESAT: number;
}

export interface CSATInterface {
  segmentId: mongoose.Types.ObjectId;
  scores: CSATScoreInterface[];
}

export interface ESATInterface {
  segmentId: mongoose.Types.ObjectId;
  scores: ESATScoreInterface[];
}

export interface ESATUnderTeamInterface {
  segmentId: mongoose.Types.ObjectId;
  opening: number;
  closing: number;
}

export interface CSATUnderTeamInterface {
  segmentId: mongoose.Types.ObjectId;
  opening: number;
  closing: number;
}

export interface TeamInvolvedInterface {
  teamId: mongoose.Types.ObjectId;
  team?: TeamInterface;
  decisionId: mongoose.Types.ObjectId;
  decision?: DecisionInterface;
  winningMetric: WinningMetricsUnderTeamInterface[];
  esat: ESATUnderTeamInterface[];
  csat: CSATUnderTeamInterface[];
  bizperf: BizperfUnderTeamInterface[];
  pnl: PNLUnderTeamInterface[];
  cashflow: CashflowUnderTeamInterface[];
  balanceSheet: BalanceSheetUnderTeamInterface[];
  adjustedParams: ParamUnderTeamInterface[];
  miscellaneous: MiscellaneousUnderTeamInterface[];
  ldr: LDRUnderTeamInterface;
  score: ScoreUnderTeamInterface;
}

export interface ResultInterface {
  simulationId: mongoose.Types.ObjectId;
  roundNumber: number;
  teams: Array<TeamInvolvedInterface>;
  marketShares: Array<{
    productId: mongoose.Types.ObjectId;
    segmentId: mongoose.Types.ObjectId;
    subProductKey?: string;
    weightedScores: WeightedScoreInterface[];
    marketShares: TeamMarketShare[];
  }>;
  csat: CSATInterface[];
  esat: ESATInterface[];
  esatDrivers: ESATDriverInterface[];
  csatDrivers: CSATDriverInterface[];
}

// Schemas
const teamScoreSchema = new mongoose.Schema<TeamScore>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Team",
    },
    originalDecisionValue: {
      type: Number,
      required: true,
    },
    originalDecisionValueString: {
      type: String,
      required: false,
    },
    score: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const teamMarketShareSchema = new mongoose.Schema<TeamMarketShare>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Team",
    },
    value: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

export interface WeightedScoreInterface {
  fieldKey: string;
  fieldLabel: string;
  coefficient: number;
  level?: string;
  teamValues: Array<{
    teamId: mongoose.Types.ObjectId;
    originalDecisionValue: number;
    score: number;
  }>;
}

const weightedScoreSchema = new mongoose.Schema<WeightedScoreInterface>(
  {
    fieldKey: {
      type: String,
      required: true,
    },
    fieldLabel: {
      type: String,
      required: true,
    },
    coefficient: {
      type: Number,
      required: true,
    },
    level: {
      type: String,
      required: false,
    },
    teamValues: {
      type: [teamScoreSchema],
      required: true,
    },
  },
  { _id: false }
);

const csatScoreSchema = new mongoose.Schema<CSATScoreInterface>({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Team ID is required"],
    ref: "Team",
  },
  openingCSAT: {
    type: Number,
    required: [true, "Opening CSAT is required"],
  },
  closingCSAT: {
    type: Number,
  },
});

const esatScoreSchema = new mongoose.Schema<ESATScoreInterface>({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Team ID is required"],
    ref: "Team",
  },
  openingESAT: {
    type: Number,
    required: [true, "Opening ESAT is required"],
  },
  closingESAT: {
    type: Number,
  },
});

const csatSchema = new mongoose.Schema<CSATInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    scores: {
      type: [csatScoreSchema],
      required: [true, "CSAT scores are required"],
      default: [],
    },
  },
  { _id: false }
);

const esatSchema = new mongoose.Schema<ESATInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    scores: {
      type: [esatScoreSchema],
      required: [true, "CSAT scores are required"],
      default: [],
    },
  },
  { _id: false }
);

const esatUnderTeamSchema = new mongoose.Schema<ESATUnderTeamInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    opening: {
      type: Number,
      required: [true, "Opening ESAT is required"],
    },
    closing: {
      type: Number,
      required: [true, "Closing ESAT is required"],
    },
  },
  { _id: false }
);

const csatUnderTeamSchema = new mongoose.Schema<CSATUnderTeamInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    opening: {
      type: Number,
      required: [true, "Opening CSAT is required"],
    },
    closing: {
      type: Number,
      required: [true, "Closing CSAT is required"],
    },
  },
  { _id: false }
);

export interface BizperfUnderTeamInterface {
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
  "Average Deals"?: number;
  "Average Assets"?: number;
  "Non Performing Loan (Aggregated)"?: number;
  "Non Performing Loan - Loan"?: number;
  "Non Performing Loan - Credit Card"?: number;
  "Account Acquisition Cost"?: number;
  "Transaction Processed"?: number;
  "Revenue Per Account"?: number;
  customFields?: Record<string, number>;
}

const bizperfUnderTeamSchema = new mongoose.Schema<BizperfUnderTeamInterface>({
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
  "Total Number of Accounts": {
    type: Number,
    required: false,
  },
  "Loan to Deposit Ratio (Aggregated)": {
    type: Number,
    required: false,
  },
  "Cost to Income Ratio": {
    type: Number,
    required: false,
  },
  "Market Share": {
    type: Number,
    required: false,
  },
  "Average Deposits": {
    type: Number,
    required: false,
  },
  "Average Loans": {
    type: Number,
    required: false,
  },
  "Average Credits": {
    type: Number,
    required: false,
  },
  "Average Transactions": {
    type: Number,
    required: false,
  },
  "Average Deals": {
    type: Number,
    required: false,
  },
  "Average Assets": {
    type: Number,
    required: false,
  },
  "Non Performing Loan (Aggregated)": {
    type: Number,
    required: false,
  },
  "Non Performing Loan - Loan": {
    type: Number,
    required: false,
  },
  "Non Performing Loan - Credit Card": {
    type: Number,
    required: false,
  },
  "Account Acquisition Cost": {
    type: Number,
    required: false,
  },
  "Transaction Processed": {
    type: Number,
    required: false,
  },
  "Revenue Per Account": {
    type: Number,
    required: false,
  },
  customFields: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: false,
  },
});

export interface PNLUnderTeamInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  subProductKey?: string;
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
  customFields?: Record<string, number>;
}

const pnlUnderTeamSchema = new mongoose.Schema<PNLUnderTeamInterface>({
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
  "Total Number of Accounts": { type: Number, required: false },
  "Avg Deposits per Account": { type: Number, required: false },
  "Total Deposits": { type: Number, required: false },
  "Interest Rate Paid": { type: Number, required: false },
  "Interest Income": { type: Number, required: false },
  "Interest Expense": { type: Number, required: false },
  "Net Interest Income": { type: Number, required: false },
  "Fees Income": { type: Number, required: false },
  "Other Non-Interest Income Total": { type: Number, required: false },
  "Non-Interest Income": { type: Number, required: false },
  "% Non-Interest Income": { type: Number, required: false },
  "Total Revenue": { type: Number, required: false },
  "Revenue Per Account": { type: Number, required: false },
  "Central Bank Compliance": { type: Number, required: false },
  "Internal Liquidity": { type: Number, required: false },
  "Avg Loans per Customer": { type: Number, required: false },
  "Total Loans": { type: Number, required: false },
  "Total Number of Cards": { type: Number, required: false },
  "Avg Balance per Customer": { type: Number, required: false },
  "Total Balance": { type: Number, required: false },
  "% Interest Income": { type: Number, required: false },
  "Staff Costs": { type: Number, required: false },
  "Other Operating Expenses": { type: Number, required: false },
  "Total Expenses": { type: Number, required: false },
  "Sales & Marketing": { type: Number, required: false },
  "Back Office Expense": { type: Number, required: false },
  "Channel and Service": { type: Number, required: false },
  "Strategic Initiatives & Other Costs": { type: Number, required: false },
  "Non-Interest Expense": { type: Number, required: false },
  "Net Income Before Tax": { type: Number, required: false },
  "Profit Before Tax": { type: Number, required: false },
  Tax: { type: Number, required: false },
  "Income Tax Expense": { type: Number, required: false },
  "Net Income After Tax": { type: Number, required: false },
  "Profit After Tax": { type: Number, required: false },
  Provisions: { type: Number, required: false },
  "Capital Charge": { type: Number, required: false },
  "Risk Adjusted Profit": { type: Number, required: false },
  Dividends: { type: Number, required: false },
  "Retained Earnings": { type: Number, required: false },
  "Business Risk Capital": { type: Number, required: false },
  "Credit Risk Capital": { type: Number, required: false },
  customFields: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: false,
  },
});

export interface CashflowUnderTeamInterface extends CashflowInterface {
  // This interface extends CashflowInterface to ensure compatibility
  // All properties are inherited from CashflowInterface
}

const cashflowUnderTeamSchema = new mongoose.Schema<CashflowUnderTeamInterface>(
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
  }
);

export interface BalanceSheetUnderTeamInterface {
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  others: Record<string, number>;
}

const balanceSheetUnderTeamSchema =
  new mongoose.Schema<BalanceSheetUnderTeamInterface>({
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

export interface WinningMetricsUnderTeamInterface {
  segmentId?: mongoose.Types.ObjectId;
  // Dynamic metrics object - supports both old and new format for backward compatibility
  metrics?: Record<string, number>; // Dynamic: { "revenue": 1000, "traffic": 500 }
  // Legacy fields - kept for backward compatibility
  revenue?: number;
  profit?: number;
  csat?: number;
  esat?: number;
}

const winningMetricsUnderTeamSchema =
  new mongoose.Schema<WinningMetricsUnderTeamInterface>({
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Segment",
    },
    metrics: {
      type: mongoose.Schema.Types.Map,
      of: Number,
      required: false,
    },
    revenue: {
      type: Number,
      required: false,
    },
    profit: {
      type: Number,
      required: false,
    },
    csat: {
      type: Number,
      required: false,
    },
    esat: {
      type: Number,
      required: false,
    },
  });

export interface ParamChangeInterface {
  year: number;
  value: number;
}

export interface ParamUnderTeamInterface {
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  originalValue: number;
  changes: Array<ParamChangeInterface>;
  type: "R" | "A";
  code: string;
}

const paramChangeSchema = new mongoose.Schema<ParamChangeInterface>({
  year: {
    type: Number,
    required: [true, "Year is required"],
  },
  value: {
    type: Number,
    required: [true, "Value is required"],
  },
});

const paramUnderTeamSchema = new mongoose.Schema<ParamUnderTeamInterface>({
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Segment ID is required"],
    ref: "Segment",
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Product ID is required"],
    ref: "Product",
  },
  originalValue: {
    type: Number,
    required: [true, "Value is required"],
  },
  changes: {
    type: [paramChangeSchema],
    default: [],
  },
  type: {
    type: String,
    required: [true, "Type is required"],
  },
  code: {
    type: String,
    required: [true, "Code is required"],
  },
});

export interface MiscellaneousUnderTeamInterface {
  segmentId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  branches?: number;
  atms?: number;
  rmNumber?: number;
  rmChurnRate?: number;
  startingCustomers?: number;
  newCustomers?: number;
  customerChurnRate?: number;
  churnedCustomers?: number;
  grossAdds?: number;
  endingCustomers?: number;
}

const miscellaneousUnderTeamSchema =
  new mongoose.Schema<MiscellaneousUnderTeamInterface>({
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Product",
    },
    branches: { type: Number, required: false },
    atms: { type: Number, required: false },
    rmNumber: { type: Number, required: false },
    rmChurnRate: { type: Number, required: false },
    startingCustomers: { type: Number, required: false },
    newCustomers: { type: Number, required: false },
    customerChurnRate: { type: Number, required: false },
    churnedCustomers: { type: Number, required: false },
    grossAdds: { type: Number, required: false },
    endingCustomers: { type: Number, required: false },
  });

export interface LDRUnderTeamInterface {
  loanToDepositRatio: number;
  totalLoan: number;
  totalDeposit: number;
  depositPerSegment: Array<{
    segmentId: mongoose.Types.ObjectId;
    deposit: number;
  }>;
}

const ldrUnderTeamSchema = new mongoose.Schema<LDRUnderTeamInterface>({
  loanToDepositRatio: { type: Number, required: false },
  totalLoan: { type: Number, required: false },
  totalDeposit: { type: Number, required: false },
  depositPerSegment: {
    type: [
      {
        segmentId: { type: mongoose.Schema.Types.ObjectId, required: false },
        deposit: { type: Number, required: false },
      },
    ],
  },
});

export interface ScoreUnderTeamInterface {
  // Dynamic metrics object - supports both old and new format for backward compatibility
  metrics?: Record<string, number>; // { "revenue": 10, "traffic": 5 }
  cumulativeMetrics?: Record<string, number>;
  tiebreaker?: number;
  // Legacy fields - kept for backward compatibility
  rap?: number;
  csat?: number;
  esat?: number;
  revenue?: number;
  cumulativeRAP?: number;
  cumulativeCSAT?: number;
  cumulativeESAT?: number;
  cumulativeRevenue?: number;
}

const scoreUnderTeamSchema = new mongoose.Schema<ScoreUnderTeamInterface>({
  metrics: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: false,
  },
  cumulativeMetrics: {
    type: mongoose.Schema.Types.Map,
    of: Number,
    required: false,
  },
  tiebreaker: { type: Number, required: false },
  rap: { type: Number, required: false },
  csat: { type: Number, required: false },
  esat: { type: Number, required: false },
  revenue: { type: Number, required: false },
  cumulativeRAP: { type: Number, required: false },
  cumulativeCSAT: { type: Number, required: false },
  cumulativeESAT: { type: Number, required: false },
  cumulativeRevenue: { type: Number, required: false },
});

const teamSchema = new mongoose.Schema<TeamInvolvedInterface>(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Team ID is required"],
      ref: "Team",
    },
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Decision ID is required"],
      ref: "Decision",
    },
    winningMetric: {
      type: [winningMetricsUnderTeamSchema],
      required: [true, "Winning metric is required"],
      default: null,
    },
    score: {
      type: scoreUnderTeamSchema,
      required: [true, "Score is required"],
      default: null,
    },
    bizperf: {
      type: [bizperfUnderTeamSchema],
      required: [true, "Biz performance are required"],
      default: [],
    },
    pnl: {
      type: [pnlUnderTeamSchema],
      required: [true, "PNL are required"],
      default: [],
    },
    cashflow: {
      type: [cashflowUnderTeamSchema],
      required: [true, "Cashflow are required"],
      default: [],
    },
    balanceSheet: {
      type: [balanceSheetUnderTeamSchema],
      required: [true, "Balance sheet are required"],
      default: [],
    },
    esat: {
      type: [esatUnderTeamSchema],
      required: [true, "ESAT are required"],
      default: [],
    },
    csat: {
      type: [csatUnderTeamSchema],
      required: [true, "CSAT are required"],
      default: [],
    },
    adjustedParams: {
      type: [paramUnderTeamSchema],
      required: [true, "Params are required"],
      default: [],
    },
    miscellaneous: {
      type: [miscellaneousUnderTeamSchema],
      required: [true, "Miscellaneous are required"],
      default: [],
    },
    ldr: {
      type: ldrUnderTeamSchema,
      required: [true, "LDR are required"],
      // default: [],
    },
  },
  { _id: false }
);

teamSchema.virtual("team", {
  ref: "Team",
  localField: "teamId",
  foreignField: "_id",
  justOne: true,
});

teamSchema.virtual("decision", {
  ref: "Decision",
  localField: "decisionId",
  foreignField: "_id",
  justOne: true,
});

export interface ESATDriverInterface {
  segmentId: mongoose.Types.ObjectId;
  fieldKey: string;
  fieldLabel: string;
  coefficient: number;
  decisionType: string;
  teamValues: Array<{
    teamId: mongoose.Types.ObjectId;
    originalDecisionValue: number;
    originalDecisionValueString?: string;
    score: number;
  }>;
}

export interface CSATDriverInterface {
  segmentId: mongoose.Types.ObjectId;
  fieldKey: string;
  fieldLabel: string;
  coefficient: number;
  decisionType: string;
  teamValues: Array<{
    teamId: mongoose.Types.ObjectId;
    originalDecisionValue: number;
    originalDecisionValueString?: string;
    score: number;
  }>;
}

const esatDriverSchema = new mongoose.Schema<ESATDriverInterface>(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Segment ID is required"],
      ref: "Segment",
    },
    fieldKey: {
      type: String,
      required: [true, "Field key is required"],
    },
    fieldLabel: {
      type: String,
      required: [true, "Field label is required"],
    },
    coefficient: {
      type: Number,
      required: [true, "Coefficient is required"],
    },
    decisionType: {
      type: String,
      required: [true, "Decision type is required"],
    },
    teamValues: {
      type: [teamScoreSchema],
    },
  },
  { _id: false }
);

const csatDriverSchema = new mongoose.Schema<CSATDriverInterface>({
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Segment ID is required"],
    ref: "Segment",
  },
  fieldKey: {
    type: String,
    required: [true, "Field key is required"],
  },
  fieldLabel: {
    type: String,
    required: [true, "Field label is required"],
  },
  coefficient: {
    type: Number,
    required: [true, "Coefficient is required"],
  },
  decisionType: {
    type: String,
    required: [true, "Decision type is required"],
  },
  teamValues: {
    type: [teamScoreSchema],
  },
});

interface ResultDocument extends ResultInterface, mongoose.Document {}

const resultSchema = new mongoose.Schema<ResultDocument>(
  {
    simulationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Simulation ID is required"],
      ref: "Simulation",
    },
    teams: {
      type: [teamSchema],
      required: [true, "Teams are required"],
      default: [],
    },
    roundNumber: {
      type: Number,
      required: [true, "Round number is required"],
    },
    marketShares: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "Product ID is required"],
            ref: "Product",
          },
          segmentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "Segment ID is required"],
            ref: "Segment",
          },
          subProductKey: {
            type: String,
            required: false,
          },
          weightedScores: {
            type: [weightedScoreSchema],
            required: [true, "Weighted scores are required"],
            default: [],
          },
          marketShares: {
            type: [teamMarketShareSchema],
            required: [true, "Market shares are required"],
            default: [],
          },
        },
      ],
    },
    csat: {
      type: [csatSchema],
      required: [true, "CSAT are required"],
      default: [],
    },
    esat: {
      type: [esatSchema],
      required: [true, "ESAT are required"],
      default: [],
    },
    esatDrivers: {
      type: [esatDriverSchema],
      required: [true, "ESAT drivers are required"],
      default: [],
    },
    csatDrivers: {
      type: [csatDriverSchema],
      required: [true, "CSAT drivers are required"],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

resultSchema.virtual("team", {
  ref: "Team",
  localField: "teams",
  foreignField: "_id",
  justOne: false,
});

// Pre-save hook for validation
// resultSchema.pre("save", async function (next) {
//   const result = this;

//   try {
//     // Validate if simulation exists
//     const simulation = await mongoose
//       .model("Simulation")
//       .findById(result.simulationId);
//     if (!simulation) {
//       throw new Error(
//         `Simulation with ID ${result.simulationId} does not exist.`
//       );
//     }

//     // Validate if product exists
//     const product = await mongoose.model("Product").findById(result.productId);
//     if (!product) {
//       throw new Error(`Product with ID ${result.productId} does not exist.`);
//     }

//     // Validate if segment exists
//     const segment = await mongoose.model("Segment").findById(result.segmentId);
//     if (!segment) {
//       throw new Error(`Segment with ID ${result.segmentId} does not exist.`);
//     }

//     next();
//   } catch (error) {
//     if (error instanceof Error) {
//       next(error);
//     } else {
//       next(new Error("An unexpected error occurred."));
//     }
//   }
// });

const Result = mongoose.model<ResultInterface>(
  "Result",
  resultSchema,
  "results"
);

export default Result;
