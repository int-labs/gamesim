import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import hardcodedPastInitiatives from "../config/constants/pastInitiatives";
import BaseData from "../models/baseData";
import Decision, { DecisionInterface } from "../models/decisions"; // Mongoose model for Decision
import GlobalInput from "../models/globalInputs";
import Product, { ProductInterface } from "../models/products";
import Projection from "../models/projections";
import Result from "../models/results";
import Round from "../models/rounds";
import Segment, { SegmentInterface } from "../models/segments";
import Simulation from "../models/simulations";
import SimulationType from "../models/simulationTypes";
import Team from "../models/teams"; // Mongoose model for Team
import calcProjections, {
  BankingExtra,
  ProjectionResult,
} from "../sim/calcProjections";
import fmcgCalcProjections from "../sim/fmcg/calcProjections";
import mallManagementCalcProjections from "../sim/mallManagement/calcProjections";
import { checkProductPrerequisites } from "../utils/checkProductPrerequisites";
import { getPaginationQuery } from "../utils/paginationHelper"; // Utility for pagination queries
import { calculateReadonlyFields } from "../utils/readonlyFieldsHelper";
import { getSocket } from "../utils/socket";
import {
  getOrFetchBaseData,
  getOrFetchGlobalInputs,
  getOrFetchProducts,
  getOrFetchSegments,
  getOrFetchTeamCount,
  getPrevRoundResult,
} from "./cache";
import { processCalculations } from "./simulationControllers";

// TODO these should be in db fields
const MINIMAL_LEVEL_VALUE = 1;
const MAXIMAL_LEVEL_VALUE = 20;

// Utility to parse roundNumber into a valid number
const parseRoundNumber = (roundNumber: string): number | null => {
  const parsedNumber = Number(roundNumber);
  return isNaN(parsedNumber) ? null : parsedNumber;
};

// Build a query object dynamically based on parameters
const buildDecisionQuery = (params: {
  simulationId: string;
  roundNumber?: number;
  teamId: string;
}) => {
  const { simulationId, roundNumber, teamId } = params;
  return {
    simulationId,
    teamId,
    ...(roundNumber !== undefined && { roundNumber }),
  };
};

// Get all decisions with pagination and filtering
export const getAllDecisions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, filters } = getPaginationQuery(req);

    // Populate the relevant fields (simulationId, teamId)
    const decisions = await Decision.find(filters)
      .skip(skip)
      .limit(limit)
      .populate("simulationId") // Populate simulation reference
      .populate("teamId"); // Populate team reference

    const totalCount = await Decision.countDocuments(filters);

    res.status(200).json({
      decisions,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching decisions:", err);
    next(err);
  }
};

const createDecisionSchema = z.object({
  simulationId: z.string(),
  decisionDetails: z.array(
    z.object({
      productId: z.string(),
      segmentId: z.string(),
      fields: z.array(
        z.object({
          key: z.string(),
          value: z.number().optional(),
          textValue: z.string().optional(),
          subProductKey: z.string().optional(),
          complexValues: z
            .array(
              z.object({
                optionKey: z.string(),
                tab: z.string(),
                itemKey: z.string(),
                value: z.number(),
                textValue: z.string().optional(),
              })
            )
            .transform((cvs) => {
              if (!cvs) return cvs;
              const uniqueOptionKeys = Array.from(
                new Set(cvs.map((cv) => cv.optionKey))
              );
              const newCvs = [...cvs];
              uniqueOptionKeys.forEach((optionKey) => {
                const hasAnchor = cvs.some(
                  (cv) =>
                    cv.optionKey === optionKey &&
                    cv.tab !== "incentive" &&
                    cv.tab !== "channel" &&
                    cv.tab !== "set_your_tenant_strategy"
                );
                if (!hasAnchor) {
                  newCvs.push({
                    optionKey,
                    tab: "campaign",
                    itemKey: optionKey,
                    value: 0,
                  });
                }
              });
              return newCvs;
            })
            .optional(),
        })
      ),
      unlockRequested: z.boolean().optional().nullable(),
    })
  ),
  segmentDecisionDetails: z.array(
    z.object({
      segmentId: z.string(),
      fields: z.array(
        z.object({
          key: z.string(),
          value: z.number(),
          textValue: z.string().optional(),
          complexValues: z
            .array(
              z.object({
                optionKey: z.string(),
                tab: z.string(),
                itemKey: z.string(),
                value: z.number(),
                textValue: z.string().optional(),
              })
            )
            .transform((cvs) => {
              if (!cvs) return cvs;
              const uniqueOptionKeys = Array.from(
                new Set(cvs.map((cv) => cv.optionKey))
              );
              const newCvs = [...cvs];
              uniqueOptionKeys.forEach((optionKey) => {
                const hasAnchor = cvs.some(
                  (cv) =>
                    cv.optionKey === optionKey &&
                    cv.tab !== "incentive" &&
                    cv.tab !== "channel" &&
                    cv.tab !== "set_your_tenant_strategy"
                );
                if (!hasAnchor) {
                  newCvs.push({
                    optionKey,
                    tab: "campaign",
                    itemKey: optionKey,
                    value: 0,
                  });
                }
              });
              return newCvs;
            })
            .optional(),
        })
      ),
    })
  ),
  globalDecisionDetails: z.array(
    z.object({
      globalInputId: z.string(),
      key: z.string(),
      value: z.number().optional(),
      textValue: z.string().optional(),
      selected: z.boolean().optional(),
    })
  ),
  // initiatives: z.array(z.string()),
  eventDecision: z
    .object({
      eventId: z.string().optional(),
      eventTriggeredId: z.string().optional(),
      chosenKey: z.string(),
    })
    .optional()
    .nullable(),
  eventDecisions: z.array(
    z.object({
      eventTriggeredId: z.string().optional(),
      eventId: z.string().optional(),
      chosenKey: z.string(),
    })
  ),
  type: z.string().optional().nullable(),
});

// Create a new decision and trigger projections creation
export const createDecision = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const io = getSocket();

  try {
    const validationResult = createDecisionSchema.safeParse(req.body);
    const user = (req as any).user;

    if (validationResult.error) {
      console.error(
        "Error parsing decision:",
        JSON.stringify(validationResult.error.format(), null, 2)
      );

      res.status(400).json({
        error: "Invalid data format. Missing or invalid required fields.",
      });

      return;
    }

    const decisionData = validationResult.data;

    if (!user.simulationId || !user.teamId) {
      res.status(400).json({
        error: "Invalid user data. Missing simulationId or teamId.",
      });
      return;
    }

    const simulation = await Simulation.findOne({
      _id: user.simulationId,
      status: "Active",
    })
      .populate("simulationType")
      .populate("activeSegmentsDetailed")
      .populate("activeProductsDetailed")
      .lean();

    if (!simulation) {
      res.status(404).json({ error: "Active simulation not found." });
      return;
    }

    // const productsInSimulation = simulation.activeProductsDetailed || [];
    // const segments = simulation.activeSegmentsDetailed || [];

    const [baseData, productsInSimulation, segments, round, totalTeams] =
      await Promise.all([
        getOrFetchBaseData(simulation.simulationTypeId.toString()),

        getOrFetchProducts(simulation.simulationTypeId.toString()),

        getOrFetchSegments(simulation.simulationTypeId.toString()),

        Round.findOne({
          simulationId: user.simulationId,
          roundNumber: simulation.config.currRounds,
        })
          .populate("event")
          .lean(),

        getOrFetchTeamCount(user.simulationId),
      ]);

    // const baseData = await BaseData.findOne({
    //   simulationTypeId: simulation.simulationTypeId,
    // });

    if (!baseData) {
      res.status(404).json({ error: "Base data not found." });
      return;
    }

    // Validate cross-subproduct fields
    for (const decisionDetail of decisionData.decisionDetails) {
      const product = productsInSimulation.find(
        (p) => p._id.toString() === decisionDetail.productId
      );

      if (
        !product ||
        !product.subProducts ||
        product.subProducts.length === 0
      ) {
        continue;
      }

      const fieldsWithValidation =
        product.fields?.filter((f: any) => {
          const hasGapConfig = f.subproductGapConfig;
          const isGapEnabled = hasGapConfig?.enabled;

          if (hasGapConfig) {
            return isGapEnabled; // If new config exists, only use it if enabled
          }

          const hasOldValidation =
            f.scope === "subproduct" &&
            (f.type === "percentage" ||
              f.type === "plain-number" ||
              f.type === "money" ||
              f.type === "plain-number-with-calculated-values") &&
            f.subproductValidation;

          return !!hasOldValidation;
        }) || [];

      for (const field of fieldsWithValidation) {
        const subproductValues: number[] = [];

        product.subProducts.forEach((sp: any) => {
          const fieldData = decisionDetail.fields.find(
            (f: any) => f.key === field.key && f.subProductKey === sp.key
          );
          if (fieldData) {
            subproductValues.push(
              typeof fieldData.value === "number" ? fieldData.value : 0
            );
          }
        });

        const sum = subproductValues.reduce((acc, val) => acc + val, 0);
        let isValid = true;

        const gapConfig = field.subproductGapConfig;
        const useGapConfig = gapConfig?.enabled;
        const validation = useGapConfig ? null : field.subproductValidation;

        const targetValueRaw = useGapConfig
          ? gapConfig.targetValue
          : validation?.targetValue;

        if (targetValueRaw !== undefined) {
          // For percentage fields, convert targetValue from percentage to decimal
          const targetValue =
            field.type === "percentage" ? targetValueRaw / 100 : targetValueRaw;

          const operator = useGapConfig
            ? gapConfig.enforceMax
              ? "<="
              : null
            : validation?.operator;

          if (operator) {
            switch (operator) {
              case "==":
                isValid = Math.abs(sum - targetValue) < 0.0001;
                break;
              case "<=":
                isValid = sum <= targetValue + 0.0001; // Adding epsilon for float safety
                break;
              case ">=":
                isValid = sum >= targetValue - 0.0001;
                break;
              case "<":
                isValid = sum < targetValue;
                break;
              case ">":
                isValid = sum > targetValue;
                break;
            }
          }
        } else if (!useGapConfig) {
          // Validate consistency - all subproducts should have the same value
          if (subproductValues.length > 0) {
            const firstValue = subproductValues[0];
            isValid = subproductValues.every(
              (val) => Math.abs(val - firstValue) < 0.0001
            );
          }
        }

        if (!isValid) {
          const operatorLabel = useGapConfig ? "equal" : validation?.operator;
          const targetValueLabel = useGapConfig
            ? gapConfig.targetValue
            : validation?.targetValue;

          res.status(400).json({
            error:
              (validation && validation.message) ||
              `Validation failed: Sum of ${field.label} across subproducts must be ${operatorLabel} ${targetValueLabel ?? "consistent"}${field.type === "percentage" ? "%" : ""}`,
          });
          return;
        }
      }
    }

    // const productsInSimulation = await Product.find({
    //   simulationTypeId: simulation.simulationTypeId,
    // });

    // const segments = await Segment.find({
    //   simulationTypeId: simulation.simulationTypeId,
    // });

    // const round = await Round.findOne({
    //   simulationId: user.simulationId,
    //   roundNumber: simulation.config.currRounds,
    // }).populate("event");

    if (!round) {
      res.status(404).json({ error: "Active round not found." });
      return;
    }

    const transformedGlobalDecisionDetails =
      decisionData.globalDecisionDetails.map((detail) => ({
        globalInputId: new mongoose.Types.ObjectId(detail.globalInputId),
        key: detail.key,
        value: detail.value,
        selected: detail.selected,
      }));

    const productIds = new Set(
      productsInSimulation.map((p) => p._id.toString())
    );

    // Fetch current round's most recent decision for unlock state (within same round)
    let currentRoundDecision: DecisionInterface | null = await Decision.findOne(
      {
        simulationId: user.simulationId,
        teamId: user.teamId,
        roundNumber: round.roundNumber,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    // Fetch previous round decision for prerequisite checking
    let prevRoundDecisionForUnlock: DecisionInterface | null =
      await Decision.findOne({
        simulationId: user.simulationId,
        teamId: user.teamId,
        roundNumber: round.roundNumber - 1,
      })
        .sort({ createdAt: -1 })
        .lean();

    const newDecision = new Decision({
      simulationId: user.simulationId,
      teamId: user.teamId,
      roundNumber: round.roundNumber,
      decisionDetails: decisionData.decisionDetails
        .filter((decDet) => productIds.has(decDet.productId))
        .map((d: any) => {
          const productId = new mongoose.Types.ObjectId(d.productId);
          const product = productsInSimulation.find(
            (p) => p._id.toString() === d.productId
          );

          // Determine unlock state
          let isUnlocked = true; // Default unlocked
          const unlockRequested = d.unlockRequested || false;

          if (product) {
            // Check if product has prerequisites
            const hasPrerequisites =
              product.unlockPrerequisites &&
              product.unlockPrerequisites.length > 0;

            if (hasPrerequisites) {
              // Check current round first (in case product was unlocked earlier in this round)
              let prevDecisionDetail =
                currentRoundDecision?.decisionDetails.find(
                  (pd) => pd.productId.toString() === d.productId
                );

              // Fall back to previous round if no current round decision exists
              if (!prevDecisionDetail) {
                prevDecisionDetail =
                  prevRoundDecisionForUnlock?.decisionDetails.find(
                    (pd) => pd.productId.toString() === d.productId
                  );
              }

              if (
                prevDecisionDetail &&
                prevDecisionDetail.isUnlocked !== undefined
              ) {
                // Preserve previous unlock state
                isUnlocked = prevDecisionDetail.isUnlocked;
              } else {
                // First time seeing this product with prerequisites - default locked
                isUnlocked = false;
              }

              // Handle unlock request
              if (unlockRequested && !isUnlocked) {
                const prereqCheck = checkProductPrerequisites(
                  product,
                  prevRoundDecisionForUnlock
                );

                if (prereqCheck.isMet) {
                  isUnlocked = true;
                  // Store unlock cost paid
                  if (product.unlockCost !== undefined) {
                    (d as any).unlockCostPaid = product.unlockCost;
                  }
                } else {
                  // Prerequisites not met - will remain locked
                  console.log(
                    `Product ${product.productName} unlock request denied: prerequisites not met`
                  );
                }
              }
            }
          }

          const mappedFields = d.fields.reduce((acc: any[], f: any) => {
            let processedValue = f.value;
            if (f.key === "product_level") {
              processedValue =
                f.value > MAXIMAL_LEVEL_VALUE
                  ? MAXIMAL_LEVEL_VALUE
                  : f.value < MINIMAL_LEVEL_VALUE
                    ? MINIMAL_LEVEL_VALUE
                    : f.value;
            }

            const fieldDef = product?.fields?.find(
              (pf: any) => pf.key === f.key
            );

            if (
              fieldDef?.type === "complex-checkbox" &&
              Array.isArray(f.complexValues)
            ) {
              f.complexValues = f.complexValues.filter((cv: any) => {
                const optionConfig =
                  fieldDef.complexCheckboxConfig?.options?.find(
                    (o: any) => o.optionKey === cv.optionKey
                  );
                if (!optionConfig) return false;
                if (
                  optionConfig.visibleRounds &&
                  optionConfig.visibleRounds.length > 0
                ) {
                  return optionConfig.visibleRounds.includes(round.roundNumber);
                }
                return true;
              });
            }

            acc.push({
              ...f,
              value: processedValue,
            });

            if (
              fieldDef?.type === "complex-checkbox" &&
              Array.isArray(f.complexValues)
            ) {
              let totalSum = 0;
              let totalCost = 0;

              const uniqueOptions = new Set<string>();

              f.complexValues.forEach((cv: any) => {
                if (cv.optionKey) {
                  uniqueOptions.add(cv.optionKey);
                }

                if (cv.tab && cv.itemKey) {
                  const val = Number(cv.value) || 0;
                  totalSum += val;
                  acc.push({
                    key: `${f.key}_${cv.optionKey}_${cv.tab}_${cv.itemKey}`,
                    value: val,
                  });
                }
              });

              uniqueOptions.forEach((optKey) => {
                acc.push({
                  key: `${f.key}_${optKey}_selected`,
                  value: 1,
                });

                const optionDef: any =
                  fieldDef.complexCheckboxConfig?.options?.find(
                    (o: any) => o.optionKey === optKey
                  );
                if (optionDef && typeof optionDef.cost !== "undefined") {
                  totalCost += Number(optionDef.cost);
                }
              });

              const finalSum = totalSum > 0 ? totalSum : uniqueOptions.size;

              acc.push({ key: `${f.key}_sum`, value: finalSum });
              acc.push({ key: `${f.key}_cost`, value: totalCost });
            }

            return acc;
          }, []);

          // --- GENERIC READONLY FIELD CALCULATION ---
          if (product) {
            calculateReadonlyFields({
              product,
              mappedFields,
              prevRoundDecision: prevRoundDecisionForUnlock,
              baseData,
              simulationRound: simulation.config.currRounds,
            });
          }

          return {
            ...d,
            productId,
            segmentId: new mongoose.Types.ObjectId(d.segmentId),
            unlockRequested,
            isUnlocked,
            unlockCostPaid: (d as any).unlockCostPaid,
            fields: mappedFields,
          };
        }),
      segmentDecisionDetails: decisionData.segmentDecisionDetails.map(
        (d: any) => ({
          segmentId: new mongoose.Types.ObjectId(d.segmentId),
          fields: d.fields.map((f: any) => ({
            key: f.key,
            value: f.value,
            textValue: f.textValue,
          })),
        })
      ),
      globalDecisionDetails: transformedGlobalDecisionDetails,
      // initiatives: decisionData.initiatives,
      eventDecisions: decisionData.eventDecisions
        ? decisionData.eventDecisions.map((ed: any) => ({
            ...ed,
            eventTriggeredId: ed.eventTriggeredId
              ? new mongoose.Types.ObjectId(ed.eventTriggeredId)
              : undefined,
            eventId: ed.eventId
              ? new mongoose.Types.ObjectId(ed.eventId)
              : undefined,
          }))
        : decisionData.eventDecision
          ? [
              {
                ...decisionData.eventDecision,
                eventId: new mongoose.Types.ObjectId(
                  decisionData.eventDecision?.eventId
                ),
              },
            ]
          : [],
    });

    const savedDecision = await newDecision.save();

    // const populatedDecision = await newDecision.populate([
    //   { path: "decisionDetails.product" },
    //   { path: "decisionDetails.segment" },
    //   { path: "eventDecisions.event" },
    //   { path: "segmentDecisionDetails.segment" },
    //   { path: "globalDecisionDetails.globalInput" },
    // ]);

    const populatedDecision = await Decision.findById(savedDecision._id)
      .populate({
        path: "decisionDetails.product decisionDetails.segment eventDecisions.event segmentDecisionDetails.segment globalDecisionDetails.globalInput",
      })
      .lean();

    if (!populatedDecision) {
      res.status(404).json({
        error: "Newly created decision not found.",
      });
      return;
    }

    if (decisionData.type === "final") {
      const updatedEarlySubmissions = [
        ...(round.earlySubmissions || []),
        savedDecision.teamId,
      ];
      await Round.findByIdAndUpdate(round._id, {
        earlySubmissions: updatedEarlySubmissions,
      });
    }

    let prevRoundDecision: DecisionInterface | null = await Decision.findOne({
      simulationId: user.simulationId,
      roundNumber: round.roundNumber - 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!prevRoundDecision) {
      const simulationType = await SimulationType.findById(
        simulation.simulationTypeId
      );

      if (!simulationType) {
        res.status(404).json({ error: "Simulation type not found." });
        return;
      }

      const pastData = simulationType.pastData.find((pd) => pd.year === 0);

      if (!pastData) {
        res.status(404).json({ error: "Past data not found." });
        return;
      }

      prevRoundDecision = {
        simulationId: simulation._id,
        decisionDetails: pastData.productData.map((pd) => ({
          productId: pd.productId,
          segmentId: pd.segmentId,
          fields: pd.fields.map((field) => ({
            key: field.key,
            value: field.value,
          })),
        })),
        segmentDecisionDetails: pastData.segmentData.map((sd) => ({
          segmentId: sd.segmentId,
          fields: sd.fields.map((field) => ({
            key: field.key,
            value: field.value,
          })),
        })),
        globalDecisionDetails: pastData.globalData.map((gd) => ({
          globalInputId: gd.globalInputId,
          key: gd.key,
          value: gd.value,
        })),
        teamId: savedDecision.teamId,
        roundNumber: round.roundNumber - 1,
        // initiatives: [],
        createdAt: new Date(),
      };
    }

    let newlyCreatedProjection = null;

    try {
      const [
        availableGlobalInputs,
        prevRoundResult,
        // penultimateProjection,
        // penultimateDecision,
      ] = await Promise.all([
        getOrFetchGlobalInputs(simulation.simulationTypeId.toString()),
        getPrevRoundResult(user.simulationId.toString(), round.roundNumber - 1),
        // Projection.findOne({
        //   simulationId: user.simulationId,
        //   roundNumber: round.roundNumber,
        //   teamId: savedDecision.teamId,
        // })
        //   .sort({ createdAt: -1 })
        //   .lean(),
        // Decision.findOne({
        //   simulationId: user.simulationId,
        //   roundNumber: round.roundNumber,
        //   teamId: savedDecision.teamId,
        // })
        //   .sort({ createdAt: -1 })
        //   .skip(1)
        //   .lean(),
      ]);

      // TODO: use key instead of name
      const calcProjectionsUsed =
        simulation.simulationType.name === "FMCG"
          ? fmcgCalcProjections
          : simulation.simulationType.name === "Mall Management"
            ? mallManagementCalcProjections
            : calcProjections;

      const newCalcProjResult = await calcProjectionsUsed({
        decision: populatedDecision,
        prevRoundDecision: prevRoundDecision as DecisionInterface,
        totalTeams,
        baseData,
        availableGlobalInputs,
        prevRoundParams:
          prevRoundResult?.teams.find((t) =>
            t.teamId.equals(savedDecision.teamId)
          )?.adjustedParams || [],
        currentRoundDecision: newDecision,
        prevRoundResult: prevRoundResult?.teams.find((t) =>
          t.teamId.equals(savedDecision.teamId)
        ),
        products: productsInSimulation,
        segments: segments,
        penultimateProjection: null,
        penultimateDecision: null,
        eventsTriggered: round.eventsTriggered || [],
      });

      const newProjectionPayload = {
        decisionId: savedDecision._id,
        teamId: savedDecision.teamId,
        simulationId: savedDecision.simulationId,
        roundNumber: savedDecision.roundNumber,
        kpi: newCalcProjResult.kpi,
        bizperf: newCalcProjResult.bizperf,
        pnl: newCalcProjResult.pnl,
        cashflow: newCalcProjResult.cashflow,
        balanceSheet: newCalcProjResult.balanceSheet,
        marketMetrics: newCalcProjResult.marketMetrics,
        chargeOffs:
          (newCalcProjResult as ProjectionResult<BankingExtra>).chargeOffs ||
          [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedProjection = await new Projection(newProjectionPayload).save();

      newlyCreatedProjection = await Projection.findById(savedProjection._id)
        .populate("pnl.product")
        .lean();
    } catch (projectionError) {
      console.error(
        `Error creating projections for decision ID ${savedDecision._id}:`,
        projectionError
      );
    }

    io.emit("projectionsCreated", { simulationId: savedDecision.simulationId });

    res.status(201).json({
      message: "Decision created successfully. Projections are being created.",
      decisionId: savedDecision._id,
      newlyCreatedProjection,
      projectionWarning:
        newlyCreatedProjection === null
          ? "Projection calculation failed. Display results may be incomplete."
          : null,
    });
  } catch (err) {
    console.error("Error creating decision:", err);

    res.status(500).json({
      error: "Failed to create decision.",
    });
  }
};

export const getDecisionById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { decisionId } = req.params;

    // Validate the decisionId parameter
    if (!decisionId || !decisionId.match(/^[0-9a-fA-F]{24}$/)) {
      res
        .status(400)
        .json({ error: "Invalid or missing decisionId parameter." });
      return;
    }

    // Fetch the decision from the database
    const decision = await Decision.findById(decisionId)
      .populate("simulationId") // Populate related simulation details if needed
      .populate("teamId"); // Populate related team details if needed

    if (!decision) {
      res.status(404).json({ error: "Decision not found." });
      return;
    }

    // Return the decision
    res.status(200).json(decision);
  } catch (err) {
    console.error("Error fetching decision:", err);
    res.status(500).json({ error: "Failed to fetch decision." });
  }
};

// Get decisions by simulationId, teamId, and optionally roundNumber
export const getDecisionByParams = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.params;

    // Parse roundNumber if provided
    const roundNum = roundNumber ? parseRoundNumber(roundNumber) : undefined;

    if (roundNum === null) {
      res
        .status(400)
        .json({ error: "Invalid roundNumber. Must be a valid number." });
      return;
    }

    // Build query dynamically
    const query = buildDecisionQuery({
      simulationId,
      teamId,
      ...(roundNum !== undefined && { roundNumber: roundNum }),
    });

    const decisions = await Decision.find(query);
    const totalCount = await Decision.countDocuments(query);

    res.status(200).json({
      decisions,
      totalCount,
    });
  } catch (err) {
    console.error("Error fetching decisions:", err);
    next(err);
  }
};

// Update a decision by simulationId, roundNumber, and teamId
export const updateDecisionByParams = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.params;

    const roundNum = roundNumber ? parseRoundNumber(roundNumber) : undefined;

    if (roundNum === null) {
      res
        .status(400)
        .json({ error: "Invalid roundNumber. Must be a valid number." });
      return;
    }

    const query = buildDecisionQuery({
      simulationId,
      teamId,
      roundNumber: roundNum,
    });
    const updatedDecision = await Decision.findOneAndUpdate(query, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedDecision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    res.status(200).json(updatedDecision);
  } catch (err) {
    console.error("Error updating decision:", err);
    next(err);
  }
};

// Delete a decision by simulationId, roundNumber, and teamId
export const deleteDecisionByParams = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.params;

    const roundNum = roundNumber ? parseRoundNumber(roundNumber) : undefined;

    if (roundNum === null) {
      res
        .status(400)
        .json({ error: "Invalid roundNumber. Must be a valid number." });
      return;
    }

    const query = buildDecisionQuery({
      simulationId,
      teamId,
      roundNumber: roundNum,
    });
    const deletedDecision = await Decision.findOneAndDelete(query);

    if (!deletedDecision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    res.status(200).json({ message: "Decision deleted successfully" });
  } catch (err) {
    console.error("Error deleting decision:", err);
    next(err);
  }
};

export const getPastInitiatives = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const { segment } = req.query;

    if (!user.simulationId || !user.teamId) {
      res
        .status(400)
        .json({ error: "Invalid user data. Missing simulationId or teamId." });
      return;
    }

    const rounds = await Round.find({ simulationId: user.simulationId }).sort({
      roundNumber: 1,
    });

    const pastInitiatives = await Promise.all(
      rounds.map(async (round) => {
        const matchCriteria: any = {
          simulationId: new mongoose.Types.ObjectId(user.simulationId),
          teamId: new mongoose.Types.ObjectId(user.teamId),
          roundNumber: round.roundNumber,
        };

        if (segment) {
          matchCriteria.segment = segment;
        }

        const decision = await Decision.aggregate([
          {
            $match: matchCriteria,
          },
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $lookup: {
              from: "initiatives",
              localField: "initiatives.selectedId",
              foreignField: "_id",
              as: "initiativesDetails",
            },
          },
          {
            $addFields: {
              initiatives: {
                $map: {
                  input: "$initiatives",
                  as: "initiative",
                  in: {
                    $mergeObjects: [
                      "$$initiative",
                      {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$initiativesDetails",
                              as: "detail",
                              cond: {
                                $eq: [
                                  "$$detail._id",
                                  "$$initiative.selectedId",
                                ],
                              },
                            },
                          },
                          0,
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        ]);

        return {
          round: round.roundNumber,
          initiatives: decision.length > 0 ? decision[0].initiatives : [],
        };
      })
    );

    const filteredHardcoded = hardcodedPastInitiatives.find(
      (hpi) => hpi.segment === segment
    ) || { round: 0, initiatives: [] };

    res.status(200).json([filteredHardcoded, ...pastInitiatives]);
  } catch (err) {
    console.error("Error fetching past initiatives:", err);
    next(err);
  }
};

const getPastData = async ({
  simulationTypeId,
  simulationId,
}: {
  simulationTypeId: mongoose.Types.ObjectId;
  simulationId: mongoose.Types.ObjectId;
}) => {
  const simulationType = await SimulationType.findById(simulationTypeId);

  if (!simulationType) {
    return {
      error: "Simulation type not found.",
      pastData: null,
    };
  }

  const pastData = simulationType.pastData.find((pd) => pd.year === 0);

  if (!pastData) {
    return {
      error: "Past data not found.",
      pastData: null,
    };
  }

  const dec = {
    _id: "round-0-decision",
    simulationId: simulationId,
    decisionDetails: pastData.productData.map((pd) => ({
      productId: pd.productId,
      segmentId: pd.segmentId,
      fields: pd.fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
    })),
    segmentDecisionDetails: pastData.segmentData.map((sd) => ({
      segmentId: sd.segmentId,
      fields: sd.fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
    })),
    globalDecisionDetails: pastData.globalData.map((gd) => ({
      globalInputId: gd.globalInputId,
      key: gd.key,
      value: gd.value,
    })),
  };

  return {
    error: null,
    pastData: dec,
  };
};

export const readCurrentRoundDecision = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    const simulationId = req.query.simulationId;

    if (!simulationId) {
      res.status(400).json({ error: "Simulation ID is required." });
      return;
    }

    const simulation = await Simulation.findById(simulationId);

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found." });
      return;
    }

    // Retrieve the current round from internal function
    const round = await Round.findOne({
      simulationId,
      roundNumber: simulation.config.currRounds,
    });

    if (!round) {
      res.status(404).json({ error: "Active round not found." });
      return;
    }

    // Retrieve the decision for the current round
    const realCurrentRoundDecision = await Decision.findOne({
      simulationId,
      roundNumber: round.roundNumber,
      teamId: user.teamId,
    })
      .populate("decisionDetails.product")
      .sort({ createdAt: -1 });

    if (realCurrentRoundDecision) {
      res.status(200).json(realCurrentRoundDecision);
      return;
    }

    const prevRoundDecisionTreatedAsCurrentRoundDecision =
      await Decision.findOne({
        simulationId,
        teamId: user.teamId,
        roundNumber: round.roundNumber - 1,
      })
        .populate("decisionDetails.product")
        .sort({ createdAt: -1 });

    if (prevRoundDecisionTreatedAsCurrentRoundDecision) {
      res.status(200).json(prevRoundDecisionTreatedAsCurrentRoundDecision);
      return;
    }

    const { error, pastData } = await getPastData({
      simulationTypeId: simulation.simulationTypeId,
      simulationId: new mongoose.Types.ObjectId(simulationId.toString()),
    });

    if (error) {
      res.status(500).json({ error });

      return;
    }

    res.status(200).json(pastData);
  } catch (err) {
    console.error("Error reading current round decision:", err);
    next(err);
  }
};

export const readPrevRoundDecision = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationId = req.query.simulationId;
    const user = (req as any).user;
    if (!simulationId) {
      res.status(400).json({ error: "Simulation ID is required." });
      return;
    }

    const simulation = await Simulation.findById(simulationId);

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found." });
      return;
    }

    const round = await Round.findOne({
      simulationId,
      roundNumber: simulation.config.currRounds,
    });

    if (!round) {
      res.status(404).json({ error: "Active round not found." });
      return;
    }

    const realPrevRoundDecision = await Decision.findOne({
      simulationId,
      teamId: user.teamId,
      roundNumber: round.roundNumber - 1,
    }).sort({ createdAt: -1 });

    if (realPrevRoundDecision) {
      res.status(200).json(realPrevRoundDecision);
      return;
    }

    const { error, pastData } = await getPastData({
      simulationTypeId: simulation.simulationTypeId,
      simulationId: new mongoose.Types.ObjectId(simulationId.toString()),
    });

    if (error) {
      res.status(500).json({ error });

      return;
    }

    res.status(200).json(pastData);

    return;
  } catch (err) {
    console.error("Error reading previous round decision:", err);
    next(err);
  }
};

export const getPredefinedDecision = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;

    if (!simulationId) {
      res.status(400).json({ error: "Simulation ID is required." });
      return;
    }

    const simulation =
      await Simulation.findById(simulationId).populate("simulationType");
    if (!simulation) {
      res.status(404).json({ error: "Simulation not found." });
      return;
    }

    const offset = simulation.simulationType?.comparisonRoundOffset ?? 1;
    const startRound = Math.min(0, 1 - offset);

    const teams = await Team.find({
      simulationId: new mongoose.Types.ObjectId(simulationId),
    });

    if (teams.length === 0) {
      res.status(404).json({ error: "No teams found for this simulation." });
      return;
    }

    const decisions = await Decision.find({
      simulationId: new mongoose.Types.ObjectId(simulationId),
      teamId: teams[0]._id,
      roundNumber: { $lte: 0, $gte: startRound },
    }).lean();

    const decisionsByRound: Record<number, any> = {};
    decisions.forEach((d) => {
      decisionsByRound[d.roundNumber] = d;
    });

    res.status(200).json(decisionsByRound);
  } catch (err) {
    console.error("Error fetching predefined decisions:", err);
    next(err);
  }
};

export const createPredefinedDecisions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const { decisionsByRound } = req.body;

    const simulation = await Simulation.findById(simulationId)
      .populate("simulationType")
      .populate("activeSegmentsDetailed")
      .populate("activeProductsDetailed");

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found." });
      return;
    }

    const teams = await Team.find({
      simulationId: new mongoose.Types.ObjectId(simulationId),
    });

    const productsInSimulation = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    });

    if (!baseData) {
      throw new Error("Base data not found.");
    }

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const totalTeams = teams.length;
    const roundsToUpdate = decisionsByRound
      ? Object.keys(decisionsByRound).map(Number)
      : [0];

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const roundNumber of roundsToUpdate) {
        const decisionData = decisionsByRound
          ? decisionsByRound[roundNumber]
          : req.body;

        // Validate/Process each team
        for (const team of teams) {
          const teamId = team._id;

          const transformedGlobalDecisionDetails = (
            decisionData.globalDecisionDetails || []
          ).map((detail: any) => ({
            globalInputId: new mongoose.Types.ObjectId(detail.globalInputId),
            key: detail.key,
            value: detail.value,
            selected: detail.selected ?? true,
          }));

          // Fetch current and prev round decisions for unlock state
          let currentRoundDecision = await Decision.findOne({
            simulationId,
            teamId,
            roundNumber,
          })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          let prevRoundDecisionForUnlock = await Decision.findOne({
            simulationId,
            teamId,
            roundNumber: roundNumber - 1,
          })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          const newDecisionDetails = (decisionData.decisionDetails || [])
            .filter((decDet: any) =>
              productsInSimulation.find((p) => p._id.equals(decDet.productId))
            )
            .map((d: any) => {
              const productId = new mongoose.Types.ObjectId(d.productId);
              const product = productsInSimulation.find((p) =>
                p._id.equals(d.productId)
              );

              let isUnlocked = true;
              const unlockRequested = d.unlockRequested || false;

              if (product) {
                const hasPrerequisites =
                  product.unlockPrerequisites &&
                  product.unlockPrerequisites.length > 0;
                if (hasPrerequisites) {
                  let prevDecisionDetail =
                    currentRoundDecision?.decisionDetails.find((pd) =>
                      pd.productId.equals(d.productId)
                    );
                  if (!prevDecisionDetail) {
                    prevDecisionDetail =
                      prevRoundDecisionForUnlock?.decisionDetails.find((pd) =>
                        pd.productId.equals(d.productId)
                      );
                  }

                  if (
                    prevDecisionDetail &&
                    prevDecisionDetail.isUnlocked !== undefined
                  ) {
                    isUnlocked = prevDecisionDetail.isUnlocked;
                  } else {
                    isUnlocked = false;
                  }

                  if (unlockRequested && !isUnlocked) {
                    const prereqCheck = checkProductPrerequisites(
                      product,
                      prevRoundDecisionForUnlock
                    );
                    if (prereqCheck.isMet) {
                      isUnlocked = true;
                    }
                  }
                }
              }

              const defaultMarketShare = 1 / totalTeams;

              const mappedFields = (d.fields || []).map((f: any) => ({
                ...f,
                value:
                  f.key === "projected_market_share"
                    ? defaultMarketShare
                    : f.value,
              }));

              if (product) {
                calculateReadonlyFields({
                  product,
                  mappedFields,
                  prevRoundDecision: prevRoundDecisionForUnlock,
                  baseData,
                  simulationRound: roundNumber,
                });
              }

              return {
                ...d,
                productId,
                segmentId: new mongoose.Types.ObjectId(d.segmentId),
                fields: mappedFields,
                unlockRequested,
                isUnlocked,
              };
            });

          const newDecision = new Decision({
            simulationId,
            teamId,
            roundNumber,
            decisionDetails: newDecisionDetails,
            segmentDecisionDetails: (
              decisionData.segmentDecisionDetails || []
            ).map((sd: any) => ({
              segmentId: new mongoose.Types.ObjectId(sd.segmentId),
              fields: (sd.fields || []).map((f: any) => ({
                key: f.key,
                value: f.value,
                textValue: f.textValue,
                subProductKey: f.subProductKey,
                complexValues: f.complexValues,
              })),
            })),
            globalDecisionDetails: transformedGlobalDecisionDetails,
            eventDecisions: [],
          });

          await newDecision.save({ session });

          // Regenerate projection for this decision
          const populatedDecision = await Decision.findById(newDecision._id)
            .populate({
              path: "decisionDetails.product decisionDetails.segment eventDecisions.event segmentDecisionDetails.segment globalDecisionDetails.globalInput",
            })
            .session(session)
            .lean();

          if (populatedDecision) {
            const calcProjectionsUsed =
              simulation.simulationType.name === "FMCG"
                ? fmcgCalcProjections
                : simulation.simulationType.name === "Mall Management"
                  ? mallManagementCalcProjections
                  : calcProjections;

            try {
              const prevRoundResult = await Result.findOne({
                simulationId,
                roundNumber: roundNumber - 1,
              })
                .sort({ createdAt: -1 })
                .session(session)
                .lean();

              const newCalcProjResult = await calcProjectionsUsed({
                decision: populatedDecision as any,
                prevRoundDecision: prevRoundDecisionForUnlock as any,
                totalTeams,
                baseData,
                availableGlobalInputs,
                prevRoundParams:
                  prevRoundResult?.teams.find((t) => t.teamId.equals(teamId))
                    ?.adjustedParams || [],
                currentRoundDecision: populatedDecision as any,
                prevRoundResult: prevRoundResult?.teams.find((t) =>
                  t.teamId.equals(teamId)
                ),
                products: productsInSimulation,
                segments: segments,
                penultimateProjection: null,
                penultimateDecision: null,
                eventsTriggered: [],
              });

              await Projection.findOneAndUpdate(
                { simulationId, teamId, roundNumber },
                {
                  ...newCalcProjResult,
                  decisionId: populatedDecision._id,
                  teamId,
                  simulationId,
                  roundNumber,
                  updatedAt: new Date().toISOString(),
                },
                { upsert: true, session }
              );
            } catch (projErr) {
              console.error(
                `Error regenerating projection for team ${teamId} round ${roundNumber}:`,
                projErr
              );
            }
          }
        }

        // Recalculate result for the round
        await processCalculations({
          simulationId: simulationId!,
          simulationTypeId: simulation.simulationTypeId!.toString(),
          simulationTypeName: simulation.simulationType.name,
          roundNumber: roundNumber,
          session,
          activeSegments:
            simulation.activeSegmentsDetailed as any as SegmentInterface[],
          activeProducts:
            simulation.activeProductsDetailed as any as ProductInterface[],
        });
      }

      await session.commitTransaction();
      res
        .status(200)
        .json({ message: "Predefined decisions updated successfully" });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error("Error creating predefined decisions:", err);
    next(err);
  }
};

export const getPreviousDecisions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { simulationId } = req.query;
    const user = (req as any).user;

    if (!simulationId) {
      res.status(400).json({ error: "Simulation ID is required" });

      return;
    }

    // Fetch simulation to get current round
    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });

      return;
    }

    const currentRound = simulation.config.currRounds;

    const previousDecisions = await Decision.aggregate([
      {
        $match: {
          simulationId: new mongoose.Types.ObjectId(simulationId as string),
          roundNumber: { $lt: currentRound },
          teamId: new mongoose.Types.ObjectId(user.teamId),
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$roundNumber",
          latestDecision: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: { newRoot: "$latestDecision" },
      },
      {
        $lookup: {
          from: "globalInputs",
          let: { globalDecisionDetails: "$globalDecisionDetails" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$globalDecisionDetails.globalInputId"],
                },
              },
            },
          ],
          as: "globalInputs",
        },
      },
      {
        $addFields: {
          globalDecisionDetails: {
            $map: {
              input: "$globalDecisionDetails",
              as: "detail",
              in: {
                $mergeObjects: [
                  "$$detail",
                  {
                    globalInput: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$globalInputs",
                            cond: {
                              $eq: ["$$this._id", "$$detail.globalInputId"],
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          globalInputs: 0, // Remove the temporary globalInputs array
        },
      },
    ]);

    res.status(200).json({
      message: "Previous decisions retrieved successfully",
      decisions: previousDecisions,
      currentRound,
    });
  } catch (err) {
    console.error("Error fetching previous decisions:", err);
    next(err);
  }
};
