import mongoose from "mongoose";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketModelField {
  key:          string;
  label:        string;
  formula?:     string;
  type?:        string;
  level?:       "global" | "segment" | "product" | "subproduct" | "dynamic";
  direction:    number;
  tightening:   number;
  elasticity?:  number;
  coefficients: Record<string, number>;
}

export interface MarketModelProduct {
  productId:     mongoose.Types.ObjectId;
  fields:        MarketModelField[];
  segmentFields: MarketModelField[];
  globalFields:  MarketModelField[];
}

export interface ProductField {
  _id:          mongoose.Types.ObjectId;
  key:          string;
  label:        string;
  type:         string;
  order:        number;
  required:     boolean;
  minValue:     number | null;
  maxValue:     number | null;
  direction:    number;
  tightening:   number;
  coefficients: Record<string, number>;
}

export interface DecisionField {
  fieldId: mongoose.Types.ObjectId;
  value:   number | string | null;
}

export interface DecisionProductInput {
  productId: mongoose.Types.ObjectId;
  fields:    DecisionField[];
}

export interface DecisionDocument {
  teamId: mongoose.Types.ObjectId;
  inputs: DecisionProductInput[];
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

// ─── Math Utilities (unchanged) ──────────────────────────────────────────────

export const erf = (x: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t    = 1 / (1 + p * absX);
  const y    = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
};

export const mean = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;

export const calcStdDev = (data: number[], tightening: number): number => {
  const values = data.filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return 1;
  const avg      = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev   = Math.sqrt(variance);
  return stdDev === 0 ? 1 : stdDev * tightening;
};

export const directionOffset = (direction: number): number => (1 - direction) / 2;

export const normalCDF = (x: number, avg: number, stdDev: number): number => {
  const z = (x - avg) / (Math.sqrt(2) * stdDev);
  return 0.5 * (1 + erf(z));
};

export const DEFAULT_TIGHTENING = 3;

// ─── Core Calculation ────────────────────────────────────────────────────────

export function calcMarketModel(input: CalcMarketModelInput): CalcMarketModelOutput {
  const { marketModelProduct, productFields, decisions, year } = input;
  const yearKey = year.toString();

  const productDecisions = decisions
    .map((d) => {
      const productInput = d.inputs.find((inp) => inp.productId.equals(marketModelProduct.productId));
      return productInput ? { teamId: d.teamId, productInput } : null;
    })
    .filter((d): d is { teamId: mongoose.Types.ObjectId; productInput: DecisionProductInput } => d !== null);

  if (productDecisions.length === 0) {
    return { weightedScores: [], sharesNormalCDF: [] };
  }

  const teamIds = productDecisions.map((d) => d.teamId);

  // Decision fields are keyed by fieldId (ProductField._id), not string key.
  const getInput = (teamId: mongoose.Types.ObjectId, fieldKey: string): number => {
    const pf = productFields.find((f) => f.key === fieldKey);
    if (!pf) return 0;

    const decision   = productDecisions.find((d) => d.teamId.equals(teamId));
    const fieldEntry = decision?.productInput.fields.find((f) => f.fieldId.equals(pf._id));
    const raw        = Number(fieldEntry?.value ?? 0);

    let clamped = raw;
    if (pf.minValue !== null) clamped = Math.max(clamped, pf.minValue);
    if (pf.maxValue !== null) clamped = Math.min(clamped, pf.maxValue);
    return clamped;
  };

  // Product-level: scored from each team's decision input, using
  // ProductField for direction/tightening/coefficients.
  const buildProductFieldContributions = (
    mmFields: MarketModelField[]
  ): { contributions: FieldContribution[]; teamTotals: Record<string, number> } => {
    const contributions: FieldContribution[] = [];
    const teamTotals: Record<string, number> = {};

    for (const mmField of mmFields) {
      if (mmField.key === "projected_market_share") continue;

      const pf = productFields.find((f) => f.key === mmField.key);
      if (!pf) continue;

      const coefficient = pf.coefficients[yearKey];
      if (coefficient === undefined || coefficient === 0) continue;

      const tightening = pf.tightening > 0 ? pf.tightening : DEFAULT_TIGHTENING;
      const allValues   = teamIds.map((tid) => getInput(tid, mmField.key));
      const avg          = mean(allValues);
      const stdDev        = calcStdDev(allValues, tightening);

      const teamValues: TeamValue[] = teamIds.map((teamId) => {
        const originalDecisionValue = getInput(teamId, mmField.key);
        const score =
          (directionOffset(pf.direction) + normalCDF(originalDecisionValue, avg, stdDev) * pf.direction) *
          coefficient;
        const safeScore = isNaN(score) ? 0 : score;
        const tidStr     = teamId.toString();
        teamTotals[tidStr] = (teamTotals[tidStr] ?? 0) + safeScore;
        return { teamId, originalDecisionValue, score: safeScore };
      });

      contributions.push({ fieldKey: mmField.key, fieldLabel: mmField.label, coefficient, teamValues });
    }

    return { contributions, teamTotals };
  };

  // Segment/global-level: ASSUMPTION — no per-team decision exists at this
  // scope, so each field's coefficient (from MarketModelField itself) is
  // applied identically to every team, rather than scored via normalCDF
  // against a distribution of team-specific values. Confirm this is right.
  const buildEmbeddedContributions = (
    mmFields: MarketModelField[]
  ): { contributions: FieldContribution[]; teamTotals: Record<string, number> } => {
    const contributions: FieldContribution[] = [];
    const teamTotals: Record<string, number> = {};

    for (const mmField of mmFields) {
      const coefficient = mmField.coefficients?.[yearKey];
      if (coefficient === undefined || coefficient === 0) continue;

      const teamValues: TeamValue[] = teamIds.map((teamId) => {
        const tidStr = teamId.toString();
        teamTotals[tidStr] = (teamTotals[tidStr] ?? 0) + coefficient;
        return { teamId, originalDecisionValue: 0, score: coefficient };
      });

      contributions.push({ fieldKey: mmField.key, fieldLabel: mmField.label, coefficient, teamValues });
    }

    return { contributions, teamTotals };
  };

  const { contributions: productContributions, teamTotals: productTotals } =
    buildProductFieldContributions(marketModelProduct.fields);
  const { contributions: segmentContributions, teamTotals: segmentTotals } =
    buildEmbeddedContributions(marketModelProduct.segmentFields);
  const { contributions: globalContributions, teamTotals: globalTotals } =
    buildEmbeddedContributions(marketModelProduct.globalFields);

  const weightedScoresNormalCDF: Record<string, number> = {};
  for (const tidStr of teamIds.map((t) => t.toString())) {
    weightedScoresNormalCDF[tidStr] =
      (productTotals[tidStr] ?? 0) + (segmentTotals[tidStr] ?? 0) + (globalTotals[tidStr] ?? 0);
  }

  const totalScore = Object.values(weightedScoresNormalCDF).reduce((a, b) => a + b, 0);

  const sharesNormalCDF: TeamShare[] = teamIds.map((teamId) => {
    const tidStr   = teamId.toString();
    const rawShare = totalScore === 0 ? 0 : (weightedScoresNormalCDF[tidStr] ?? 0) / totalScore;

    const pmsRaw = getInput(teamId, "projected_market_share");
    const pms    = Math.min(Math.max(pmsRaw, 0), 100) / 100;
    const normalisedPms = teamIds.length === 0 ? 0 : pms / (1 / teamIds.length);

    const actualShare = Math.min(isNaN(rawShare) ? 0 : rawShare * normalisedPms, 1);
    return { teamId, value: actualShare };
  });

  return {
    weightedScores: [...productContributions, ...segmentContributions, ...globalContributions],
    sharesNormalCDF,
  };
}