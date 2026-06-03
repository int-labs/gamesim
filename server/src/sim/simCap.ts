import mongoose from "mongoose";

import {
  DecisionDetailInterface,
  DecisionInterface,
  EventDecisionInterface,
  GlobalDecisionDetailInterface,
  SegmentDecisionDetailInterface,
} from "../models/decisions";
import { IGlobalInput } from "../models/globalInputs";
import { ParamDocument } from "../models/param";
import { ProductInterface } from "../models/products";
import {
  BalanceSheetInterface,
  BusinessPerformanceInterface,
  CashflowInterface,
  ChargeOffRow,
  MarketMetrics,
  PnLInterface,
} from "../models/projections";
import {
  ParamUnderTeamInterface,
  TeamInvolvedInterface,
} from "../models/results";
import { RoundInterface } from "../models/rounds";
import { SegmentInterface } from "../models/segments";
import { extractFields, mapFields } from "../utils/decisionFields";
import {
  calculateDecayChargeOffTable,
  provisionsPct,
  sumCustCount,
} from "./simFuncChargeoffV2";

const requiredFieldDefaults = {
  projected_market_share: 0,
  interest_rate: 0,
  fees: 0,
  marketing_spent: 0,
  product_level: 0,
  risk_level: 0,
};

const computeCapMetrics = ({
  churnRate = 0,
  projectedMarketShare = 0,
  prevTotalMarketSize = 0,
  currentTotalMarketSize = 0,
  isProjections = true,
  numberOfTeams = 2,
  riskLevel = 0,
  useChargeoff = false,
  deltaCustomers = 0,
  segmentId,
  productId,
  useMMShare = false,
  mmShare = 0,
  chargeoffCoefficient,
}: {
  churnRate?: number;
  prevTotalMarketSize?: number;
  currentTotalMarketSize?: number;
  isProjections?: boolean;
  projectedMarketShare?: number;
  numberOfTeams?: number;
  riskLevel?: number;
  useChargeoff?: boolean;
  deltaCustomers?: number;
  segmentId: string;
  productId: string;
  useMMShare?: boolean;
  mmShare?: number;
  chargeoffCoefficient?: {
    mean: number;
    stdDev: number;
    start: number;
    step: number;
    end: number;
  };
}) => {
  const capOpeningMarket = prevTotalMarketSize;

  let chargeOffTable: ChargeOffRow[] = [];

  // Use charge-off logic if applicable
  let capNewMarket, capProvisions;
  if (
    useChargeoff &&
    typeof riskLevel === "number" &&
    typeof deltaCustomers === "number"
  ) {
    chargeOffTable = calculateDecayChargeOffTable({
      deltaCustomers,
      // segment: segmentKey,
      // when triggered by roundEnding, use the mmShare from the decision
      // otherwise, use the average mmShare of all teams
      mmShare: useMMShare ? mmShare : 1 / numberOfTeams,
      chargeoffCoefficient,
    });

    // Get customer count sum for risk level using V2 function
    // Need to check this one
    capNewMarket = sumCustCount(chargeOffTable, riskLevel);
    // console.log("capNewMarket from charge-off table:", capNewMarket);
    //Adjustment impact here based on other decisions
    capProvisions = provisionsPct(chargeOffTable, riskLevel);
    // console.log("capProvisions from charge-off table:", capProvisions);
  } else {
    capNewMarket = currentTotalMarketSize - capOpeningMarket;
  }

  // Change to OBAL
  // const capMarketChurn = capMarketChurn last round;
  const capMarketChurn = Math.round(capOpeningMarket * churnRate);
  // console.log("capMarketChurn:", capMarketChurn);

  // console.log("capNewMarket:", capNewMarket);

  const capAvailMarket = capMarketChurn + capNewMarket;
  // console.log("capAvailMarket:", capAvailMarket);

  const capClosingMarket = capOpeningMarket + capNewMarket;
  // console.log("capClosingMarket:", capClosingMarket);

  const capMarketGrowth = capClosingMarket - capOpeningMarket;
  // console.log("capMarketGrowth:", capMarketGrowth);

  const capMarketGrowthRate =
    Math.round((capMarketGrowth / capOpeningMarket) * 100) / 100;
  // console.log("capMarketGrowthRate:", capMarketGrowthRate);

  // Change to OBAL
  const capStartingCust = Math.round(capOpeningMarket / numberOfTeams);
  // console.log("capStartingCust:", capStartingCust);

  // Before using churnRate here, adjust it with impact from Initiatives, Events, Segment Level input
  const capCustChurn = Math.round(capStartingCust * churnRate);
  // console.log("capCustChurn:", capCustChurn);

  const mmShareSavingsAcc = 0.2;

  const capGrossAdds = Math.round(
    capAvailMarket * (isProjections ? projectedMarketShare : mmShareSavingsAcc)
  );
  // console.log("capGrossAdds:", capGrossAdds);

  const capEndingCust = Math.round(
    capStartingCust - capCustChurn + capGrossAdds
  );
  // console.log("capEndingCust:", capEndingCust);

  const capNetAdds = capEndingCust - capStartingCust;
  // console.log("capNetAdds:", capNetAdds);

  const capGrowthRate = Number((capNetAdds / capStartingCust).toFixed(2));
  // console.log("capGrowthRate:", capGrowthRate);

  const capMktShare = Number(capEndingCust / capClosingMarket);
  // console.log("capMktShare:", capMktShare);

  return {
    capMarketChurn,
    capEndingCust,
    capGrossAdds,
    capCustChurn,
    capStartingCust,
    capClosingMarket,
    capMarketGrowthRate,
    capMktShare,
    chargeOffs: chargeOffTable,
    capProvisions,
    capAvailMarket,
  };
};

const getImpactsFromGlobalDecisions = ({
  globalDecisions,
  availableGlobalInputs,
  productId,
  latestGlobalDecisionsInPreviousRounds,
}: {
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  latestGlobalDecisionsInPreviousRounds: Array<
    Array<GlobalDecisionDetailInterface>
  >;
  availableGlobalInputs: IGlobalInput[];
  productId: string;
}) => {
  const impactsFromGlobalDecisions: {
    type: "absolute" | "relative";
    value: number;
    key: string;
    impacting: string;
  }[] = [];

  globalDecisions.forEach((g) => {
    const globalDecisionAvailable = availableGlobalInputs.find(
      (i) => i._id.toString() === g.globalInputId.toString()
    );

    if (globalDecisionAvailable) {
      if (g.globalInput?.type === "full-set") {
        const inputsImpactingThisProduct = (
          globalDecisionAvailable.inputs.find((i) => i.key === g.key)
            ?.productsImpacted || []
        ).filter((p) => p.toString() === productId);

        inputsImpactingThisProduct.forEach((p) => {
          const impacts =
            globalDecisionAvailable.inputs.find((i) => i.key === g.key)
              ?.impacts || {};

          Object.entries(impacts).forEach(([key, impact]) => {
            impactsFromGlobalDecisions.push({
              type: impact.type,
              value: impact.value,
              key: g.key,
              impacting: key,
            });
          });
        });
      } else if (g.globalInput?.type === "selectable-set") {
        const selectedInPreviousRounds =
          latestGlobalDecisionsInPreviousRounds.some((lgdipr) =>
            lgdipr?.find((gpr) => gpr.key === g.key && gpr.selected)
          );

        const isSelected = !!g.selected || !!selectedInPreviousRounds;

        if (isSelected) {
          const impactsOfThisGlobalDecision =
            globalDecisionAvailable.inputs.find((input) => input.key === g.key)
              ?.impacts || {};

          Object.entries(impactsOfThisGlobalDecision).forEach(
            ([key, impact]) => {
              impactsFromGlobalDecisions.push({
                type: impact.type,
                value: impact.value,
                key: g.key,
                impacting: key,
              });
            }
          );
        }
      }
    }
  });

  return impactsFromGlobalDecisions;
};

const getImpactsFromEvents = ({
  eventDecisions,
  productId,
  currentRound,
  eventsTriggered,
}: {
  eventDecisions: Array<EventDecisionInterface>;
  productId: string;
  currentRound: number;
  eventsTriggered: RoundInterface["eventsTriggered"];
}) => {
  // console.log("eventDecisions:", eventDecisions);
  // console.log("productId:", productId);

  const impactsFromEvents: {
    type: "absolute" | "relative";
    value: number;
    impacting: string;
  }[] = [];

  eventsTriggered.forEach((e) => {
    const event = e.event;

    if (event) {
      // Prefer eventTriggeredId for matching, fall back to eventId for backward compatibility
      const chosenKey = eventDecisions.find(
        (ed) =>
          (ed.eventTriggeredId &&
            ed.eventTriggeredId.toString() === e._id?.toString()) ||
          (!ed.eventTriggeredId &&
            ed.eventId &&
            ed.eventId.toString() === e.eventId.toString())
      )?.chosenKey;

      event.choices.forEach((c) => {
        const isChosen = c.key === chosenKey;

        if (isChosen) {
          const currentRoundImpacts = c.config[currentRound]?.impacts || [];

          currentRoundImpacts.forEach((i) => {
            if (i.impactedProducts.some((p) => p.toString() === productId)) {
              impactsFromEvents.push({
                type: "relative",
                value: i.value,
                impacting: i.paramCode,
              });
            }
          });
        }
      });
    }
  });

  return impactsFromEvents;
};

export async function simCapUniversal({
  detail,
  segmentDecisions,
  globalDecisions,
  eventDecisions = [],
  prevRoundDecision,
  totalTeams,
  // marketSize,
  currentYearMarketSize = 0,
  prevYearMarketSize = 0,
  availableGlobalInputs,
  triggeredBy,
  roundNumber,
  prevRoundParams,
  simFinFunction, // Pass the specific simFin function to use
  currentRoundDecision,
  prevRoundResult,
  segments,
  products,
  param,
  latestDecisionsInPreviousRounds,
  exceededLoan = 0,
  totalCompanyLoan = 0,
  eventsTriggered,
}: {
  detail: DecisionDetailInterface;
  segmentDecisions: Array<SegmentDecisionDetailInterface>;
  globalDecisions: Array<GlobalDecisionDetailInterface>;
  eventDecisions?: Array<EventDecisionInterface>;
  prevRoundDecision: DecisionInterface;
  totalTeams: number;
  // marketSize?: number;
  currentYearMarketSize?: number;
  prevYearMarketSize?: number;
  availableGlobalInputs: IGlobalInput[];
  triggeredBy?: "teamPlaying" | "roundEnding";
  roundNumber: number;
  prevRoundParams: ParamUnderTeamInterface[];
  simFinFunction: Function; // The specific simFin function to use
  currentRoundDecision: DecisionInterface;
  prevRoundResult?: TeamInvolvedInterface;
  segments: SegmentInterface[];
  products: ProductInterface[];
  param: ParamDocument;
  latestDecisionsInPreviousRounds?: Array<DecisionInterface>;
  exceededLoan?: number;
  eventsTriggered: RoundInterface["eventsTriggered"];
  totalCompanyLoan?: number;
}): Promise<{
  capEndingCust: number;
  totalRevenue: number;
  newBizPerf: BusinessPerformanceInterface[];
  newPnl: PnLInterface[];
  newCashflow: CashflowInterface;
  newBalanceSheet: BalanceSheetInterface;
  marketMetrics: MarketMetrics[];
  chargeOffs?: ChargeOffRow[];
  adjustedParams: ParamUnderTeamInterface[];
  newMiscellaneous?: TeamInvolvedInterface["miscellaneous"][number];
  loan?: number;
  deposit?: number;
  npl?: {
    nonPerforming: number;
    totalLoan: number;
    ratio: number;
  };
}> {
  const product = detail.product;
  if (!product) {
    console.error("❌ Product not found for decision detail:", detail);
    return {
      capEndingCust: 0,
      totalRevenue: 0,
      newBizPerf: [],
      newPnl: [],
      newCashflow: {
        productId: new mongoose.Types.ObjectId(),
        segmentId: new mongoose.Types.ObjectId(),
        operatingActivities: {},
        investingActivities: {},
        financingActivities: {},
        generalActivities: {},
      },
      newBalanceSheet: {
        productId: new mongoose.Types.ObjectId(),
        segmentId: new mongoose.Types.ObjectId(),
        assets: {},
        liabilities: {},
        equity: {},
        others: {},
      },
      marketMetrics: [],
      chargeOffs: [],
      adjustedParams: [],
    };
  }

  const segmentId = detail.segmentId;
  const productId = product._id;

  let currentRoundMarketChurnRate = 0;

  let marketChurnRateAdjustment = 0;

  let impactsFromGlobalDecisions: Array<{
    type: "absolute" | "relative";
    value: number;
    key: string;
    impacting: string;
  }> = [];

  let impactsFromEvents: Array<{
    type: "absolute" | "relative";
    value: number;
    impacting: string;
  }> = [];

  if (triggeredBy === "roundEnding") {
    impactsFromGlobalDecisions = getImpactsFromGlobalDecisions({
      globalDecisions,
      latestGlobalDecisionsInPreviousRounds:
        latestDecisionsInPreviousRounds?.map((d) => d.globalDecisionDetails) ||
        [],
      availableGlobalInputs,
      productId: productId.toString(),
    });

    impactsFromEvents = getImpactsFromEvents({
      eventDecisions,
      productId: productId.toString(),
      currentRound: roundNumber,
      eventsTriggered: eventsTriggered,
    });
  }

  if (
    // roundNumber > 1 && prevRoundParams.length > 0

    false // always false for now
  ) {
    const currentProductPrevRoundMarketChurnRateAdjustment =
      prevRoundParams.find(
        (p) =>
          p.productId.equals(productId) &&
          p.segmentId.equals(segmentId) &&
          p.code === "marketChurnRate"
      );

    // currentRoundMarketChurnRate =
    //   currentProductPrevRoundMarketChurnRateAdjustment
    //     ? currentProductPrevRoundMarketChurnRateAdjustment.originalValue +
    //       currentProductPrevRoundMarketChurnRateAdjustment.changes.reduce(
    //         (sum, change) => sum + change.value,
    //         0
    //       )
    //     : 0;
  } else {
    // currentRoundMarketChurnRate =
    //   (
    //     await fetchParamBySegmentProduct({ segmentId, productId })
    //   )?.parameters.find((p) => p.betterCode === "marketChurnRate")
    //     ?.paramValue ?? 0;
    currentRoundMarketChurnRate =
      param.parameters.find((p) => p.betterCode === "marketChurnRate")
        ?.paramValue ?? 0;
  }

  if (impactsFromGlobalDecisions.length > 0) {
    marketChurnRateAdjustment += impactsFromGlobalDecisions
      .filter((g) => g.impacting === "marketChurnRate")
      .reduce((sum, impact) => sum + impact.value, 0);
  }

  if (impactsFromEvents.length > 0) {
    const relativeImpacts = impactsFromEvents
      .filter(
        (impact) =>
          impact.type === "relative" && impact.impacting === "churnRate"
      )
      .reduce((sum, impact) => sum + (impact.value || 0), 0);

    marketChurnRateAdjustment +=
      currentRoundMarketChurnRate * (1 + relativeImpacts);
  }

  if (triggeredBy === "roundEnding") {
    currentRoundMarketChurnRate += marketChurnRateAdjustment;
  }

  const productInput = mapFields(detail.fields);
  const {
    projected_market_share: projMktShare,
    interest_rate: interestRate,
    fees: averageFee,
    marketing_spent: marketingSpent,
    product_level: productLevel,
    risk_level: riskLevel,
  } = extractFields(productInput, requiredFieldDefaults);

  const {
    capMarketChurn,
    capStartingCust,
    capCustChurn,
    capGrossAdds,
    capEndingCust,
    capMktShare,
    capMarketGrowthRate,
    chargeOffs,
    capProvisions,
    capAvailMarket,
    capClosingMarket,
  } = computeCapMetrics({
    projectedMarketShare: projMktShare,
    prevTotalMarketSize: prevYearMarketSize,
    currentTotalMarketSize: currentYearMarketSize,
    isProjections: true,
    numberOfTeams: totalTeams,
    deltaCustomers: currentYearMarketSize - prevYearMarketSize,
    useChargeoff: product.useChargeoff,
    chargeoffCoefficient: product.chargeoffCoefficient,
    churnRate: currentRoundMarketChurnRate,
    riskLevel,
    segmentId: segmentId.toString(),
    productId: productId.toString(),
    useMMShare: triggeredBy === "roundEnding",
    mmShare: projMktShare,
  });

  const tnoITInfra =
    globalDecisions.find((g) => g.key === "itInfrastructure")?.value || 0;
  const tnoMobileBanking =
    globalDecisions.find((g) => g.key === "mobileBanking")?.value || 0;
  const tnoBackOffice =
    globalDecisions.find((g) => g.key === "backOffice")?.value || 0;

  let adjustedParams: ParamUnderTeamInterface[] = [];

  const prevRoundMarketChurnRate = prevRoundParams.find(
    (p) =>
      p.productId.equals(productId) &&
      p.segmentId.equals(segmentId) &&
      p.code === "marketChurnRate"
  );

  const nextRoundMarketChurnRate = prevRoundMarketChurnRate
    ? {
        ...prevRoundMarketChurnRate,
        changes: [
          ...(prevRoundMarketChurnRate?.changes ?? []),
          { year: roundNumber, value: marketChurnRateAdjustment },
        ],
      }
    : {
        segmentId,
        productId,
        code: "marketChurnRate",
        originalValue: 0,
        changes: [{ year: roundNumber, value: marketChurnRateAdjustment }],
        type: "R" as "R" | "A",
      };

  adjustedParams.push(nextRoundMarketChurnRate);

  const {
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    newAdjustedParams,
    newMiscellaneous,
    loan,
    deposit,
    npl,
  } = await simFinFunction({
    inputs: {
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
      ...(capProvisions && { capProvisions }),
      roundNumber,
      prevRoundParams,
    },
    productId,
    currentTotalRevenue: 0,
    marketingSpent,
    productLevel,
    segmentId,
    impactsFromGlobalDecisions,
    // impactsFromEvents,
    prevRoundDecision,
    triggeredBy,
    prevRoundParams,
    availableGlobalInputs,
    globalDecisions,
    roundNumber,
    currentRoundDecision,
    segmentDecisions,
    prevRoundResult,
    product: products.find((p) => p._id.equals(productId)),
    segment: segments.find((s) => s._id.equals(segmentId)),
    param,
    exceededLoan,
    totalCompanyLoan,
    impactsFromEvents,
  });

  return {
    capEndingCust,
    totalRevenue,
    newBizPerf,
    newPnl,
    newCashflow,
    newBalanceSheet,
    marketMetrics: [
      {
        segmentId,
        productId,
        marketChurn: capMarketChurn,
        endingCustomers: capEndingCust,
        grossAdds: capGrossAdds,
        customerChurn: capCustChurn,
        startingCustomers: capStartingCust,
        marketGrowthRate: capMarketGrowthRate,
        marketShare: capMktShare,
      },
    ],
    ...(chargeOffs && { chargeOffs }),
    adjustedParams: [...adjustedParams, ...(newAdjustedParams ?? [])],
    newMiscellaneous: {
      ...(newMiscellaneous ?? {}),
      segmentId,
      productId,
      startingCustomers: capStartingCust,
      newCustomers: capAvailMarket,
      customerChurnRate: currentRoundMarketChurnRate,
      churnedCustomers: capCustChurn,
      grossAdds: capGrossAdds,
      endingCustomers: capEndingCust,
    },
    loan,
    deposit,
    npl,
  };
}
