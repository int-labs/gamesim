import mongoose from "mongoose";

import { BaseDataInterface } from "../models/baseData";
import {
  DecisionDetailInterface,
  DecisionInterface,
  SegmentDecisionDetailInterface,
} from "../models/decisions";
import { IGlobalInput } from "../models/globalInputs";
import Param, { ParamDocument } from "../models/param";
import { ProductInterface } from "../models/products";
import {
  BalanceSheetInterface,
  BusinessPerformanceInterface,
  CashflowInterface,
  ChargeOffInterface,
  MarketMetrics,
  PnLInterface,
  ProjectionInterface,
  ProjectionKPIInterface,
} from "../models/projections";
import {
  ParamUnderTeamInterface,
  TeamInvolvedInterface,
} from "../models/results";
import { RoundInterface } from "../models/rounds";
import { SegmentInterface } from "../models/segments";
import { simCapUniversal } from "./simCap";
import {
  simFinSeg1Prod1,
  simFinSeg1Prod2,
  simFinSeg1Prod3,
  simFinSeg2Prod1,
  simFinSeg2Prod2,
  simFinSeg2Prod3,
  simFinSeg3Prod1,
  simFinSeg3Prod2,
  simFinSeg3Prod3,
  simFinSeg4Prod1,
  simFinSeg4Prod2,
  simFinSeg4Prod3,
  simFinSeg4Prod4,
} from "./simFin";

export interface ExtendedDecisionDetails
  extends Omit<DecisionDetailInterface, "productId"> {
  productId: ProductInterface;
}

export interface ExtendedDecision
  extends Omit<DecisionInterface, "decisionDetails"> {
  decisionDetails: ExtendedDecisionDetails[];
  roundNumber: number;
}

const rebalanceBalancesheet = ({
  totalAssets,
  totalLiabilities,
  totalEquity,
  otherAssets,
  otherEquityInstruments,
  segmentId,
}: {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  otherAssets: number;
  otherEquityInstruments: number;
  segmentId?: string;
}) => {
  const difference = totalAssets - (totalLiabilities + totalEquity);

  if (difference > 0) {
    return {
      totalAssets: totalAssets,
      totalEquity: totalEquity + difference,
      otherAssets: otherAssets,
      otherEquityInstruments: otherEquityInstruments + difference,
    };
  }

  if (difference < 0) {
    return {
      totalAssets: totalAssets - difference,
      totalEquity: totalEquity,
      otherAssets: otherAssets - difference,
      otherEquityInstruments: otherEquityInstruments,
    };
  }

  return {
    totalAssets: totalAssets,
    totalEquity: totalEquity,
    otherAssets: otherAssets,
    otherEquityInstruments: otherEquityInstruments,
  };
};

const batchFetchParameters = async (
  segmentProductPairs: Array<{
    segmentId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
  }>
) => {
  const uniquePairs = [
    ...new Set(
      segmentProductPairs.map(
        (p) => `${p.segmentId.toString()}-${p.productId.toString()}`
      )
    ),
  ];

  const params = await Param.find({
    $or: uniquePairs.map((pair) => {
      const [segmentId, productId] = pair.split("-");
      return {
        segmentId: new mongoose.Types.ObjectId(segmentId),
        productId: new mongoose.Types.ObjectId(productId),
      };
    }),
  }).lean();

  // Create a map for O(1) lookup
  const paramMap: Record<string, ParamDocument> = {};
  params.forEach((param) => {
    const key = `${param.segmentId.toString()}-${param.productId.toString()}`;
    paramMap[key] = param;
  });

  return paramMap;
};

const hasDecisionChanged = ({
  currentProductLatestDecision,
  currentProductPenultimateDecision,
  currentProductLatestSegmentDecision,
  currentProductPenultimateSegmentDecision,
}: {
  currentProductLatestDecision: DecisionDetailInterface;
  currentProductPenultimateDecision: DecisionDetailInterface;
  currentProductLatestSegmentDecision: SegmentDecisionDetailInterface;
  currentProductPenultimateSegmentDecision: SegmentDecisionDetailInterface;
}): boolean => {
  // Compare decisionDetails
  if (
    currentProductLatestDecision.fields.length !==
    currentProductPenultimateDecision.fields.length
  ) {
    return true;
  }

  // Compare each decision detail
  for (let i = 0; i < currentProductLatestDecision.fields.length; i++) {
    const current = currentProductLatestDecision.fields[i];
    const previous = currentProductPenultimateDecision.fields[i];

    if (!previous) return true;

    // Compare key fields that affect calculation
    if (current.key !== previous.key || current.value !== previous.value) {
      return true;
    }
  }

  // Compare segmentDecisionDetails
  if (
    currentProductLatestSegmentDecision.fields.length !==
    currentProductPenultimateSegmentDecision.fields.length
  ) {
    return true;
  }

  for (let i = 0; i < currentProductLatestSegmentDecision.fields.length; i++) {
    const current = currentProductLatestSegmentDecision.fields[i];
    const previous = currentProductPenultimateSegmentDecision.fields[i];

    if (!previous) return true;

    if (current.key !== previous.key || current.value !== previous.value) {
      return true;
    }
  }

  return false; // No changes detected
};

const processDecisionDetails = async ({
  decision,
  prevRoundDecision,
  totalTeams,
  baseData,
  availableGlobalInputs,
  triggeredBy = "teamPlaying",
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  products,
  segments,
  paramMap,
  penultimateProjection,
  penultimateDecision,
  latestDecisionsInPreviousRounds,
  exceededLoan = 0,
  totalCompanyLoan = 0,
  eventsTriggered,
}: {
  decision: DecisionInterface;
  prevRoundDecision: DecisionInterface;
  totalTeams: number;
  baseData: BaseDataInterface;
  availableGlobalInputs: IGlobalInput[];
  triggeredBy?: "teamPlaying" | "roundEnding";
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  prevRoundResult?: TeamInvolvedInterface;
  products: ProductInterface[];
  segments: SegmentInterface[];
  paramMap: Record<string, ParamDocument>;
  penultimateProjection: ProjectionInterface | null;
  penultimateDecision: DecisionInterface | null;
  latestDecisionsInPreviousRounds?: Array<DecisionInterface>;
  exceededLoan?: number;
  totalCompanyLoan?: number;
  eventsTriggered: RoundInterface["eventsTriggered"];
}) => {
  const kpiList: ProjectionKPIInterface[] = [];
  const bizperf: BusinessPerformanceInterface[] = [];
  const pnl: PnLInterface[] = [];
  const cashflow: CashflowInterface[] = [];
  const balanceSheet: BalanceSheetInterface[] = [];
  const marketMetrics: MarketMetrics[] = [];
  const chargeOffs: ChargeOffInterface[] = [];
  const miscellaneous: TeamInvolvedInterface["miscellaneous"] = [];
  let adjustedParams: ParamUnderTeamInterface[] = [];
  let loanInSegment = 0;
  let depositInSegment = 0;

  const npls: Array<{
    segmentId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    npl: {
      nonPerforming: number;
      totalLoan: number;
      ratio: number;
    };
  }> = [];

  const year = decision.roundNumber;
  // console.log("year", year);

  for (const detail of decision.decisionDetails) {
    const product = detail.product;
    if (!product) {
      console.error("❌ Product not found for decision detail:", detail);
      continue;
    }

    const {
      segmentId: productSegmentId,
      _id: productId,
      productName,
    } = product;

    const matchedSegment = baseData.marketData?.segments?.find(
      (segment) =>
        segment.segmentId?.toString() === productSegmentId?.toString()
    );

    if (!matchedSegment) {
      console.error(`❌ Segment not found for ID: ${productSegmentId}`);
      continue;
    }

    const matchedProduct = matchedSegment.products.find(
      (p) => p.productId?.toString() === productId?.toString()
    );

    if (!matchedProduct) {
      console.error(`❌ Product not found for ID: ${productId}`);
      continue;
    }

    const currentProductLatestDecision = detail;
    const currentProductPenultimateDecision =
      penultimateDecision?.decisionDetails.find(
        (d) =>
          d.segmentId.toString() === detail.segmentId.toString() &&
          d.productId.toString() === detail.productId.toString()
      );

    const currentProductLatestSegmentDecision =
      decision.segmentDecisionDetails.find(
        (d) => d.segmentId.toString() === detail.segmentId.toString()
      );
    const currentProductPenultimateSegmentDecision =
      penultimateDecision?.segmentDecisionDetails.find(
        (d) => d.segmentId.toString() === detail.segmentId.toString()
      );

    // Check if this specific product's decision has changed
    const productDecisionChanged = true;
    // const productDecisionChanged = hasDecisionChanged({
    //   currentProductLatestDecision,
    //   currentProductPenultimateDecision:
    //     currentProductPenultimateDecision || currentProductLatestDecision, // Fallback to current if no penultimate
    //   currentProductLatestSegmentDecision:
    //     currentProductLatestSegmentDecision || {
    //       segmentId: detail.segmentId,
    //       fields: [],
    //     },
    //   currentProductPenultimateSegmentDecision:
    //     currentProductPenultimateSegmentDecision || {
    //       segmentId: detail.segmentId,
    //       fields: [],
    //     },
    // });

    // If decision hasn't changed and we have penultimate projection, reuse it for this product
    if (!productDecisionChanged && penultimateProjection) {
      // console.log(
      //   ` Product ${productName} decision unchanged, reusing penultimate projection`
      // );

      // Find the corresponding data from penultimate projection for this product
      const penultimateKPI = penultimateProjection.kpi?.find(
        (k) =>
          k.segmentId.toString() === detail.segmentId.toString() &&
          k.productId?.toString() === detail.productId.toString()
      );
      const penultimateBizperf = penultimateProjection.bizperf?.filter(
        (b) =>
          b.segmentId?.toString() === detail.segmentId.toString() &&
          b.productId?.toString() === detail.productId.toString()
      );
      const penultimatePnl = penultimateProjection.pnl?.filter(
        (p) =>
          p.segmentId?.toString() === detail.segmentId.toString() &&
          p.productId?.toString() === detail.productId.toString()
      );
      const penultimateMarketMetrics =
        penultimateProjection.marketMetrics?.filter(
          (m) =>
            m.segmentId.toString() === detail.segmentId.toString() &&
            m.productId.toString() === detail.productId.toString()
        );
      const penultimateChargeOffs = penultimateProjection.chargeOffs?.filter(
        (c) =>
          c.segmentId.toString() === detail.segmentId.toString() &&
          c.productId.toString() === detail.productId.toString()
      );
      // const penultimateMiscellaneous =
      //   penultimateProjection.miscellaneous?.find(
      //     (m) =>
      //       m.segmentId.toString() === detail.segmentId.toString() &&
      //       m.productId.toString() === detail.productId.toString()
      //   );

      // Add the reused data
      if (penultimateKPI) kpiList.push(penultimateKPI);
      if (penultimateBizperf) bizperf.push(...penultimateBizperf);
      if (penultimatePnl) pnl.push(...penultimatePnl);
      if (penultimateMarketMetrics)
        marketMetrics.push(...penultimateMarketMetrics);
      if (penultimateChargeOffs) chargeOffs.push(...penultimateChargeOffs);
      // if (penultimateMiscellaneous)
      //   miscellaneous.push(penultimateMiscellaneous);

      // Calculate loan/deposit from reused PnL data
      const reusedPnl = penultimatePnl || [];
      const loan = reusedPnl.find(
        (p) => p.productId?.toString() === detail.productId.toString()
      )?.["Total Loans"];

      const deposit = reusedPnl.find(
        (p) => p.productId?.toString() === detail.productId.toString()
      )?.["Total Deposits"];

      if (typeof loan === "number") {
        loanInSegment += loan;
        // console.log("product", product.productName);
        // console.log("loan", loan);
      }
      if (typeof deposit === "number") {
        depositInSegment += deposit;

        // console.log("product", product.productName);
        // console.log("deposit", deposit);
      }

      continue; // Skip to next product
    }

    const paramKey = `${detail.segmentId.toString()}-${detail.productId.toString()}`;
    const param = paramMap[paramKey];

    const prevYearMarketSize =
      matchedProduct.yearlyData?.[(year - 1).toString()]?.marketSize;
    const currentYearMarketSize =
      matchedProduct.yearlyData?.[year.toString()]?.marketSize;

    let simCapResult;

    const productSimConfig: {
      [productName: string]: {
        simFinFunction: Function;
        requiresLoanFields?: boolean;
      };
    } = {
      // Segment 1
      Deposit: { simFinFunction: simFinSeg1Prod1 },
      Loan: { simFinFunction: simFinSeg1Prod2, requiresLoanFields: true },
      "Credit Card": {
        simFinFunction: simFinSeg1Prod3,
        requiresLoanFields: true,
      },

      // // Segment 2
      "Private Banking Services": { simFinFunction: simFinSeg2Prod1 },
      "Premier Loan": {
        simFinFunction: simFinSeg2Prod2,
        requiresLoanFields: true,
      },
      Securities: { simFinFunction: simFinSeg2Prod3 },

      // // Segment 3
      "Business Deposit": { simFinFunction: simFinSeg3Prod1 },
      "Capital Loan": {
        simFinFunction: simFinSeg3Prod2,
        requiresLoanFields: true,
      },
      "Retail Transaction Services": { simFinFunction: simFinSeg3Prod3 },

      // // Segment 4
      "Global Transaction Services": { simFinFunction: simFinSeg4Prod1 },
      "Capital Market": { simFinFunction: simFinSeg4Prod2 },
      "Institutional Lending": {
        simFinFunction: simFinSeg4Prod3,
        requiresLoanFields: true,
      },
      "Asset Management": { simFinFunction: simFinSeg4Prod4 },
    };

    const config = productSimConfig[productName];

    if (!config) {
      console.warn(`⚠️ Unknown product type: ${productName}`);
      continue;
    }

    simCapResult = await simCapUniversal({
      detail,
      segmentDecisions: decision.segmentDecisionDetails,
      globalDecisions: decision.globalDecisionDetails,
      eventDecisions: decision.eventDecisions,
      prevRoundDecision,
      totalTeams,
      currentYearMarketSize,
      prevYearMarketSize,
      availableGlobalInputs,
      triggeredBy,
      roundNumber: decision.roundNumber,
      prevRoundParams,
      currentRoundDecision,
      prevRoundResult,
      products,
      segments,
      param,
      simFinFunction: config.simFinFunction,
      latestDecisionsInPreviousRounds,
      ...(config.requiresLoanFields ? { exceededLoan, totalCompanyLoan } : {}),
      eventsTriggered,
    });

    const {
      totalRevenue,
      newBizPerf,
      newPnl,
      newCashflow,
      newBalanceSheet,
      adjustedParams: newAdjustedParams,
      loan,
      deposit,
    } = simCapResult;

    loanInSegment += typeof loan === "number" ? loan : 0;
    depositInSegment += typeof deposit === "number" ? deposit : 0;

    const profit = newPnl.find((p) => p.productId === productId)?.[
      "Risk Adjusted Profit"
    ];

    kpiList.push({
      segmentId: productSegmentId,
      productId,
      revenue: totalRevenue,
      profit: profit || 0,
      csat: 0,
      esat: 0, // Not calculated yet
      cir: 0,
      brandEquity: 0, // deprecated, but retained
    });

    bizperf.push(...newBizPerf);
    pnl.push(...newPnl);
    cashflow.push(newCashflow);
    balanceSheet.push(newBalanceSheet);
    marketMetrics.push(...simCapResult.marketMetrics);
    miscellaneous.push(
      simCapResult.newMiscellaneous || {
        productId,
        segmentId: productSegmentId,
        branches: 1,
        atms: 1,
      }
    );

    if (simCapResult.chargeOffs) {
      chargeOffs.push({
        segmentId: productSegmentId,
        productId,
        table: simCapResult.chargeOffs,
      });
    }

    adjustedParams.push(...newAdjustedParams);

    if (simCapResult.npl) {
      npls.push({
        segmentId: productSegmentId,
        productId,
        npl: simCapResult.npl,
      });
    }
  }

  const combined: Record<
    string,
    { sum: Record<string, number>; count: Record<string, number> }
  > = {};

  for (const entry of bizperf) {
    const { segmentId, ...fields } = entry;
    if (!combined[segmentId?.toString() ?? "global"]) {
      combined[segmentId?.toString() ?? "global"] = { sum: {}, count: {} };
    }
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === "number") {
        combined[segmentId?.toString() ?? "global"].sum[key] =
          (combined[segmentId?.toString() ?? "global"].sum[key] || 0) + value;
        combined[segmentId?.toString() ?? "global"].count[key] =
          (combined[segmentId?.toString() ?? "global"].count[key] || 0) + 1;
      }
    }
  }

  const combinedForPnl: Record<
    string,
    { sum: Record<string, number>; count: Record<string, number> }
  > = {};

  for (const entry of pnl) {
    const { segmentId, ...fields } = entry;

    if (!combinedForPnl[segmentId?.toString() ?? "global"]) {
      combinedForPnl[segmentId?.toString() ?? "global"] = {
        sum: {},
        count: {},
      };
    }

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === "number") {
        combinedForPnl[segmentId?.toString() ?? "global"].sum[key] =
          (combinedForPnl[segmentId?.toString() ?? "global"].sum[key] || 0) +
          value;
        combinedForPnl[segmentId?.toString() ?? "global"].count[key] =
          (combinedForPnl[segmentId?.toString() ?? "global"].count[key] || 0) +
          1;
      }
    }
  }

  const combinedForKPI: Record<
    string,
    { sum: Record<string, number>; count: Record<string, number> }
  > = {};

  for (const entry of kpiList) {
    const { segmentId, ...fields } = entry;

    if (!combinedForKPI[segmentId.toString()]) {
      combinedForKPI[segmentId.toString()] = { sum: {}, count: {} };
    }

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === "number") {
        combinedForKPI[segmentId.toString()].sum[key] =
          (combinedForKPI[segmentId.toString()].sum[key] || 0) + value;
        combinedForKPI[segmentId.toString()].count[key] =
          (combinedForKPI[segmentId.toString()].count[key] || 0) + 1;
      }
    }
  }

  const processCombinedData = <
    T extends { segmentId?: mongoose.Types.ObjectId },
  >(
    data: T[],
    groupBy: keyof T,
    averageFields: string[] = []
  ) => {
    const combined = new Map<
      string,
      { sum: Record<string, number>; count: Record<string, number> }
    >();

    // Single pass through data
    for (const entry of data) {
      // const key = entry[groupBy].toString();
      // const groupBy = "segmentId";
      const key = entry.segmentId?.toString() ?? "global";

      if (!combined.has(key)) {
        combined.set(key, { sum: {}, count: {} });
      }

      const group = combined.get(key)!;

      // Process all fields in one loop
      for (const [field, value] of Object.entries(entry)) {
        if (field !== groupBy.toString() && typeof value === "number") {
          group.sum[field] = (group.sum[field] || 0) + value;
          group.count[field] = (group.count[field] || 0) + 1;
        }
      }
    }

    // Convert to final format
    return Array.from(combined.entries()).map(([key, { sum, count }]) => {
      const result: any = { [groupBy]: new mongoose.Types.ObjectId(key) };

      for (const [field, total] of Object.entries(sum)) {
        if (averageFields.includes(field)) {
          result[field] = total / count[field];
        } else {
          result[field] = total;
        }
      }

      return result;
    });
  };

  // Use the optimized function for all three data types
  const combinedBizperf = processCombinedData(bizperf, "segmentId", [
    "Cost to Income Ratio",
    // "Loan to Deposit Ratio",
    "Market Share",
    "Account Acquisition Cost",
    "Revenue Per Account",
  ]);

  const combinedPNL = processCombinedData(pnl, "segmentId");

  const combinedKPI = processCombinedData(kpiList, "segmentId", [
    "csat",
    "esat",
  ]);

  const combinedCashflowMap = new Map<
    string,
    {
      segmentId?: mongoose.Types.ObjectId;
      operatingActivities: Record<string, number>;
      investingActivities: Record<string, number>;
      financingActivities: Record<string, number>;
      generalActivities: Record<string, number>;
    }
  >();

  for (const item of cashflow) {
    const key = item.segmentId?.toString() ?? "global";
    let agg = combinedCashflowMap.get(key);
    if (!agg) {
      agg = {
        segmentId: item.segmentId,
        operatingActivities: {},
        investingActivities: {},
        financingActivities: {},
        generalActivities: {},
      };
      combinedCashflowMap.set(key, agg);
    }

    // operating
    for (const k in item.operatingActivities) {
      const v = item.operatingActivities[k] ?? 0;
      agg.operatingActivities[k] = (agg.operatingActivities[k] ?? 0) + v;
    }
    // investing
    for (const k in item.investingActivities) {
      const v = item.investingActivities[k] ?? 0;
      agg.investingActivities[k] = (agg.investingActivities[k] ?? 0) + v;
    }
    // financing
    for (const k in item.financingActivities) {
      const v = item.financingActivities[k] ?? 0;
      agg.financingActivities[k] = (agg.financingActivities[k] ?? 0) + v;
    }
    // general
    for (const k in item.generalActivities) {
      const v = item.generalActivities[k] ?? 0;
      agg.generalActivities[k] = (agg.generalActivities[k] ?? 0) + v;
    }
  }

  const combinedCashflow = Array.from(combinedCashflowMap.values());

  const combinedBalanceSheetMap = new Map<
    string,
    {
      segmentId?: mongoose.Types.ObjectId;
      assets: Record<string, number>;
      liabilities: Record<string, number>;
      equity: Record<string, number>;
      others: Record<string, number>;
    }
  >();

  for (const item of balanceSheet) {
    const key = item.segmentId?.toString() ?? "global";
    let agg = combinedBalanceSheetMap.get(key);
    if (!agg) {
      agg = {
        segmentId: item.segmentId,
        assets: {},
        liabilities: {},
        equity: {},
        others: {},
      };
      combinedBalanceSheetMap.set(key, agg);
    }

    for (const k in item.assets) {
      const v = item.assets[k] ?? 0;
      agg.assets[k] = (agg.assets[k] ?? 0) + v;
    }
    for (const k in item.liabilities) {
      const v = item.liabilities[k] ?? 0;
      agg.liabilities[k] = (agg.liabilities[k] ?? 0) + v;
    }
    for (const k in item.equity) {
      const v = item.equity[k] ?? 0;
      agg.equity[k] = (agg.equity[k] ?? 0) + v;
    }
    for (const k in item.others) {
      const v = item.others[k] ?? 0;
      agg.others[k] = (agg.others[k] ?? 0) + v;
    }
  }

  const combinedBalanceSheet = Array.from(combinedBalanceSheetMap.values());

  const { totalAssets, totalEquity, otherAssets, otherEquityInstruments } =
    rebalanceBalancesheet({
      totalAssets: combinedBalanceSheet[0].assets.totalAssets,
      totalLiabilities: combinedBalanceSheet[0].liabilities.totalLiabilities,
      totalEquity: combinedBalanceSheet[0].equity.totalEquity,
      otherAssets: combinedBalanceSheet[0].assets.otherAssets,
      otherEquityInstruments:
        combinedBalanceSheet[0].equity.otherEquityInstruments,
      segmentId: combinedBalanceSheet[0].segmentId?.toString() ?? "",
    });

  combinedBalanceSheet[0].assets.totalAssets = totalAssets;
  combinedBalanceSheet[0].equity.totalEquity = totalEquity;
  combinedBalanceSheet[0].assets.otherAssets = otherAssets;
  combinedBalanceSheet[0].equity.otherEquityInstruments =
    otherEquityInstruments;

  const fmt = (x: unknown) =>
    Number(x ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

  const firstBS = combinedBalanceSheet[0];

  return {
    kpi: [...kpiList, ...combinedKPI],
    bizperf: [...bizperf, ...combinedBizperf],
    pnl: [...pnl, ...combinedPNL],
    cashflow: [...cashflow, ...combinedCashflow],
    balanceSheet: [...balanceSheet, ...combinedBalanceSheet],
    marketMetrics: [...marketMetrics],
    chargeOffs: [...chargeOffs],
    adjustedParams: [...adjustedParams],
    npls: [...npls],
    miscellaneous: [...miscellaneous],
    loanInSegment,
    depositInSegment,
  };
};

interface SegmentGroup {
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  decision: DecisionInterface;
}

type BaseProjections = {
  kpi: ProjectionKPIInterface[];
  bizperf: BusinessPerformanceInterface[];
  pnl: PnLInterface[];
  balanceSheet: BalanceSheetInterface[];
  cashflow: CashflowInterface[];
  marketMetrics: MarketMetrics[];
};

export type ProjectionResult<T extends object = {}> = BaseProjections & T;

export type BankingExtra = {
  // this should be generic but since FMCG not need it, let's put it here
  adjustedParams: ParamUnderTeamInterface[];
  // these are specific for banking
  miscellaneous: TeamInvolvedInterface["miscellaneous"];
  chargeOffs: ChargeOffInterface[];
  ldr: {
    loanToDepositRatio: number;
    totalLoan: number;
    totalDeposit: number;
    depositPerSegment: Array<{
      segmentId: mongoose.Types.ObjectId;
      deposit: number;
    }>;
  };
};

export default async function calcProjections({
  decision,
  prevRoundDecision,
  totalTeams,
  baseData,
  segmentId,
  productId,
  availableGlobalInputs = [],
  triggeredBy = "teamPlaying",
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  products,
  segments,
  penultimateProjection,
  penultimateDecision,
  latestDecisionsInPreviousRounds,
  exceededLoan = 0,
  totalCompanyLoan = 0,
  eventsTriggered,
}: {
  decision: DecisionInterface;
  prevRoundDecision: DecisionInterface;
  totalTeams: number;
  baseData: BaseDataInterface;
  segmentId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  availableGlobalInputs?: IGlobalInput[];
  triggeredBy?: "teamPlaying" | "roundEnding";
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  prevRoundResult?: TeamInvolvedInterface;
  products: ProductInterface[];
  segments: SegmentInterface[];
  penultimateProjection: ProjectionInterface | null;
  penultimateDecision: DecisionInterface | null;
  latestDecisionsInPreviousRounds?: Array<DecisionInterface>;
  exceededLoan?: number;
  totalCompanyLoan?: number;
  eventsTriggered: RoundInterface["eventsTriggered"];
}): Promise<ProjectionResult<BankingExtra>> {
  const filteredDecisionDetails = decision.decisionDetails.filter((detail) => {
    const matchesSegment = segmentId
      ? detail.segmentId.equals(segmentId)
      : true;
    const matchesProduct = productId
      ? detail.productId.equals(productId)
      : true;
    return matchesSegment && matchesProduct;
  });

  if (filteredDecisionDetails.length === 0) {
    console.warn(
      "No decision details match the provided segmentId and productId."
    );
    return {
      kpi: [],
      bizperf: [],
      pnl: [],
      balanceSheet: [],
      cashflow: [],
      // newBalanceSheet: [],
      marketMetrics: [],
      chargeOffs: [],
      adjustedParams: [],
      miscellaneous: [],
      ldr: {
        loanToDepositRatio: 0,
        totalLoan: 0,
        totalDeposit: 0,
        depositPerSegment: [],
      },
    };
  }

  const segmentProductPairs = decision.decisionDetails.map((detail) => ({
    segmentId: detail.segmentId,
    productId: detail.productId,
  }));

  const paramMap = await batchFetchParameters(segmentProductPairs);

  const segmentGroups = filteredDecisionDetails.reduce(
    (acc, detail) => {
      const segmentName = detail.segment?.key || "retailmass";
      if (!acc[segmentName]) {
        acc[segmentName] = {
          segmentId: detail.segmentId,
          productId: detail.productId,
          decision: {
            ...decision,
            decisionDetails: [],
          } as DecisionInterface,
        };
      }
      acc[segmentName].decision.decisionDetails.push(detail);
      return acc;
    },
    {} as { [key: string]: SegmentGroup }
  );

  const result = {
    kpi: [] as ProjectionKPIInterface[],
    bizperf: [] as BusinessPerformanceInterface[],
    pnl: [] as PnLInterface[],
    balanceSheet: [] as BalanceSheetInterface[],
    cashflow: [] as CashflowInterface[],
    marketMetrics: [] as MarketMetrics[],
    chargeOffs: [] as ChargeOffInterface[],
    adjustedParams: [] as ParamUnderTeamInterface[],
    miscellaneous: [] as TeamInvolvedInterface["miscellaneous"],

    ldr: {
      loanToDepositRatio: 0,
      totalLoan: 0,
      totalDeposit: 0,
      depositPerSegment: [] as Array<{
        segmentId: mongoose.Types.ObjectId;
        deposit: number;
      }>,
    },
    npls: [] as Array<{
      segmentId: mongoose.Types.ObjectId;
      productId: mongoose.Types.ObjectId;
      npl: {
        nonPerforming: number;
        totalLoan: number;
        ratio: number;
      };
    }>,
  };

  let totalLoan = 0;
  let totalDeposit = 0;

  // Process all segments using the same processDecisionDetails function
  for await (const group of Object.values(segmentGroups)) {
    const prevRMNumber =
      prevRoundResult?.miscellaneous?.find(
        (m) =>
          m.segmentId.toString() === group.segmentId.toString() && !m.productId
      )?.rmNumber || 0;

    // TODO make it dynamic
    const fixedEmployeeChurnRate = 0.05;

    const churnedEmployees = Math.round(prevRMNumber * fixedEmployeeChurnRate);

    const closingRMNumber =
      group.decision.segmentDecisionDetails
        .find((d) => d.segmentId.toString() === group.segmentId.toString())
        ?.fields.find((f) => f.key === "rm_number")?.value || 0;

    const newHiring = closingRMNumber - prevRMNumber + churnedEmployees;

    const segmentResult = await processDecisionDetails({
      decision: group.decision,
      prevRoundDecision,
      totalTeams,
      baseData,
      availableGlobalInputs,
      triggeredBy,
      prevRoundParams,
      currentRoundDecision,
      prevRoundResult,
      products,
      segments,
      paramMap,
      penultimateProjection,
      penultimateDecision,
      latestDecisionsInPreviousRounds,
      exceededLoan,
      totalCompanyLoan,
      eventsTriggered,
    });

    result.kpi.push(...segmentResult.kpi);
    result.bizperf.push(...segmentResult.bizperf);
    result.pnl.push(...segmentResult.pnl);
    result.cashflow.push(...segmentResult.cashflow);
    result.balanceSheet.push(...segmentResult.balanceSheet);
    result.marketMetrics.push(...segmentResult.marketMetrics);
    result.chargeOffs.push(...segmentResult.chargeOffs);
    result.adjustedParams.push(...segmentResult.adjustedParams);
    result.miscellaneous.push(
      ...[
        ...segmentResult.miscellaneous,
        {
          segmentId: group.segmentId,
          rmNumber: closingRMNumber,
          rmChurnRate: fixedEmployeeChurnRate,
        },
      ]
    );

    totalLoan += segmentResult.loanInSegment;
    totalDeposit += segmentResult.depositInSegment;

    result.ldr.depositPerSegment.push({
      segmentId: group.segmentId,
      deposit: segmentResult.depositInSegment,
    });

    result.npls.push(...segmentResult.npls);
  }

  const loanToDepositRatio = totalLoan / totalDeposit;

  result.bizperf = result.bizperf.map((bizperf) => {
    return {
      ...bizperf,
      "Loan to Deposit Ratio (Aggregated)": loanToDepositRatio,
    };
  });

  const nplAndTotalLoanAggregated = result.npls.reduce(
    (acc, npl) => {
      return {
        nonPerforming: acc.nonPerforming + npl.npl.nonPerforming,
        totalLoan: acc.totalLoan + npl.npl.totalLoan,
      };
    },
    {
      nonPerforming: 0,
      totalLoan: 0,
    }
  );

  result.bizperf = result.bizperf.map((bizperf) => {
    return {
      ...bizperf,
      "Non Performing Loan (Aggregated)":
        nplAndTotalLoanAggregated.nonPerforming /
        (nplAndTotalLoanAggregated.totalLoan || 1),
    };
  });

  result.ldr.loanToDepositRatio = loanToDepositRatio;
  result.ldr.totalLoan = totalLoan;
  result.ldr.totalDeposit = totalDeposit;

  return result;
}
