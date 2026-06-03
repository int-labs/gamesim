//Calculates for whole team (i.e. 5 teams)

import mongoose from "mongoose";

import BaseData from "../models/baseData";
import { TeamMarketShare, WeightedScoreInterface } from "../models/results";

export type MarketModelBatchInput = Record<
  string,
  Array<{
    teamId: mongoose.Types.ObjectId;
    value: number;
    selected?: boolean;
    globalInputType?: "full-set" | "selectable-set" | "varied";
    eventId?: mongoose.Types.ObjectId;
    chosenKey?: string;
    originalValue?: any;
  }>
>;

export const erf = (x: number) => {
  // Abramowitz and Stegun formula 7.1.26
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);

  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
};

export const mean = (arr: number[]) =>
  arr.reduce((a, b) => a + b, 0) / arr.length;
export const calcStdDev = (data: number[], tightening: number) => {
  // Filter out blanks
  const values = data.filter((v) => v !== null && v !== undefined);

  if (values.length === 0) return 1;

  // Population standard deviation
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev === 0 ? 1 : stdDev * tightening;
};

export const directionOffset = (direction: number) => (1 - direction) / 2;

export const normalCDF = (x: number, mean: number, stdDev: number) => {
  const z = (x - mean) / (Math.sqrt(2) * stdDev);
  return 0.5 * (1 + erf(z));
};
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const defaultTightening = 3;

export async function simMm({
  inputs,
  segmentInputs,
  globalInputs,
  year,
  segmentId,
  productId,
  simulationTypeId,
}: {
  inputs: MarketModelBatchInput;
  segmentInputs: MarketModelBatchInput;
  globalInputs: MarketModelBatchInput;
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  year: number;
  simulationTypeId: mongoose.Types.ObjectId;
}): Promise<{
  weightedScores: WeightedScoreInterface[];
  sharesNormalCDF: TeamMarketShare[];
}> {
  const baseData = await BaseData.findOne({ simulationTypeId });

  if (!baseData) {
    throw new Error("Base data not found for simulation type");
  }

  // Find the segment and product in marketModel
  const segment = baseData.marketModel.segments.find((s) =>
    s.segmentId.equals(segmentId)
  );

  if (!segment) {
    throw new Error("Segment not found in market model");
  }

  const product = segment.products.find((p) => p.productId.equals(productId));

  if (!product) {
    throw new Error("Product not found in market model");
  }

  // Get coefficients for the year
  const weights: Record<string, number> = {};

  product.fields.forEach((field) => {
    const coefficient = field.coefficients[year.toString()];

    if (coefficient !== undefined && field.key !== "projected_market_share") {
      weights[field.key] = coefficient;
    }
  });

  product.segmentFields.forEach((field) => {
    const coefficient = field.coefficients[year.toString()];

    weights[field.key] = coefficient;
  });

  /**
   * IMPORTANT: Conflicting Keys Warning
   * If the same key exists in multiple levels (e.g., "packaging" in both global and product levels),
   * the later loops will overwrite the earlier ones in the 'weights', 'means', and 'stdDevs' maps.
   * This logic assumes keys are unique across all levels.
   */

  // iterate again for global fields
  product.globalFields.forEach((field) => {
    const coefficient = field.coefficients[year.toString()];

    if (coefficient !== undefined) {
      weights[field.key] = coefficient;
    }
  });

  // Need to loop for total of teams
  const numberOfTeams = Object.values(inputs)[0]?.length || 0;

  if (numberOfTeams === 0) {
    throw new Error("No input data provided");
  }

  const means: Record<string, number> = {};
  const stdDevs: Record<string, number> = {};

  Object.entries(inputs).forEach(([key, values]) => {
    if (key !== "projected_market_share") {
      means[key] = mean(values.map((v) => v.value));

      const tightening = product.fields.find(
        (field) => field.key === key
      )?.tightening;

      if (tightening && tightening > 0) {
        stdDevs[key] = calcStdDev(
          values.map((v) => v.value),
          tightening
        );
      } else {
        stdDevs[key] = calcStdDev(
          values.map((v) => v.value),
          defaultTightening
        );
      }
    }
  });

  Object.entries(segmentInputs).forEach(([key, values]) => {
    if (key !== "projected_market_share") {
      means[key] = mean(values.map((v) => v.value));

      const tightening = product.segmentFields.find(
        (field) => field.key === key
      )?.tightening;

      if (tightening && tightening > 0) {
        stdDevs[key] = calcStdDev(
          values.map((v) => v.value),
          tightening
        );
      } else {
        stdDevs[key] = calcStdDev(
          values.map((v) => v.value),
          defaultTightening
        );
      }
    }
  });

  Object.entries(globalInputs).forEach(([key, values]) => {
    means[key] = mean(values.map((v) => v.value));

    const tightening = product.globalFields.find(
      (field) => field.key === key
    )?.tightening;

    if (tightening && tightening > 0) {
      stdDevs[key] = calcStdDev(
        values.map((v) => v.value),
        tightening
      );
    } else {
      stdDevs[key] = calcStdDev(
        values.map((v) => v.value),
        defaultTightening
      );
    }
  });

  const fieldContributions = product.fields
    .filter((field) => field.key !== "projected_market_share")
    .map((field) => {
      const coefficient = field.coefficients[year.toString()];
      if (coefficient === undefined) return null;

      return {
        fieldKey: field.key,
        fieldLabel: field.label,
        coefficient,
        teamValues: inputs[field.key].map((value) => {
          const score =
            (directionOffset(field.direction) +
              normalCDF(value.value, means[field.key], stdDevs[field.key]) *
                field.direction) *
            coefficient;

          return {
            teamId: value.teamId,
            originalDecisionValue: value.value,
            score: isNaN(score) ? 0 : score,
          };
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const segmentFieldContributions = product.segmentFields
    .filter((field) => field.key !== "projected_market_share")
    .map((field) => {
      const coefficient = field.coefficients[year.toString()];
      if (coefficient === undefined) return null;

      return {
        fieldKey: field.key,
        fieldLabel: field.label,
        coefficient,
        teamValues: (segmentInputs[field.key] || []).map((value) => {
          const score =
            (directionOffset(field.direction) +
              normalCDF(value.value, means[field.key], stdDevs[field.key]) *
                field.direction) *
            coefficient;

          return {
            teamId: value.teamId,
            originalDecisionValue: value.value,
            score: isNaN(score) ? 0 : score,
          };
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const globalFieldContributions = product.globalFields
    .filter((field) => field.key !== "projected_market_share")
    .map((field) => {
      const coefficient = field.coefficients[year.toString()];
      if (coefficient === undefined) return null;

      return {
        fieldKey: field.key,
        fieldLabel: field.label,
        coefficient,
        teamValues: (globalInputs[field.key] || []).map((value) => {
          const fieldValue = value.value;

          const score =
            (directionOffset(field.direction) +
              normalCDF(fieldValue || 0, means[field.key], stdDevs[field.key]) *
                field.direction) *
            coefficient;

          return {
            teamId: value.teamId,
            originalDecisionValue: fieldValue,
            score: isNaN(score) ? 0 : score,
          };
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // let weightedScores: Record<string, number> = {};
  let weightedScoresNormalCDF: Record<string, number> = {};

  // let shares: Array<{ teamId: mongoose.Types.ObjectId; value: number }> = [];

  let sharesNormalCDF: Array<{
    teamId: mongoose.Types.ObjectId;
    value: number;
  }> = [];

  fieldContributions.forEach((field) => {
    field?.teamValues.forEach((teamValue) => {
      // if (!weightedScores[teamValue.teamId.toString()]) {
      //   weightedScores[teamValue.teamId.toString()] = 0;
      // }

      if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
        weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
      }

      // weightedScores[teamValue.teamId.toString()] += teamValue.weightedScore;
      weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
    });
  });

  segmentFieldContributions.forEach((field) => {
    field?.teamValues.forEach((teamValue) => {
      if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
        weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
      }

      weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
    });
  });

  globalFieldContributions.forEach((field) => {
    field?.teamValues.forEach((teamValue) => {
      if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
        weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
      }

      if (typeof teamValue.score === "number" && !isNaN(teamValue.score)) {
        weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
      }
    });
  });

  // const totalWeightedScoreEveryTeam: Array<{
  //   teamId: mongoose.Types.ObjectId;
  //   weightedScore: number;
  // }> = Object.entries(weightedScores).map(([teamId, weightedScore]) => ({
  //   teamId: new mongoose.Types.ObjectId(teamId),
  //   weightedScore,
  // }));

  const totalWeightedScoreEveryTeamNormalCDF: Array<{
    teamId: mongoose.Types.ObjectId;
    weightedScore: number;
  }> = Object.entries(weightedScoresNormalCDF).map(
    ([teamId, weightedScore]) => ({
      teamId: new mongoose.Types.ObjectId(teamId),
      weightedScore,
    })
  );

  // Object.entries(weightedScores).forEach(([teamId, weightedScore]) => {
  //   const share =
  //     weightedScore /
  //     totalWeightedScoreEveryTeam.reduce(
  //       (acc, curr) => acc + curr.weightedScore,
  //       0
  //     );
  //   shares.push({ teamId: new mongoose.Types.ObjectId(teamId), value: share });
  // });

  Object.entries(weightedScoresNormalCDF).forEach(([teamId, score]) => {
    const shareNormalCDF =
      score /
      totalWeightedScoreEveryTeamNormalCDF.reduce(
        (acc, curr) => acc + curr.weightedScore,
        0
      );

    const nonNaNShareNormalCDF = isNaN(shareNormalCDF) ? 0 : shareNormalCDF;

    sharesNormalCDF.push({
      teamId: new mongoose.Types.ObjectId(teamId),
      value: nonNaNShareNormalCDF,
    });
  });

  // deposit retail mass => 680601165499d4f75673f96b
  // private banking service affluent => 681715d993904e857289ced0
  if (
    productId.equals(new mongoose.Types.ObjectId("681715d993904e857289ced0"))
  ) {
    // console.log("fieldContributions", fieldContributions);
    // console.log("segmentFieldContributions", segmentFieldContributions);
    // console.log("globalFieldContributions", globalFieldContributions);
    // console.log("weightedScoresNormalCDF", weightedScoresNormalCDF);
    // console.log(
    //   "totalWeightedScoreEveryTeamNormalCDF",
    //   totalWeightedScoreEveryTeamNormalCDF
    // );
    // console.log("sharesNormalCDF", sharesNormalCDF);
  }

  return {
    weightedScores: [
      ...fieldContributions,
      ...segmentFieldContributions,
      ...globalFieldContributions,
    ],
    sharesNormalCDF,
  };
}
