import mongoose from "mongoose";

import {
  DecisionInterface,
  GlobalDecisionDetailInterface,
  SegmentDecisionDetailInterface,
} from "../models/decisions";
import {
  BaseInputInterface as GlobalBaseInputInterface,
  IGlobalInput,
} from "../models/globalInputs";
import { ParamDocument } from "../models/param";
import { ProductInterface } from "../models/products";
import {
  BalanceSheetInterface,
  BusinessPerformanceInterface,
  CashflowInterface,
  PnLInterface,
} from "../models/projections";
import {
  ParamUnderTeamInterface,
  TeamInvolvedInterface,
} from "../models/results";
import { SegmentInterface } from "../models/segments";
import { BalanceSheetFieldHelper } from "../utils/balanceSheetFieldHelper";
import { CashflowFieldHelper } from "../utils/cashflowFieldHelper";

const calculateCashAndCashEquivalent = ({
  prevRoundCashflow,
  fallbackPrevRoundCashAndCashEquivalents,
}: {
  prevRoundCashflow?: CashflowInterface | null;
  fallbackPrevRoundCashAndCashEquivalents: number;
}) => {
  if (!prevRoundCashflow) {
    return fallbackPrevRoundCashAndCashEquivalents;
  }

  const sumOfPrevRoundCashflow =
    Object.entries(prevRoundCashflow.operatingActivities).reduce(
      (sum, [key, value]) => sum + value,
      0
    ) +
    Object.entries(prevRoundCashflow.investingActivities).reduce(
      (sum, [key, value]) => sum + value,
      0
    ) +
    Object.entries(prevRoundCashflow.financingActivities).reduce(
      (sum, [key, value]) => sum + value,
      0
    );

  return sumOfPrevRoundCashflow + fallbackPrevRoundCashAndCashEquivalents;
};

const calculateWorkingCapitalChange = ({
  prevRoundCashflow,
  fallbackPrevRoundWorkingCapitalChange,
  prevRoundCash,
  investmentChanges,
  tax,
}: {
  prevRoundCashflow?: CashflowInterface | null;
  fallbackPrevRoundWorkingCapitalChange: number;
  prevRoundCash: number;
  investmentChanges: number;
  tax: number;
}) => {
  const prevRoundWorkingCapital =
    prevRoundCashflow?.operatingActivities?.workingCapitalChange ||
    fallbackPrevRoundWorkingCapitalChange;

  return prevRoundWorkingCapital + (prevRoundCash + investmentChanges - tax);
};

const calculateLoansAndAdvancesToCustomers = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundLoansAndAdvancesToCustomers,
  totalLoans,
  provisions,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundLoansAndAdvancesToCustomers: number;
  totalLoans: number;
  provisions: number;
}) => {
  const prevRoundLoansAndAdvancesToCustomers =
    prevRoundBalanceSheet?.assets?.loansAndAdvancesToCustomers ||
    fallbackPrevRoundLoansAndAdvancesToCustomers;

  return prevRoundLoansAndAdvancesToCustomers + totalLoans - provisions;
};

const calculateFixedAssets = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundFixedAssets,
  capex,
  depreciation,
  amortization,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundFixedAssets: number;
  capex: number;
  depreciation: number;
  amortization: number;
}) => {
  const initialFixedAssets =
    prevRoundBalanceSheet?.assets?.fixedAssets || fallbackPrevRoundFixedAssets;

  const currentRoundFixedAssets =
    initialFixedAssets + (capex - (depreciation + amortization));

  return currentRoundFixedAssets;
};

const calculateInvestments = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundInvestments,
  investmentChanges,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundInvestments: number;
  investmentChanges: number;
}) => {
  const prevRoundInvestments =
    prevRoundBalanceSheet?.assets?.investments || fallbackPrevRoundInvestments;

  return prevRoundInvestments + investmentChanges;
};

const calculateOtherAssets = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundOtherAssets,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundOtherAssets: number;
}) => {
  const prevRoundOtherAssets =
    prevRoundBalanceSheet?.assets?.otherAssets || fallbackPrevRoundOtherAssets;

  const changesOfOtherAssets = 1000_000;

  return prevRoundOtherAssets + changesOfOtherAssets;
};

const calculateCustomerDeposits = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundCustomerDeposits,
  customerDeposits,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundCustomerDeposits: number;
  customerDeposits: number;
}) => {
  const prevRoundCustomerDeposits =
    prevRoundBalanceSheet?.liabilities?.customerDeposits ||
    fallbackPrevRoundCustomerDeposits;

  return prevRoundCustomerDeposits + customerDeposits;
};

const calculateBorrowings = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundBorrowings,
  borrowings,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundBorrowings: number;
  borrowings: number;
}) => {
  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities?.borrowings ||
    fallbackPrevRoundBorrowings;

  return prevRoundBorrowings + borrowings;
};

const calculateProvisions = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundProvisions,
  provisions,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundProvisions: number;
  provisions: number;
}) => {
  const prevRoundProvisions =
    prevRoundBalanceSheet?.liabilities?.provisions ||
    fallbackPrevRoundProvisions;

  return prevRoundProvisions + provisions;
};

const calculateShareCapital = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundShareCapital,
  shareCapital,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundShareCapital: number;
  shareCapital: number;
}) => {
  const prevRoundShareCapital =
    prevRoundBalanceSheet?.liabilities?.shareCapital ||
    fallbackPrevRoundShareCapital;

  return prevRoundShareCapital + shareCapital;
};

const calculateRetainedEarnings = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundRetainedEarnings,
  newRetainedEarnings,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundRetainedEarnings: number;
  newRetainedEarnings: number;
}) => {
  const prevRoundRetainedEarnings =
    prevRoundBalanceSheet?.liabilities?.retainedEarnings ||
    fallbackPrevRoundRetainedEarnings;

  return prevRoundRetainedEarnings + newRetainedEarnings;
};

//New
const calculateReserves = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundReserves,
  newReserves,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundReserves: number;
  newReserves: number;
}) => {
  const prevRoundReserves =
    prevRoundBalanceSheet?.equity?.reserves || fallbackPrevRoundReserves;

  return prevRoundReserves + newReserves;
};

const calculateOtherEquityInstruments = ({
  prevRoundBalanceSheet,
  fallbackPrevRoundOtherEquityInstruments,
  newOtherEquityInstruments,
}: {
  prevRoundBalanceSheet?: BalanceSheetInterface | null;
  fallbackPrevRoundOtherEquityInstruments: number;
  newOtherEquityInstruments: number;
}) => {
  const prevRoundOtherEquityInstruments =
    prevRoundBalanceSheet?.liabilities?.otherEquityInstruments ||
    fallbackPrevRoundOtherEquityInstruments;

  return prevRoundOtherEquityInstruments + newOtherEquityInstruments;
};

type FinancialInputs = {
  // baseVariables: ProductInterface["baseVariables"];
  averageFee: number;
  interestRate: number;
  projMktShare: number;
  capMarketChurn: number;
  capStartingCust: number;
  capCustChurn: number;
  capGrossAdds: number;
  capEndingCust: number;
  capMktShare: number;
  capProvisions?: number;
};

export type BizPerfEntry = {
  productId: mongoose.Types.ObjectId;
  [key: string]: number | mongoose.Types.ObjectId;
};

function round(value: number) {
  return Math.round(value);
}

const calculateInitiativeCost = ({
  selectedInitiatives,
  availableGlobalInputs,
  segmentRatio,
  bankwideRatio = 0,
}: {
  selectedInitiatives: string[];
  availableGlobalInputs: IGlobalInput[];
  segmentRatio: number;
  bankwideRatio?: number;
}) => {
  return (
    availableGlobalInputs
      .find((input) => input.key === "initiatives")
      ?.inputs.filter((input) => selectedInitiatives.includes(input.key))
      .map((input) => ({
        cost: input.cost,
        key: input.key,
        impactLevel: input.impactLevel,
      }))
      .reduce((sum, { cost, impactLevel }) => {
        if (impactLevel === "segment") {
          return sum + (cost || 0) * segmentRatio;
        } else if (impactLevel === "global") {
          return sum + (cost || 0) * bankwideRatio;
        } else {
          return sum + (cost || 0);
        }
      }, 0) || 0
  );
};

const findReductionFactor = ({
  tnoLevel,
  key,
  availableTNOInputs,
}: {
  tnoLevel: number;
  key: string;
  availableTNOInputs: GlobalBaseInputInterface[];
}) => {
  const tnoInput = availableTNOInputs.find((input) => input.key === key);

  if (!tnoInput) {
    return 1;
  }

  if (!Array.isArray(tnoInput.reductionFactors)) {
    return 1;
  }

  if (tnoLevel > tnoInput.reductionFactors.length) {
    return tnoInput.reductionFactors[tnoInput.reductionFactors.length - 1];
  }

  if (tnoLevel < 1) {
    return 1;
  }

  return tnoInput.reductionFactors[tnoLevel - 1];
};

const findImpactMultiplier = ({
  currentLevel = 0,
  impactMultipliers = [],
}: {
  impactMultipliers?: Array<number>;
  currentLevel?: number;
}) => {
  if (!impactMultipliers || impactMultipliers.length === 0) {
    return 1;
  }

  if (currentLevel > impactMultipliers.length) {
    return impactMultipliers[impactMultipliers.length - 1];
  }

  return impactMultipliers[currentLevel - 1];
};

export const calculateSomeFieldAfterImpactsFromGlobalDecisions = ({
  originalValue,
  impactsFromGlobalDecisions,
  productName,
  fieldName = "unknown field",
}: {
  originalValue: number;
  impactsFromGlobalDecisions: Array<{
    key?: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  productName: string;
  fieldName?: string;
}) => {
  // console.log("productName:", productName);
  // console.log(
  //   `originalValue of ${fieldName} before impacts from global decisions:`,
  //   originalValue
  // );

  let calculatedValue = originalValue;

  if (impactsFromGlobalDecisions && impactsFromGlobalDecisions.length > 0) {
    // Separate absolute and relative impacts
    const absoluteImpacts = impactsFromGlobalDecisions
      .filter((impact) => impact.type === "absolute")
      .reduce((sum, impact) => sum + (impact.value || 0), 0);

    const relativeImpacts = impactsFromGlobalDecisions
      .filter((impact) => impact.type === "relative")
      .reduce((sum, impact) => sum + (impact.value || 0), 0);

    calculatedValue = calculatedValue * (1 + relativeImpacts);
    calculatedValue = calculatedValue + absoluteImpacts;
  }

  // console.log(
  //   `${fieldName} after impacts from global decisions:`,
  //   calculatedValue
  // );

  return calculatedValue;
};

// Helper function to extract parameter value safely
const getParamValue = (
  param: ParamDocument,
  code: string,
  defaultValue: number = 0
) => {
  const paramEntry = param?.parameters.find((p) => p.paramCode === code);
  return paramEntry ? paramEntry.paramValue : defaultValue;
};

async function calculateDepositProductFinances({
  inputs,
  productId,
  productName,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
  // Parameters extracted by each simFinSegProd function
  paramBaseSpread,
  paramTaxRate,
  paramCCAWaitTime,
  paramPercentOnlineBanking,
  paramBranchOperatingCost,
  paramAtmOperatingCost,
  paramHiringBreakdown,
  paramPremCentOperatingCost,
  paramAccBalance,
  paramAccSize,
  paramOtherNonIntIncomeFixed,
  paramOtherNonIntIncomeVar,
  paramProvisionFixed,
  paramProvisionVar,
  paramBackOfficeFixed,
  paramBackOfficeVar,
  paramInetFixed,
  paramInetVar,
  paramItFixed,
  paramItVar,
  paramBranchPerKCust,
  paramAtmPerKCust,
  paramPremCentPerKCust,
  paramServCostPerCust,
  paramServBase,
  paramOtherCostPerCust,
  paramBizRiskEcCapRate,
  paramCreditRiskSeverity,
  paramCreditRiskDebtBeta,
  paramSalaryBase,
  paramEmployeeBase,
  paramRetainedEarnings,
  paramDividends,
  paramInvestmentChanges,
  paramEquityIssuance,
  paramEquityBuyback,
  // Segment-specific flags
  hasSegmentInputs = true,
  marketingInitCost = 0,
  tnoCostMultiplier = 1,
  obalBranch = 1000,
  obalAtm = 1400,
  obalPremCent = 75,
  employeeChurnRate = 0.05,
  initiativeSegmentCostRatio = 0.4,
  initiativeBankwideCostRatio = 0.6,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  productName: string;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
  // Parameters passed from each simFinSegProd function
  paramBaseSpread: number;
  paramTaxRate: number;
  paramCCAWaitTime: number;
  paramPercentOnlineBanking: number;
  paramBranchOperatingCost: number;
  paramAtmOperatingCost: number;
  paramHiringBreakdown: number;
  paramPremCentOperatingCost: number;
  paramAccBalance: number;
  paramAccSize: number;
  paramOtherNonIntIncomeFixed: number;
  paramOtherNonIntIncomeVar: number;
  paramProvisionFixed: number;
  paramProvisionVar: number;
  paramBackOfficeFixed: number;
  paramBackOfficeVar: number;
  paramInetFixed: number;
  paramInetVar: number;
  paramItFixed: number;
  paramItVar: number;
  paramBranchPerKCust: number;
  paramAtmPerKCust: number;
  paramPremCentPerKCust: number;
  paramServCostPerCust: number;
  paramServBase: number;
  paramOtherCostPerCust: number;
  paramBizRiskEcCapRate: number;
  paramCreditRiskSeverity: number;
  paramCreditRiskDebtBeta: number;
  paramSalaryBase: number;
  paramEmployeeBase: number;
  paramRetainedEarnings: number;
  paramDividends: number;
  paramInvestmentChanges: number;
  paramEquityIssuance: number;
  paramEquityBuyback: number;
  // Segment-specific configuration
  hasSegmentInputs?: boolean;
  marketingInitCost?: number;
  tnoCostMultiplier?: number;
  obalBranch?: number;
  obalAtm?: number;
  obalPremCent?: number;
  employeeChurnRate?: number;
  initiativeSegmentCostRatio?: number;
  initiativeBankwideCostRatio?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
}> {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capEndingCust,
    capGrossAdds,
    capMktShare,
    // tnoITInfra,
    tnoMobileBanking,
  } = inputs;

  if (triggeredBy === "roundEnding") {
    paramAccSize = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: paramAccSize,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "paramAccSize"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "param account size",
    });
  }

  //paramAccSize change to Account Number
  let totalAcc = capEndingCust * paramAccSize;
  // console.log("Total Number of Accounts", totalAcc);

  let totalMoney = capEndingCust * paramAccBalance * paramAccSize;
  // console.log("Total Deposits", totalMoney);

  //paramBaseSpread change to internalRate
  let interestIncome = totalMoney * paramBaseSpread;
  // console.log("Interest Income", interestIncome);
  let interestExpense = totalMoney * interestRate;
  // console.log("Interest Expense", interestExpense);
  let netInterestIncome = interestIncome - interestExpense;
  // console.log("Net Interest Income", netInterestIncome);

  //Check
  let feesIncome = averageFee * totalAcc;
  // console.log("Fees Income", feesIncome);
  let otherNonIntIncome =
    paramOtherNonIntIncomeFixed + totalMoney * paramOtherNonIntIncomeVar;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Total Revenue",
    });
  }

  // console.log("Total Revenue", totalRevenue);
  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = totalAcc !== 0 ? totalRevenue / totalAcc : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Sales and Marketing
  let salesTotal = Math.ceil(marketingSpent);
  // console.log("Sales and Marketing Total", salesTotal);
  let salesPctRev = salesTotal / totalRevenue;
  // console.log("Sales and Marketing % of Revenue", salesPctRev);

  // Branches calculation
  const branchRequired = (capEndingCust * paramBranchPerKCust) / 1000;
  // console.log("branchRequired:", branchRequired);

  const prevMiscellaneous = prevRoundResult?.miscellaneous?.find((m) =>
    m.productId?.equals(productId)
  );
  const branchUtilization = branchRequired / obalBranch;
  // console.log("branchUtilization:", branchUtilization);

  //TODO: Add TnO Branch cost here
  const branchCost = Math.ceil(branchRequired * paramBranchOperatingCost);
  // console.log("branchCost:", branchCost);

  // ATM calculation
  const atmRequired = (capEndingCust * paramAtmPerKCust) / 1000;
  // console.log("atmRequired:", atmRequired);

  // TODO: Fazry
  // Update OBAL here for rolling round
  const atmUtilization = atmRequired / obalAtm;
  // console.log("atmUtilization:", atmUtilization);

  //TODO: Add TnO ATM cost here
  const atmCost = Math.ceil(atmRequired * paramAtmOperatingCost);
  // console.log("atmCost:", atmCost);

  // Premier Center calculation
  const premCentRequired = (capEndingCust * paramPremCentPerKCust) / 1000;
  // console.log("premCentRequired:", premCentRequired);

  // TODO: Fazry
  // Update OBAL here for rolling round
  const premCentUtilization = premCentRequired / obalPremCent;
  // console.log("premCentUtilization:", premCentUtilization);

  //Need to compensate for utilization
  const premCentCost = Math.ceil(premCentRequired * paramPremCentOperatingCost);
  // console.log("premCentCost:", premCentCost);

  const branchAndDiscCost = Math.ceil(branchCost + atmCost + premCentCost);

  //Compensation and Benefits
  //TODO
  //Salary and Training
  //Take input from Segment level

  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  //TODO: Fazry
  // For Retail Mass Segment 1, use paramEmployeeBase and paramSalaryBase (Now has 0 staffCost)
  // Else, use segmentEmployeeBase and segmentSalaryBase
  let salaryCost = 0;
  let trainingCost = 0;
  let staffCost = 0;

  if (hasSegmentInputs) {
    const trainingCostRatio =
      segment?.fields
        .find((f) => f.key === "training")
        ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

    // console.log("trainingCostRatio:", trainingCostRatio);

    const totalRMBeforeHiring =
      prevRoundResult?.miscellaneous?.find(
        (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
      )?.rmNumber || 0;

    // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

    const churnedEmployee = Math.round(totalRMBeforeHiring * employeeChurnRate);

    const totalRMAfterHiringAndChurn =
      currentSegmentDecision?.fields.find((f) => f.key === "rm_number")
        ?.value || 0;
    const segmentNewHiring =
      totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
    const segmentSalary =
      currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value ||
      0;
    //TODO Fazry
    //const segmentTrainingCost
    // console.log("segmentSalary:", segmentSalary);

    let totalPeople =
      (totalRMBeforeHiring * (1 - employeeChurnRate) + segmentNewHiring) *
      paramHiringBreakdown;
    // console.log("Total New Hire", totalPeople);
    salaryCost = totalPeople * segmentSalary;
    // console.log("Salary Cost", salaryCost);
    //To change to original Training cost only
    trainingCost = totalPeople * trainingCostRatio * segmentSalary;

    staffCost = Math.ceil(salaryCost + trainingCost);
  } else {
    let fixedTrainingCostRatioForProductsWithoutSegmentInputs = 1.1;

    staffCost =
      paramEmployeeBase *
      paramSalaryBase *
      fixedTrainingCostRatioForProductsWithoutSegmentInputs;
  }

  // Back Office
  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  console.log("Depreciation:", depreciation);
  console.log("Amortization:", amortization);

  //Need breakdown per TnO

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);

  let backOfficeVar = totalAcc * paramBackOfficeVar * (1 + productLevel / 24);
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Back Office Total",
    });
  }

  // Contoh (Back Office cost tanpa dari TnO)
  // let backOfficeDepreciation = Math.ceil(
  //   backOfficeTotal * paramBackOfficeDepreciation
  // );
  // let backOfficeAmortization = Math.ceil(
  //   backOfficeTotal * paramBackOfficeAmortization
  // );
  // console.log("Back Office Total", backOfficeTotal);
  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  // Need to calculate employee required to serve the customers
  // Need param for this to be adjustable from trainingCost
  let employeeRequired = 100;

  //Internet Expense
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalAcc * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  const tnoITInfra =
    globalDecisions.find((decision) => decision.key === "itInfra")?.value || 0;

  //IT Expense
  //TODO:Check link here
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  // console.log("IT Cost Reduction Factor", itCostReductionFactor);
  let itVar = totalAcc * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Total",
    });
  }

  //New Account and Overhead
  let newAccounts = paramServCostPerCust * capGrossAdds;
  // console.log("New Accounts", newAccounts);
  let serviceBase = paramServBase;
  let employeeOverhead = paramEmployeeBase * paramSalaryBase * 0.05;
  let newAccountsAndOverheadTotal = Math.ceil(
    newAccounts + serviceBase + employeeOverhead
  );
  // console.log("New Accounts and Overhead Total", newAccountsAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  let otherCost = paramOtherCostPerCust * capEndingCust;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: initiativeSegmentCostRatio,
    bankwideRatio: initiativeBankwideCostRatio,
  });

  // console.log("Depo SI Cost", siCost);

  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);

  // let staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("Staff Cost", staffCost);

  let channelServ =
    branchAndDiscCost + itTotal + inetTotal + newAccountsAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);

  let nonInterestExp = otherOperatingExpenses + staffCost;

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp);
  // console.log("NPBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NPBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NPAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NPAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalMoney);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(
    paramBizRiskEcCapRate * otherOperatingExpenses
  );
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  // console.log("Total Capital Charge", totalCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  let rap = Math.ceil(npat - totalCapCharge);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  let rapPerAcc = totalAcc !== 0 ? Math.ceil(rap / totalAcc) : 0;
  // console.log("RAP per Account", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / totalAcc);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalAcc),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Deposits": round(paramAccBalance),
      "Account Acquisition Cost": custAcqCostPerAcc,
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat < 0 ? 0 : Math.ceil(paramDividends * npat);

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Total Deposits": round(totalMoney),
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Staff Costs": staffCost,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Other Operating Expenses": otherOperatingExpenses,
      "Non-Interest Expense": nonInterestExp,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };
  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  // --- Cash Flow derived items ---

  // Capex = branch expansion + IT spend (Investing Activity)
  const capex = branchCost + itTotal;

  // Investment changes = % of revenue allocated to securities/investments (Investing Activity)
  const investmentChanges = paramInvestmentChanges * totalRevenue;

  // Equity transactions = issuance minus buybacks (Financing Activity)
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  // --- Balance Sheet core totals ---

  // Cash = closing balance from Cash Flow (Operating + Investing + Financing)
  // Year 0 starts with placeholder value of 20,000,000;
  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  // --- Working Capital calculation ---

  // Current Assets = Cash + short-term investments
  // Current Liabilities = tax
  // Working Capital = Current Assets - Current Liabilities

  const fallbackPrevRoundWorkingCapitalChange =
    param.parameters.find(
      (p) => p.betterCode === "initial.operating.workingCapitalChange"
    )?.paramValue || 0;

  const workingCapitalChange = calculateWorkingCapitalChange({
    prevRoundCash:
      prevRoundResult?.balanceSheet.find(
        (bs) => bs.productId?._id.toString() === productId.toString()
      )?.assets.cashAndCashEquivalents || 0,
    fallbackPrevRoundWorkingCapitalChange:
      fallbackPrevRoundWorkingCapitalChange,
    investmentChanges,
    tax,
  });

  // console.log("workingCapital", workingCapital);

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  const loansAndAdvancesToCustomers = 0; // not applicable for deposit products

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: 0, // deposit don't have provisions
      depreciation: depreciation + amortization,
      workingCapitalChange: workingCapitalChange,
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: totalMoney,
      netChangeInLoansAndAdvancesToCustomers: -loansAndAdvancesToCustomers,
      taxPaid: -tax,
    },
    investing: {
      capex: -capex,
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: 0, // capital market don't have debt issuance
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: totalMoney,
  });

  const borrowings = 0; // not applicable for deposit products

  const provisions = 0; // not applicable for deposit products

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: {
      productId,
      segmentId,
      branches: branchRequired,
      atms: atmRequired,
    },
    deposit: totalMoney,
  };
}

async function calculateLoanProductFinances({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  roundNumber,
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  // param related
  paramAccSize,
  paramBaseSpread,
  paramInterbankRate,
  paramAccBalance,
  paramAccBalanceNew,
  paramOtherNonIntIncomeFixed,
  paramOtherNonIntIncomeVar,
  paramProvisionFixed,
  paramBackOfficeVar,
  paramBackOfficeFixed,
  paramBranchPerKCust,
  paramBranchOperatingCost,
  paramAtmPerKCust,
  paramAtmOperatingCost,
  paramPremCentPerKCust,
  paramPremCentOperatingCost,
  paramInetVar,
  paramInetFixed,
  paramItVar,
  paramItFixed,
  paramServCostPerCust,
  paramServBase,
  paramTaxRate,
  paramCreditRiskSeverity,
  paramBizRiskEcCapRate,
  paramCreditRiskDebtBeta,
  paramHiringBreakdown,
  paramOtherCostPerCust,
  paramSalaryBase,
  paramEmployeeBase,
  paramRetainedEarnings,
  paramDividends,
  paramInvestmentChanges,
  paramEquityIssuance,
  paramEquityBuyback,
  // param related ends
  hasSegmentInputs,
  assumedLGD,
  fixedEmployeeChurnRate,
  tnoCostMultiplier,
  obalBranch,
  obalAtm,
  obalPremCent,
  initiativeCostSegmentRatio,
  initiativeBankwideCostRatio = 0.6,
  percentageDebtIssuance = 0,
  // specific
  commPct = 0,
  salaryTotalCoefficient = 1,
  exceededLoan = 0,
  totalCompanyLoan = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  // param related
  paramAccSize: number;
  paramBaseSpread: number;
  paramInterbankRate: number;
  paramAccBalance: number;
  paramAccBalanceNew: number;
  paramOtherNonIntIncomeFixed: number;
  paramOtherNonIntIncomeVar: number;
  paramProvisionFixed: number;
  paramBackOfficeVar: number;
  paramBackOfficeFixed: number;
  paramBranchPerKCust: number;
  paramBranchOperatingCost: number;
  paramAtmPerKCust: number;
  paramAtmOperatingCost: number;
  paramPremCentPerKCust: number;
  paramPremCentOperatingCost: number;
  paramInetVar: number;
  paramInetFixed: number;
  paramItVar: number;
  paramItFixed: number;
  paramServCostPerCust: number;
  paramServBase: number;
  paramTaxRate: number;
  paramCreditRiskSeverity: number;
  paramBizRiskEcCapRate: number;
  paramCreditRiskDebtBeta: number;
  paramHiringBreakdown: number;
  paramOtherCostPerCust: number;
  paramSalaryBase: number;
  paramEmployeeBase: number;
  paramRetainedEarnings: number;
  paramDividends: number;
  paramInvestmentChanges: number;
  paramEquityIssuance: number;
  paramEquityBuyback: number;
  // param related ends
  hasSegmentInputs?: boolean;
  assumedLGD: number;
  fixedEmployeeChurnRate: number;
  tnoCostMultiplier: number;
  obalBranch: number;
  obalAtm: number;
  obalPremCent: number;
  initiativeCostSegmentRatio: number;
  initiativeBankwideCostRatio?: number;
  percentageDebtIssuance?: number;
  // specific
  commPct?: number;
  salaryTotalCoefficient?: number;
  exceededLoan?: number;
  totalCompanyLoan?: number;
}) {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
    capProvisions,
  } = inputs;

  if (triggeredBy === "roundEnding") {
    paramAccSize = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: paramAccSize,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "paramAccSize"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "param account size",
    });
  }

  let currAcc = paramAccSize * (capStartingCust - capCustChurn);
  // console.log("Existing Number of Accounts", currAcc);
  // console.log("New Number of Accounts", capGrossAdds);

  let totalAcc = currAcc + capGrossAdds;
  // console.log("Total Number of Accounts", totalAcc);

  let avgAccPerCust = totalAcc / capEndingCust;
  // console.log("Avg Number of Accs Per Cust", avgAccPerCust);

  const currAccIntRate =
    prevRoundDecision.decisionDetails
      .find((d) => d.productId.toString() === productId.toString())
      ?.fields.find((f) => f.key === "interest_rate")?.value ?? 0;
  // console.log("Current Acc Interest Rate", currAccIntRate);
  // console.log("New Acc Interest Rate", interestRate);

  let avgAccIntRate = (currAccIntRate + interestRate) / 2;
  // console.log("Avg Acc Interest Rate", avgAccIntRate);

  let avgAccSpread = (avgAccIntRate - paramBaseSpread) * 10000;
  // console.log("Avg Acc Spread", avgAccSpread);

  let currAccBalance = paramAccBalance * currAcc;
  // console.log("Current Acc Balance", currAccBalance);
  let newAccBalance = paramAccBalanceNew * capGrossAdds;
  // console.log("New Acc Balance", newAccBalance);

  let totalAccBalance = currAccBalance + newAccBalance;
  // console.log("Total Acc Balance", totalAccBalance);
  let avgBalanceperAcc = totalAccBalance / totalAcc;
  // console.log("Avg Balance per Acc", avgBalanceperAcc);

  let currAccIntIncome = currAccBalance * currAccIntRate;
  // console.log("Current Acc Interest Income", currAccIntIncome);
  let newAccIntIncome = newAccBalance * interestRate;
  // console.log("New Acc Interest Income", newAccIntIncome);
  let loanInterestIncome = currAccIntIncome + newAccIntIncome;
  // console.log("Total Acc Interest Income", loanInterestIncome);

  let interbankInterestExpense =
    exceededLoan *
    (totalAccBalance / (totalCompanyLoan || 1)) *
    paramInterbankRate;

  let loanInterestExpense =
    totalAccBalance * paramBaseSpread + interbankInterestExpense;
  // console.log("Total Acc Interest Expense", loanInterestExpense);

  let loanNii = loanInterestIncome - loanInterestExpense;
  // console.log("Total Acc Net Interest Income", loanNii);

  let feesIncome = averageFee * totalAcc;
  // console.log("Fees Income", feesIncome);
  let otherNonIntIncome =
    paramOtherNonIntIncomeFixed + totalAccBalance * paramOtherNonIntIncomeVar;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = loanNii + nonInterestIncome;

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Total Revenue",
    });
  }

  // console.log("Total Revenue22", totalRevenue);
  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = totalAcc !== 0 ? totalRevenue / totalAcc : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Provisions
  let currentRoundProvisionsRatio = 0;
  let provisionsRatioAdjustment = 0;

  if (roundNumber > 1 && prevRoundParams.length > 0) {
    const currentProductPrevRoundProvisionsRatioAdjustment =
      prevRoundParams.find(
        (p) =>
          p.productId.equals(productId) &&
          p.segmentId.equals(segmentId) &&
          p.code === "provisionsRatio"
      );

    currentRoundProvisionsRatio =
      currentProductPrevRoundProvisionsRatioAdjustment
        ? currentProductPrevRoundProvisionsRatioAdjustment.originalValue +
          currentProductPrevRoundProvisionsRatioAdjustment.changes.reduce(
            (sum, change) => sum + change.value,
            0
          )
        : 0;
  } else {
    // currentRoundProvisionsRatio =
    // (
    //   await fetchParamBySegmentProduct({ segmentId, productId })
    // )?.parameters.find((p) => p.betterCode === "provisionsRatio")
    //   ?.paramValue ?? 0;
    currentRoundProvisionsRatio =
      param?.parameters.find((p) => p.betterCode === "provisionsRatio")
        ?.paramValue ?? 0;
  }

  // if (impactsFromGlobalDecisions.length > 0) {
  //   provisionsRatioAdjustment = impactsFromGlobalDecisions
  //     .filter((g) => g.impacting === "provisionsRatio")
  //     .reduce((sum, impact) => sum + (impact.value || 0) / 100, 0);
  // }

  // if (triggeredBy === "roundEnding") {
  //   currentRoundProvisionsRatio += provisionsRatioAdjustment;
  // }

  let provisionsVar = currAccBalance * currentRoundProvisionsRatio;
  // console.log("Current Round Provisions Ratio", currentRoundProvisionsRatio);
  // console.log("Provision Variable", provisionsVar);
  let capChargeOffRatePNewCust = capProvisions ?? 0;
  // console.log("capChargeOffRatePNewCust", capChargeOffRatePNewCust);
  let provisionsNewCust =
    capGrossAdds * avgBalanceperAcc * capChargeOffRatePNewCust;
  // console.log("capGrossAdds", capGrossAdds);
  // console.log("Average Balance per Acc", avgBalanceperAcc);
  // console.log("Provision New Cust", provisionsNewCust);
  let provisionsTotal = Math.ceil(
    paramProvisionFixed + provisionsVar + provisionsNewCust
  );

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Provision Total",
    });
  }
  // console.log("Provision Total", provisionsTotal);

  // ---- NPL Estimation (Existing Customers Only) ----
  // const assumedLGD = 0.35;
  let estimatedNPLRatio = currentRoundProvisionsRatio / assumedLGD;
  // console.log("Estimated NPL Ratio (existing)", estimatedNPLRatio);

  let estimatedNPL = currAccBalance * estimatedNPLRatio;
  // console.log("Estimated NPL (from existing balance)", estimatedNPL);

  let nplOverLoan = estimatedNPL / totalAccBalance;
  // console.log("NPL over Total Loan", nplOverLoan);

  // ---- Recalculate Loan Provisions Ratio ----
  let newProvisionsRatio = provisionsTotal / totalAccBalance;
  // console.log("Loan Provisions Ratio", newProvisionsRatio);

  let adjustedParams: ParamUnderTeamInterface[] = [];

  const prevRoundProvisionsRatio = prevRoundParams.find(
    (p) =>
      p.productId.equals(productId) &&
      p.segmentId.equals(segmentId) &&
      p.code === "provisionsRatio"
  );

  const nextRoundProvisionsRatio = prevRoundProvisionsRatio
    ? {
        ...prevRoundProvisionsRatio,
        changes: [
          ...(prevRoundProvisionsRatio?.changes ?? []),
          {
            year: roundNumber,
            // value: newProvisionsRatio - currentRoundProvisionsRatio,
            value: 0,
          },
        ],
      }
    : {
        segmentId,
        productId,
        code: "provisionsRatio",
        originalValue:
          param?.parameters.find((p) => p.betterCode === "provisionsRatio")
            ?.paramValue ?? 0,
        changes: [
          {
            year: roundNumber,
            // value: newProvisionsRatio - currentRoundProvisionsRatio,
            value: 0,
          },
        ],
        type: "R" as "R" | "A",
      };

  adjustedParams.push(nextRoundProvisionsRatio);

  // For rolling round
  // obalBranch = branchRequired;

  let staffCost = 0;

  //Compensation and Benefits
  if (hasSegmentInputs) {
    const currentSegmentDecision = segmentDecisions.find(
      (d) => d.segmentId.toString() === segmentId.toString()
    );
    const trainingLevel =
      currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
      0;
    const impactMultipliers =
      currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
        ?.impactMultipliers || [];

    const trainingImpactMultiplier = findImpactMultiplier({
      currentLevel: trainingLevel,
      impactMultipliers,
    });

    // console.log(
    //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
    // );

    const trainingCostRatio =
      segment?.fields
        .find((f) => f.key === "training")
        ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

    // console.log("trainingCostRatio:", trainingCostRatio);

    const totalRMBeforeHiring =
      prevRoundResult?.miscellaneous?.find(
        (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
      )?.rmNumber || 0;

    // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

    // const fixedEmployeeChurnRate = 0.05;

    const churnedEmployee = Math.round(
      totalRMBeforeHiring * fixedEmployeeChurnRate
    );

    const totalRMAfterHiringAndChurn =
      currentSegmentDecision?.fields.find((f) => f.key === "rm_number")
        ?.value || 0;
    const segmentNewHiring =
      totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
    const segmentSalary =
      currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value ||
      0;
    //TODO Fazry
    //const segmentTrainingCost
    // console.log("segmentSalary:", segmentSalary);

    let totalPeople =
      (totalRMBeforeHiring * (1 - fixedEmployeeChurnRate) + segmentNewHiring) *
      paramHiringBreakdown;
    // console.log("Total New Hire", totalPeople);
    let salaryCost = totalPeople * segmentSalary;
    // console.log("Salary Cost", salaryCost);
    //To change to original Training cost only
    let trainingCost = totalPeople * trainingCostRatio * segmentSalary;

    // console.log("Training Cost", trainingCost);

    staffCost = Math.ceil(salaryCost + trainingCost);
    // console.log("Staff Cost Total", staffCost);
  } else {
    let salaryTotal = Math.ceil(
      paramSalaryBase * paramEmployeeBase * salaryTotalCoefficient
    );

    let agentCommission =
      (capGrossAdds / capStartingCust) * totalRevenue * commPct;

    staffCost = Math.ceil(salaryTotal + agentCommission);
    // console.log("Staff Cost Total", staffCost);
  }

  // Need to calculate employee required to serve the customers
  // Need param for this to be adjustable from trainingCost
  let employeeRequired = 100;

  //Sales and Marketing
  //Change to param for Init total Cost
  let marketingInitCost = 1;

  let salesTotal = Math.ceil(marketingSpent + marketingInitCost);
  // console.log("Sales and Marketing Total", salesTotal);
  let salesPctRev = salesTotal / totalRevenue;
  // console.log("Sales and Marketing % of Revenue", salesPctRev);

  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  // const tnoCostMultiplier = 1.225;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);

  //Product Level change to final product level instead of input
  let backOfficeVar =
    totalAccBalance * paramBackOfficeVar * (productLevel / 12);
  // console.log("Back Office Variable", backOfficeVar);
  //Other Back Office TODO
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Back Office Total",
    });
  }

  // console.log("Back Office Total", backOfficeTotal);
  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  const prevRoundMiscellaneous = prevRoundResult?.miscellaneous?.find(
    (m) =>
      m.productId?.toString() === productId.toString() &&
      m.segmentId.toString() === segmentId.toString()
  );

  const prevRoundBranch = prevRoundMiscellaneous?.branches || 1000;
  // console.log("prevRoundBranch:", prevRoundBranch);

  // Branches calculation
  const branchRequired = (capEndingCust * paramBranchPerKCust) / 1000;
  // console.log("branchRequired:", branchRequired);

  // TODO: Update OBAL here for rolling round
  // const obalBranch = 1000;
  const branchUtilization = branchRequired / obalBranch;
  //TODO use ratio to split whole TnO cost
  const tnoCost = 0;
  const branchCost = Math.ceil(branchRequired * paramBranchOperatingCost);
  // console.log("branchUtilization:", branchUtilization);
  // console.log("branchCost:", branchCost);

  // ATM calculation
  const atmRequired = (capEndingCust * paramAtmPerKCust) / 1000;
  // console.log("branchRequired:", branchRequired);

  // TODO: Update OBAL here for rolling round
  // const obalAtm = 1000;
  const atmUtilization = atmRequired / obalAtm;
  // console.log("atmUtilization:", atmUtilization);

  const atmCost = Math.ceil(atmRequired * paramAtmOperatingCost);
  // console.log("atmCost:", atmCost);

  // Premier Center calculation
  const premCentRequired = (capEndingCust * paramPremCentPerKCust) / 1000;
  // console.log("premCentRequired:", premCentRequired);

  // TODO: Fazry
  // Update OBAL here for rolling round
  // const obalPremCent = 4000;
  const premCentUtilization = premCentRequired / obalPremCent;
  // console.log("premCentUtilization:", premCentUtilization);

  //Need to compensate for utilization
  const premCentCost = Math.ceil(premCentRequired * paramPremCentOperatingCost);
  // console.log("premCentCost:", premCentCost);

  const branchAndDiscCost = Math.ceil(branchCost + atmCost + premCentCost);

  //Internet Expense
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalAcc * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  //IT Expense
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let itVar = totalAcc * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Total",
    });
  }

  //New Account and Overhead
  //TODO
  //Can be affected by Init
  let newAccounts = paramServCostPerCust * capGrossAdds;
  // console.log("New Accounts", newAccounts);
  let serviceBase = paramServBase;
  let newAccountsAndOverheadTotal = Math.ceil(newAccounts + serviceBase);
  // console.log("New Accounts and Overhead Total", newAccountsAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  let otherCost = paramOtherCostPerCust * capEndingCust;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: initiativeCostSegmentRatio,
    bankwideRatio: initiativeBankwideCostRatio,
  });
  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("Loan SI Cost", siCost);
  // console.log("Strategic Initiatives & Other Costs Total", siAndOtherCostTotal);

  // console.log("loan si cost", siCost);

  let channelServ =
    branchAndDiscCost + itTotal + inetTotal + newAccountsAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);

  let nonInterestExp = otherOperatingExpenses + staffCost;

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("NPBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NPBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NIAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NIAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalAccBalance);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(
    paramBizRiskEcCapRate * otherOperatingExpenses
  );
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  // console.log("Total Capital Charge", totalCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  //Added Provisions here
  let rap = Math.ceil(npat - totalCapCharge);
  // console.log("Original RAP", rap);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  let rapPerAcc = totalAcc !== 0 ? Math.ceil(rap / totalAcc) : 0;
  // console.log("RAP per Account", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalAcc),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Loans": round(paramAccBalance),
      // TODO the NPL must be updated with correct value
      "Non Performing Loan (Aggregated)": estimatedNPL,
      "Account Acquisition Cost": custAcqCostPerAcc,
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat < 0 ? 0 : Math.ceil(paramDividends * npat);

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Total Loans": round(totalAccBalance),
      "Interest Income": round(loanInterestIncome),
      "Interest Expense": round(loanInterestExpense),
      "Net Interest Income": round(loanNii),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Staff Costs": staffCost,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Other Operating Expenses": otherOperatingExpenses,
      "Non-Interest Expense": nonInterestExp,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  // --- Cash Flow derived items ---
  // Capex = branch expansion + IT spend (Investing Activity)
  const capex = branchCost + itTotal;

  // Investment changes = % of revenue allocated to securities/investments (Investing Activity)
  const investmentChanges = paramInvestmentChanges * totalRevenue;

  // Equity transactions = issuance minus buybacks (Financing Activity)
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  // --- Balance Sheet core totals ---
  // Cash = closing balance from Cash Flow (Operating + Investing + Financing)

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );
  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  // --- Working Capital calculation ---

  // Current Assets = Cash + short-term investments
  // Current Liabilities = tax
  // Working Capital = Current Assets - Current Liabilities

  const fallbackPrevRoundWorkingCapitalChange =
    param.parameters.find(
      (p) => p.betterCode === "initial.operating.workingCapitalChange"
    )?.paramValue || 0;

  const workingCapitalChange = calculateWorkingCapitalChange({
    prevRoundCash:
      prevRoundResult?.balanceSheet.find(
        (bs) => bs.productId?._id.toString() === productId.toString()
      )?.assets.cashAndCashEquivalents || 0,
    fallbackPrevRoundWorkingCapitalChange:
      fallbackPrevRoundWorkingCapitalChange,
    investmentChanges,
    tax,
  });
  // console.log("workingCapital", workingCapital);

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const fallbackPrevRoundLoansAndAdvancesToCustomers =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.loansAndAdvancesToCustomers"
    )?.paramValue || 0;

  const loansAndAdvancesToCustomers = calculateLoansAndAdvancesToCustomers({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundLoansAndAdvancesToCustomers:
      fallbackPrevRoundLoansAndAdvancesToCustomers,
    totalLoans: totalAccBalance,
    provisions: provisionsTotal,
  });

  // console.log("totalAccBalance2", totalAccBalance);
  // console.log("provisionsTotal2", provisionsTotal);

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const customerDeposits = 0; // not applicable for loan products

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: workingCapitalChange,
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -(
        totalAccBalance - provisionsTotal
      ),
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newAdjustedParams: adjustedParams,
    newMiscellaneous: {
      productId,
      segmentId,
      branches: branchRequired,
      atms: atmRequired,
    },
    loan: totalAccBalance,
    npl: {
      nonPerforming: estimatedNPL,
      totalLoan: totalAccBalance,
      ratio: estimatedNPL / totalAccBalance,
    },
  };
}

export async function simFinSeg1Prod1({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  product,
  segment,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  currentRoundDecision: DecisionInterface;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
}> {
  // console.log(
  //   `simFinSeg1Prod1 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P1-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P1S1-4");
  const paramAccSize = getParamValue(param, "P1S1-6");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P1S1-8");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P1S1-10");

  const paramBackOfficeFixed = getParamValue(param, "P1S1-18");
  const paramBackOfficeVar = getParamValue(param, "P1S1-20");
  const paramInetFixed = getParamValue(param, "P1S1-22");
  const paramInetVar = getParamValue(param, "P1S1-24");
  const paramItFixed = getParamValue(param, "P1S1-26");
  const paramItVar = getParamValue(param, "P1S1-28");

  const paramTellerHours = getParamValue(param, "P1S1-30");
  const paramTellerHoursNew = getParamValue(param, "P1S1-32");
  const paramCsHours = getParamValue(param, "P1S1-34");
  const paramCsHoursNew = getParamValue(param, "P1S1-36");
  const paramAdvisorHours = getParamValue(param, "P1S1-38");
  const paramAdvisorHoursNew = getParamValue(param, "P1S1-40");

  const paramBranchPerKCust = getParamValue(param, "P1S1-42");
  const paramAtmPerKCust = getParamValue(param, "P1S1-44");
  const paramPremCentPerKCust = getParamValue(param, "P1S1-46");
  const paramServCostPerCust = getParamValue(param, "P1S1-48");
  const paramServBase = getParamValue(param, "P1S1-50");
  const paramOtherCostPerCust = getParamValue(param, "P1S1-52");

  const paramBizRiskEcCapRate = getParamValue(param, "P1S1-86");
  const paramCreditRiskSeverity = getParamValue(param, "P1S1-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P1S1-90");

  const paramSalaryBase = getParamValue(param, "P1S1-92");
  const paramEmployeeBase = getParamValue(param, "P1S1-94");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const tnoCostMultiplier = 1.15;
  const obalBranch =
    prevRoundResult?.miscellaneous?.find((m) => m.productId?.equals(productId))
      ?.branches || 1000;
  const obalAtm = 4000;
  const obalPremCent = 4000;

  return calculateDepositProductFinances({
    inputs,
    productId,
    productName: product?.productName,
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    roundNumber,
    // Parameters extracted by each simFinSegProd function
    paramBaseSpread,
    paramTaxRate,
    paramCCAWaitTime,
    paramPercentOnlineBanking,
    paramBranchOperatingCost,
    paramAtmOperatingCost,
    paramHiringBreakdown: 0,
    paramPremCentOperatingCost,
    paramAccBalance,
    paramAccSize,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed: 0,
    paramProvisionVar: 0,
    paramBackOfficeFixed,
    paramBackOfficeVar,
    paramInetFixed,
    paramInetVar,
    paramItFixed,
    paramItVar,
    paramBranchPerKCust,
    paramAtmPerKCust,
    paramPremCentPerKCust,
    paramServCostPerCust,
    paramServBase,
    paramOtherCostPerCust,
    paramBizRiskEcCapRate,
    paramCreditRiskSeverity,
    paramCreditRiskDebtBeta,
    paramSalaryBase,
    paramEmployeeBase,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // Segment-specific flags
    hasSegmentInputs: false,
    marketingInitCost: 0,
    tnoCostMultiplier,
    obalBranch,
    obalAtm,
    obalPremCent,
    initiativeSegmentCostRatio: 0.4,
  });
}

export async function simFinSeg1Prod2({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  riskLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  roundNumber,
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  param,
  product,
  segment,
  exceededLoan = 0,
  totalCompanyLoan = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  riskLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: {
    type: "absolute" | "relative";
    value: number;
    key: string;
    impacting: string;
    // globalInputId: mongoose.Types.ObjectId;
  }[];
  impactsFromEvents: {
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }[];
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  exceededLoan?: number;
  totalCompanyLoan?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newAdjustedParams: ParamUnderTeamInterface[];
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  loan: number;
  npl: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
}> {
  // console.log(
  //   `simFinSeg1Prod2 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P2S1-4");
  const paramAccBalanceNew = getParamValue(param, "P2S1-6");
  const paramAccSize = getParamValue(param, "P2S1-8");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P2S1-10");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P2S1-12");

  const paramProvisionFixed = getParamValue(param, "P2S1-14");
  const paramProvisionVar = getParamValue(param, "P2S1-16");

  const paramBackOfficeFixed = getParamValue(param, "P2S1-20");
  const paramBackOfficeVar = getParamValue(param, "P2S1-22");
  const paramInetFixed = getParamValue(param, "P2S1-24");
  const paramInetVar = getParamValue(param, "P2S1-26");
  const paramItFixed = getParamValue(param, "P2S1-28");
  const paramItVar = getParamValue(param, "P2S1-30");

  const paramBranchPerKCust = getParamValue(param, "P2S1-46");
  const paramAtmPerKCust = getParamValue(param, "P2S1-48");
  const paramPremCentPerKCust = getParamValue(param, "P2S1-50");
  const paramServCostPerCust = getParamValue(param, "P2S1-52");
  const paramServBase = getParamValue(param, "P2S1-54");
  const paramOtherCostPerCust = getParamValue(param, "P2S1-56");

  const paramBizRiskEcCapRate = getParamValue(param, "P2S1-86");
  const paramCreditRiskSeverity = getParamValue(param, "P2S1-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P2S1-90");

  const paramSalaryBase = getParamValue(param, "P2S1-92");
  const paramEmployeeBase = getParamValue(param, "P2S1-94");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  return calculateLoanProductFinances({
    inputs,
    productId,
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    prevRoundDecision,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    roundNumber,
    prevRoundParams,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    // param related
    paramAccSize,
    paramBaseSpread,
    paramInterbankRate: 0.04,
    paramAccBalance,
    paramAccBalanceNew,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed,
    paramBackOfficeVar,
    paramBackOfficeFixed,
    paramBranchPerKCust,
    paramBranchOperatingCost,
    paramAtmPerKCust,
    paramAtmOperatingCost,
    paramPremCentPerKCust,
    paramPremCentOperatingCost,
    paramInetVar,
    paramInetFixed,
    paramItVar,
    paramItFixed,
    paramServCostPerCust,
    paramServBase,
    paramTaxRate,
    paramCreditRiskSeverity,
    paramBizRiskEcCapRate,
    paramCreditRiskDebtBeta,
    paramOtherCostPerCust,
    paramSalaryBase,
    paramEmployeeBase,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param related ends
    assumedLGD: 0.4,
    tnoCostMultiplier: 1.15,
    obalBranch: 1000,
    obalAtm: 1000,
    obalPremCent: 4000,
    exceededLoan,
    totalCompanyLoan,
    // no segment in retail mass
    hasSegmentInputs: false,
    paramHiringBreakdown: 0,
    fixedEmployeeChurnRate: 0,
    initiativeCostSegmentRatio: 0,
    // specific retail mass
    commPct: 0.05,
    salaryTotalCoefficient: 2.5,
    percentageDebtIssuance: 0.04,
  });
}

export async function simFinSeg1Prod3({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  riskLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  prevRoundParams,
  param,
  product,
  segment,
  roundNumber,
  exceededLoan = 0,
  totalCompanyLoan = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  riskLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: {
    type: "absolute" | "relative";
    value: number;
    key: string;
    impacting: string;
    // globalInputId: mongoose.Types.ObjectId;
  }[];
  impactsFromEvents: {
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }[];
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  exceededLoan?: number;
  totalCompanyLoan?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newAdjustedParams: ParamUnderTeamInterface[];
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  loan: number;
  npl: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
}> {
  // console.log(
  //   `simFinSeg1Prod3 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P3S1-4");
  const paramAccBalanceNew = getParamValue(param, "P3S1-6");
  const paramAccSize = getParamValue(param, "P3S1-8");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P3S1-10");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P3S1-12");

  const paramProvisionFixed = getParamValue(param, "P3S1-14");
  const paramProvisionVar = getParamValue(param, "P3S1-16");

  const paramBackOfficeFixed = getParamValue(param, "P3S1-20");
  const paramBackOfficeVar = getParamValue(param, "P3S1-22");
  const paramInetFixed = getParamValue(param, "P3S1-24");
  const paramInetVar = getParamValue(param, "P3S1-26");
  const paramItFixed = getParamValue(param, "P3S1-28");
  const paramItVar = getParamValue(param, "P3S1-30");

  const paramBranchPerKCust = getParamValue(param, "P3S1-44");
  const paramAtmPerKCust = getParamValue(param, "P3S1-46");
  const paramPremCentPerKCust = getParamValue(param, "P3S1-48");
  const paramServCostPerCust = getParamValue(param, "P3S1-50");
  const paramServBase = getParamValue(param, "P3S1-52");
  const paramOtherCostPerCust = getParamValue(param, "P3S1-54");

  const paramBizRiskEcCapRate = getParamValue(param, "P3S1-86");
  const paramCreditRiskSeverity = getParamValue(param, "P3S1-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P3S1-90");

  const paramSalaryBase = getParamValue(param, "P3S1-92");
  const paramEmployeeBase = getParamValue(param, "P3S1-94");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  return calculateLoanProductFinances({
    inputs,
    productId,
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    prevRoundDecision,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    roundNumber,
    prevRoundParams,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    // param related
    paramAccSize,
    paramBaseSpread,
    paramInterbankRate: 0.04,
    paramAccBalance,
    paramAccBalanceNew,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed,
    paramBackOfficeVar,
    paramBackOfficeFixed,
    paramBranchPerKCust,
    paramBranchOperatingCost,
    paramAtmPerKCust,
    paramAtmOperatingCost,
    paramPremCentPerKCust,
    paramPremCentOperatingCost,
    paramInetVar,
    paramInetFixed,
    paramItVar,
    paramItFixed,
    paramServCostPerCust,
    paramServBase,
    paramTaxRate,
    paramCreditRiskSeverity,
    paramBizRiskEcCapRate,
    paramCreditRiskDebtBeta,
    paramOtherCostPerCust,
    paramSalaryBase,
    paramEmployeeBase,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param related ends
    assumedLGD: 0.75,
    tnoCostMultiplier: 1.2,
    obalBranch: 1000,
    obalAtm: 1000,
    obalPremCent: 4000,
    exceededLoan,
    totalCompanyLoan,
    // no segment in retail mass
    hasSegmentInputs: false,
    paramHiringBreakdown: 0,
    fixedEmployeeChurnRate: 0,
    initiativeCostSegmentRatio: 0,
    // specific retail mass
    commPct: 0,
    salaryTotalCoefficient: 1,
    percentageDebtIssuance: 0.04,
  });
}

export async function simFinSeg2Prod1({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  currentRoundDecision: DecisionInterface;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
}> {
  // console.log(
  //   `simFinSeg2Prod1 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P1S2-4");
  const paramAccSize = getParamValue(param, "P1S2-6");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P1S2-8");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P1S2-10");

  const paramProvisionFixed = getParamValue(param, "P1S2-14");
  const paramProvisionVar = getParamValue(param, "P1S2-16");

  const paramBackOfficeFixed = getParamValue(param, "P1S2-18");
  const paramBackOfficeVar = getParamValue(param, "P1S2-20");
  const paramInetFixed = getParamValue(param, "P1S2-22");
  const paramInetVar = getParamValue(param, "P1S2-24");
  const paramItFixed = getParamValue(param, "P1S2-26");
  const paramItVar = getParamValue(param, "P1S2-28");

  const paramBranchPerKCust = getParamValue(param, "P1S2-42");
  const paramAtmPerKCust = getParamValue(param, "P1S2-44");
  const paramPremCentPerKCust = getParamValue(param, "P1S2-46");
  const paramServCostPerCust = getParamValue(param, "P1S2-48");
  const paramServBase = getParamValue(param, "P1S2-50");
  const paramOtherCostPerCust = getParamValue(param, "P1S2-52");

  const paramBizRiskEcCapRate = getParamValue(param, "P1S2-86");
  const paramCreditRiskSeverity = getParamValue(param, "P1S2-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P1S2-90");

  const paramSalaryBase = getParamValue(param, "P1S2-92");
  const paramEmployeeBase = getParamValue(param, "P1S2-94");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const tnoCostMultiplier = 1.175;
  const obalBranch =
    prevRoundResult?.miscellaneous?.find((m) => m.productId?.equals(productId))
      ?.branches || 1000;
  const obalAtm = 1400;
  const obalPremCent = 75;

  return calculateDepositProductFinances({
    inputs,
    productId,
    productName: product?.productName || "unknown product",
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    roundNumber,
    // Parameters extracted by each simFinSegProd function
    paramBaseSpread,
    paramTaxRate,
    paramCCAWaitTime,
    paramPercentOnlineBanking,
    paramBranchOperatingCost,
    paramAtmOperatingCost,
    paramHiringBreakdown,
    paramPremCentOperatingCost,
    paramAccBalance,
    paramAccSize,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed,
    paramProvisionVar,
    paramBackOfficeFixed,
    paramBackOfficeVar,
    paramInetFixed,
    paramInetVar,
    paramItFixed,
    paramItVar,
    paramBranchPerKCust,
    paramAtmPerKCust,
    paramPremCentPerKCust,
    paramServCostPerCust,
    paramServBase,
    paramOtherCostPerCust,
    paramBizRiskEcCapRate,
    paramCreditRiskSeverity,
    paramCreditRiskDebtBeta,
    paramSalaryBase,
    paramEmployeeBase,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // Segment-specific flags
    hasSegmentInputs: true,
    marketingInitCost: 0,
    tnoCostMultiplier,
    obalBranch,
    obalAtm,
    obalPremCent,
    initiativeSegmentCostRatio: 0.4,
  });
}

export async function simFinSeg2Prod2({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  roundNumber,
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  exceededLoan = 0,
  totalCompanyLoan = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  exceededLoan?: number;
  totalCompanyLoan?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newAdjustedParams: ParamUnderTeamInterface[];
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  loan: number;
  npl: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
}> {
  // console.log(
  //   `simFinSeg2Prod2 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P2S2-4");
  const paramAccBalanceNew = getParamValue(param, "P2S2-6");
  const paramAccSize = getParamValue(param, "P2S2-8");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P2S2-10");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P2S2-12");

  const paramProvisionFixed = getParamValue(param, "P2S2-14");
  const paramProvisionVar = getParamValue(param, "P2S2-16");

  const paramBackOfficeFixed = getParamValue(param, "P2S2-20");
  const paramBackOfficeVar = getParamValue(param, "P2S2-22");
  const paramInetFixed = getParamValue(param, "P2S2-24");
  const paramInetVar = getParamValue(param, "P2S2-26");
  const paramItFixed = getParamValue(param, "P2S2-28");
  const paramItVar = getParamValue(param, "P2S2-30");

  const paramBranchPerKCust = getParamValue(param, "P2S2-46");
  const paramAtmPerKCust = getParamValue(param, "P2S2-48");
  const paramPremCentPerKCust = getParamValue(param, "P2S2-50");
  const paramServCostPerCust = getParamValue(param, "P2S2-52");
  const paramServBase = getParamValue(param, "P2S2-54");
  const paramOtherCostPerCust = getParamValue(param, "P2S2-56");

  const paramBizRiskEcCapRate = getParamValue(param, "P2S2-86");
  const paramCreditRiskSeverity = getParamValue(param, "P2S2-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P2S2-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  // TODO: Update OBAL here for rolling round
  const obalBranch = 1000;
  const obalAtm = 1000;
  const obalPremCent = 4000;

  return calculateLoanProductFinances({
    inputs,
    productId,
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    prevRoundDecision,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    roundNumber,
    prevRoundParams,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    // param related
    paramAccSize,
    paramBaseSpread,
    paramInterbankRate: 0.04,
    paramAccBalance,
    paramAccBalanceNew,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed,
    paramBackOfficeVar,
    paramBackOfficeFixed,
    paramBranchPerKCust,
    paramBranchOperatingCost,
    paramAtmPerKCust,
    paramAtmOperatingCost,
    paramPremCentPerKCust,
    paramPremCentOperatingCost,
    paramInetVar,
    paramInetFixed,
    paramItVar,
    paramItFixed,
    paramServCostPerCust,
    paramServBase,
    paramTaxRate,
    paramCreditRiskSeverity,
    paramBizRiskEcCapRate,
    paramCreditRiskDebtBeta,
    paramHiringBreakdown,
    paramOtherCostPerCust,
    paramSalaryBase: 0,
    paramEmployeeBase: 0,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param related ends
    assumedLGD: 0.35,
    obalBranch,
    obalAtm,
    obalPremCent,
    exceededLoan,
    totalCompanyLoan,
    percentageDebtIssuance: 0.06,
    // has segment inputs
    hasSegmentInputs: true,
    tnoCostMultiplier: 1.225,
    fixedEmployeeChurnRate: 0.05,
    initiativeCostSegmentRatio: 0.445,
  });
}

export async function simFinSeg2Prod3({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
}> {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
  } = inputs;

  // console.log(
  //   `simFinSeg2Prod3 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P3S2-92");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");

  const paramAccPerCust = getParamValue(param, "P3S2-14");
  const paramChurnRate = getParamValue(param, "P3S2-4");
  const paramTransPerAcc = getParamValue(param, "P3S2-6");
  const paramDepPerAcc = getParamValue(param, "P3S2-8");
  const paramInterestIncomeRate = getParamValue(param, "P3S2-10");
  const paramInterestExpRate = getParamValue(param, "P3S2-12");
  const paramPercentSelf = getParamValue(param, "P3S2-16");
  const paramPercentAdvisor = getParamValue(param, "P3S2-18");

  const paramOtherNonIntIncomeFixed = getParamValue(param, "P3S2-20");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P3S2-22");

  const paramProvisionsFixed = getParamValue(param, "P3S2-24");
  const paramProvisionsVar = getParamValue(param, "P3S2-26");
  const paramProvisionsNewCust = getParamValue(param, "P3S2-28");
  const paramCommission = getParamValue(param, "P3S2-30");

  const paramBackOfficeFixed = getParamValue(param, "P3S2-32");
  const paramBackOfficeVar = getParamValue(param, "P3S2-34");
  const paramInetFixed = getParamValue(param, "P3S2-36");
  const paramInetVar = getParamValue(param, "P3S2-38");
  const paramItFixed = getParamValue(param, "P3S2-40");
  const paramItVar = getParamValue(param, "P3S2-42");

  const paramBranchPerKCust = getParamValue(param, "P3S2-46");
  const paramServCostPerCust = getParamValue(param, "P3S2-48");
  const paramServBase = getParamValue(param, "P3S2-50");
  const paramOtherCostPerCust = getParamValue(param, "P3S2-52");

  const paramBizRiskEcCapRate = getParamValue(param, "P3S2-86");
  const paramCreditRiskSeverity = getParamValue(param, "P3S2-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P3S2-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  let totalTrans = capEndingCust * paramAccPerCust;
  // console.log("Total Number of Transactions", totalTrans);
  let avgTrans = paramAccPerCust * paramTransPerAcc;
  // console.log("Avg Number of Transactions", avgTrans);
  let totalMoney = capEndingCust * avgTrans;
  // console.log("Total Transactions", totalMoney);

  let totalDep = capEndingCust * paramDepPerAcc;
  // console.log("Total Number of Deposits", totalDep);

  let transInterestIncome = totalMoney * paramInterestIncomeRate;
  // console.log("Transaction Interest Income", transInterestIncome);
  let depoInterestIncome = totalDep * paramBaseSpread;
  // console.log("Deposit Interest Income", depoInterestIncome);

  let interestIncome = transInterestIncome + depoInterestIncome;
  // console.log("Total Interest Income", interestIncome);
  let interestExpense = totalDep * paramInterestExpRate;
  // console.log("Interest Expense", interestExpense);
  let netInterestIncome = interestIncome - interestExpense;
  // console.log("Net Interest Income", netInterestIncome);

  const commission =
    currentRoundDecision.decisionDetails
      .find((d) => d.productId.toString() === productId.toString())
      ?.fields.find((f) => f.key === "commission")?.value || 0;
  // console.log("commission", commission);

  //100 is the multiplier
  let feesIncomeSelf = 100 * commission * (totalTrans * paramPercentSelf);
  let feesIncomeAdvisor =
    0.05 * commission * (totalMoney * paramPercentAdvisor);
  let feesIncome = feesIncomeSelf + feesIncomeAdvisor;
  // console.log("paramPercentSelf", paramPercentSelf);
  // console.log("paramPercentAdvisor", paramPercentAdvisor);
  // console.log("feesIncomeSelf", feesIncomeSelf);
  // console.log("feesIncomeAdvisor", feesIncomeAdvisor);
  // console.log("Fees Income", feesIncome);

  let otherNonIntIncome =
    capEndingCust * paramOtherNonIntIncomeVar + paramOtherNonIntIncomeFixed;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Total Revenue",
    });
  }

  // console.log("Total Revenue23", totalRevenue);
  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = capEndingCust !== 0 ? totalRevenue / capEndingCust : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Sales and Marketing
  //Change to param for Init total Cost
  let marketingInitCost = 1;

  let salesCommission = totalRevenue * paramCommission;
  // console.log("Sales Commission", salesCommission);
  let salesTotal = Math.ceil(
    marketingSpent + marketingInitCost + salesCommission
  );
  // console.log("Sales and Marketing Total", salesTotal);

  //Provisions
  let provisionsVar = totalMoney * paramProvisionsVar;
  // console.log("Provisions Variable", provisionsVar);
  let provisionsNewCust = capGrossAdds * avgTrans * paramProvisionsNewCust;
  // console.log("Provisions New Cust", provisionsNewCust);
  let provisionsTotal = Math.ceil(
    paramProvisionsFixed + provisionsVar + provisionsNewCust
  );

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Provision Total",
    });
  }
  // console.log("Provisions Total", provisionsTotal);

  let provisionsRatio = provisionsTotal / totalMoney;
  // console.log("Credit Provisions Ratio", provisionsRatio);

  //Back Office
  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const tnoCostMultiplier = 1.075;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);
  //Added compensation and benefits for Wealth Advisor

  const finalProductLevel = productLevel;
  let backOfficeVar =
    totalTrans * paramBackOfficeVar * (finalProductLevel / 12);
  // console.log("Back Office Variable", backOfficeVar);
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );
  // console.log("Back Office Total", backOfficeTotal);

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "Back Office Total",
    });
  }

  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  const prevRoundMiscellaneous = prevRoundResult?.miscellaneous.find(
    (m) =>
      m.productId?.toString() === productId.toString() &&
      m.segmentId.toString() === segmentId.toString()
  );

  const prevRoundBranch = prevRoundMiscellaneous?.branches || 1000;
  // console.log("prevRoundBranch:", prevRoundBranch);

  // Branch cost only, no ATM
  // Branches calculation
  const branchRequired = (capEndingCust * paramBranchPerKCust) / 1000;
  // console.log("branchRequired:", branchRequired);

  // TODO: Update OBAL here for rolling round
  const obalBranch = 1000;
  const branchUtilization = branchRequired / obalBranch;
  const branchCost = Math.ceil(branchRequired * paramBranchOperatingCost);
  // console.log("branchUtilization:", branchUtilization);
  // console.log("branchCost:", branchCost);

  // For rolling round
  // obalBranch = branchRequired;

  //Compensation and Benefits
  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  const trainingCostRatio =
    segment?.fields
      .find((f) => f.key === "training")
      ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

  // console.log("trainingCostRatio:", trainingCostRatio);

  const totalRMBeforeHiring =
    prevRoundResult?.miscellaneous?.find(
      (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
    )?.rmNumber || 0;

  // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

  const fixedEmployeeChurnRate = 0.05;

  const churnedEmployee = Math.round(
    totalRMBeforeHiring * fixedEmployeeChurnRate
  );

  const totalRMAfterHiringAndChurn =
    currentSegmentDecision?.fields.find((f) => f.key === "rm_number")?.value ||
    0;
  const segmentNewHiring =
    totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
  const segmentSalary =
    currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value || 0;
  //TODO Fazry
  //const segmentTrainingCost
  // console.log("segmentSalary:", segmentSalary);

  let totalPeople =
    (totalRMBeforeHiring * 0.95 + segmentNewHiring) * paramHiringBreakdown;
  // console.log("Total New Hire", totalPeople);
  let salaryCost = totalPeople * segmentSalary;
  // console.log("Salary Cost", salaryCost);
  //To change to original Training cost only
  let trainingCost = totalPeople * trainingCostRatio * segmentSalary;

  // console.log("Training Cost", trainingCost);

  // Need to calculate employee required to serve the customers
  // Need param for this to be adjustable from trainingCost
  let employeeRequired = 100;

  //Internet Expense
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalTrans * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  //IT Expense
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let itVar = totalTrans * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "IT Expense Total",
    });
  }

  //New Transaction and Overhead
  // console.log("capGrossAdds", capGrossAdds);
  let newTrans = paramServCostPerCust * capGrossAdds;
  // console.log("New Transactions", newTrans);
  let wealthAdvisorAdminExp = 20520000;

  //TODO
  //Change to Services from enterprise input
  //Need to confirm
  let enterpriseService = 8;
  let serviceBase = paramServBase * (1 + enterpriseService / 12);
  let newTransAndOverheadTotal = Math.ceil(
    newTrans + wealthAdvisorAdminExp + serviceBase
  );
  // console.log("New Accounts and Overhead Total", newTransAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  //Need to add this to param for mapping
  let otherCost = paramOtherCostPerCust * capEndingCust;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: 0.21,
  });
  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("Strategic Initiatives & Other Costs Total", siAndOtherCostTotal);

  let staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("Staff Cost Total", staffCost);

  let channelServ = branchCost + itTotal + inetTotal + newTransAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);
  let nonInterestExp = otherOperatingExpenses + staffCost;

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("NIBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NIBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NIAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NIAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalMoney);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(
    paramBizRiskEcCapRate * otherOperatingExpenses
  );
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  let rap = Math.ceil(npat - totalCapCharge);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "unknown product",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  //TODO Check if this is per cust, trans, or acc, or etc.
  let rapPerAcc = capEndingCust !== 0 ? Math.ceil(rap / capEndingCust) : 0;
  // console.log("RAP per Customer", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalTrans),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Transactions": round(avgTrans),
      "Account Acquisition Cost": custAcqCostPerAcc,
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat > 0 ? Math.ceil(paramDividends * npat) : 0;

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Staff Costs": staffCost,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Other Operating Expenses": otherOperatingExpenses,
      "Non-Interest Expense": nonInterestExp,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const atmCost = 0;
  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  const investmentChanges = paramInvestmentChanges * totalRevenue;
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  const capex = branchCost + itTotal;

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: totalDep,
  });

  const loansAndAdvancesToCustomers = 0; // not applicable for securities

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const percentageDebtIssuance = 0.06;

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: 0, // not yet implemented
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -loansAndAdvancesToCustomers,
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: {
      productId,
      segmentId,
      branches: branchRequired,
      atms: 1,
    },
  };
}

export async function simFinSeg3Prod1({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
}> {
  // console.log(
  //   `simFinSeg3Prod1 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccSize = getParamValue(param, "P1S3-6");
  const paramAccBalance = getParamValue(param, "P1S3-4");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P1S3-8");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P1S3-10");

  const paramBackOfficeFixed = getParamValue(param, "P1S3-18");
  const paramBackOfficeVar = getParamValue(param, "P1S3-20");
  const paramInetFixed = getParamValue(param, "P1S3-22");
  const paramInetVar = getParamValue(param, "P1S3-24");
  const paramItFixed = getParamValue(param, "P1S3-26");
  const paramItVar = getParamValue(param, "P1S3-28");

  const paramBranchPerKCust = getParamValue(param, "P1S3-42");
  const paramAtmPerKCust = getParamValue(param, "P1S3-44");
  const paramPremCentPerKCust = getParamValue(param, "P1S3-46");
  const paramServCostPerCust = getParamValue(param, "P1S3-48");
  const paramServBase = getParamValue(param, "P1S3-50");
  const paramOtherCostPerCust = getParamValue(param, "P1S3-52");

  const paramBizRiskEcCapRate = getParamValue(param, "P1S3-86");
  const paramCreditRiskSeverity = getParamValue(param, "P1S3-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P1S3-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const tnoCostMultiplier = 0.85;
  const obalBranch =
    prevRoundResult?.miscellaneous?.find((m) => m.productId?.equals(productId))
      ?.branches || 1000;
  const obalAtm = 4000;
  const obalPremCent = 4000;

  return calculateDepositProductFinances({
    inputs,
    productId,
    productName: product?.productName || "unknown product",
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    roundNumber,
    // Parameters extracted by each simFinSegProd function
    paramBaseSpread,
    paramTaxRate,
    paramCCAWaitTime,
    paramPercentOnlineBanking,
    paramBranchOperatingCost,
    paramAtmOperatingCost,
    paramHiringBreakdown: 0,
    paramPremCentOperatingCost,
    paramAccBalance,
    paramAccSize,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed: 0,
    paramProvisionVar: 0,
    paramBackOfficeFixed,
    paramBackOfficeVar,
    paramInetFixed,
    paramInetVar,
    paramItFixed,
    paramItVar,
    paramBranchPerKCust,
    paramAtmPerKCust,
    paramPremCentPerKCust,
    paramServCostPerCust,
    paramServBase,
    paramOtherCostPerCust,
    paramBizRiskEcCapRate,
    paramCreditRiskSeverity,
    paramCreditRiskDebtBeta,
    paramSalaryBase: 0,
    paramEmployeeBase: 0,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // Segment-specific flags
    hasSegmentInputs: false,
    marketingInitCost: 0,
    tnoCostMultiplier,
    obalBranch,
    obalAtm,
    obalPremCent,
    initiativeSegmentCostRatio: 0.15,
  });
}

export async function simFinSeg3Prod2({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  roundNumber,
  prevRoundParams,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  exceededLoan,
  totalCompanyLoan,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  currentRoundDecision: DecisionInterface;
  exceededLoan?: number;
  totalCompanyLoan?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newAdjustedParams: ParamUnderTeamInterface[];
  loan: number;
  npl: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
}> {
  // console.log(
  //   `simFinSeg3Prod2 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramAccBalance = getParamValue(param, "P2S3-4");
  const paramAccBalanceNew = getParamValue(param, "P2S3-6");
  const paramAccSize = getParamValue(param, "P2S3-8");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P2S3-10");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P2S3-12");

  const paramProvisionFixed = getParamValue(param, "P2S3-14");
  const paramProvisionVar = getParamValue(param, "P2S3-16");

  const paramBackOfficeFixed = getParamValue(param, "P2S3-20");
  const paramBackOfficeVar = getParamValue(param, "P2S3-22");
  const paramInetFixed = getParamValue(param, "P2S3-24");
  const paramInetVar = getParamValue(param, "P2S3-26");
  const paramItFixed = getParamValue(param, "P2S3-28");
  const paramItVar = getParamValue(param, "P2S3-30");

  const paramBranchPerKCust = getParamValue(param, "P2S2-46");
  const paramAtmPerKCust = getParamValue(param, "P2S2-48");
  const paramPremCentPerKCust = getParamValue(param, "P2S2-50");
  const paramServCostPerCust = getParamValue(param, "P2S3-52");
  const paramServBase = getParamValue(param, "P2S3-54");
  const paramOtherCostPerCust = getParamValue(param, "P2S3-56");

  const paramBizRiskEcCapRate = getParamValue(param, "P2S3-86");
  const paramCreditRiskSeverity = getParamValue(param, "P2S3-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P2S3-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  return calculateLoanProductFinances({
    inputs,
    productId,
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    prevRoundDecision,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    roundNumber,
    prevRoundParams,
    currentRoundDecision,
    prevRoundResult,
    param,
    segment,
    product,
    // param related
    paramAccSize,
    paramBaseSpread,
    paramInterbankRate: 0.04,
    paramAccBalance,
    paramAccBalanceNew,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionFixed,
    paramBackOfficeVar,
    paramBackOfficeFixed,
    paramBranchPerKCust,
    paramBranchOperatingCost,
    paramAtmPerKCust,
    paramAtmOperatingCost,
    paramPremCentPerKCust,
    paramPremCentOperatingCost,
    paramInetVar,
    paramInetFixed,
    paramItVar,
    paramItFixed,
    paramServCostPerCust,
    paramServBase,
    paramTaxRate,
    paramCreditRiskSeverity,
    paramBizRiskEcCapRate,
    paramCreditRiskDebtBeta,
    paramHiringBreakdown,
    paramOtherCostPerCust,
    paramSalaryBase: 0,
    paramEmployeeBase: 0,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param related ends
    assumedLGD: 0.6,
    // for now branch, atm, prem cent are hardcoded, is it needed or not?
    obalBranch: 1,
    obalAtm: 1,
    obalPremCent: 1,
    exceededLoan,
    totalCompanyLoan,
    percentageDebtIssuance: 0.08,
    // has segment inputs
    hasSegmentInputs: true,
    tnoCostMultiplier: 1,
    fixedEmployeeChurnRate: 0.05,
    initiativeCostSegmentRatio: 0.255,
  });
}

async function calculateTransactionProductFinances({
  inputs,
  productId,
  productName,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  roundNumber,
  prevRoundParams,
  segment,
  // Parameters extracted by each simFinSegProd function
  paramBaseSpread,
  paramTaxRate,
  paramHiringBreakdown,
  paramValuePTrans,
  paramDeposit,
  paramDepositNew,
  paramInterestExpRate,
  paramTransPCust,
  paramFeeIncomeBase,
  paramFeeIncomePCust,
  paramOtherNonIntIncomeFixed,
  paramOtherNonIntIncomeVar,
  paramProvisionsFixed,
  paramProvisionsVar,
  paramProvisionsNewCust,
  paramMarketingBase,
  paramMarketingVar,
  paramCommission,
  paramBackOfficeFixed,
  paramBackOfficeVar,
  paramInetFixed,
  paramInetVar,
  paramItFixed,
  paramItVar,
  paramServCostNewCust,
  paramServCostVar,
  paramServCostFixed,
  paramOtherCostPerCust,
  paramBizRiskEcCapRate,
  paramCreditRiskSeverity,
  paramCreditRiskDebtBeta,
  paramRetainedEarnings,
  paramDividends,
  paramInvestmentChanges,
  paramEquityIssuance,
  paramEquityBuyback,
  // param related ends
  branchAndDiscCost,
  compAndBenefits,
  initiativeSegmentCostRatio,
  initiativeBankwideCostRatio = 0.6,
  percentageDebtIssuance = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    tnoBackOffice: number;
  };
  productId: mongoose.Types.ObjectId;
  productName: string;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber?: number;
  prevRoundParams?: Array<ParamUnderTeamInterface>;
  // Parameters passed from each simFinSegProd function
  paramBaseSpread: number;
  paramTaxRate: number;
  paramHiringBreakdown: number;
  paramValuePTrans: number;
  paramDeposit: number;
  paramDepositNew: number;
  paramInterestExpRate: number;
  paramTransPCust: number;
  paramFeeIncomeBase: number;
  paramFeeIncomePCust: number;
  paramOtherNonIntIncomeFixed: number;
  paramOtherNonIntIncomeVar: number;
  paramProvisionsFixed: number;
  paramProvisionsVar: number;
  paramProvisionsNewCust: number;
  paramMarketingBase: number;
  paramMarketingVar: number;
  paramCommission: number;
  paramBackOfficeFixed: number;
  paramBackOfficeVar: number;
  paramInetFixed: number;
  paramInetVar: number;
  paramItFixed: number;
  paramItVar: number;
  paramServCostNewCust: number;
  paramServCostVar: number;
  paramServCostFixed: number;
  paramOtherCostPerCust: number;
  paramBizRiskEcCapRate: number;
  paramCreditRiskSeverity: number;
  paramCreditRiskDebtBeta: number;
  paramRetainedEarnings: number;
  paramDividends: number;
  paramInvestmentChanges: number;
  paramEquityIssuance: number;
  paramEquityBuyback: number;
  // param related ends
  branchAndDiscCost: number;
  compAndBenefits: number;
  initiativeSegmentCostRatio: number;
  initiativeBankwideCostRatio?: number;
  percentageDebtIssuance?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
  newAdjustedParams: ParamUnderTeamInterface[];
}> {
  const {
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
    tnoBackOffice,
  } = inputs;

  // console.log(`calculateTransactionProductFinances - product ${productName}`);

  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  const trainingCostRatio =
    segment?.fields
      .find((f) => f.key === "training")
      ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

  // console.log("trainingCostRatio:", trainingCostRatio);

  // Core calculations
  let totalNoTrans = paramTransPCust * (capStartingCust - capCustChurn);
  // console.log("totalNoTrans:", totalNoTrans);

  let totalTrans = paramValuePTrans * totalNoTrans;
  // console.log("totalTrans:", totalTrans);

  let currAcc = paramTransPCust * (capStartingCust - capCustChurn);
  // console.log("currAcc:", currAcc);

  let newAcc = paramTransPCust * capGrossAdds;
  // console.log("newAcc:", newAcc);

  let totalAcc = currAcc + newAcc;
  // console.log("totalAcc:", totalAcc);

  let totalTransPCust = totalTrans / capEndingCust;
  // console.log("totalTransPCust:", totalTransPCust);

  let currDepo = paramDeposit * (capStartingCust - capCustChurn);
  // console.log("currDepo:", currDepo);

  let newDepo = paramDepositNew * capGrossAdds;
  // console.log("newDepo:", newDepo);

  let totalDepo = currDepo + newDepo;
  // console.log("totalDepo:", totalDepo);

  let totalDepoPCust = totalDepo / capEndingCust;
  // console.log("totalDepoPCust:", totalDepoPCust);

  // Interest calculations
  let currAccIntIncome = currDepo * paramBaseSpread;
  // console.log("currAccIntIncome:", currAccIntIncome);

  let newAccIntIncome = newDepo * paramBaseSpread;
  // console.log("newAccIntIncome:", newAccIntIncome);

  let interestIncome = currAccIntIncome + newAccIntIncome;
  // console.log("interestIncome:", interestIncome);

  let interestExpense = totalDepo * paramInterestExpRate;
  // console.log("interestExpense:", interestExpense);

  let netInterestIncome = interestIncome - interestExpense;
  // console.log("netInterestIncome:", netInterestIncome);

  // Fee income calculations
  let txnFeeInput =
    currentRoundDecision.decisionDetails
      .find((detail) => detail.productId.toString() === productId.toString())
      ?.fields.find((field) => field.key === "transaction_fee")?.value ?? 0;
  // console.log("txnFeeInput:", txnFeeInput);

  let feesIncome =
    paramFeeIncomeBase + totalNoTrans * paramFeeIncomePCust * txnFeeInput;
  // console.log("feesIncome:", feesIncome);

  let otherNonIntIncome =
    paramOtherNonIntIncomeFixed + capEndingCust * paramOtherNonIntIncomeVar;
  // console.log("otherNonIntIncome:", otherNonIntIncome);

  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("nonInterestIncome:", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;
  // console.log("totalRevenue:", totalRevenue);

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: productName,
      fieldName: "Total Revenue",
    });
    // console.log("adjusted totalRevenue (roundEnding):", totalRevenue);
  }

  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("percentNonInterestIncome:", percentNonInterestIncome);

  let revPerAcc = capEndingCust !== 0 ? totalRevenue / capEndingCust : 0;
  // console.log("revPerAcc:", revPerAcc);

  // Provisions calculation
  let currentRoundProvisionsRatio = 0;
  let provisionsRatioAdjustment = 0;

  if (
    roundNumber !== undefined &&
    prevRoundParams &&
    prevRoundParams.length > 0
  ) {
    const currentProductPrevRoundProvisionsRatioAdjustment =
      prevRoundParams.find(
        (p) =>
          p.productId.equals(productId) &&
          p.segmentId.equals(segmentId) &&
          p.code === "provisionsRatio"
      );

    currentRoundProvisionsRatio =
      currentProductPrevRoundProvisionsRatioAdjustment
        ? currentProductPrevRoundProvisionsRatioAdjustment.originalValue +
          currentProductPrevRoundProvisionsRatioAdjustment.changes.reduce(
            (sum, change) => sum + change.value,
            0
          )
        : 0;
  } else {
    currentRoundProvisionsRatio =
      param?.parameters.find((p) => p.betterCode === "provisionsRatio")
        ?.paramValue ?? 0;
  }

  if (impactsFromGlobalDecisions.length > 0) {
    provisionsRatioAdjustment = impactsFromGlobalDecisions
      .filter((g) => g.impacting === "provisionsRatio")
      .reduce((sum, impact) => sum + (impact.value || 0) / 100, 0);
    // console.log("provisionsRatioAdjustment:", provisionsRatioAdjustment);
  }

  if (triggeredBy === "roundEnding") {
    currentRoundProvisionsRatio += provisionsRatioAdjustment;
  }

  let provisionsVar = paramProvisionsVar * totalDepo;
  // console.log("provisionsVar:", provisionsVar);

  let provisionsNewCust = newDepo * paramProvisionsNewCust;
  // console.log("provisionsNewCust:", provisionsNewCust);

  let provisionsTotal = Math.ceil(
    paramProvisionsFixed + provisionsVar + provisionsNewCust
  );

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: productName,
      fieldName: "Provision Total",
    });
  }
  // console.log("provisionsTotal:", provisionsTotal);

  let newProvisionsRatio = provisionsTotal / totalTrans;
  // console.log("newProvisionsRatio:", newProvisionsRatio);

  // Sales and Marketing
  let marketingInitCost = 1;
  // console.log("marketingInitCost:", marketingInitCost);

  let marketingCost = Math.ceil(paramMarketingBase + marketingSpent);
  // console.log("marketingCost:", marketingCost);

  let salesCommission = Math.ceil(paramCommission * totalRevenue);
  // console.log("salesCommission:", salesCommission);

  let salesTotal = Math.ceil(
    marketingCost + marketingInitCost + salesCommission
  );
  // console.log("salesTotal:", salesTotal);

  let salesPctRev = salesTotal / totalRevenue;
  // console.log("salesPctRev:", salesPctRev);

  // Back Office
  const boCostReductionFactor = findReductionFactor({
    tnoLevel: tnoBackOffice,
    key: "backOffice",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  // console.log("boCostReductionFactor:", boCostReductionFactor);

  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const tnoCostMultiplier = 1.075;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);

  let backOfficeVar = paramBackOfficeVar * totalRevenue * boCostReductionFactor;
  // console.log("backOfficeVar:", backOfficeVar);

  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );
  // console.log("backOfficeTotal:", backOfficeTotal);

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: productName,
      fieldName: "Back Office Total",
    });
  }

  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("backOfficePctRev:", backOfficePctRev);

  // Staff costs calculation
  let staffCost = 0;

  const totalRMBeforeHiring =
    prevRoundResult?.miscellaneous?.find(
      (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
    )?.rmNumber || 0;

  // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

  const fixedEmployeeChurnRate = 0.05;

  const churnedEmployee = Math.round(
    totalRMBeforeHiring * fixedEmployeeChurnRate
  );

  const totalRMAfterHiringAndChurn =
    currentSegmentDecision?.fields.find((f) => f.key === "rm_number")?.value ||
    0;
  const segmentNewHiring =
    totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
  const segmentSalary =
    currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value || 0;
  //TODO Fazry
  //const segmentTrainingCost
  // console.log("segmentSalary:", segmentSalary);

  let totalPeople =
    (totalRMBeforeHiring * 0.95 + segmentNewHiring) * paramHiringBreakdown;
  // console.log("Total New Hire", totalPeople);
  let salaryCost = totalPeople * segmentSalary;
  // console.log("Salary Cost", salaryCost);
  //To change to original Training cost only
  let trainingCost = totalPeople * trainingCostRatio * segmentSalary;
  // console.log("trainingCost:", trainingCost);

  staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("staffCost:", staffCost);

  // Internet Expense
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  // console.log("inetCostReductionFactor:", inetCostReductionFactor);

  let inetVar = totalAcc * paramInetVar * inetCostReductionFactor;
  // console.log("inetVar:", inetVar);

  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("inetTotal:", inetTotal);

  // IT Expense
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  // console.log("itCostReductionFactor:", itCostReductionFactor);

  let itVar = totalAcc * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: productName,
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("itVar:", itVar);

  let itTotal = Math.ceil(paramItFixed + itVar);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: productName,
      fieldName: "IT Expense Total",
    });
  }
  // console.log("itTotal:", itTotal);

  // New Transaction and Overhead
  let newTrans = paramServCostNewCust * capGrossAdds;
  // console.log("newTrans:", newTrans);

  let serviceVar = paramServCostVar * (1 + productLevel / 12) * totalRevenue;
  // console.log("serviceVar:", serviceVar);

  let serviceBase = paramServCostFixed * (1 + productLevel / 12);
  // console.log("serviceBase:", serviceBase);

  let newTransAndOverheadTotal = Math.ceil(newTrans + serviceVar + serviceBase);
  // console.log("newTransAndOverheadTotal:", newTransAndOverheadTotal);

  // Strategic Initiatives & Other Costs
  let otherCost = paramOtherCostPerCust * capEndingCust;
  // console.log("otherCost:", otherCost);

  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: initiativeSegmentCostRatio,
    bankwideRatio: initiativeBankwideCostRatio,
  });
  // console.log("siCost:", siCost);

  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("siAndOtherCostTotal:", siAndOtherCostTotal);

  let channelServ =
    branchAndDiscCost +
    compAndBenefits +
    itTotal +
    inetTotal +
    newTransAndOverheadTotal;
  // console.log("channelServ:", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("otherOperatingExpenses:", otherOperatingExpenses);

  let nonInterestExp = otherOperatingExpenses + staffCost;
  // console.log("nonInterestExp:", nonInterestExp);

  let cir = nonInterestExp / totalRevenue;
  // console.log("cir:", cir);

  // Profit calculations
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("npbt:", npbt);

  let npbtPctRev = npbt / totalRevenue;
  // console.log("npbtPctRev:", npbtPctRev);

  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("tax:", tax);

  let npat = Math.ceil(npbt - tax);
  // console.log("npat:", npat);

  let npatPctRev = npat / totalRevenue;
  // console.log("npatPctRev:", npatPctRev);

  // Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalTrans);
  // console.log("econCapInvest:", econCapInvest);

  let bizEconCapCharge = Math.ceil(
    paramBizRiskEcCapRate * otherOperatingExpenses
  );
  // console.log("bizEconCapCharge:", bizEconCapCharge);

  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("creditRiskEconCapCharge:", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  // console.log("totalCapCharge:", totalCapCharge);

  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("capChargePctRev:", capChargePctRev);

  // RAP
  let rap = Math.ceil(npat - totalCapCharge);
  // console.log("rap:", rap);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: productName,
      fieldName: "RAP",
    });
  }

  let rapPctRev = rap / totalRevenue;
  let rapPerAcc = totalAcc !== 0 ? Math.ceil(rap / totalAcc) : 0;
  let roe = npat / econCapInvest;

  let custAcqCost = Math.ceil(salesTotal + 1);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);

  // Build return objects
  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalAcc),
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Transactions": round(paramValuePTrans),
      "Average Deposits": round(totalDepo / totalAcc),
      "Account Acquisition Cost": custAcqCostPerAcc,
      "Transaction Processed": round(totalTrans),
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat > 0 ? Math.ceil(paramDividends * npat) : 0;

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Total Deposits": round(totalDepo),
      "Revenue Per Account": revPerAcc,
      "Staff Costs": staffCost,
      "Other Operating Expenses": otherOperatingExpenses,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Non-Interest Expense": nonInterestExp,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  // Provisions tracking for adjusted params
  let newAdjustedParams: ParamUnderTeamInterface[] = [];

  if (roundNumber !== undefined && prevRoundParams) {
    const prevRoundProvisionsRatio = prevRoundParams.find(
      (p) =>
        p.productId.equals(productId) &&
        p.segmentId.equals(segmentId) &&
        p.code === "provisionsRatio"
    );

    const nextRoundProvisionsRatio = prevRoundProvisionsRatio
      ? {
          ...prevRoundProvisionsRatio,
          changes: [
            ...(prevRoundProvisionsRatio?.changes ?? []),
            {
              year: roundNumber,
              value: newProvisionsRatio - currentRoundProvisionsRatio,
            },
          ],
        }
      : {
          segmentId,
          productId,
          code: "provisionsRatio",
          originalValue:
            param?.parameters.find((p) => p.betterCode === "provisionsRatio")
              ?.paramValue ?? 0,
          changes: [
            {
              year: roundNumber,
              value: newProvisionsRatio - currentRoundProvisionsRatio,
            },
          ],
          type: "R" as "R" | "A",
        };

    newAdjustedParams.push(nextRoundProvisionsRatio);
  }

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const atmCost = 0;
  const branchCost = 0;

  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  // --- Cash Flow derived items ---
  // Capex = branch expansion + IT spend (Investing Activity)
  const capex = branchCost + itTotal;

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  // Investment changes = % of revenue allocated to securities/investments (Investing Activity)
  const investmentChanges = paramInvestmentChanges * totalRevenue;

  // Equity transactions = issuance minus buybacks (Financing Activity)
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  // --- Balance Sheet core totals ---

  // --- Working Capital calculation ---

  // Current Assets = Cash + short-term investments
  // Current Liabilities = tax
  // Working Capital = Current Assets - Current Liabilities

  const fallbackPrevRoundWorkingCapitalChange =
    param.parameters.find(
      (p) => p.betterCode === "initial.operating.workingCapitalChange"
    )?.paramValue || 0;

  const workingCapitalChange = calculateWorkingCapitalChange({
    prevRoundCash:
      prevRoundResult?.balanceSheet.find(
        (bs) => bs.productId?._id.toString() === productId.toString()
      )?.assets.cashAndCashEquivalents || 0,
    fallbackPrevRoundWorkingCapitalChange:
      fallbackPrevRoundWorkingCapitalChange,
    investmentChanges,
    tax,
  });
  // console.log("workingCapital", workingCapital);

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  const prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const loansAndAdvancesToCustomers = 0; // not applicable for transaction products

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: totalDepo,
  });

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: workingCapitalChange,
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -loansAndAdvancesToCustomers,
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: { productId, segmentId, branches: 1, atms: 1 },
    deposit: totalDepo,
    newAdjustedParams,
  };
}

export async function simFinSeg3Prod3({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  roundNumber,
  prevRoundParams,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    tnoBackOffice: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
  prevRoundParams: Array<ParamUnderTeamInterface>;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
  newAdjustedParams: ParamUnderTeamInterface[];
}> {
  // console.log(
  //   `simFinSeg3Prod3 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramValuePTrans = getParamValue(param, "P3S3-4");
  const paramDeposit = getParamValue(param, "P3S3-6");
  const paramDepositNew = getParamValue(param, "P3S3-8");
  const paramInterestExpRate = getParamValue(param, "P3S3-10");
  const paramTransPCust = getParamValue(param, "P3S3-12");
  const paramFeeIncomeBase = getParamValue(param, "P3S3-14");
  const paramFeeIncomePCust = getParamValue(param, "P3S3-16");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P3S3-18");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P3S3-20");

  const paramProvisionsFixed = getParamValue(param, "P3S3-22");
  const paramProvisionsVar = getParamValue(param, "P3S3-24");
  const paramProvisionsNewCust = getParamValue(param, "P3S3-26");
  const paramMarketingBase = getParamValue(param, "P3S3-28");
  const paramMarketingVar = getParamValue(param, "P3S3-30");
  const paramCommission = getParamValue(param, "P3S3-32");

  const paramBackOfficeFixed = getParamValue(param, "P3S3-34");
  const paramBackOfficeVar = getParamValue(param, "P3S3-36");
  const paramInetFixed = getParamValue(param, "P3S3-46");
  const paramInetVar = getParamValue(param, "P3S3-48");
  const paramItFixed = getParamValue(param, "P3S3-50");
  const paramItVar = getParamValue(param, "P3S3-52");

  const paramServCostNewCust = getParamValue(param, "P3S3-54");
  const paramServCostVar = getParamValue(param, "P3S3-56");
  const paramServCostFixed = getParamValue(param, "P3S3-58");
  const paramOtherCostPerCust = getParamValue(param, "P3S3-60");

  const paramBizRiskEcCapRate = getParamValue(param, "P3S3-86");
  const paramCreditRiskSeverity = getParamValue(param, "P3S3-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P3S3-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  //TODO
  let branchAndDiscCost = 68045687;

  //Compensation and Benefits
  //TODO
  let compAndBenefits = 63974435;

  return calculateTransactionProductFinances({
    inputs,
    productId,
    productName: "Retail Transaction Services",
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    currentRoundDecision,
    prevRoundResult,
    branchAndDiscCost,
    compAndBenefits,
    initiativeSegmentCostRatio: 0.595,
    param,
    // Pass extracted parameters
    paramBaseSpread,
    paramTaxRate,
    paramHiringBreakdown,
    paramValuePTrans,
    paramDeposit,
    paramDepositNew,
    paramInterestExpRate,
    paramTransPCust,
    paramFeeIncomeBase,
    paramFeeIncomePCust,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionsFixed,
    paramProvisionsVar,
    paramProvisionsNewCust,
    paramMarketingBase,
    paramMarketingVar,
    paramCommission,
    paramBackOfficeFixed,
    paramBackOfficeVar,
    paramInetFixed,
    paramInetVar,
    paramItFixed,
    paramItVar,
    paramServCostNewCust,
    paramServCostVar,
    paramServCostFixed,
    paramOtherCostPerCust,
    paramBizRiskEcCapRate,
    paramCreditRiskSeverity,
    paramCreditRiskDebtBeta,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param ends
    percentageDebtIssuance: 0.08,
  });
}

export async function simFinSeg4Prod1({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    tnoBackOffice: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  deposit: number;
}> {
  // console.log(
  //   `simFinSeg4Prod1 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramHiringBreakdown = getParamValue(param, "P-14");
  const paramPremCentOperatingCost = getParamValue(param, "P-16");

  const paramValuePTrans = getParamValue(param, "P1S4-4");
  const paramDeposit = getParamValue(param, "P1S4-6");
  const paramDepositNew = getParamValue(param, "P1S4-8");
  const paramInterestExpRate = getParamValue(param, "P1S4-10");
  const paramTransPCust = getParamValue(param, "P1S4-12");
  const paramFeeIncomeBase = getParamValue(param, "P1S4-14");
  const paramFeeIncomePCust = getParamValue(param, "P1S4-16");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P1S4-18");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P1S4-20");

  const paramProvisionsFixed = getParamValue(param, "P1S4-22");
  const paramProvisionsVar = getParamValue(param, "P1S4-24");
  const paramProvisionsNewCust = getParamValue(param, "P1S4-26");
  const paramMarketingBase = getParamValue(param, "P1S4-28");
  const paramMarketingVar = getParamValue(param, "P1S4-30");
  const paramCommission = getParamValue(param, "P1S4-32");

  const paramBackOfficeFixed = getParamValue(param, "P1S4-34");
  const paramBackOfficeVar = getParamValue(param, "P1S4-36");
  const paramInetFixed = getParamValue(param, "P1S4-46");
  const paramInetVar = getParamValue(param, "P1S4-48");
  const paramItFixed = getParamValue(param, "P1S4-50");
  const paramItVar = getParamValue(param, "P1S4-52");

  const paramServCostNewCust = getParamValue(param, "P1S4-54");
  const paramServCostVar = getParamValue(param, "P1S4-56");
  const paramServCostFixed = getParamValue(param, "P1S4-58");
  const paramOtherCostPerCust = getParamValue(param, "P1S4-60");

  const paramBizRiskEcCapRate = getParamValue(param, "P1S4-86");
  const paramCreditRiskSeverity = getParamValue(param, "P1S4-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P1S4-90");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  //Branch and ATM cost
  //TODO
  let branchAndDiscCost = 68045687;

  //Compensation and Benefits
  //TODO
  let compAndBenefits = 63974435;

  return calculateTransactionProductFinances({
    inputs,
    productId,
    productName: "Global Transaction Services",
    currentTotalRevenue,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    impactsFromEvents,
    triggeredBy,
    availableGlobalInputs,
    globalDecisions,
    segmentDecisions,
    currentRoundDecision,
    prevRoundResult,
    branchAndDiscCost,
    compAndBenefits,
    initiativeSegmentCostRatio: 0.595,
    param,
    // Pass extracted parameters
    paramBaseSpread,
    paramTaxRate,
    paramHiringBreakdown,
    paramValuePTrans,
    paramDeposit,
    paramDepositNew,
    paramInterestExpRate,
    paramTransPCust,
    paramFeeIncomeBase,
    paramFeeIncomePCust,
    paramOtherNonIntIncomeFixed,
    paramOtherNonIntIncomeVar,
    paramProvisionsFixed,
    paramProvisionsVar,
    paramProvisionsNewCust,
    paramMarketingBase,
    paramMarketingVar,
    paramCommission,
    paramBackOfficeFixed,
    paramBackOfficeVar,
    paramInetFixed,
    paramInetVar,
    paramItFixed,
    paramItVar,
    paramServCostNewCust,
    paramServCostVar,
    paramServCostFixed,
    paramOtherCostPerCust,
    paramBizRiskEcCapRate,
    paramCreditRiskSeverity,
    paramCreditRiskDebtBeta,
    paramRetainedEarnings,
    paramDividends,
    paramInvestmentChanges,
    paramEquityIssuance,
    paramEquityBuyback,
    // param ends
    percentageDebtIssuance: 0.12,
  });
}

export async function simFinSeg4Prod2({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    tnoBackOffice: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
}> {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
    tnoBackOffice,
  } = inputs;

  // console.log(
  //   `simFinSeg4Prod2 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // console.log("Inputs", averageFee);

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");
  const paramDealSize = getParamValue(param, "P2S4-2");
  const paramDealSizeEquity = getParamValue(param, "P2S4-4");
  const paramDealSizeDebt = getParamValue(param, "P2S4-6");

  const paramInterestIncomeRate = getParamValue(param, "P2S4-8");
  const paramInterestExpRate = getParamValue(param, "P2S4-10");

  const paramFeeIncomeBase = getParamValue(param, "P2S4-12");
  const paramFeeIncomePCust = getParamValue(param, "P2S4-14");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P2S4-16");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P2S4-18");

  const paramProvisionsFixed = getParamValue(param, "P2S4-20");
  const paramProvisionsVar = getParamValue(param, "P2S4-22");
  const paramProvisionsRatePctRev = getParamValue(param, "P2S4-24");

  const paramMarketingVar = getParamValue(param, "P2S4-26");
  const paramCommission = getParamValue(param, "P2S4-28");
  const paramBonus = getParamValue(param, "P2S4-30");

  const paramBackOfficeFixed = getParamValue(param, "P2S4-32");
  const paramBackOfficeVar = getParamValue(param, "P2S4-34");
  const paramInetFixed = getParamValue(param, "P2S4-40");
  const paramInetVar = getParamValue(param, "P2S4-42");

  const paramItFixed = getParamValue(param, "P2S4-44");
  const paramItVar = getParamValue(param, "P2S4-46");

  const paramServCostFixed = getParamValue(param, "P2S4-48");
  const paramServCostVar = getParamValue(param, "P2S4-50");
  const paramOtherCostFixed = getParamValue(param, "P2S4-52");
  const paramOtherCostVar = getParamValue(param, "P2S4-54");

  const paramBizRiskEcCapRate = getParamValue(param, "P2S4-86");
  const paramCreditRiskSeverity = getParamValue(param, "P2S4-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P2S4-90");

  const paramHiringBreakdown = getParamValue(param, "P-14");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  const trainingCostRatio =
    segment?.fields
      .find((f) => f.key === "training")
      ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

  // console.log("trainingCostRatio:", trainingCostRatio);

  const totalRMBeforeHiring =
    prevRoundResult?.miscellaneous?.find(
      (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
    )?.rmNumber || 0;

  // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

  const fixedEmployeeChurnRate = 0.05;

  const churnedEmployee = Math.round(
    totalRMBeforeHiring * fixedEmployeeChurnRate
  );

  const totalRMAfterHiringAndChurn =
    currentSegmentDecision?.fields.find((f) => f.key === "rm_number")?.value ||
    0;
  const segmentNewHiring =
    totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
  const segmentSalary =
    currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value || 0;
  //TODO Fazry
  //const segmentTrainingCost
  // console.log("segmentSalary:", segmentSalary);

  let totalPeople =
    (totalRMBeforeHiring * 0.95 + segmentNewHiring) * paramHiringBreakdown;
  // console.log("Total New Hire", totalPeople);
  let salaryCost = totalPeople * segmentSalary;
  // console.log("Salary Cost", salaryCost);
  //To change to original Training cost only
  let trainingCost = totalPeople * trainingCostRatio * segmentSalary;
  // console.log("trainingCost:", trainingCost);
  let staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("Staff Cost Total", staffCost);

  let totalDealsParam = paramDealSize + paramDealSizeDebt + paramDealSizeEquity;
  // console.log("Total Deals Param", totalDealsParam);
  //TODO Fazry bring in projected market share here
  //let totalDeals = marketShare * capEndingCust * totalDealsParam;
  let totalDeals = projMktShare * capEndingCust * totalDealsParam;
  // console.log("Total Deals", totalDeals);

  let interestIncome = 0;
  let interestExpense = 0;

  let netInterestIncome = interestIncome - interestExpense;
  // console.log("Net Interest Income", netInterestIncome);

  //Note: Supposed to be having pricing strategy (+12% i.e.)
  //Change 1 with pricing strategy mapping
  let txnFeeInput =
    currentRoundDecision.decisionDetails
      .find((detail) => detail.productId.toString() === productId.toString())
      ?.fields.find((field) => field.key === "fees")?.value ?? 0;
  // console.log("txnFeeInput asset management", txnFeeInput);

  let feesIncome =
    paramFeeIncomeBase + totalDeals * (paramFeeIncomePCust * (1 + txnFeeInput));
  // console.log("Fees Income", feesIncome);
  let otherNonIntIncome =
    paramOtherNonIntIncomeFixed + capEndingCust * paramOtherNonIntIncomeVar;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "product name",
      fieldName: "Total Revenue",
    });
  }

  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = capEndingCust !== 0 ? totalRevenue / capEndingCust : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Provisions
  let provisionsVar = paramProvisionsVar * totalDeals;
  // console.log("Provision Variable", provisionsVar);
  let provisionsTotal = Math.ceil(paramProvisionsFixed + provisionsVar);

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: product?.productName || "product name",
      fieldName: "Provision Total",
    });
  }
  // console.log("Provision Total", provisionsTotal);

  let provisionsRatio = provisionsTotal / totalDeals;
  // console.log("Loan Provisions Ratio", provisionsRatio);

  //Sales and Marketing
  //Change to param for Init total Cost
  let marketingInitCost = 1;
  let salesCommission = Math.ceil(paramCommission * totalRevenue);
  let salesTotal = Math.ceil(
    marketingSpent + marketingInitCost + salesCommission
  );
  // console.log("Sales and Marketing Total", salesTotal);
  let salesPctRev = salesTotal / totalRevenue;
  // console.log("Sales and Marketing % of Revenue", salesPctRev);

  //Back Office
  //Product Level change to final product level instead of input
  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const tnoCostMultiplier = 1.075;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);
  const boCostReductionFactor = findReductionFactor({
    tnoLevel: tnoBackOffice,
    key: "backOffice",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let backOfficeVar = paramBackOfficeVar * totalRevenue * boCostReductionFactor;
  // console.log("Back Office Variable", backOfficeVar);
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );
  // console.log("Back Office Total", backOfficeTotal);

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "product name",
      fieldName: "Back Office Total",
    });
  }

  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  //Branch and ATM cost
  //TODO
  let branchAndDiscCost = 5603576;

  //Compensation and Benefits
  //TODO
  let compAndBenefits = averageFee * totalRevenue;
  // console.log("Compensation and Benefits", compAndBenefits);
  // console.log("averageFee", averageFee);

  //Internet Expense
  //Change to TnO
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalRevenue * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  //IT Expense
  //Change to TnO
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let itVar = totalRevenue * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Total",
    });
  }

  //New Transaction and Overhead
  let serviceVar = paramServCostVar * (1 + productLevel / 12) * totalRevenue;
  let serviceBase = paramServCostFixed * (1 + productLevel / 12);
  let newTransAndOverheadTotal = Math.ceil(+serviceVar + serviceBase);
  // console.log("New Asset and Overhead Total", newTransAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  let otherCost = paramOtherCostFixed + paramOtherCostVar * totalRevenue;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: 0.13,
  });
  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("Strategic Initiatives & Other Costs Total", siAndOtherCostTotal);

  let channelServ =
    branchAndDiscCost +
    compAndBenefits +
    itTotal +
    inetTotal +
    newTransAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);
  let nonInterestExp = otherOperatingExpenses + staffCost;
  // console.log("Non-Interest Expense Total", nonInterestExp);

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("NPBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NPBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NIAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NIAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalRevenue);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(paramBizRiskEcCapRate * nonInterestExp);
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  let rap = Math.ceil(npat - totalCapCharge);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "product name",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  let rapPerAcc = totalDeals !== 0 ? Math.ceil(rap / totalDeals) : 0;
  // console.log("RAP per Account", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(0),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Deals": round(paramDealSize),
      "Account Acquisition Cost": custAcqCostPerAcc,
      // TODO the Transaction Processed must be updated with correct value
      "Transaction Processed": round(50000000),
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat > 0 ? Math.ceil(paramDividends * npat) : 0;

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Revenue Per Account": revPerAcc,
      "Staff Costs": staffCost,
      "Other Operating Expenses": otherOperatingExpenses,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Non-Interest Expense": nonInterestExp,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const atmCost = 0;
  const branchCost = 0;

  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  const investmentChanges = paramInvestmentChanges * totalRevenue;
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  let capex = 0;

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: 0, // not yet implemented
  });

  const loansAndAdvancesToCustomers = 0; // not applicable for capital market

  const percentageDebtIssuance = 0.12;

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: 0, // not yet implemented
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -loansAndAdvancesToCustomers,
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: { productId, segmentId, branches: 1, atms: 1 },
  };
}

export async function simFinSeg4Prod3({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  prevRoundDecision,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
  prevRoundParams,
  exceededLoan = 0,
  totalCompanyLoan = 0,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
    capProvisions?: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  prevRoundDecision: DecisionInterface;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  exceededLoan?: number;
  totalCompanyLoan?: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
  loan: number;
  npl: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
  newAdjustedParams: ParamUnderTeamInterface[];
}> {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
    capProvisions,
  } = inputs;

  // console.log(
  //   `simFinSeg4Prod3 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // console.log("Inputs", averageFee);

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");

  const paramDeposit = getParamValue(param, "P3S4-6");
  const paramBalPerAcc = getParamValue(param, "P3S4-8");
  const paramBalPerAccNew = getParamValue(param, "P3S4-10");
  const paramTransPCust = getParamValue(param, "P3S4-12");
  const paramInterestExpRate = getParamValue(param, "P3S4-14");

  const paramFeeIncomeFixed = getParamValue(param, "P3S4-16");
  const paramFeeIncomePCust = getParamValue(param, "P3S4-18");
  const paramOtherNonIntIncomeFixed = getParamValue(param, "P3S4-20");
  const paramOtherNonIntIncomeVar = getParamValue(param, "P3S4-22");

  const paramProvisionsFixed = getParamValue(param, "P3S4-24");
  const paramProvisionsVar = getParamValue(param, "P3S4-26");
  const paramProvisionsNewCust = getParamValue(param, "P3S4-28");

  const paramCommission = getParamValue(param, "P3S4-32");
  const paramBonus = getParamValue(param, "P3S4-34");

  const paramBackOfficeFixed = getParamValue(param, "P3S4-36");
  const paramBackOfficeVar = getParamValue(param, "P3S4-38");

  const paramInetFixed = getParamValue(param, "P3S4-40");
  const paramInetVar = getParamValue(param, "P3S4-42");

  const paramItFixed = getParamValue(param, "P3S4-44");
  const paramItVar = getParamValue(param, "P3S4-46");

  const paramServCostVar = getParamValue(param, "P3S4-52");
  const paramServCostFixed = getParamValue(param, "P3S4-54");

  const paramOtherCostPerCust = getParamValue(param, "P3S4-56");

  const paramBizRiskEcCapRate = getParamValue(param, "P3S4-86");
  const paramCreditRiskSeverity = getParamValue(param, "P3S4-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P3S4-90");

  const paramHiringBreakdown = getParamValue(param, "P-14");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const paramInterbankRate = 0.04;

  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  const trainingCostRatio =
    segment?.fields
      .find((f) => f.key === "training")
      ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

  // console.log("trainingCostRatio:", trainingCostRatio);

  const totalRMBeforeHiring =
    prevRoundResult?.miscellaneous?.find(
      (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
    )?.rmNumber || 0;

  // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

  const fixedEmployeeChurnRate = 0.05;

  const churnedEmployee = Math.round(
    totalRMBeforeHiring * fixedEmployeeChurnRate
  );

  const totalRMAfterHiringAndChurn =
    currentSegmentDecision?.fields.find((f) => f.key === "rm_number")?.value ||
    0;
  const segmentNewHiring =
    totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
  const segmentSalary =
    currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value || 0;
  //TODO Fazry
  //const segmentTrainingCost
  // console.log("segmentSalary:", segmentSalary);

  let totalPeople =
    (totalRMBeforeHiring * 0.95 + segmentNewHiring) * paramHiringBreakdown;
  // console.log("Total New Hire", totalPeople);
  let salaryCost = totalPeople * segmentSalary;
  // console.log("Salary Cost", salaryCost);
  //To change to original Training cost only
  let trainingCost = totalPeople * trainingCostRatio * segmentSalary;
  // console.log("trainingCost:", trainingCost);
  let staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("Staff Cost Total", staffCost);

  let totalAcc = paramTransPCust * capEndingCust;
  // console.log("Total Number of Accounts", totalAcc);

  let avgDepoPerAcc = paramTransPCust * paramDeposit;
  // console.log("Avg Depo Per Cust", avgDepoPerAcc);

  let totalDepo = avgDepoPerAcc * capEndingCust;
  // console.log("Total Accounts Deposit", totalDepo);

  let currAcc = capStartingCust - capCustChurn;
  // console.log("Current Customers", currAcc);

  let newAcc = capGrossAdds;
  // console.log("New Customers", newAcc);

  let avgBalPerAcc =
    (currAcc * paramBalPerAcc + newAcc * paramBalPerAccNew) /
    (currAcc + newAcc);
  // console.log("Average Balance Per Account", avgBalPerAcc);

  let currAccBalance = currAcc * paramBalPerAcc;
  // console.log("Current Account Balance", currAccBalance);

  let newAccBalance = newAcc * paramBalPerAccNew;
  // console.log("New Account Balance", newAccBalance);

  let totalAccBalance = currAccBalance + newAccBalance;
  // console.log("Total Account Balance", totalAccBalance);

  let depoIntIncome = totalDepo * paramBaseSpread;
  // console.log("Deposit Interest Income", depoIntIncome);

  const currAccIntRate =
    prevRoundDecision.decisionDetails
      .find((d) => d.productId.toString() === productId.toString())
      ?.fields.find((f) => f.key === "interest_rate")?.value ?? 0;
  // console.log("Current Acc Interest Rate", currAccIntRate);
  // console.log("New Acc Interest Rate", interestRate);

  let avgAccIntRate = (currAccIntRate + interestRate) / 2;
  // console.log("Avg Acc Interest Rate", avgAccIntRate);

  let avgAccSpread = (avgAccIntRate - paramBaseSpread) * 10000;
  // console.log("Avg Acc Spread", avgAccSpread);

  let balInterestIncome = totalAccBalance * avgAccIntRate;
  // console.log("Balance Interest Income", balInterestIncome);

  let interestIncome = depoIntIncome + balInterestIncome;
  // console.log("Interest Income", interestIncome);

  let depoInterestExpense = totalDepo * paramInterestExpRate;
  // console.log("Deposit Interest Expense", depoInterestExpense);

  let balInterestExpense = totalAccBalance * paramBaseSpread;
  // console.log("Balance Interest Expense", balInterestExpense);

  let interbankInterestExpense =
    exceededLoan *
    (totalAccBalance / (totalCompanyLoan || 1)) *
    paramInterbankRate;

  let interestExpense =
    depoInterestExpense + balInterestExpense + interbankInterestExpense;
  // console.log("Interest Expense", interestExpense);

  // Total amount (deposit + balance)
  let totalAmount = totalDepo + totalAccBalance;

  // Weighted average interest rate
  let weightedAvgInterestRate = interestExpense / totalAmount;

  // console.log("Weighted Average Interest Rate", weightedAvgInterestRate);

  let netInterestIncome = interestIncome - interestExpense;
  // console.log("Net Interest Income", netInterestIncome);

  let feesIncome = paramFeeIncomeFixed + capEndingCust * paramFeeIncomePCust;
  // console.log("Fees Income", feesIncome);
  let otherNonIntIncome =
    paramOtherNonIntIncomeFixed + capEndingCust * paramOtherNonIntIncomeVar;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;
  // console.log("Total Revenue", totalRevenue);

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "product name",
      fieldName: "Total Revenue",
    });
  }

  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = capEndingCust !== 0 ? totalRevenue / capEndingCust : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Provisions institutional lending
  let currentRoundProvisionsRatio = 0;
  // let provisionsRatioAdjustment = 0;

  if (roundNumber > 1 && prevRoundParams.length > 0) {
    const currentProductPrevRoundProvisionsRatioAdjustment =
      prevRoundParams.find(
        (p) =>
          p.productId.equals(productId) &&
          p.segmentId.equals(segmentId) &&
          p.code === "provisionsRatio"
      );

    currentRoundProvisionsRatio =
      currentProductPrevRoundProvisionsRatioAdjustment
        ? currentProductPrevRoundProvisionsRatioAdjustment.originalValue +
          currentProductPrevRoundProvisionsRatioAdjustment.changes.reduce(
            (sum, change) => sum + change.value,
            0
          )
        : 0;
  } else {
    currentRoundProvisionsRatio =
      param?.parameters.find((p) => p.betterCode === "provisionsRatio")
        ?.paramValue ?? 0;
  }

  let provisionsVar =
    paramProvisionsVar * (capStartingCust - capCustChurn) * avgBalPerAcc;
  // console.log("Provision Variable", provisionsVar);
  //TODO Fix provisions rate for new cust
  // let capChargeOffRatePNewCust = capProvisions ?? 0;
  let capChargeOffRatePNewCust = (capProvisions ?? 0) / 5;
  // console.log("capChargeOffRatePNewCust", capChargeOffRatePNewCust);
  // console.log("paramBalPerAccNew", paramBalPerAccNew);
  // console.log("capGrossAdds", capGrossAdds);
  let provisionsNewCust =
    capGrossAdds * paramBalPerAccNew * capChargeOffRatePNewCust;
  // console.log("capGrossAdds", capGrossAdds);
  // console.log("paramBalPerAccNew", paramBalPerAccNew);
  // console.log("capChargeOffRatePNewCust", capChargeOffRatePNewCust);
  // console.log("Provision New Cust", provisionsNewCust);
  let provisionsTotal = Math.ceil(
    paramProvisionsFixed + provisionsVar + provisionsNewCust
  );

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: product?.productName || "product name",
      fieldName: "Provision Total",
    });
  }
  // console.log("Provision Total", provisionsTotal);

  let provisionsRatio = provisionsTotal / totalAccBalance;
  // console.log("Credit Provisions Ratio", provisionsRatio);

  // ---- NPL Estimation (Existing Customers Only) ----
  const assumedLGD = 0.25;
  let estimatedNPLRatio = currentRoundProvisionsRatio / assumedLGD;
  // console.log("Estimated NPL Ratio (existing)", estimatedNPLRatio);

  let estimatedNPL = currAccBalance * estimatedNPLRatio;
  // console.log("Estimated NPL (from existing balance)", estimatedNPL);

  let nplOverLoan = estimatedNPL / totalAccBalance;
  // console.log("NPL over Total Loan", nplOverLoan);

  // ---- Recalculate Loan Provisions Ratio ----
  let newProvisionsRatio = provisionsTotal / totalAccBalance;
  // console.log("Loan Provisions Ratio", newProvisionsRatio);

  let adjustedParams: ParamUnderTeamInterface[] = [];

  const prevRoundProvisionsRatio = prevRoundParams.find(
    (p) =>
      p.productId.equals(productId) &&
      p.segmentId.equals(segmentId) &&
      p.code === "provisionsRatio"
  );

  const nextRoundProvisionsRatio = prevRoundProvisionsRatio
    ? {
        ...prevRoundProvisionsRatio,
        changes: [
          ...(prevRoundProvisionsRatio?.changes ?? []),
          {
            year: roundNumber,
            // value: newProvisionsRatio - currentRoundProvisionsRatio,
            value: 0,
          },
        ],
      }
    : {
        segmentId,
        productId,
        code: "provisionsRatio",
        originalValue:
          param?.parameters.find((p) => p.betterCode === "provisionsRatio")
            ?.paramValue ?? 0,
        changes: [
          {
            year: roundNumber,
            // value: newProvisionsRatio - currentRoundProvisionsRatio,
            value: 0,
          },
        ],
        type: "R" as "R" | "A",
      };

  adjustedParams.push(nextRoundProvisionsRatio);

  //Sales and Marketing
  //Change to param for Init total Cost
  let marketingInitCost = 1;
  let salesCommission =
    totalRevenue * paramCommission * (capGrossAdds / capStartingCust);
  // console.log("Sales Commission", salesCommission);
  let salesTotal = Math.ceil(
    marketingSpent + marketingInitCost + salesCommission
  );
  // console.log("Sales and Marketing Total", salesTotal);
  let salesPctRev = salesTotal / totalRevenue;
  // console.log("Sales and Marketing % of Revenue", salesPctRev);

  //Back Office
  //Product Level change to final product level instead of input
  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const tnoCostMultiplier = 1.075;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);
  let boCostReductionFactor = 0.98; //Mapping to tnoBackOffice
  let backOfficeVar = paramBackOfficeVar * totalRevenue * boCostReductionFactor;
  // console.log("Back Office Variable", backOfficeVar);
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + finalTnoCost
  );
  // console.log("Back Office Total", backOfficeTotal);

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "product name",
      fieldName: "Back Office Total",
    });
  }

  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  //Branch and ATM cost
  //TODO
  let branchAndDiscCost = 47876536;

  //Compensation and Benefits
  //TODO
  let compAndBenefits = 78324556;

  //Internet Expense
  //Change to TnO
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalAcc * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  //IT Expense
  //Change to TnO
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let itVar = totalAcc * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Total",
    });
  }

  //New Account and Overhead
  let serviceVar = paramServCostVar * (1 + productLevel / 12) * totalRevenue;
  //TODO
  let rmCost = 11240000;
  let newTransAndOverheadTotal = Math.ceil(
    serviceVar + rmCost + paramServCostFixed
  );
  // console.log("New Transactions and Overhead Total", newTransAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  let otherCost = paramOtherCostPerCust * capEndingCust;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: 0.58,
  });
  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("Strategic Initiatives & Other Costs Total", siAndOtherCostTotal);

  let channelServ =
    branchAndDiscCost +
    compAndBenefits +
    itTotal +
    inetTotal +
    newTransAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);
  let nonInterestExp = otherOperatingExpenses + staffCost;
  // console.log("Non-Interest Expense Total", nonInterestExp);

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("NPBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NPBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NIAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NIAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalAccBalance);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(paramBizRiskEcCapRate * nonInterestExp);
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  let rap = Math.ceil(npat - totalCapCharge);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "product name",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  let rapPerAcc = totalAcc !== 0 ? Math.ceil(rap / totalAcc) : 0;
  // console.log("RAP per Account", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalAcc),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      //TODO Change Average Balance instead
      //"Average Balance": round(avgBalPerAcc),
      "Non Performing Loan (Aggregated)": round(nplOverLoan),
      "Average Loans": round(paramBalPerAcc),
      "Account Acquisition Cost": custAcqCostPerAcc,
      // TODO the Transaction Processed must be updated with correct value
      "Transaction Processed": round(50000000),
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat > 0 ? Math.ceil(paramDividends * npat) : 0;

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Interest Rate Paid": weightedAvgInterestRate,
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Total Loans": round(totalAccBalance),
      "Revenue Per Account": revPerAcc,
      "Staff Costs": staffCost,
      "Other Operating Expenses": otherOperatingExpenses,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Non-Interest Expense": nonInterestExp,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const atmCost = 0;
  const branchCost = 0;

  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  const investmentChanges = paramInvestmentChanges * totalRevenue;
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  let capex = 0;

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const fallbackPrevRoundLoansAndAdvancesToCustomers =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.loansAndAdvancesToCustomers"
    )?.paramValue || 0;

  const loansAndAdvancesToCustomers = calculateLoansAndAdvancesToCustomers({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundLoansAndAdvancesToCustomers:
      fallbackPrevRoundLoansAndAdvancesToCustomers,
    totalLoans: totalAccBalance,
    provisions: provisionsTotal,
  });

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: 0, // not yet implemented
  });

  const percentageDebtIssuance = 0.12;

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: 0, // not yet implemented
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -(
        totalAccBalance - provisionsTotal
      ),
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: { productId, segmentId, branches: 1, atms: 1 },
    loan: totalAccBalance,
    // newAdjustedParams: [{
    //   segmentId,
    //   productId,
    //   originalValue: paramcharge,
    //   changes: [],
    //   fieldName: "",
    //   newAdjustedValue: param.value,
    //   newAdjustedValue: param.value,
    // }],
    newAdjustedParams: [],
    npl: {
      nonPerforming: estimatedNPL,
      totalLoan: totalAccBalance,
      ratio: estimatedNPL / totalAccBalance,
    },
  };
}

export async function simFinSeg4Prod4({
  inputs,
  productId,
  currentTotalRevenue,
  marketingSpent,
  productLevel,
  segmentId,
  impactsFromGlobalDecisions,
  impactsFromEvents,
  triggeredBy,
  availableGlobalInputs,
  globalDecisions,
  segmentDecisions,
  currentRoundDecision,
  prevRoundResult,
  param,
  segment,
  product,
  roundNumber,
}: {
  inputs: FinancialInputs & {
    tnoITInfra: number;
    tnoMobileBanking: number;
  };
  productId: mongoose.Types.ObjectId;
  currentTotalRevenue: number;
  marketingSpent: number;
  productLevel: number;
  segmentId: mongoose.Types.ObjectId;
  impactsFromGlobalDecisions: Array<{
    key: string;
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  impactsFromEvents: Array<{
    value: number;
    type: "absolute" | "relative";
    impacting: string;
  }>;
  triggeredBy: "teamPlaying" | "roundEnding";
  availableGlobalInputs: IGlobalInput[];
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  prevRoundResult?: TeamInvolvedInterface;
  param: ParamDocument;
  product?: ProductInterface;
  segment?: SegmentInterface;
  currentRoundDecision: DecisionInterface;
  roundNumber: number;
}): Promise<{
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  newMiscellaneous: TeamInvolvedInterface["miscellaneous"][number];
}> {
  const {
    // baseVariables,
    averageFee,
    interestRate,
    projMktShare,
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    tnoITInfra,
    tnoMobileBanking,
  } = inputs;

  // console.log(
  //   `simFinSeg4Prod4 - Product ${productId.toString()} in segment ${segmentId.toString()}`
  // );

  // console.log("Inputs", averageFee);

  // test out the param passed from calcProjections
  // const param = await fetchParamBySegmentProduct({ segmentId, productId });
  const paramBaseSpread = getParamValue(param, "P-2");
  const paramTaxRate = getParamValue(param, "P-4");
  const paramCCAWaitTime = getParamValue(param, "P-6");
  const paramPercentOnlineBanking = getParamValue(param, "P-8");
  const paramBranchOperatingCost = getParamValue(param, "P-10");
  const paramAtmOperatingCost = getParamValue(param, "P-12");

  const paramAssetPerAcc = getParamValue(param, "P4S4-4");
  const paramInterestIncomeRate = getParamValue(param, "P4S4-6");
  const paramInterestExpenseRate = getParamValue(param, "P4S4-8");
  const paramAccPerCust = getParamValue(param, "P4S4-10");

  const paramNonIntIncomeFixed = getParamValue(param, "P4S4-12");
  const paramNonIntIncomePerCust = getParamValue(param, "P4S4-14");
  const paramProvisionsFixed = getParamValue(param, "P4S4-16");
  const paramProvisionsVar = getParamValue(param, "P4S4-18");
  const paramProvisionsNewCust = getParamValue(param, "P4S4-20");

  const paramCommission = getParamValue(param, "P4S4-22");
  const paramBonus = getParamValue(param, "P4S4-34");

  const paramBackOfficeFixed = getParamValue(param, "P4S4-24");
  const paramBackOfficeVar = getParamValue(param, "P4S4-26");
  const paramInetFixed = getParamValue(param, "P4S4-28");
  const paramInetVar = getParamValue(param, "P4S4-30");

  const paramItFixed = getParamValue(param, "P4S4-32");
  const paramItVar = getParamValue(param, "P4S4-34");

  const paramServCostPerCust = getParamValue(param, "P4S4-40");
  const paramServCostFixed = getParamValue(param, "P4S4-42");
  const paramOtherCostPerCust = getParamValue(param, "P4S4-44");

  const paramRevSharingPct = getParamValue(param, "P4S4-46");
  const paramPricingVar = getParamValue(param, "P4S4-48");

  const paramBizRiskEcCapRate = getParamValue(param, "P4S4-86");
  const paramCreditRiskSeverity = getParamValue(param, "P4S4-88");
  const paramCreditRiskDebtBeta = getParamValue(param, "P4S4-90");

  const paramHiringBreakdown = getParamValue(param, "P-14");

  const paramRetainedEarnings = getParamValue(param, "P-18");
  const paramDividends = getParamValue(param, "P-20");

  const paramInvestmentChanges = getParamValue(param, "P-22");
  const paramEquityIssuance = getParamValue(param, "P-24");
  const paramEquityBuyback = getParamValue(param, "P-26");

  const currentSegmentDecision = segmentDecisions.find(
    (d) => d.segmentId.toString() === segmentId.toString()
  );
  const trainingLevel =
    currentSegmentDecision?.fields.find((f) => f.key === "training")?.value ||
    0;
  const impactMultipliers =
    currentSegmentDecision?.segment?.fields?.find((f) => f.key === "training")
      ?.impactMultipliers || [];

  const trainingImpactMultiplier = findImpactMultiplier({
    currentLevel: trainingLevel,
    impactMultipliers,
  });

  // console.log(
  //   `TODO just use this: with training level of ${trainingLevel}, training impact multiplier is ${trainingImpactMultiplier}`
  // );

  const trainingCostRatio =
    segment?.fields
      .find((f) => f.key === "training")
      ?.costs?.find((c) => c.selectedValue === trainingLevel)?.cost || 0;

  // console.log("trainingCostRatio:", trainingCostRatio);

  const totalRMBeforeHiring =
    prevRoundResult?.miscellaneous?.find(
      (m) => m.segmentId.toString() === segmentId.toString() && !m.productId
    )?.rmNumber || 0;

  // console.log("totalRMBeforeHiring:", totalRMBeforeHiring);

  const fixedEmployeeChurnRate = 0.05;

  const churnedEmployee = Math.round(
    totalRMBeforeHiring * fixedEmployeeChurnRate
  );

  const totalRMAfterHiringAndChurn =
    currentSegmentDecision?.fields.find((f) => f.key === "rm_number")?.value ||
    0;
  const segmentNewHiring =
    totalRMAfterHiringAndChurn - totalRMBeforeHiring + churnedEmployee;
  const segmentSalary =
    currentSegmentDecision?.fields.find((f) => f.key === "salary")?.value || 0;
  //TODO Fazry
  //const segmentTrainingCost
  // console.log("segmentSalary:", segmentSalary);

  let totalPeople =
    (totalRMBeforeHiring * 0.95 + segmentNewHiring) * paramHiringBreakdown;
  // console.log("Total New Hire", totalPeople);
  let salaryCost = totalPeople * segmentSalary;
  // console.log("Salary Cost", salaryCost);
  //To change to original Training cost only
  let trainingCost = totalPeople * trainingCostRatio * segmentSalary;
  // console.log("trainingCost:", trainingCost);
  let staffCost = Math.ceil(salaryCost + trainingCost);
  // console.log("Staff Cost Total", staffCost);

  let totalAcc = paramAccPerCust * capEndingCust;
  // console.log("Total Number of Accounts", totalAcc);

  let avgAssetPerAcc = paramAccPerCust * paramAssetPerAcc;
  // console.log("Avg Asset Per Cust", avgAssetPerAcc);

  let totalAum = avgAssetPerAcc * capEndingCust;
  // console.log("Total Assets Under Management", totalAum);

  let interestIncome = paramInterestIncomeRate * totalAum;
  // console.log("Interest Income", interestIncome);

  let interestExpense = paramInterestExpenseRate * totalAum;
  // console.log("Interest Expense", interestExpense);

  let netInterestIncome = interestIncome - interestExpense;
  // console.log("Net Interest Income", netInterestIncome);

  //Note: Supposed to be having pricing strategy (+12% i.e.)
  //Change 1 with pricing strategy mapping
  let txnFeeInput =
    currentRoundDecision.decisionDetails
      .find((detail) => detail.productId.toString() === productId.toString())
      ?.fields.find((field) => field.key === "fees")?.value ?? 0;
  // console.log("txnFeeInput asset management", txnFeeInput);

  let feesIncome = totalAum * paramPricingVar * txnFeeInput;
  // console.log("Fees Income", feesIncome);
  let otherNonIntIncome =
    paramNonIntIncomeFixed + capEndingCust * paramNonIntIncomePerCust;
  // console.log("Other Non-Interest Income Total", otherNonIntIncome);
  let nonInterestIncome = feesIncome + otherNonIntIncome;
  // console.log("Non-Interest Income", nonInterestIncome);

  let totalRevenue = netInterestIncome + nonInterestIncome;

  if (triggeredBy === "roundEnding") {
    totalRevenue = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: totalRevenue,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "revenue"
      ),
      productName: product?.productName || "product name",
      fieldName: "Total Revenue",
    });
  }

  let percentNonInterestIncome =
    totalRevenue !== 0 ? nonInterestIncome / totalRevenue : 0;
  // console.log("% Non-Interest Income", percentNonInterestIncome);
  let revPerAcc = capEndingCust !== 0 ? totalRevenue / capEndingCust : 0;
  // console.log("Revenue Per Account", revPerAcc);

  //Provisions
  let provisionsVar = paramProvisionsVar * totalAum;
  // console.log("Provision Variable", provisionsVar);
  //Need to add chargeoff here
  let provisionsNewCust =
    capGrossAdds * avgAssetPerAcc * paramProvisionsNewCust;
  // console.log("Provision New Cust", provisionsNewCust);
  let provisionsTotal = Math.ceil(
    paramProvisionsFixed + provisionsVar + provisionsNewCust
  );

  if (triggeredBy === "roundEnding") {
    provisionsTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: provisionsTotal,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "provisions"
      ),
      productName: product?.productName || "product name",
      fieldName: "Provision Total",
    });
  }
  // console.log("Provision Total", provisionsTotal);

  let provisionsRatio = provisionsTotal / totalAum;
  // console.log("Credit Provisions Ratio", provisionsRatio);

  //Sales and Marketing
  //Change to param for Init total Cost
  let marketingInitCost = 1;
  let salesCommission =
    totalRevenue * paramCommission * (capGrossAdds / capStartingCust);
  // console.log("Sales Commission", salesCommission);

  let nonIntIncomeRevSharing = nonInterestIncome * paramRevSharingPct;
  // console.log("Non-Interest Income Revenue Sharing", nonIntIncomeRevSharing);
  let netInterestIncomeRevSharing = netInterestIncome * paramRevSharingPct;
  // console.log(
  //   "Net Interest Income Revenue Sharing",
  //   netInterestIncomeRevSharing
  // );

  let salesTotal = Math.ceil(
    marketingSpent +
      marketingInitCost +
      salesCommission +
      nonIntIncomeRevSharing +
      netInterestIncomeRevSharing
  );
  // console.log("Sales and Marketing Total", salesTotal);
  let salesPctRev = salesTotal / totalRevenue;
  // console.log("Sales and Marketing % of Revenue", salesPctRev);

  //Back Office
  //Product Level change to final product level instead of input
  const tnoLevels = globalDecisions
    .filter((decision) => decision.globalInput?.key === "tech_ops")
    .reduce(
      (acc, decision) => {
        acc[decision.key] = decision?.value || 0;
        return acc;
      },
      {} as Record<string, number>
    );
  // console.log("TNO Levels", tnoLevels);

  const tnoCostMultiplier = 1.075;
  const techOpsInputs =
    availableGlobalInputs.find((input) => input.key === "tech_ops")?.inputs ||
    [];

  let depreciation = 0;
  let amortization = 0;

  const totalBaseCost = techOpsInputs.reduce((sum, input) => {
    const cost =
      input.costs?.find((c) => c.selectedValue === tnoLevels[input.key])
        ?.cost || 0;

    const currentTNODepreciationRate =
      param.parameters.find((p) => p.betterCode === `depreciation.${input.key}`)
        ?.paramValue || 0;
    const currentTNOAmortizationRate =
      param.parameters.find((p) => p.betterCode === `amortization.${input.key}`)
        ?.paramValue || 0;

    depreciation += cost * currentTNODepreciationRate;
    amortization += cost * currentTNOAmortizationRate;

    return sum + cost;
  }, 0);

  const finalTnoCost = totalBaseCost * tnoCostMultiplier;
  // console.log("Final TNO Cost:", finalTnoCost);
  let boCostReductionFactor = 0.98; //Mapping to tnoBackOffice
  let backOfficeVar = paramBackOfficeVar * totalRevenue * boCostReductionFactor;
  // console.log("Back Office Variable", backOfficeVar);
  let rmBoCost = 5163750;
  let backOfficeTotal = Math.ceil(
    paramBackOfficeFixed + backOfficeVar + rmBoCost + finalTnoCost
  );
  // console.log("Back Office Total", backOfficeTotal);

  if (triggeredBy === "roundEnding") {
    backOfficeTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: backOfficeTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "backOffice"
      ),
      productName: product?.productName || "product name",
      fieldName: "Back Office Total",
    });
  }

  let backOfficePctRev = backOfficeTotal / totalRevenue;
  // console.log("Back Office % of Revenue", backOfficePctRev);

  //Branch and ATM cost
  //TODO
  let branchAndDiscCost = 18688000;

  //Compensation and Benefits
  //TODO
  let compAndBenefits = 82721250;

  //Internet Expense
  //Change to TnO
  const inetCostReductionFactor = findReductionFactor({
    tnoLevel: tnoMobileBanking,
    key: "mobileBanking",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let inetVar = totalAcc * paramInetVar * inetCostReductionFactor;
  let inetTotal = Math.ceil(paramInetFixed + inetVar);
  // console.log("Internet Expense Total", inetTotal);

  //IT Expense
  //Change to TnO
  const itCostReductionFactor = findReductionFactor({
    tnoLevel: tnoITInfra,
    key: "itInfra",
    availableTNOInputs:
      availableGlobalInputs.find((input) => input.key === "tno")?.inputs || [],
  });
  let itVar = totalAcc * paramItVar * itCostReductionFactor;

  if (triggeredBy === "roundEnding") {
    itVar = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itVar,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "itVar"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Variable",
    });
  }
  // console.log("IT Expense Variable", itVar);
  let itTotal = Math.ceil(paramItFixed + itVar);
  // console.log("IT Expense Total", itTotal);

  if (triggeredBy === "roundEnding") {
    itTotal = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: itTotal,
      impactsFromGlobalDecisions: impactsFromEvents.filter(
        (i) => i.impacting === "itCost"
      ),
      productName: product?.productName || "product name",
      fieldName: "IT Expense Total",
    });
  }

  //New Account and Overhead
  //TODO
  let newAssetCost = paramServCostPerCust * capGrossAdds;
  let rmCost = 15390000;
  let serviceFixed = paramServCostFixed * (1 + productLevel / 12);
  let newAssetAndOverheadTotal = Math.ceil(
    serviceFixed + rmCost + newAssetCost
  );
  // console.log("New Assets and Overhead Total", newAssetAndOverheadTotal);

  //Strategic Initiatives & Other Costs
  //TODO after integrating initiatives
  let otherCost = paramOtherCostPerCust * capEndingCust;
  let siCost = calculateInitiativeCost({
    selectedInitiatives: globalDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.key),
    availableGlobalInputs,
    segmentRatio: 0.06,
  });
  let siAndOtherCostTotal = Math.ceil(otherCost + siCost);
  // console.log("Strategic Initiatives & Other Costs Total", siAndOtherCostTotal);

  let channelServ =
    branchAndDiscCost +
    compAndBenefits +
    itTotal +
    inetTotal +
    newAssetAndOverheadTotal;
  // console.log("Channel Serv", channelServ);

  let otherOperatingExpenses = Math.ceil(
    salesTotal + backOfficeTotal + channelServ + siAndOtherCostTotal
  );
  // console.log("Other Operating Expenses Total", otherOperatingExpenses);
  let nonInterestExp = otherOperatingExpenses + staffCost;
  // console.log("Non-Interest Expense Total", nonInterestExp);

  let cir = nonInterestExp / totalRevenue;
  // console.log("Cost to Income Ratio", cir);

  //NIBT
  let npbt = Math.ceil(totalRevenue - nonInterestExp - provisionsTotal);
  // console.log("NPBT", npbt);
  let npbtPctRev = npbt / totalRevenue;
  // console.log("NPBT % of Revenue", npbtPctRev);

  //Tax
  let tax = npbt <= 0 ? 0 : Math.ceil(paramTaxRate * npbt);
  // console.log("Tax", tax);
  let npat = Math.ceil(npbt - tax);
  // console.log("NIAT", npat);
  let npatPctRev = npat / totalRevenue;
  // console.log("NIAT % of Revenue", npatPctRev);

  //Capital Charge
  let econCapInvest = Math.ceil(paramCreditRiskSeverity * totalAum);
  // console.log("Economic Capital Investment", econCapInvest);
  let bizEconCapCharge = Math.ceil(paramBizRiskEcCapRate * nonInterestExp);
  // console.log("Business Economic Capital Charge", bizEconCapCharge);
  let creditRiskEconCapCharge = Math.ceil(
    paramCreditRiskDebtBeta * econCapInvest
  );
  // console.log("Credit Risk Economic Capital Charge", creditRiskEconCapCharge);

  let totalCapCharge = Math.ceil(bizEconCapCharge + creditRiskEconCapCharge);
  let capChargePctRev = totalCapCharge / totalRevenue;
  // console.log("Capital Charge % of Revenue", capChargePctRev);

  //RAP
  let rap = Math.ceil(npat - totalCapCharge);

  if (triggeredBy === "roundEnding") {
    rap = calculateSomeFieldAfterImpactsFromGlobalDecisions({
      originalValue: rap,
      impactsFromGlobalDecisions: impactsFromGlobalDecisions.filter(
        (i) => i.impacting === "rap"
      ),
      productName: product?.productName || "product name",
      fieldName: "RAP",
    });
  }

  // console.log("RAP", rap);
  let rapPctRev = rap / totalRevenue;
  // console.log("RAP % of Revenue", rapPctRev);
  let rapPerAcc = totalAcc !== 0 ? Math.ceil(rap / totalAcc) : 0;
  // console.log("RAP per Account", rapPerAcc);

  let roe = npat / econCapInvest;
  // console.log("ROE", roe);

  let custAcqCost = Math.ceil(salesTotal + 1);
  // console.log("Customer Acquisition Cost", custAcqCost);
  let custAcqCostPerAcc = Math.ceil(custAcqCost / capGrossAdds);
  // console.log("Account Acquisition Cost", custAcqCostPerAcc);

  const newBizPerf: BusinessPerformanceInterface[] = [
    {
      productId,
      segmentId,
      "Total Number of Accounts": round(totalAcc),
      // TODO these three must be updated with correct values
      "Loan to Deposit Ratio (Aggregated)": 0,
      "Cost to Income Ratio": cir,
      "Market Share": capMktShare,
      "Average Assets": round(avgAssetPerAcc),
      "Account Acquisition Cost": custAcqCostPerAcc,
      // TODO the Transaction Processed must be updated with correct value
      "Transaction Processed": round(50000000),
      "Revenue Per Account": revPerAcc,
    },
  ];

  const dividends = npat > 0 ? Math.ceil(paramDividends * npat) : 0;

  const prevRoundRetainedEarnings =
    prevRoundResult?.pnl.find(
      (p) => p.productId?.toString() === productId.toString()
    )?.["Retained Earnings"] || 0;

  const retainedEarnings =
    roundNumber === 0
      ? paramRetainedEarnings
      : prevRoundRetainedEarnings + npat - dividends;

  const newPnl: PnLInterface[] = [
    {
      productId,
      segmentId,
      "Interest Income": round(interestIncome),
      "Interest Expense": round(interestExpense),
      "Net Interest Income": round(netInterestIncome),
      "Fees Income": round(feesIncome),
      "Other Non-Interest Income Total": round(otherNonIntIncome),
      "Non-Interest Income": round(nonInterestIncome),
      "% Non-Interest Income": Math.round(percentNonInterestIncome * 100) / 100,
      "Total Revenue": round(totalRevenue),
      "Revenue Per Account": revPerAcc,
      "Staff Costs": staffCost,
      "Other Operating Expenses": otherOperatingExpenses,
      "Total Expenses": staffCost + otherOperatingExpenses,
      "Sales & Marketing": salesTotal,
      "Back Office Expense": backOfficeTotal,
      "Channel and Service": channelServ,
      "Strategic Initiatives & Other Costs": siAndOtherCostTotal,
      "Non-Interest Expense": nonInterestExp,
      "Profit Before Tax": npbt,
      Tax: tax,
      "Income Tax Expense": tax,
      "Profit After Tax": npat,
      Provisions: provisionsTotal,
      "Capital Charge": totalCapCharge,
      "Risk Adjusted Profit": rap,
      Dividends: dividends,
      "Retained Earnings": retainedEarnings,
      "Business Risk Capital": bizEconCapCharge,
      "Credit Risk Capital": creditRiskEconCapCharge,
    },
  ];

  const newCashflow: CashflowInterface = {
    productId,
    segmentId,
    operatingActivities: {},
    investingActivities: {},
    financingActivities: {},
    generalActivities: {},
  };

  const atmCost = 0;
  const branchCost = 0;

  const strategicInvestments =
    staffCost + otherOperatingExpenses - (atmCost + branchCost + itTotal);

  const investmentChanges = paramInvestmentChanges * totalRevenue;
  const equityTransactions =
    paramEquityIssuance * npat - paramEquityBuyback * npat;

  const newBalanceSheet: BalanceSheetInterface = {
    segmentId,
    productId,
    assets: {},
    liabilities: {},
    equity: {},
    others: {},
  };

  let fallbackPrevRoundCashAndCashEquivalents =
    param.parameters.find(
      (p) => p.betterCode === "initial.asset.cashAndCashEquivalents"
    )?.paramValue || 0;

  const prevRoundCashflow = prevRoundResult?.cashflow.find(
    (c) => c.productId?.toString() === productId.toString()
  );

  const cashAndCashEquivalents = calculateCashAndCashEquivalent({
    prevRoundCashflow: prevRoundCashflow,
    fallbackPrevRoundCashAndCashEquivalents:
      fallbackPrevRoundCashAndCashEquivalents,
  });

  let fallbackPrevRoundFixedAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.fixedAssets")
      ?.paramValue || 0;

  let prevRoundBalanceSheet = prevRoundResult?.balanceSheet.find(
    (b) => b.productId?.toString() === productId.toString()
  );

  let capex = 0;

  const fixedAssets = calculateFixedAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundFixedAssets: fallbackPrevRoundFixedAssets,
    capex,
    depreciation,
    amortization,
  });

  const fallbackPrevRoundInvestments =
    param.parameters.find((p) => p.betterCode === "initial.asset.investments")
      ?.paramValue || 0;

  const fallbackPrevRoundCustomerDeposits =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.customerDeposits"
    )?.paramValue || 0;

  const customerDeposits = calculateCustomerDeposits({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundCustomerDeposits: fallbackPrevRoundCustomerDeposits,
    customerDeposits: 0, // not yet implemented
  });

  const loansAndAdvancesToCustomers = 0; // not applicable for asset management

  const percentageDebtIssuance = 0.12;

  const fallbackPrevRoundBorrowings =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.borrowings"
    )?.paramValue || 0;

  const prevRoundBorrowings =
    prevRoundBalanceSheet?.liabilities.borrowings ||
    fallbackPrevRoundBorrowings;

  const cfDebtIssuanceRepayment = prevRoundBorrowings * percentageDebtIssuance;

  const borrowings = prevRoundBorrowings + cfDebtIssuanceRepayment;

  CashflowFieldHelper.setValue(newCashflow, {
    operating: {
      profitBeforeTax: npbt,
      provisions: provisionsTotal,
      depreciation: depreciation + amortization,
      workingCapitalChange: 0, // not yet implemented
      strategicInvestments: -strategicInvestments,
      netChangeInCustomerDeposits: customerDeposits,
      netChangeInLoansAndAdvancesToCustomers: -loansAndAdvancesToCustomers,
      taxPaid: -tax,
    },
    investing: {
      capex: -(branchCost + itTotal),
      atmDeployment: -atmCost,
      investmentChanges: -investmentChanges,
    },
    financing: {
      debtIssuance: cfDebtIssuanceRepayment,
      equityTransactions: equityTransactions,
      dividendPaid: dividends,
    },
  });

  const investments = calculateInvestments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundInvestments: fallbackPrevRoundInvestments,
    investmentChanges,
  });

  const fallbackPrevRoundOtherAssets =
    param.parameters.find((p) => p.betterCode === "initial.asset.otherAssets")
      ?.paramValue || 0;

  const otherAssets = calculateOtherAssets({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherAssets: fallbackPrevRoundOtherAssets,
  });

  const totalAssets =
    cashAndCashEquivalents +
    loansAndAdvancesToCustomers +
    investments +
    otherAssets +
    fixedAssets;

  const fallbackPrevRoundProvisions =
    param.parameters.find(
      (p) => p.betterCode === "initial.liability.provisions"
    )?.paramValue || 0;

  const provisions = calculateProvisions({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundProvisions: fallbackPrevRoundProvisions,
    provisions: provisionsTotal,
  });

  const totalLiabilities = customerDeposits + borrowings + provisions;

  const fallbackPrevRoundShareCapital =
    param.parameters.find((p) => p.betterCode === "initial.equity.shareCapital")
      ?.paramValue || 0;

  const shareCapital = calculateShareCapital({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundShareCapital: fallbackPrevRoundShareCapital,
    shareCapital: equityTransactions,
  });

  const fallbackPrevRoundRetainedEarnings =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.retainedEarnings"
    )?.paramValue || 0;

  const bsRetainedEarnings = calculateRetainedEarnings({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundRetainedEarnings: fallbackPrevRoundRetainedEarnings,
    newRetainedEarnings: npat - dividends,
  });

  //New
  const fallbackPrevRoundReserves =
    param.parameters.find((p) => p.betterCode === "initial.equity.reserves")
      ?.paramValue || 0;

  const reserves = calculateReserves({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundReserves: fallbackPrevRoundReserves,
    newReserves: 100000000, // same treatment as retained earnings
  });

  const fallbackPrevRoundOtherEquityInstruments =
    param.parameters.find(
      (p) => p.betterCode === "initial.equity.otherEquityInstruments"
    )?.paramValue || 0;

  const otherEquityInstruments = calculateOtherEquityInstruments({
    prevRoundBalanceSheet: prevRoundBalanceSheet,
    fallbackPrevRoundOtherEquityInstruments:
      fallbackPrevRoundOtherEquityInstruments,
    newOtherEquityInstruments: 0, // not yet implemented
  });

  const totalEquity =
    shareCapital + bsRetainedEarnings + reserves + otherEquityInstruments;

  BalanceSheetFieldHelper.setValue(newBalanceSheet, {
    assets: {
      cashAndCashEquivalents: cashAndCashEquivalents,
      loansAndAdvancesToCustomers: loansAndAdvancesToCustomers,
      investments: investments,
      fixedAssets: fixedAssets,
      otherAssets: otherAssets,
      totalAssets: totalAssets,
    },
    liabilities: {
      customerDeposits: customerDeposits,
      borrowings: borrowings,
      provisions: provisions,
      totalLiabilities: totalLiabilities,
    },
    equity: {
      shareCapital: shareCapital,
      retainedEarnings: bsRetainedEarnings,
      reserves: reserves,
      otherEquityInstruments: otherEquityInstruments,
      totalEquity: totalEquity,
    },
  });

  return {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newMiscellaneous: { productId, segmentId, branches: 1, atms: 1 },
  };
}
