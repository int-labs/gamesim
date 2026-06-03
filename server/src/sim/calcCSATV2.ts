import mongoose from "mongoose";

import BaseData from "../models/baseData";
import { CSATScoreInterface } from "../models/results";
import { MarketModelBatchInput } from "./calcMm";

//Import paramList

// interface TeamCSAT {
//   teamId: mongoose.Types.ObjectId;
//   openingCSAT: number;
//   closingCSAT: number;
// }

function calculateScoreAddition(
  currentTeamValue: number,
  allTeamValues: number[],
  multiplier: number
) {
  // currentValue: the value for the current team (E6)
  // allValues: array of values for all teams (E6:I6)
  // multiplier: percentage addition (D6)

  // Rank in descending order (highest = rank 1)
  const sorted = [...allTeamValues]
    .filter((v) => v !== null && v !== undefined)
    .sort((a, b) => b - a);
  const rank = sorted.indexOf(currentTeamValue) + 1;

  return (3.5 - rank) * multiplier;
}

export async function calcCSATV2({
  inputs,
  segmentInputs,
  year,
  segmentId,
  simulationTypeId,
  globalInputs,
  eventInputs,
  openingCSAT = [],
  numberOfTeams,
  manualAdjustment,
  teamIds,
  eventsTriggered = [],
}: {
  inputs: MarketModelBatchInput;
  segmentInputs: MarketModelBatchInput;
  globalInputs: MarketModelBatchInput;
  eventInputs: MarketModelBatchInput;
  eventsTriggered: string[];
  segmentId: mongoose.Types.ObjectId;
  year: number;
  simulationTypeId: mongoose.Types.ObjectId;
  openingCSAT?: Array<{
    teamId: mongoose.Types.ObjectId;
    score: number;
  }>;
  numberOfTeams: number;
  manualAdjustment?: Record<string, number>;
  teamIds: mongoose.Types.ObjectId[];
}): Promise<{
  //   weightedScores: WeightedScoreInterface[];
  csatScores: CSATScoreInterface[];
  csatUnderTeams: {
    teamId: mongoose.Types.ObjectId;
    segmentId: mongoose.Types.ObjectId;
    opening: number;
    closing: number;
  }[];
  csatDrivers: Array<{
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
  }>;
}> {
  const baseData = await BaseData.findOne({ simulationTypeId }).populate(
    "csatMarketModel.segments.drivers.globalInput"
  );

  if (!baseData) {
    throw new Error("Base data not found for simulation type");
  }

  // Find the segment in marketModel
  const segment = baseData.csatMarketModel?.segments.find((s) =>
    s.segmentId.equals(segmentId)
  );

  if (!segment) {
    throw new Error("Segment not found in market model");
  }

  if (numberOfTeams === 0) {
    throw new Error("No input data provided");
  }

  const weights: Record<string, number> = {};

  const drivers = segment.drivers;

  const perTeamCSAT: Array<{
    teamId: mongoose.Types.ObjectId;
    segmentId: mongoose.Types.ObjectId;
    opening: number;
    closing: number;
  }> = [];

  teamIds.forEach((teamId) => {
    perTeamCSAT.push({
      teamId,
      segmentId,
      opening:
        openingCSAT.find((o) => o.teamId.toString() === teamId.toString())
          ?.score ?? 0.6,
      closing: 0,
    });
  });

  const overallContributions = drivers.map((driver) => {
    if (driver.level === "segment") {
      const coefficient = driver.coefficients[year.toString()] ?? 0.005;
      if (coefficient === undefined) return null;

      // (segmentInputs[driver.key] || []).forEach((value, index, arr) => {
      //   const score = calculateScoreAddition(
      //     value.value,
      //     arr.map((v) => v.value),
      //     coefficient
      //   );
      // });

      return {
        fieldKey: driver.key,
        fieldLabel: driver.label,
        coefficient,
        decisionType: "segment",
        teamValues: (segmentInputs[driver.key] || []).map(
          (value, index, arr) => {
            const score = calculateScoreAddition(
              value.value,
              arr.map((v) => v.value),
              coefficient
            );

            return {
              teamId: value.teamId,
              originalDecisionValue: value.value,
              score: isNaN(score) ? 0 : score,
            };
          }
        ),
      };
    }

    if (driver.level === "product") {
      const coefficient = driver.coefficients[year.toString()] ?? 0.005;
      if (coefficient === undefined) return null;

      return {
        fieldKey: driver.key,
        fieldLabel: driver.label,
        coefficient,
        decisionType: "product",
        teamValues: (inputs[driver.key] || []).map((value, index, arr) => {
          const score = calculateScoreAddition(
            value.value,
            arr.map((v) => v.value),
            coefficient
          );

          return {
            teamId: value.teamId,
            originalDecisionValue: value.value,
            score: isNaN(score) ? 0 : score,
          };
        }),
      };
    }

    if (driver.level === "global") {
      const coefficient = driver.coefficients[year.toString()] ?? 0.005;
      if (coefficient === undefined) return null;

      return {
        fieldKey: driver.key,
        fieldLabel: driver.label,
        coefficient,
        decisionType:
          driver.globalInput?.key === "tech_ops"
            ? "tech_ops"
            : driver.globalInput?.key === "initiatives"
              ? "initiatives"
              : "global",
        teamValues: (globalInputs[driver.key] || []).map(
          (value, index, arr) => {
            const score =
              value.globalInputType === "selectable-set"
                ? value.selected
                  ? coefficient
                  : 0
                : calculateScoreAddition(
                    value.value ? value.value : 0,
                    arr.map((v) => (v.value ? v.value : 0)),
                    coefficient
                  );

            return {
              teamId: value.teamId,
              originalDecisionValue: value.selected
                ? 1
                : value.value
                  ? value.value
                  : 0,
              score: isNaN(score) ? 0 : score,
            };
          }
        ),
      };
    }

    if (driver.level === "event") {
      const coefficient = driver.coefficients[year.toString()] ?? 0;
      if (coefficient === undefined) return null;

      return {
        fieldKey: `${driver.eventId}_${driver.choiceKey}`,
        fieldLabel: driver.label,
        coefficient,
        decisionType: "event",
        teamValues: teamIds.map((teamId) => {
          const isEventTriggered = eventsTriggered.includes(
            driver.eventId?.toString() ?? ""
          );
          const currentTeamAnswer =
            eventInputs[`${driver.eventId}_${driver.choiceKey}`]?.find(
              (v) => v.teamId.toString() === teamId.toString()
            )?.chosenKey || "";
          const currentTeamScore = coefficient;

          if (isEventTriggered && currentTeamAnswer !== "") {
            return {
              teamId,
              originalDecisionValue: 0,
              originalDecisionValueString: `${driver.eventId}_${currentTeamAnswer}`,
              score: currentTeamScore,
            };
          }

          return {
            teamId,
            originalDecisionValue: 0,
            score: 0,
          };
        }),
      };
    }
  });

  // const fieldContributions = Object.entries(inputs)
  //   .filter(([key]) => key !== "projected_market_share")
  //   .map(([key, values]) => {
  //     const coefficient = weights[key];
  //     if (coefficient === undefined) return null;

  //     return {
  //       fieldKey: key,
  //       fieldLabel: key, // You might want to add proper labels
  //       coefficient,
  //       decisionType: "product",
  //       teamValues: values.map((value) => {
  //         // Simple linear scoring: value * coefficient
  //         const score = value.value * coefficient;

  //         return {
  //           teamId: value.teamId,
  //           originalDecisionValue: value.value,
  //           score: isNaN(score) ? 0 : score,
  //         };
  //       }),
  //     };
  //   })
  //   .filter((item): item is NonNullable<typeof item> => item !== null);

  // const globalFieldContributions = Object.entries(globalInputs)
  //   .filter(([key]) => key !== "projected_market_share")
  //   .map(([key, values]) => {
  //     const coefficient = weights[key] ?? 0.005;
  //     if (coefficient === undefined) return null;

  //     return {
  //       fieldKey: key,
  //       fieldLabel: key, // You might want to add proper labels
  //       coefficient,
  //       teamValues: values.map((value, index, arr) => {
  //         const score = calculateScoreAddition(
  //           value.value,
  //           arr.map((v) => v.value),
  //           coefficient
  //         );

  //         return {
  //           teamId: value.teamId,
  //           originalDecisionValue: value.value,
  //           score: isNaN(score) ? 0 : score,
  //         };
  //       }),
  //     };
  //   })
  //   .filter((item): item is NonNullable<typeof item> => item !== null);

  let weightedScoresNormalCDF: Record<string, number> = {};

  // Calculate total scores for each team
  overallContributions.forEach((field) => {
    field?.teamValues.forEach((teamValue) => {
      if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
        weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
      }

      weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
    });
  });

  // not yet applied
  // fieldContributions.forEach((field) => {
  //   field.teamValues.forEach((teamValue) => {
  //     if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
  //       weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
  //     }

  //     weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
  //   });
  // });

  // globalFieldContributions.forEach((field) => {
  //   field.teamValues.forEach((teamValue) => {
  //     if (!weightedScoresNormalCDF[teamValue.teamId.toString()]) {
  //       weightedScoresNormalCDF[teamValue.teamId.toString()] = 0;
  //     }

  //     if (typeof teamValue.score === "number" && !isNaN(teamValue.score)) {
  //       weightedScoresNormalCDF[teamValue.teamId.toString()] += teamValue.score;
  //     }
  //   });
  // });

  // console.log("globalFieldContributions", globalFieldContributions);

  // Calculate CSAT scores for each team
  const csatScores: CSATScoreInterface[] = Object.entries(
    weightedScoresNormalCDF
  ).map(([teamId, score]) => {
    const openingCSATFromArray =
      openingCSAT.find((o) => o.teamId.toString() === teamId)?.score ?? 0.6;

    const scoreAfterManualAdjustment =
      score + (manualAdjustment?.[teamId] ?? 0);

    const boundedOpeningCSAT = Math.max(0, Math.min(1, openingCSATFromArray));
    const closingCSAT = Math.max(
      0,
      Math.min(1, boundedOpeningCSAT + scoreAfterManualAdjustment)
    ); // Example: opening + additional influence

    const csatUnderTeam = perTeamCSAT.find(
      (e) => e.teamId.toString() === teamId
    );

    if (csatUnderTeam) {
      csatUnderTeam.closing = closingCSAT;
    }

    return {
      teamId: new mongoose.Types.ObjectId(teamId),
      openingCSAT: boundedOpeningCSAT,
      closingCSAT: closingCSAT,
    };
  });

  // console.log("csatScores", csatScores);

  return {
    // weightedScores: [...fieldContributions, ...globalFieldContributions],
    csatScores,
    csatUnderTeams: perTeamCSAT,
    csatDrivers: overallContributions
      .filter((driver): driver is NonNullable<typeof driver> => driver !== null)
      .map((driver) => ({
        ...driver,
        segmentId,
      })),
  };
}
