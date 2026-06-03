import mongoose from "mongoose";

import BaseData from "../models/baseData";
import { ESATScoreInterface } from "../models/results";
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

export async function calcESAT({
  inputs,
  segmentInputs,
  globalInputs,
  eventInputs,
  year,
  segmentId,
  simulationTypeId,
  openingESAT = [],
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
  openingESAT?: Array<{
    teamId: mongoose.Types.ObjectId;
    score: number;
  }>;
  numberOfTeams: number;
  manualAdjustment?: Record<string, number>;
  teamIds: mongoose.Types.ObjectId[];
}): Promise<{
  //   weightedScores: WeightedScoreInterface[];
  esatScores: ESATScoreInterface[];
  esatUnderTeams: {
    teamId: mongoose.Types.ObjectId;
    segmentId: mongoose.Types.ObjectId;
    opening: number;
    closing: number;
  }[];
  esatDrivers: Array<{
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
    "esatMarketModel.segments.drivers.globalInput"
  );

  if (!baseData) {
    throw new Error("Base data not found for simulation type");
  }

  // Find the segment in marketModel
  const segment = baseData.esatMarketModel?.segments.find((s) =>
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

  const perTeamESAT: Array<{
    teamId: mongoose.Types.ObjectId;
    segmentId: mongoose.Types.ObjectId;
    opening: number;
    closing: number;
  }> = [];

  teamIds.forEach((teamId) => {
    perTeamESAT.push({
      teamId,
      segmentId,
      opening:
        openingESAT.find((o) => o.teamId.toString() === teamId.toString())
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

  const fieldContributions = Object.entries(inputs)
    .filter(([key]) => key !== "projected_market_share")
    .map(([key, values]) => {
      const coefficient = weights[key];
      if (coefficient === undefined) return null;

      return {
        fieldKey: key,
        fieldLabel: key, // You might want to add proper labels
        coefficient,
        teamValues: values.map((value) => {
          // Simple linear scoring: value * coefficient
          const score = value.value * coefficient;

          return {
            teamId: value.teamId,
            originalDecisionValue: value.value,
            score: isNaN(score) ? 0 : score,
          };
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

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

  let weightedScoreArray = Object.entries(weightedScoresNormalCDF).map(
    ([teamId, score]) => {
      return {
        teamId: teamId,
        score: score,
      };
    }
  );

  if (weightedScoreArray.length === 0) {
    weightedScoreArray = teamIds.map((teamId) => {
      return {
        teamId: teamId.toString(),
        score: 0,
      };
    });
  }

  // Calculate ESAT scores for each team
  const esatScores: ESATScoreInterface[] = weightedScoreArray.map(
    ({ teamId, score }) => {
      const openingESATFromArray =
        openingESAT.find((o) => o.teamId.toString() === teamId)?.score ?? 0.6;

      const scoreAfterManualAdjustment =
        score + (manualAdjustment?.[teamId] ?? 0);

      const boundedOpeningESAT = Math.max(0, Math.min(1, openingESATFromArray));
      const closingESAT = Math.max(
        0,
        Math.min(1, boundedOpeningESAT + scoreAfterManualAdjustment)
      ); // Example: opening + additional influence

      const esatUnderTeam = perTeamESAT.find(
        (e) => e.teamId.toString() === teamId
      );

      if (esatUnderTeam) {
        esatUnderTeam.closing = closingESAT;
      }

      return {
        teamId: new mongoose.Types.ObjectId(teamId),
        openingESAT: boundedOpeningESAT,
        closingESAT: closingESAT,
      };
    }
  );

  // console.log("esatScores", esatScores);

  return {
    // weightedScores: [...fieldContributions, ...globalFieldContributions],
    esatScores,
    esatUnderTeams: perTeamESAT,
    esatDrivers: overallContributions
      .filter((driver): driver is NonNullable<typeof driver> => driver !== null)
      .map((driver) => ({
        ...driver,
        segmentId,
      })),
  };
}
