import mongoose from "mongoose";
import { DecisionInterface } from "../models/decisions";
import { BaseDataInterface } from "../models/baseData";

/**
 * Calculate the CSAT score based on global decision details, with support for manual adjustments and flexible opening CSAT.
 * 
 * @param decision - The decision object containing globalDecisionDetails
 * @param baseData - Base data containing CSAT coefficients/weights
 * @param allTeamsGlobalDecisionDetails - Array of all teams' globalDecisionDetails for the round, as { [driver]: string }
 * @param options - Optional: { manualAdjustments, openingCSAT, year }
 * @returns The calculated CSAT score (0-100)
 */
export const calcCSAT = (
  decision: DecisionInterface,
  baseData: BaseDataInterface,
  allTeamsGlobalDecisionDetails: Array<{ [driver: string]: number }> = [],
  options?: {
    manualAdjustments?: Record<string, number>,
    openingCSAT?: number,
    year?: string
  }
): number => {
  const manualAdjustments = options?.manualAdjustments || {};
  // Use provided openingCSAT, or default 60
  const openingCSAT = options?.openingCSAT ?? 60;
  // Use provided year, or from decision, or default "1"
  const year = options?.year || decision.roundNumber?.toString() || "1";

  // Look up CSAT coefficients from baseData
  const csatCoefficients = baseData.csatData?.[year] || {};


  let totalImpact = 0;
  // Process each driver from globalDecisionDetails
  for (const detail of (decision.globalDecisionDetails || [])) {
    const driver = detail.key;
    const rating = detail.value ?? 0;
    
    // Calculate rank (1-based, where 1 is best)
    const rank = allTeamsGlobalDecisionDetails.filter(
      teamRatings => (teamRatings[driver] ?? 0) > rating
    ).length + 1;
    
    // Use coefficient from csatData, fallback to 0.05 if missing
    const coefficient = csatCoefficients[driver] ?? 0.05;
    
    // Calculate raw impact: (3.5 - RANK) * coefficient
    let impact = (3.5 - rank) * coefficient;
    
    // Add manual adjustment if present
    if (manualAdjustments[driver]) {
      impact += manualAdjustments[driver];
    }
    
    totalImpact += impact;
  }

  let closingCSAT = openingCSAT + totalImpact;
  closingCSAT = Math.max(0, Math.min(100, closingCSAT));
  return closingCSAT;
};