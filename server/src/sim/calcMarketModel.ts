import mongoose from "mongoose";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketModelField {
  key:         string;
  label:       string;
  formula?:    string;
  type?:       string;
  elasticity?: number;
  level?:      "global" | "segment" | "product" | "dynamic";
}

export interface MarketModelProduct {
  productId:     mongoose.Types.ObjectId;
  fields:        MarketModelField[];
  segmentFields: MarketModelField[];
  globalFields:  MarketModelField[];
}

export interface MarketModelSegment {
  segmentId: mongoose.Types.ObjectId;
  products:  MarketModelProduct[];
}

export interface ProductField {
  _id?:         mongoose.Types.ObjectId;
  key:          string;
  label:        string;
  type:         string;
  order:        number;
  required:     boolean;
  minValue:     number | null;
  maxValue:     number | null;
  direction:    "higher" | "lower";
  tightening:   number;
  coefficients: Record<string, number>;
}

export interface MarketDataYearly {
  marketSize: number;
}

export interface MarketDataProduct {
  productId:  mongoose.Types.ObjectId;
  yearlyData: Record<string, MarketDataYearly>;
}

export interface MarketDataSegment {
  segmentId: mongoose.Types.ObjectId;
  products:  MarketDataProduct[];
}

export interface DecisionDocument {
  teamId:    mongoose.Types.ObjectId;
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  inputs:    Record<string, number>;
}

export interface TeamValue {
  teamId:                mongoose.Types.ObjectId;
  originalDecisionValue: number;
  score:                 number;
}

export interface FieldContribution {
  fieldKey:    string;
  fieldLabel:  string;
  coefficient: number;
  teamValues:  TeamValue[];
}

export interface TeamShare {
  teamId: mongoose.Types.ObjectId;
  value:  number;
}

export interface CalcMarketModelInput {
  marketModelProduct: MarketModelProduct;
  productFields:      ProductField[];
  decisions:          DecisionDocument[];
  year:               number;
}

export interface CalcMarketModelOutput {
  weightedScores:  FieldContribution[];
  sharesNormalCDF: TeamShare[];
}

// ─── Math Utilities ──────────────────────────────────────────────────────────

export const erf = (x: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p  = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t    = 1 / (1 + p * absX);
  const y    =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return sign * y;
};

export const mean = (arr: number[]): number =>
  arr.reduce((a, b) => a + b, 0) / arr.length;

export const calcStdDev = (data: number[], tightening: number): number => {
  const values = data.filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return 1;

  const avg      = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev   = Math.sqrt(variance);

  return stdDev === 0 ? 1 : stdDev * tightening;
};

export const directionOffset = (direction: number): number =>
  (1 - direction) / 2;

export const normalCDF = (x: number, avg: number, stdDev: number): number => {
  const z = (x - avg) / (Math.sqrt(2) * stdDev);
  return 0.5 * (1 + erf(z));
};

export const DEFAULT_TIGHTENING = 3;

// ─── Core Calculation ────────────────────────────────────────────────────────

export function calcMarketModel(
  input: CalcMarketModelInput
): CalcMarketModelOutput {
  const { marketModelProduct, productFields, decisions, year } = input;
  const yearKey = year.toString();

  // ── Decisions for this product + segment ─────────────────────────────────
  const productDecisions = decisions.filter((d) =>
    d.productId.equals(marketModelProduct.productId)
  );

  if (productDecisions.length === 0) {
    return { weightedScores: [], sharesNormalCDF: [] };
  }

  const teamIds = productDecisions.map((d) => d.teamId);

  // ── Input resolver ────────────────────────────────────────────────────────
  const getInput = (
    teamId:   mongoose.Types.ObjectId,
    fieldKey: string
  ): number => {
    const decision = productDecisions.find((d) => d.teamId.equals(teamId));
    const raw      = decision?.inputs?.[fieldKey] ?? 0;

    // clamp against productField minValue/maxValue if defined
    const pf = productFields.find((f) => f.key === fieldKey);
    if (!pf) return raw;

    let clamped = raw;
    if (pf.minValue !== null) clamped = Math.max(clamped, pf.minValue);
    if (pf.maxValue !== null) clamped = Math.min(clamped, pf.maxValue);
    return clamped;
  };

  // ── Helper: resolve direction as numeric (higher = 1, lower = -1) ────────
  const resolveDirection = (direction: "higher" | "lower"): number =>
    direction === "higher" ? 1 : -1;

  // ── Helper: build field contributions for one set of fields ──────────────
  const buildContributions = (
    mmFields: MarketModelField[]
  ): {
    contributions: FieldContribution[];
    teamTotals:    Record<string, number>;
  } => {
    const contributions: FieldContribution[] = [];
    const teamTotals:    Record<string, number> = {};

    for (const mmField of mmFields) {
      if (mmField.key === "projected_market_share") continue;

      // look up calc config from productFields
      const pf = productFields.find((f) => f.key === mmField.key);
      if (!pf) continue;

      const coefficient = pf.coefficients[yearKey];
      if (coefficient === undefined || coefficient === 0) continue;

      const direction  = resolveDirection(pf.direction);
      const tightening = pf.tightening > 0 ? pf.tightening : DEFAULT_TIGHTENING;

      const allValues = teamIds.map((tid) => getInput(tid, mmField.key));
      const avg       = mean(allValues);
      const stdDev    = calcStdDev(allValues, tightening);

      const teamValues: TeamValue[] = teamIds.map((teamId) => {
        const originalDecisionValue = getInput(teamId, mmField.key);
        const score =
          (directionOffset(direction) +
            normalCDF(originalDecisionValue, avg, stdDev) * direction) *
          coefficient;

        const safeScore = isNaN(score) ? 0 : score;
        const tidStr    = teamId.toString();

        teamTotals[tidStr] = (teamTotals[tidStr] ?? 0) + safeScore;

        return { teamId, originalDecisionValue, score: safeScore };
      });

      contributions.push({
        fieldKey:   mmField.key,
        fieldLabel: mmField.label,
        coefficient,
        teamValues,
      });
    }

    return { contributions, teamTotals };
  };

  // ── Score all three field types ───────────────────────────────────────────
  const { contributions: productContributions, teamTotals: productTotals } =
    buildContributions(marketModelProduct.fields);

  const { contributions: segmentContributions, teamTotals: segmentTotals } =
    buildContributions(marketModelProduct.segmentFields);

  const { contributions: globalContributions, teamTotals: globalTotals } =
    buildContributions(marketModelProduct.globalFields);

  // ── Merge totals across all field types ───────────────────────────────────
  const weightedScoresNormalCDF: Record<string, number> = {};
  for (const tidStr of teamIds.map((t) => t.toString())) {
    weightedScoresNormalCDF[tidStr] =
      (productTotals[tidStr] ?? 0) +
      (segmentTotals[tidStr] ?? 0) +
      (globalTotals[tidStr]  ?? 0);
  }

  // ── Normalise into sharesNormalCDF ────────────────────────────────────────
  const totalScore = Object.values(weightedScoresNormalCDF).reduce(
    (a, b) => a + b,
    0
  );

  const sharesNormalCDF: TeamShare[] = teamIds.map((teamId) => {
    const tidStr   = teamId.toString();
    const rawShare =
      totalScore === 0
        ? 0
        : (weightedScoresNormalCDF[tidStr] ?? 0) / totalScore;

    // projected_market_share: team's intended capture, clamped 0–100
    const pmsRaw = getInput(teamId, "projected_market_share");
    const pms    = Math.min(Math.max(pmsRaw, 0), 100) / 100;

    // normalise against each team's equal slice (1 / numberOfTeams)
    const normalisedPms =
      teamIds.length === 0 ? 0 : pms / (1 / teamIds.length);

    const actualShare = Math.min(
      isNaN(rawShare) ? 0 : rawShare * normalisedPms,
      1
    );

    return { teamId, value: actualShare };
  });

  return {
    weightedScores: [
      ...productContributions,
      ...segmentContributions,
      ...globalContributions,
    ],
    sharesNormalCDF,
  };
}