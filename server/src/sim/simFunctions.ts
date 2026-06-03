/**
 * Computes the Probability Density Function (PDF) for a normal distribution.
 * This function evaluates how likely a given value `x` is in relation to a normal distribution 
 * with a given `mean` and `standard deviation` (`stdDev`).
 * 
 * Formula:
 *    PDF(x) = (1 / (σ * sqrt(2π))) * exp(-0.5 * ((x - μ) / σ)²)
 */
export const funcPdf = (x: number, mean: number, stdDev: number): number => {
  if (stdDev === 0) return 0; // Prevent division by zero, ensuring numerical stability.
  const exponent = Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * exponent;
};

/**
 * Computes either the Cumulative Distribution Function (CDF) or the PDF 
 * of a normal distribution.
 * 
 * - If `cumulative = true`, it returns the CDF, which gives the probability 
 *   that `x` is less than or equal to a given threshold.
 * - If `cumulative = false`, it simply returns the PDF.
 */
export const funcNormDist = (
  x: number,
  mean: number,
  stdDev: number,
  cumulative: boolean = false
): number => {
  if (stdDev === 0) return 0; // Prevent division by zero for edge cases.
  if (cumulative) {
    const z = (x - mean) / stdDev; // Standardization of `x` to a normal variable
    const t = 1 / (1 + 0.2316419 * Math.abs(z)); // Approximation for CDF
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const probabilities =
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? 1 - d * probabilities : d * probabilities;
  } else {
    return funcPdf(x, mean, stdDev);
  }
};

export const depoMarketModel = (
  interestRate: number,
  marketingSpend: number,
  fees: number,
  productLevel: number,
  baseVariables: {
    churnRate: number;
    growthRate: number;
    interestRateSpread: number;
    interestRateRisk: number;
    customerAcquisitionCost: number;
    marketShare: number;
    digitalEngagementRate: number;
    serviceQualityScore: number;
    feesRate: number;
    startingCust: number;
  },
  totalTeams: number
): number => {
  const {
    churnRate, 
    growthRate,
    interestRateSpread,
    interestRateRisk,
    customerAcquisitionCost,
    marketShare,
    digitalEngagementRate,
    serviceQualityScore,
    feesRate,
    startingCust,
  } = baseVariables;

  console.log(`[depoMarketModel] Inputs ->`, { interestRate, marketingSpend, fees, productLevel, totalTeams, ...baseVariables });

  /** ───────────────────────────────────────────────
   *  Interest Rate Influence on Churn Reduction (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let interestRateEffect = Math.exp(-Math.abs(interestRate - interestRateSpread) / interestRateRisk);
  console.log(`[depoMarketModel] Interest Rate Effect on Churn: ${interestRateEffect}`);

  /** ───────────────────────────────────────────────
   *  Marketing Spend Impact on Churn Reduction (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let marketingEffect = Math.min(1, Math.max(0.5, Math.log1p(marketingSpend) / (2 * Math.log1p(customerAcquisitionCost))));
  console.log(`[depoMarketModel] Marketing Impact on Churn: ${marketingEffect}`);

  /** ───────────────────────────────────────────────
   *  Fees Impact on Churn Rate (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let feesImpact = Math.max(0.8, 1 - Math.exp(-Math.abs(fees - feesRate) * 1.5));
  console.log(`[depoMarketModel] Fees Impact on Churn: ${feesImpact}`);

  /** ───────────────────────────────────────────────
   *  Product Level Impact on Customer Retention (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let productImpact = Math.tanh(productLevel / 2);
  console.log(`[depoMarketModel] Product Impact on Churn: ${productImpact}`);

  /** ───────────────────────────────────────────────
   *  Digital Engagement & Service Quality Impact (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let adjustedDigitalEngagement = 
    digitalEngagementRate * 4 +  
    0.015 * Math.log1p(marketingSpend) + 
    0.01 * productLevel;
  adjustedDigitalEngagement = Math.max(0.1, Math.min(1, adjustedDigitalEngagement));

  let adjustedServiceQuality = 
    serviceQualityScore * 17.5 +  
    0.005 * Math.log1p(marketingSpend) - 
    0.005 * fees + 
    0.01 * (1 / Math.abs(interestRate - interestRateSpread + 0.01));
  adjustedServiceQuality = Math.max(1, Math.min(5, adjustedServiceQuality));

  let engagementEffect = Math.sqrt(adjustedDigitalEngagement) * 0.1 + (adjustedServiceQuality / 5) * 0.15;
  engagementEffect = Math.max(0.2, Math.min(1, engagementEffect));

  console.log(`[depoMarketModel] Adjusted Digital Engagement Rate: ${adjustedDigitalEngagement}`);
  console.log(`[depoMarketModel] Adjusted Service Quality Score: ${adjustedServiceQuality}`);
  console.log(`[depoMarketModel] Engagement Impact on Churn: ${engagementEffect}`);

  /** ───────────────────────────────────────────────
   *  Adjusted Churn Rate Based on Decisions (50% Less Sensitivity)
   * ─────────────────────────────────────────────── */
  let adjustedChurnRate = churnRate * 
    (1 - 0.075 * interestRateEffect) * 
    (1 - 0.075 * marketingEffect) * 
    (1 + 0.12 * feesImpact) * 
    (1 - 0.05 * productImpact) * 
    (1 - 0.1 * engagementEffect);
  adjustedChurnRate = Math.max(0.04, Math.min(0.5, adjustedChurnRate));

  console.log(`[depoMarketModel] Adjusted Churn Rate: ${adjustedChurnRate}`);

  /** ───────────────────────────────────────────────
   *  Growth Rate Contribution (New Customers)
   * ─────────────────────────────────────────────── */
  let newCustomers = marketShare * growthRate;
  newCustomers = Math.min(newCustomers, 0.05); // Cap growth at max 5%

  console.log(`[depoMarketModel] New Customers Contribution: ${newCustomers}`);

  /** ───────────────────────────────────────────────
   *  Final Market Share Calculation (With Growth)
   * ─────────────────────────────────────────────── */
  let newMarketShare = marketShare * (1 - adjustedChurnRate) + newCustomers;

  console.log(`[depoMarketModel] Final Market Share (After Churn & Growth Adjustments): ${newMarketShare}`);

  return newMarketShare;
};

export const creditMarketModel = (
  interestRate: number,
  marketingSpend: number,
  fees: number,
  productLevel: number,
  risk: number, // Represents risk tolerance, creditworthiness, etc.
  baseVariables: {
    churnRate?: number;
    marketShare?: number;
    customerAcquisitionCost?: number;
    customerLifetimeValue?: number;
    digitalEngagementRate?: number;
    serviceQualityScore?: number;
    interestRateSpread?: number;
    interestRateRisk?: number;
    averageCreditBalance?: number;
    minCreditLimit?: number;
    maxCreditLimit?: number;
    growthRate?: number;
    retentionRate?: number;
    rewardProgramCostRate?: number;
    fraudRate?: number;
  },
  totalTeams: number
): number => {
  // Ensure base variables have default values
  const creditSafeBaseVariables = {
    churnRate: baseVariables?.churnRate ?? 0.025,
    marketShare: baseVariables?.marketShare ?? 0.25,
    customerAcquisitionCost: baseVariables?.customerAcquisitionCost ?? 120,
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
  };

  const {
    churnRate,
    marketShare,
    interestRateRisk,
    growthRate,
    retentionRate,
    fraudRate,
  } = creditSafeBaseVariables;

  /** ──────────────────────────────────────
   *  🔹 Credit Risk Impact Calculation
   *  - Higher risk = lower expected credit market share
   * ────────────────────────────────────── */
  let creditRiskImpact = Math.exp(-Math.abs(risk - 700) / 50); // Assuming 700 is a baseline credit score

  let churnEffect = Math.exp(-churnRate * 5); // Higher churn = lower market presence
  let retentionEffect = Math.exp(retentionRate * 2); // Higher retention = better engagement

  console.log(`[creditMarketModel] Credit Risk Impact: ${creditRiskImpact}`);
  console.log(`[creditMarketModel] Churn Effect: ${churnEffect}`);
  console.log(`[creditMarketModel] Retention Effect: ${retentionEffect}`);

  /** ──────────────────────────────────────
   *  🔹 Economic Growth & Consumer Confidence
   * ────────────────────────────────────── */
  let economicImpact = 1 + 0.05 * Math.tanh(growthRate * 50);

  console.log(`[creditMarketModel] Economic Impact: ${economicImpact}`);

  /** ──────────────────────────────────────
   *  🔹 Interest Rate & Fees Effect
   * ────────────────────────────────────── */
  let interestRateEffect = Math.exp(-Math.abs(interestRate - interestRateRisk) * 5);
  let feesImpact = 1 - Math.tanh(fees / 200);

  console.log(`[creditMarketModel] Interest Rate Effect: ${interestRateEffect}`);
  console.log(`[creditMarketModel] Fees Impact: ${feesImpact}`);

  /** ──────────────────────────────────────
   *  🔹 Market Share & Marketing Impact
   * ────────────────────────────────────── */
  let marketShareInfluence = Math.pow(1 - marketShare, 1.1) * 0.8 + marketShare * 0.3;
  let marketingEffect = 1 + 0.08 * Math.log1p(marketingSpend);

  console.log(`[creditMarketModel] Market Share Influence: ${marketShareInfluence}`);
  console.log(`[creditMarketModel] Marketing Effect: ${marketingEffect}`);

  /** ──────────────────────────────────────
   *  📌 Final Credit Market Share Calculation
   * ────────────────────────────────────── */
  let adjustedCreditMarket =
    creditRiskImpact *
    churnEffect *
    retentionEffect *
    economicImpact *
    interestRateEffect *
    feesImpact *
    marketShareInfluence *
    marketingEffect;

  let minShare = 1 / (totalTeams * 2); // Ensure some market presence
  let maxShare = 1 / totalTeams; // Cap market influence

  let finalCreditMarketShare = Math.max(minShare, Math.min(maxShare, adjustedCreditMarket));

  console.log(`[creditMarketModel] Adjusted Market Share: ${adjustedCreditMarket}`);
  console.log(`[creditMarketModel] Final Market Share (Bounded): ${finalCreditMarketShare}`);

  return finalCreditMarketShare;
};

export const loanMarketModel = (
  interestRate: number,
  marketingSpend: number,
  fees: number,
  productLevel: number,
  risk: number, // Represents creditworthiness & risk tolerance
  loanSafeBaseVariables: { 
    capitalReserveRatio?: number;
    riskSpread?: number;
    interestRateRisk?: number;
    prepaymentRate?: number;
    approvalRate?: number;
    marketShare?: number;
    processingFeeRate?: number;
    averageLoanBalance?: number;
    defaultRate?: number; // Added defaultRate as it was referenced but not passed in baseVariables
  },
  totalTeams: number
): number => {
  // Extracting variables directly from loanSafeBaseVariables
  const {
    capitalReserveRatio = 0.1, // Default if undefined
    riskSpread = 0.02,
    interestRateRisk = 0.03,
    prepaymentRate = 0.1,
    approvalRate = 0.75,
    marketShare = 0.2,
    processingFeeRate = 0.005,
    averageLoanBalance = 150000,
    defaultRate = 0.015, // Ensure this exists
  } = loanSafeBaseVariables; 

  /** ──────────────────────────────────────
   *  🔹 Default & Risk Impact on Market Share
   * ────────────────────────────────────── */
  let defaultRiskImpact = Math.exp(-defaultRate * 10); // Adjusted from funcNormDist to avoid dependency
  let approvalBoost = Math.tanh(approvalRate * 1.5);

  console.log(`[loanMarketModel] Default Risk Impact: ${defaultRiskImpact}`);
  console.log(`[loanMarketModel] Approval Boost: ${approvalBoost}`);

  /** ──────────────────────────────────────
   *  🔹 Interest Rate Effect on Loan Demand
   * ────────────────────────────────────── */
  let interestRateEffect = Math.exp(-Math.abs(interestRate - riskSpread) * 5);

  console.log(`[loanMarketModel] Interest Rate Effect: ${interestRateEffect}`);

  /** ──────────────────────────────────────
   *  🔹 Prepayment & Processing Fees Impact
   * ────────────────────────────────────── */
  let prepaymentImpact = 1 - Math.tanh(prepaymentRate * 2);
  let processingFeeEffect = 1 - Math.tanh(processingFeeRate * 10);

  console.log(`[loanMarketModel] Prepayment Impact: ${prepaymentImpact}`);
  console.log(`[loanMarketModel] Processing Fee Effect: ${processingFeeEffect}`);

  /** ──────────────────────────────────────
   *  🔹 Capital Reserve & Liquidity Impact
   * ────────────────────────────────────── */
  let liquidityBoost = 1 + 0.02 * Math.log1p(averageLoanBalance);
  let complianceConstraint = Math.max(0.7, 1 - (capitalReserveRatio ?? 0.1) * 0.3);

  console.log(`[loanMarketModel] Liquidity Boost: ${liquidityBoost}`);
  console.log(`[loanMarketModel] Compliance Constraint: ${complianceConstraint}`);

  /** ──────────────────────────────────────
   *  🔹 Market Share & Marketing Impact
   * ────────────────────────────────────── */
  let marketShareInfluence = Math.pow(1 - marketShare, 1.1) * 0.8 + marketShare * 0.3;
  let marketingEffect = 1 + 0.08 * Math.log1p(marketingSpend);

  console.log(`[loanMarketModel] Market Share Influence: ${marketShareInfluence}`);
  console.log(`[loanMarketModel] Marketing Effect: ${marketingEffect}`);

  /** ──────────────────────────────────────
   *  📌 Final Loan Market Share Calculation
   * ────────────────────────────────────── */
  let adjustedLoanMarket =
    liquidityBoost *
    approvalBoost *
    defaultRiskImpact * // Using the inverse to align with other calculations
    interestRateEffect *
    prepaymentImpact *
    processingFeeEffect *
    complianceConstraint *
    marketShareInfluence *
    marketingEffect;

  let minShare = 1 / (totalTeams * 2);
  let maxShare = 1 / totalTeams;

  let finalLoanMarketShare = Math.max(minShare, Math.min(maxShare, adjustedLoanMarket));

  console.log(`[loanMarketModel] Adjusted Market Share: ${adjustedLoanMarket}`);
  console.log(`[loanMarketModel] Final Market Share (Bounded): ${finalLoanMarketShare}`);

  return finalLoanMarketShare;
};

export const investmentMarketModel = (
  interestRate: number,
  marketingSpend: number,
  fees: number,
  productLevel: number,
  risk: number,
  commission: number,
  investmentSafeBaseVariables: { 
    investmentRisk?: number;
    averageReturnRate?: number;
    fundDiversificationScore?: number;
    redemptionRate?: number;
    taxEfficiency?: number;
    capitalFlows?: number;
    riskAversion?: number;
    marketShare?: number;
    managementFeeRate?: number;
    commissionRate?: number;
    riskAppetiteSegmentation?: {
      lowRisk?: number;
      moderateRisk?: number;
      highRisk?: number;
    };
  },
  totalTeams: number
): number => {
  // Extracting values with default fallbacks
  const {
    investmentRisk = 0.06,
    averageReturnRate = 0.07,
    fundDiversificationScore = 0.8,
    redemptionRate = 0.02,
    taxEfficiency = 0.85,
    capitalFlows = 50000, // Added default value for missing property
    riskAversion = 0.5, // Added default value for missing property
    marketShare = 0.2,
    managementFeeRate = 0.012,
    commissionRate = 0.005,
    riskAppetiteSegmentation = {
      lowRisk: 0.35,
      moderateRisk: 0.5,
      highRisk: 0.15,
    },
  } = investmentSafeBaseVariables;

  /** ──────────────────────────────────────
   *  🔹 Risk & Market Momentum Impact
   * ────────────────────────────────────── */
  let riskImpact = Math.exp(-Math.abs(risk - riskAversion) * 5); // Adjusted from funcPdf
  let marketMomentum = 1 + 0.08 * (averageReturnRate - investmentRisk); // Adjusted from marketTrend
  let capitalEffect = 1 + 0.05 * Math.log1p(capitalFlows);

  console.log(`[investmentMarketModel] Risk Impact: ${riskImpact}`);
  console.log(`[investmentMarketModel] Market Momentum: ${marketMomentum}`);
  console.log(`[investmentMarketModel] Capital Effect: ${capitalEffect}`);

  /** ──────────────────────────────────────
   *  🔹 Fees, Commissions & Redemption Effects
   * ────────────────────────────────────── */
  let feeImpact = 1 - Math.tanh((fees + managementFeeRate) * 10);
  let commissionEffect = 1 - Math.tanh(commission * 20);
  let redemptionImpact = 1 - Math.tanh(redemptionRate * 5);

  console.log(`[investmentMarketModel] Fee Impact: ${feeImpact}`);
  console.log(`[investmentMarketModel] Commission Effect: ${commissionEffect}`);
  console.log(`[investmentMarketModel] Redemption Impact: ${redemptionImpact}`);

  /** ──────────────────────────────────────
   *  🔹 Diversification, Tax Efficiency & Risk Appetite
   * ────────────────────────────────────── */
  let diversificationEffect = 1 + 0.05 * fundDiversificationScore;
  let taxEfficiencyBoost = 1 + 0.04 * taxEfficiency;

  let riskAppetiteAdjustment =
  (riskAppetiteSegmentation?.lowRisk ?? 0.35) * 0.9 +
  (riskAppetiteSegmentation?.moderateRisk ?? 0.5) * 1.0 +
  (riskAppetiteSegmentation?.highRisk ?? 0.15) * 1.2;

  console.log(`[investmentMarketModel] Diversification Effect: ${diversificationEffect}`);
  console.log(`[investmentMarketModel] Tax Efficiency Boost: ${taxEfficiencyBoost}`);
  console.log(`[investmentMarketModel] Risk Appetite Adjustment: ${riskAppetiteAdjustment}`);

  /** ──────────────────────────────────────
   *  🔹 Market Share & Marketing Influence
   * ────────────────────────────────────── */
  let marketShareInfluence = Math.pow(1 - marketShare, 1.1) * 0.8 + marketShare * 0.3;
  let marketingEffect = 1 + 0.08 * Math.log1p(marketingSpend);

  console.log(`[investmentMarketModel] Market Share Influence: ${marketShareInfluence}`);
  console.log(`[investmentMarketModel] Marketing Effect: ${marketingEffect}`);

  /** ──────────────────────────────────────
   *  📌 Final Investment Market Share Calculation
   * ────────────────────────────────────── */
  let adjustedInvestmentMarket =
    riskImpact *
    marketMomentum *
    capitalEffect *
    feeImpact *
    commissionEffect *
    redemptionImpact *
    diversificationEffect *
    taxEfficiencyBoost *
    riskAppetiteAdjustment *
    marketShareInfluence *
    marketingEffect;

  let minShare = 1 / (totalTeams * 2);
  let maxShare = 1 / totalTeams;

  let finalInvestmentMarketShare = Math.max(minShare, Math.min(maxShare, adjustedInvestmentMarket));

  console.log(`[investmentMarketModel] Adjusted Market Share: ${adjustedInvestmentMarket}`);
  console.log(`[investmentMarketModel] Final Market Share (Bounded): ${finalInvestmentMarketShare}`);

  return finalInvestmentMarketShare;
};