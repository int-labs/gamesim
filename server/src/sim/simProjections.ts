import { BaseDataInterface } from "../models/baseData";
import Product from "../models/products"; // Import the Product model
import Projection from "../models/projections";
import { calcCSAT } from "./calcCSAT";
import {
  creditMarketModel,
  depoMarketModel,
  investmentMarketModel,
  loanMarketModel,
} from "./simFunctions"; // Use marketModel instead of churnRate calculations

export const calculateProjections = async (
  decision: any,
  totalTeams: number,
  baseData: BaseDataInterface // Add baseData parameter
): Promise<{
  _id: { $oid: string };
  decisionId: { $oid: string };
  simulationId: { $oid: string };
  teamId: { $oid: string };
  projections: [number, number, number, number];
  pnl: Array<{
    productId: { $oid: string };
    [key: string]: number | { $oid: string };
  }>;
  createdAt: { $date: string };
  updatedAt: { $date: string };
}> => {
  let totalRevenue = 0;
  let grossProfit = 0; // Gross Profit ($)
  let totalCSAT = 0; // Customer Satisfaction (%)
  let totalESAT = 0; // Employee Satisfaction (%)
  const pnl: Array<{
    productId: { $oid: string };
    [key: string]: number | { $oid: string };
  }> = []; // To store per-product PnL metrics as an array

  console.log("Processing decision:", decision);

  for (const detail of decision.decisionDetails) {
    const product = await Product.findById(detail.productId);
    if (!product) {
      console.warn(`Product not found: ${detail.productId}`);
      continue;
    }

    const { productName, baseVariables } = product;
    const productId = { $oid: detail.productId }; // Convert productId to the desired format

    let adjTotalMarket = (baseVariables?.availableMarket ?? 0) / totalTeams;
    console.log(`Total Market Per Team for ${productName}: ${adjTotalMarket}`);

    // CSAT Opening Value
    let openingCSAT = 60; // Default for round 1
    if (typeof decision.roundNumber === "number" && decision.roundNumber > 1) {
      const prevProjection = await Projection.findOne({
        simulationId: decision.simulationId,
        teamId: decision.teamId,
        roundNumber: decision.roundNumber - 1,
      }).lean();
      if (
        prevProjection &&
        Array.isArray(prevProjection.kpi) &&
        prevProjection.kpi.length > 0
      ) {
        const csatSum = prevProjection.kpi.reduce(
          (sum, k) => sum + (typeof k.csat === "number" ? k.csat : 0),
          0
        );
        openingCSAT = csatSum / prevProjection.kpi.length;
      }
    }

    // Calculate CSAT
    const allTeamsGlobalDecisionDetails = [
      Object.fromEntries(
        (decision.globalDecisionDetails || []).map(
          (d: { key: string; value: number }) => [d.key, d.value]
        )
      ),
    ];
    const csatScore = calcCSAT(
      decision,
      baseData,
      allTeamsGlobalDecisionDetails,
      {
        openingCSAT,
        year: decision.roundNumber?.toString() || "1",
      }
    );
    totalCSAT += csatScore;

    switch (productName) {
      case "Savings Account":
        console.log("Starting calculations for Savings Account...");

        const depoSafeBaseVariables = {
          churnRate: baseVariables?.churnRate ?? 0.008,
          growthRate: baseVariables?.churnRate ?? 0.006,
          interestRateSpread: baseVariables?.interestRateSpread ?? 0.02,
          interestRateRisk: baseVariables?.interestRateRisk ?? 0.015,
          customerAcquisitionCost: baseVariables?.customerAcquisitionCost ?? 40,
          marketShare: baseVariables?.marketShare ?? 0.3,
          digitalEngagementRate: baseVariables?.digitalEngagementRate ?? 0.75,
          serviceQualityScore: baseVariables?.serviceQualityScore ?? 4.6,
          feesRate: baseVariables?.feesRate ?? 0.001,
          startingCust: baseVariables?.startingCust ?? 12302824,
        };
        console.log("Deposit Safe Base Variables:", depoSafeBaseVariables);

        // Use marketModel to determine adjusted market share
        const depoMarketShare = depoMarketModel(
          detail.interestRate,
          detail.marketingSpend,
          detail.fees,
          detail.productLevel,
          depoSafeBaseVariables,
          totalTeams
        );

        console.log("Calculated market share:", depoMarketShare);

        // Adjust total market based on computed market share
        adjTotalMarket *= depoMarketShare;

        console.log("Adjusted total market:", adjTotalMarket);

        const endingCust = (baseVariables?.startingCust ?? 12302824) + 1000000;

        const depoAccSize = endingCust * (baseVariables?.accountSize ?? 0);
        const totalDepo = endingCust * (baseVariables?.accountMoney ?? 0);

        console.log("Total Number of Accounts:", depoAccSize);
        console.log("Total Deposits:", totalDepo);

        // Liquidity allocations
        const depoCentralBankCompliance =
          totalDepo * (baseVariables?.centralBankLiquidityCompliance ?? 0);
        const depoInternalLiquidity =
          totalDepo * (baseVariables?.internalLiquidity ?? 0);
        const depoCof =
          totalDepo - depoCentralBankCompliance - depoInternalLiquidity;

        console.log(
          "Central Bank Compliance Deposits:",
          depoCentralBankCompliance
        );
        console.log("Internal Liquidity Deposits:", depoInternalLiquidity);
        console.log("Deposits for Cost of Funds:", depoCof);

        const depoInterestIncome =
          depoCentralBankCompliance *
            (baseVariables?.centralBankLiquidityInterestRate ?? 0) +
          depoCof * (baseVariables?.cofRate ?? 0);

        const depoInterestExpense = totalDepo * detail.interestRate;
        const depoNetInterestIncome = depoInterestIncome - depoInterestExpense;

        console.log("Interest Income:", depoInterestIncome);
        console.log("Interest Expense:", depoInterestExpense);
        console.log("Net Interest Income:", depoNetInterestIncome);

        const depoFeesIncome = detail.fees * depoAccSize;

        console.log("Fees Income:", depoFeesIncome);

        const test = 295000000;
        const depoOtherNonIIIncome =
          (baseVariables?.nonInterestIncomeperDepoFix ?? 0) +
          depoAccSize * (baseVariables?.nonInterestIncomeperDepo ?? 0) +
          test;

        console.log("Other Non-Interest Income:", depoOtherNonIIIncome);

        const depoNonInterestIncome = depoFeesIncome + depoOtherNonIIIncome;
        console.log("Non-Interest Income:", depoNonInterestIncome);

        const depoTotalRevenue = depoNetInterestIncome + depoNonInterestIncome;
        const depoPercentNonInterestIncome =
          depoNonInterestIncome / depoTotalRevenue;
        const depoRevPerCust = depoTotalRevenue / adjTotalMarket;

        console.log("Total Revenue:", depoTotalRevenue);
        console.log(
          "Percent Non-Interest Income:",
          depoPercentNonInterestIncome
        );
        console.log("Revenue per Customer:", depoRevPerCust);

        totalRevenue += depoTotalRevenue;

        console.log("Debugging");

        // CSAT Debugging
        const serviceQualityImpact =
          depoSafeBaseVariables.serviceQualityScore *
          depoSafeBaseVariables.marketShare *
          50;
        console.log(`[Debug] Service Quality Impact: ${serviceQualityImpact}`);

        const digitalEngagementImpact =
          Math.sqrt(depoSafeBaseVariables.digitalEngagementRate) * 20;
        console.log(
          `[Debug] Digital Engagement Impact: ${digitalEngagementImpact}`
        );

        const marketingImpact = Math.sqrt(detail.marketingSpend) * 0.05;
        console.log(`[Debug] Marketing Spend Impact: ${marketingImpact}`);

        const productLevelImpact = Math.sqrt(detail.productLevel) * 4;
        console.log(`[Debug] Product Level Impact: ${productLevelImpact}`);

        const interestRateImpact = Math.log1p(detail.interestRate) * 100;
        console.log(`[Debug] Interest Rate Impact: ${interestRateImpact}`);

        const feesImpact = Math.log1p(detail.fees) * 10;
        console.log(`[Debug] Fees Impact (Negative): ${feesImpact}`);

        const csatImpact =
          openingCSAT +
          depoSafeBaseVariables.serviceQualityScore *
            depoSafeBaseVariables.marketShare *
            50 +
          Math.sqrt(depoSafeBaseVariables.digitalEngagementRate) * 20 +
          (Math.sqrt(detail.marketingSpend) * 0.045) / 1000 + // Account for thousands ending (Uniform)
          Math.sqrt(detail.productLevel) * 4 +
          Math.log1p(detail.interestRate) * 100 -
          Math.log1p(detail.fees) * 10;

        console.log(`[Debug] Final CSAT Impact: ${csatImpact}`);

        // ESAT Debugging
        const esatServiceQualityImpact =
          depoSafeBaseVariables.serviceQualityScore * 0.9;
        console.log(
          `[Debug] ESAT Service Quality Impact: ${esatServiceQualityImpact}`
        );

        const esatFeesImpact = Math.log1p(detail.fees) * 2;
        console.log(`[Debug] ESAT Fees Impact: ${esatFeesImpact}`);

        const esatProductLevelImpact = Math.tanh(detail.productLevel / 10) * 2;
        console.log(
          `[Debug] ESAT Product Level Impact (Negative): ${esatProductLevelImpact}`
        );

        const esatMarketingImpact = Math.log1p(detail.marketingSpend) * 0.005;
        console.log(
          `[Debug] ESAT Marketing Impact (Negative): ${esatMarketingImpact}`
        );

        const esatImpact =
          openingCSAT +
          depoSafeBaseVariables.serviceQualityScore * 0.9 +
          Math.log1p(detail.fees) * 2 -
          Math.tanh(detail.productLevel / 10) * 2 -
          Math.log1p(detail.marketingSpend) * 0.005;

        console.log(`[Debug] Final ESAT Impact: ${esatImpact}`);

        // New Customers Debugging
        const newCustomersMarketImpact =
          depoMarketShare * adjTotalMarket * 0.02;
        console.log(
          `[Debug] New Customers Market Impact: ${newCustomersMarketImpact}`
        );

        const newCustomersMarketingImpact =
          Math.log1p(detail.marketingSpend) * 50;
        console.log(
          `[Debug] New Customers Marketing Impact: ${newCustomersMarketingImpact}`
        );

        const newCustomersInterestRateImpact =
          Math.tanh(detail.interestRate / 5) * 30;
        console.log(
          `[Debug] New Customers Interest Rate Impact: ${newCustomersInterestRateImpact}`
        );

        const newCustomersFeesImpact = Math.log1p(detail.fees) * 20;
        console.log(
          `[Debug] New Customers Fees Impact (Negative): ${newCustomersFeesImpact}`
        );

        const newCustomersImpact =
          depoMarketShare * adjTotalMarket * 0.02 +
          Math.log1p(detail.marketingSpend) * 50 +
          Math.tanh(detail.interestRate / 5) * 30 -
          Math.log1p(detail.fees) * 20;

        console.log(
          `[Debug] Final New Customers Impact: ${newCustomersImpact}`
        );

        // Ensure CSAT, ESAT, Brand Equity are within 0-100 range
        totalCSAT += Math.max(0, Math.min(100, csatImpact));
        totalESAT += Math.max(0, Math.min(100, esatImpact));
        grossProfit += Math.max(0, newCustomersImpact); // Prevent negative new customers

        console.log("Updated Totals - Revenue:", totalRevenue);
        console.log("Updated Totals - CSAT:", totalCSAT);
        console.log("Updated Totals - ESAT:", totalESAT);

        pnl.push({
          productId,
          "Total No of Accounts": depoAccSize,
          "Avg Deposits per Customer": baseVariables?.accountMoney ?? 0,
          "Total Deposits": totalDepo,
          "Interest Income": depoInterestIncome,
          "Interest Expense": depoInterestExpense,
          "Net Interest Income": depoNetInterestIncome,
          "Fees Income": depoFeesIncome,
          "Other Non-Interest Income Total": depoOtherNonIIIncome,
          "Non-Interest Income": depoNonInterestIncome,
          "% Non-Interest Income": depoPercentNonInterestIncome,
          "Total Revenue": depoTotalRevenue,
          "Revenue per Customer": depoRevPerCust,
          "Central Bank Compliance": depoCentralBankCompliance,
          "Internal Liquidity": depoInternalLiquidity,
        });

        console.log("PnL entry added:", pnl[pnl.length - 1]);
        break;

      case "Credit Card":
        console.log("Starting calculations for Credit Card...");

        const creditSafeBaseVariables = {
          churnRate: baseVariables?.churnRate ?? 0.025,
          marketShare: baseVariables?.marketShare ?? 0.25,
          customerAcquisitionCost:
            baseVariables?.customerAcquisitionCost ?? 120,
          customerLifetimeValue: baseVariables?.customerLifetimeValue ?? 6000,
          digitalEngagementRate: baseVariables?.digitalEngagementRate ?? 0.75,
          serviceQualityScore: baseVariables?.serviceQualityScore ?? 4.4,

          interestRateSpread: baseVariables?.interestRateSpread ?? 0.03,
          interestRateRisk: baseVariables?.interestRateRisk ?? 0.04,

          averageCreditBalance: baseVariables?.averageCreditBalance ?? 2500,
          minCreditLimit: baseVariables?.minCreditLimit ?? 1500,
          maxCreditLimit: baseVariables?.maxCreditLimit ?? 60000,

          growthRate: baseVariables?.growthRate ?? 0.008,
          retentionRate: baseVariables?.retentionRate ?? 0.9,

          rewardProgramCostRate: baseVariables?.rewardProgramCostRate ?? 0.01,
          fraudRate: baseVariables?.fraudRate ?? 0.001,
          startingCust: baseVariables?.startingCust ?? 7940775,
        };

        console.log("Credit Safe Base Variables:", creditSafeBaseVariables);

        // Use marketModel to determine adjusted market share
        const creditMarketShare = creditMarketModel(
          detail.interestRate,
          detail.marketingSpend,
          detail.fees,
          detail.productLevel,
          detail.risk,
          creditSafeBaseVariables,
          totalTeams
        );

        console.log("Calculated market share:", creditMarketShare);

        // Takes in CoF from Deposits
        adjTotalMarket *= creditMarketShare;

        console.log("Adjusted total market:", adjTotalMarket);

        const creditAccSize =
          adjTotalMarket * (baseVariables?.accountSize ?? 0);
        const totalCredit = adjTotalMarket * (baseVariables?.accountMoney ?? 0);

        console.log("Deposit Account Size:", creditAccSize);
        console.log("Total Deposits:", totalCredit);

        pnl.push({
          productId,
          "Total No of Cards": creditAccSize,
          "Avg Balance per Customer": 15,
          "Total Balance": 200,
          "Fees Income": 11,
          "Other Non-Interest Income Total": 11,
          "% Interest Income": 11,
          "Total Revenue": 11,
          "Revenue per Customer": 11,
        });
        break;

      case "Home Loan":
        console.log("Starting calculations for Home Loans...");

        const loanSafeBaseVariables = {
          marketShare: baseVariables?.marketShare ?? 0.2,
          customerAcquisitionCost:
            baseVariables?.customerAcquisitionCost ?? 250,
          customerLifetimeValue: baseVariables?.customerLifetimeValue ?? 30000,
          interestRateRisk: baseVariables?.interestRateRisk ?? 0.03,
          interestRateSpread: baseVariables?.interestRateSpread ?? 0.015,
          averageLoanBalance: baseVariables?.averageLoanBalance ?? 180000,
          minLoanAmount: baseVariables?.minLoanAmount ?? 100000,
          maxLoanAmount: baseVariables?.maxLoanAmount ?? 2000000,
          defaultRate: baseVariables?.defaultRate ?? 0.015,
          loanTermAverage: baseVariables?.loanTermAverage ?? 25,
          riskWeight: baseVariables?.riskWeight ?? 0.7,
          processingFeeRate: baseVariables?.processingFeeRate ?? 0.005,
          prepaymentRate: baseVariables?.prepaymentRate ?? 0.12,
          approvalRate: baseVariables?.approvalRate ?? 0.85,
          startingCust: baseVariables?.startingCust ?? 709538,
        };
        console.log("Loan Safe Base Variables:", loanSafeBaseVariables);

        // Use marketModel to determine adjusted market share
        const loanMarketShare = loanMarketModel(
          detail.interestRate,
          detail.marketingSpend,
          detail.fees,
          detail.productLevel,
          detail.risk,
          loanSafeBaseVariables,
          totalTeams
        );

        console.log("Calculated market share:", loanMarketShare);

        pnl.push({
          productId,
          "Total No of Accounts": 15,
          "Avg Loans per Customer": 15,
          "Total Loans": 200,
          "Interest Income": 11,
          "Interest Expense": 11,
          "Net Interest Income": 11,
          "Non-Interest Income": 11,
          "Total Revenue": 11,
          "Revenue per Customer": 11,
        });
        break;

      case "Mutual Funds":
        console.log("Starting calculations for Mutual Funds...");

        const investmentSafeBaseVariables = {
          marketShare: baseVariables?.marketShare ?? 0.2,
          customerAcquisitionCost:
            baseVariables?.customerAcquisitionCost ?? 180,
          customerLifetimeValue: baseVariables?.customerLifetimeValue ?? 1000,
          investmentRisk: baseVariables?.investmentRisk ?? 0.06,
          averageReturnRate: baseVariables?.averageReturnRate ?? 0.07,
          minInvestment: baseVariables?.minInvestment ?? 1500,
          managementFeeRate: baseVariables?.managementFeeRate ?? 0.012,
          commissionRate: baseVariables?.commissionRate ?? 0.005,
          fundDiversificationScore:
            baseVariables?.fundDiversificationScore ?? 0.8,
          redemptionRate: baseVariables?.redemptionRate ?? 0.02,
          averageInvestorAge: baseVariables?.averageInvestorAge ?? 42,
          taxEfficiency: baseVariables?.taxEfficiency ?? 0.85,
          startingCust: baseVariables?.startingCust ?? 720000,
          riskAppetiteSegmentation: {
            lowRisk: baseVariables?.riskAppetiteSegmentation?.lowRisk ?? 0.35,
            moderateRisk:
              baseVariables?.riskAppetiteSegmentation?.moderateRisk ?? 0.5,
            highRisk: baseVariables?.riskAppetiteSegmentation?.highRisk ?? 0.15,
          },
        };
        console.log(
          "Investment Safe Base Variables:",
          investmentSafeBaseVariables
        );

        // Use marketModel to determine adjusted market share
        const investmentMarketShare = investmentMarketModel(
          detail.interestRate,
          detail.marketingSpend,
          detail.fees,
          detail.productLevel,
          detail.risk,
          detail.commission,
          investmentSafeBaseVariables,
          totalTeams
        );

        console.log("Calculated market share:", investmentMarketShare);
        pnl.push({
          productId,
          "Interest Income": 15,
          "Interest Expense": 15,
          "Net Interest Income": 200,
          "Non-Interest Income": 11,
          "Total Revenue": 11,
          "Revenue per Customer": 11,
        });
        break;
    }
  }
  const now = new Date().toISOString();

  return {
    _id: { $oid: decision._id },
    decisionId: { $oid: decision.decisionId },
    simulationId: { $oid: decision.simulationId },
    teamId: { $oid: decision.teamId },
    projections: [totalRevenue, Math.round(grossProfit), totalCSAT, totalESAT],
    pnl,
    createdAt: { $date: now },
    updatedAt: { $date: now },
  };
};
