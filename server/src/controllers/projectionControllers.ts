import { Request, Response } from "express";
import mongoose from "mongoose";

import pastProjections, {
  HardcodedPastProjection,
} from "../config/constants/pastProjections";
import BalanceSheetConfig from "../models/balanceSheetConfig";
import BaseData from "../models/baseData";
import BizPerfConfig from "../models/bizperfConfig";
import CashflowConfig from "../models/cashflowConfig";
import { DecisionInterface } from "../models/decisions";
import PnLConfig from "../models/pnlConfig";
import Product from "../models/products";
import Projection, { ProjectionInterface } from "../models/projections";
import Result from "../models/results";
import Simulation from "../models/simulations";
import SimulationType from "../models/simulationTypes";
import { calculateProjections } from "../sim/simProjections";
import { BalanceSheetFieldHelper } from "../utils/balanceSheetFieldHelper";
import { BizPerfFieldHelper } from "../utils/bizperfFieldHelper";
import { CashflowFieldHelper } from "../utils/cashflowFieldHelper";
import { PnLFieldHelper } from "../utils/pnlFieldHelper";
import { getSocket } from "../utils/socket";
// import { Result } from "postcss";

const { ObjectId } = mongoose.Types;

interface ExtendedProjection extends ProjectionInterface {
  prevRoundProjection?: ProjectionInterface;
  prevRoundKPI?: { [k in string]: number };
  decision?: DecisionInterface;
}

export const createProjections = async (
  req: Request,
  res: Response
): Promise<void> => {
  const io = getSocket();

  try {
    const { decision, totalTeams, toggle } = req.body;

    // Validate input parameters
    if (!decision || !decision._id || typeof totalTeams !== "number") {
      console.error(
        "Validation failed: Missing or invalid required parameters."
      );
      res
        .status(400)
        .json({ error: "Missing or invalid required parameters." });
      return; // Stop further execution
    }

    // Transform $oid to ObjectId for decisionId
    const decisionId = new ObjectId(decision._id.$oid || decision._id);

    // Transform productId in decisionDetails
    decision.decisionDetails = decision.decisionDetails.map(
      (detail: any, index: number) => {
        return {
          ...detail,
          productId: new ObjectId(detail.productId.$oid || detail.productId),
        };
      }
    );

    // Run simEngine to calculate projections
    // Fetch baseData using simulationTypeId from decision
    const baseData = await BaseData.findOne({
      simulationTypeId: decision.simulationTypeId,
    });
    if (!baseData) {
      throw new Error("Base data not found for simulation type");
    }
    const result = await calculateProjections(decision, totalTeams, baseData);

    // Transform productId in pnl array to valid ObjectId
    const transformedPnl = result.pnl.map((item: any, index: number) => {
      return {
        ...item,
        segmentId: new ObjectId(item.segmentId.$oid || item.segmentId),
        productId: new ObjectId(item.productId.$oid || item.productId),
      };
    });

    // Prepare projection document
    const projection = new Projection({
      decisionId: decision._id,
      teamId: decision.teamId,
      simulationId: decision.simulationId,
      roundNumber: decision.roundNumber,
      projections: result.projections,
      pnl: transformedPnl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Save projections to the database
    await projection.save();

    // Emit a WebSocket event
    io.emit("projectionsCreated", { simulationId: decision.simulationId });

    // Respond to the client
    // res.status(201).json({ message: 'Projections created successfully.', projection });
    return; // Stop further execution
  } catch (error) {
    console.error("Error in createProjections:", error);

    // Prevent multiple responses
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error." });
    }
    return; // Stop further execution
  }
};

export const getProjectionsByDecisionId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { decisionId } = req.params;

    // Validate if decisionId is provided
    if (!decisionId) {
      res.status(400).json({ error: "Decision ID is required." });
      return;
    }

    // Fetch the projection associated with the decisionId
    const projection = await Projection.findOne({ decisionId });

    // Check if projection exists
    if (!projection) {
      res
        .status(404)
        .json({ error: `No projection found for Decision ID ${decisionId}.` });
      return;
    }

    // Respond with the projection data
    res.status(200).json(projection);
  } catch (error) {
    console.error("Error in getProjectionsByDecisionId:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const hardcodedDecisionByproductNameByproductBu: {
  [productBuKey in string]: {
    [typeKey in string]: { [decisionField in string]: number };
  };
} = {
  "Mass Consumer": {
    Deposit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Loan: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Credit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Investment: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Transaction: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
  },
  "Affluent Consumer": {
    Deposit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Loan: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Credit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Investment: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Transaction: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
  },
  SME: {
    Deposit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Loan: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Credit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Investment: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Transaction: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
  },
  Corporate: {
    Deposit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Loan: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Credit: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Investment: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
    Transaction: {
      interestRate: 0.05,
      marketingSpend: 1000,
      fees: 50,
      productLevel: 1,
      risk: 0.1,
      commission: 10,
    },
  },
};

const getHardcodedDecisionDetails = async (productBu: string) => {
  const products = await Product.find({ productBu: productBu }).lean();

  return products.map((p) => {
    const decisionDetails =
      hardcodedDecisionByproductNameByproductBu[p.productBu]?.[p.productName] ||
      {};

    return {
      ...decisionDetails,
      productId: p._id,
    };
  });
};

export const getLatestProjection = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({ message: "Latest projection not implemented." });

  // try {
  //   const productBu = req.query.productBu;

  //   const user = (req as any).user;

  //   // Validate if teamId is provided
  //   if (!user.teamId) {
  //     res.status(400).json({ error: "Team ID is required." });
  //     return;
  //   }

  //   // Find the simulation to get the active round
  //   const simulation = await Simulation.findById(user.simulationId);

  //   if (!simulation) {
  //     res
  //       .status(404)
  //       .json({ error: `No simulation found for Team ID ${user.teamId}.` });
  //     return;
  //   }

  //   const activeRoundNumber = simulation.config.currRounds;

  //   // Fetch the latest projection associated with the teamId and active round
  //   let latestProjection: ExtendedProjection | null =
  //     await Projection.aggregate([
  //       {
  //         $match: {
  //           teamId: new mongoose.Types.ObjectId(user.teamId),
  //           simulationId: new mongoose.Types.ObjectId(user.simulationId),
  //           roundNumber: activeRoundNumber,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "decisions",
  //           localField: "decisionId",
  //           foreignField: "_id",
  //           as: "decision",
  //           pipeline: [
  //             {
  //               $match: {
  //                 productBu: productBu,
  //               },
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$decision",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $match: {
  //           "decision.productBu": productBu,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "products", // Name of the collection to join
  //           localField: "pnl.productId", // Field in Order
  //           foreignField: "_id", // Field in Product
  //           as: "productData",
  //         },
  //       },
  //       {
  //         $set: {
  //           pnl: {
  //             $map: {
  //               input: "$pnl",
  //               as: "pnlElement",
  //               in: {
  //                 $mergeObjects: [
  //                   "$$pnlElement", // Keep existing fields
  //                   {
  //                     product: {
  //                       $arrayElemAt: [
  //                         {
  //                           $filter: {
  //                             input: "$productData",
  //                             as: "prod",
  //                             cond: {
  //                               $eq: ["$$prod._id", "$$pnlElement.productId"],
  //                             },
  //                           },
  //                         },
  //                         0,
  //                       ],
  //                     },
  //                   },
  //                 ],
  //               },
  //             },
  //           },
  //         },
  //       },
  //       { $unset: "productData" },
  //       {
  //         $sort: {
  //           createdAt: -1,
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           teamId: 1,
  //           simulationId: 1,
  //           roundNumber: 1,
  //           decision: 1,
  //           kpi: 1,
  //           pnl: 1,
  //         },
  //       },
  //     ])
  //       .then((projections) => {
  //         return projections[0];
  //       })
  //       .catch((error) => {
  //         console.error("Error in aggregation:", error);
  //         return null;
  //       });

  //   // Fetch the previous round projection associated with the teamId
  //   const previousProjection: ExtendedProjection | null =
  //     await Projection.aggregate([
  //       {
  //         $match: {
  //           teamId: new mongoose.Types.ObjectId(user.teamId),
  //           simulationId: new mongoose.Types.ObjectId(user.simulationId),
  //           roundNumber: activeRoundNumber - 1,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "decisions",
  //           localField: "decisionId",
  //           foreignField: "_id",
  //           as: "decision",
  //           pipeline: [
  //             {
  //               $match: {
  //                 productBu: productBu,
  //               },
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$decision",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $match: {
  //           "decision.productBu": productBu,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "products", // Name of the collection to join
  //           localField: "pnl.productId", // Field in Order
  //           foreignField: "_id", // Field in Product
  //           as: "productData",
  //         },
  //       },
  //       {
  //         $set: {
  //           pnl: {
  //             $map: {
  //               input: "$pnl",
  //               as: "pnlElement",
  //               in: {
  //                 $mergeObjects: [
  //                   "$$pnlElement", // Keep existing fields
  //                   {
  //                     product: {
  //                       $arrayElemAt: [
  //                         {
  //                           $filter: {
  //                             input: "$productData",
  //                             as: "prod",
  //                             cond: {
  //                               $eq: ["$$prod._id", "$$pnlElement.productId"],
  //                             },
  //                           },
  //                         },
  //                         0,
  //                       ],
  //                     },
  //                   },
  //                 ],
  //               },
  //             },
  //           },
  //         },
  //       },
  //       { $unset: "productData" },
  //       {
  //         $sort: {
  //           createdAt: -1,
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           teamId: 1,
  //           simulationId: 1,
  //           roundNumber: 1,
  //           decision: 1,
  //           kpi: 1,
  //           pnl: 1,
  //         },
  //       },
  //     ])
  //       .then((projections) => {
  //         return projections[0];
  //       })
  //       .catch((error) => {
  //         console.error("Error in aggregation:", error);
  //         return null;
  //       });

  //   let prevRoundKPI: Record<string, number> = {};
  //   let prevRoundProjection = null;

  //   // Include the previous round projection if it exists
  //   if (previousProjection) {
  //     prevRoundKPI = previousProjection.kpi;
  //     prevRoundProjection = previousProjection;
  //     // latestProjection.prevRoundProjection = previousProjection.projections;
  //   } else {
  //     const hardcodedPastProjection = pastProjections.find(
  //       (pp) => pp.productBu === productBu
  //     );

  //     const hardcodedDecisionDetails = await getHardcodedDecisionDetails(
  //       productBu?.toString() || ""
  //     );

  //     prevRoundKPI = hardcodedPastProjection?.kpi || {};
  //     prevRoundProjection = {
  //       ...(hardcodedPastProjection || {}),
  //       decision: { decisionDetails: hardcodedDecisionDetails },
  //     };
  //   }

  //   // Check if decision is populated
  //   if (!latestProjection || !latestProjection.decision) {
  //     res.status(404).json({
  //       error: `No projection found for Team ID ${user.teamId}.`,
  //       prevRoundKPI,
  //       prevRoundProjection,
  //     });
  //     return;
  //   }

  //   latestProjection.prevRoundKPI = prevRoundKPI;
  //   latestProjection.prevRoundProjection =
  //     prevRoundProjection as unknown as ExtendedProjection;

  //   // Respond with the latest projection data
  //   res.status(200).json(latestProjection);
  // } catch (error) {
  //   console.error("Error in getLatestProjection:", error);
  //   res.status(500).json({ error: "Internal server error." });
  // }
};

export const getCurrentRoundProjection = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Validate if teamId is provided
    if (!user.teamId) {
      res.status(400).json({ error: "Team ID is required." });
      return;
    }

    // Find the simulation to get the active round
    const simulation = await Simulation.findById(user.simulationId);

    if (!simulation) {
      res
        .status(404)
        .json({ error: `No simulation found for Team ID ${user.teamId}.` });
      return;
    }

    const currentRoundNumber = simulation.config.currRounds;

    const projections = await Projection.findOne({
      teamId: user.teamId,
      roundNumber: currentRoundNumber,
    })
      .sort({ createdAt: -1 })
      .populate("decision")
      .populate("pnl.product");

    if (!projections) {
      res.status(404).json({
        error: `No projections found for Team ID ${user.teamId} in round ${currentRoundNumber}.`,
      });
      return;
    }

    res.status(200).json(projections);
  } catch (err) {
    console.error("Error in getCurrentRoundProjections:", err);
    res.status(500).json({ error: "Internal server error." });
  }
};

export const getPrevRoundProjections = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Validate if teamId is provided
    if (!user.teamId) {
      res.status(400).json({ error: "Team ID is required." });
      return;
    }

    // Find the simulation to get the active round
    const simulation = await Simulation.findById(user.simulationId);

    if (!simulation) {
      res
        .status(404)
        .json({ error: `No simulation found for Team ID ${user.teamId}.` });
      return;
    }

    const previousRoundNumber = simulation.config.currRounds - 1;

    // Fetch the latest projection associated with the teamId and previous round
    const previousProjection = await Projection.findOne({
      teamId: user.teamId,
      roundNumber: previousRoundNumber,
    })
      .sort({ createdAt: -1 })
      .populate("decision");

    // Check if projection exists
    if (!previousProjection) {
      res.status(404).json({
        error: `No projection found for Team ID ${user.teamId} in the previous round.`,
      });
      return;
    }

    // Respond with the previous projection data
    res.status(200).json(previousProjection);
  } catch (error) {
    console.error("Error in getPreviousProjections:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const projectionAggregate = async (
  teamId: string,
  simulationId: string,
  currentRoundNumber: number
) => {
  let projectionsByRound: Record<number, ProjectionInterface> = {};

  for (let i = 1; i <= currentRoundNumber; i++) {
    // const pipeline: PipelineStage[] = [
    //   // Match projections by teamId and simulationId
    //   {
    //     $match: {
    //       teamId: new mongoose.Types.ObjectId(teamId),
    //       simulationId: new mongoose.Types.ObjectId(simulationId),
    //       roundNumber: i,
    //     },
    //   },
    //   {
    //     $sort: {
    //       createdAt: -1,
    //     },
    //   },
    //   // Lookup to decisions collection
    //   {
    //     $lookup: {
    //       from: "decisions",
    //       localField: "decisionId",
    //       foreignField: "_id",
    //       as: "decision",
    //     },
    //   },
    //   // Unwind the decision array
    //   {
    //     $unwind: {
    //       path: "$decision",
    //       preserveNullAndEmptyArrays: true,
    //     },
    //   },
    //   // // Filter by productBu if provided
    //   // ...(productBu
    //   //   ? [
    //   //       {
    //   //         $match: {
    //   //           "decision.productBu": productBu,
    //   //         },
    //   //       },
    //   //     ]
    //   //   : []),
    //   // Lookup products for bizperf
    //   // {
    //   //   $lookup: {
    //   //     from: "products",
    //   //     localField: "bizperf.productId",
    //   //     foreignField: "_id",
    //   //     as: "bizperfProducts",
    //   //   },
    //   // },
    //   // Lookup products for pnl
    //   // {
    //   //   $lookup: {
    //   //     from: "products",
    //   //     localField: "pnl.productId",
    //   //     foreignField: "_id",
    //   //     as: "pnlProducts",
    //   //   },
    //   // },
    //   // Lookup products for balanceSheet
    //   // {
    //   //   $lookup: {
    //   //     from: "products",
    //   //     localField: "balanceSheet.productId",
    //   //     foreignField: "_id",
    //   //     as: "balanceSheetProducts",
    //   //   },
    //   // },
    //   // Reshape bizperf with populated products
    //   // {
    //   //   $set: {
    //   //     bizperf: {
    //   //       $map: {
    //   //         input: "$bizperf",
    //   //         as: "bizperfItem",
    //   //         in: {
    //   //           $mergeObjects: [
    //   //             "$$bizperfItem",
    //   //             {
    //   //               product: {
    //   //                 $arrayElemAt: [
    //   //                   {
    //   //                     $filter: {
    //   //                       input: "$bizperfProducts",
    //   //                       as: "prod",
    //   //                       cond: {
    //   //                         $eq: ["$$prod._id", "$$bizperfItem.productId"],
    //   //                       },
    //   //                     },
    //   //                   },
    //   //                   0,
    //   //                 ],
    //   //               },
    //   //             },
    //   //           ],
    //   //         },
    //   //       },
    //   //     },
    //   //   },
    //   // },
    //   // // Reshape pnl with populated products
    //   // {
    //   //   $set: {
    //   //     pnl: {
    //   //       $map: {
    //   //         input: "$pnl",
    //   //         as: "pnlItem",
    //   //         in: {
    //   //           $mergeObjects: [
    //   //             "$$pnlItem",
    //   //             {
    //   //               product: {
    //   //                 $arrayElemAt: [
    //   //                   {
    //   //                     $filter: {
    //   //                       input: "$pnlProducts",
    //   //                       as: "prod",
    //   //                       cond: {
    //   //                         $eq: ["$$prod._id", "$$pnlItem.productId"],
    //   //                       },
    //   //                     },
    //   //                   },
    //   //                   0,
    //   //                 ],
    //   //               },
    //   //             },
    //   //           ],
    //   //         },
    //   //       },
    //   //     },
    //   //   },
    //   // },
    //   // Reshape balanceSheet with populated products
    //   // {
    //   //   $set: {
    //   //     balanceSheet: {
    //   //       $map: {
    //   //         input: "$balanceSheet",
    //   //         as: "bsItem",
    //   //         in: {
    //   //           $mergeObjects: [
    //   //             "$$bsItem",
    //   //             {
    //   //               product: {
    //   //                 $arrayElemAt: [
    //   //                   {
    //   //                     $filter: {
    //   //                       input: "$balanceSheetProducts",
    //   //                       as: "prod",
    //   //                       cond: { $eq: ["$$prod._id", "$$bsItem.productId"] },
    //   //                     },
    //   //                   },
    //   //                   0,
    //   //                 ],
    //   //               },
    //   //             },
    //   //           ],
    //   //         },
    //   //       },
    //   //     },
    //   //   },
    //   // },
    //   // Remove temporary arrays
    //   {
    //     $unset: ["bizperfProducts", "balanceSheetProducts"],
    //   },
    //   // Sort by round number and creation date
    //   // {
    //   //   $sort: {
    //   //     roundNumber: 1,
    //   //     createdAt: -1,
    //   //   },
    //   // },
    // ];

    // let projectionPerRound = await Projection.aggregate(pipeline).then(
    //   (projections) => projections[0]
    // );

    let projectionPerRound = await Projection.findOne({
      teamId: new mongoose.Types.ObjectId(teamId),
      simulationId: new mongoose.Types.ObjectId(simulationId),
      roundNumber: i,
    }).sort({ createdAt: -1 });

    if (!projectionPerRound) {
      continue;
    }

    projectionsByRound[i] = projectionPerRound;
  }

  return projectionsByRound;

  // return Projection.aggregate(pipeline).allowDiskUse(true);
};

export const getProjections = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Validate if teamId and simulationId are provided
    if (!user.teamId || !user.simulationId) {
      res
        .status(400)
        .json({ error: "Team ID and Simulation ID are required." });
      return;
    }

    const simulation = await Simulation.findById(user.simulationId);

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found." });
      return;
    }
    const currentRoundNumber = simulation.config.currRounds;

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    ).lean();
    const offset = simulationType?.comparisonRoundOffset || 1;

    const prevRoundResultOverall = await Result.findOne({
      simulationId: new mongoose.Types.ObjectId(user.simulationId),
      roundNumber: currentRoundNumber - offset,
    })
      .sort({ createdAt: -1 })
      .lean();

    let thisTeamPrevRoundResult: any = prevRoundResultOverall?.teams.find(
      (t) => t.teamId.toString() === user.teamId.toString()
    );

    const currentRoundProjection = await Projection.findOne({
      teamId: new mongoose.Types.ObjectId(user.teamId),
      simulationId: new mongoose.Types.ObjectId(user.simulationId),
      roundNumber: currentRoundNumber,
    })
      .sort({ createdAt: -1 })
      .lean();

    const productsInSelectedproductBu = await Product.find({
      productBu: req.query.productBu?.toString(),
    });

    const hardcodedRound0ProjectionForCumulativeFeedback = {
      roundNumber: 0,
      bizperf: (productsInSelectedproductBu || []).map((p) => ({
        p,
        productId: p._id,
        ...(p.productName === "Deposit"
          ? {
              "Total Number of Accounts": 12302804,
              "Avg Deposits per Customer": 5500,
              "Total Deposits": 61514020000,
              "Interest Income": 1845420600,
              "Interest Expense": 676654220,
              "Net Interest Income": 1168766380,
              "Fees Income": 159936452,
              "Other Non-Interest Income Total": 256206080,
              "Non-Interest Income": 416142532,
              "% Non-Interest Income": 0.2626,
              "Total Revenue": 1584908912,
            }
          : p.productName === "Loan"
            ? {
                "Total Loans": 201,
                "Total No of Accounts": 16,
                "Avg Loans per Customer": 16,
                "Total Revenue": 12,
                "Interest Income": 12,
                "Non-Interest Income": 12,
                "Interest Expense": 12,
                "Net Interest Income": 12,
                "Revenue per Customer": 12,
              }
            : p.productName === "Credit"
              ? {
                  "Total Balance": 201,
                  "Total No of Cards": 7875001,
                  "Avg Balance per Customer": 16,
                  "Total Revenue": 12,
                  "% Interest Income": 12,
                  "Fees Income": 12,
                  "Other Non-Interest Income Total": 12,
                  "Revenue per Customer": 12,
                }
              : p.productName === "Investment"
                ? {
                    "Total Revenue": 12,
                    "Interest Income": 16,
                    "Interest Expense": 16,
                    "Net Interest Income": 201,
                    "Non-Interest Income": 12,
                    "Revenue per Customer": 12,
                  }
                : {}),
      })),
      balanceSheet: productsInSelectedproductBu.map((p) => ({
        p,
        productId: p._id,
        assets: {
          cashAndCashEquivalents: 5000000,
          loansAndAdvances: 30000000,
          investments: 10000000,
          fixedAssets: 2000000,
        },
        liabilities: {
          deposits: 40000000,
          borrowings: 5000000,
          otherLiabilities: 1000000,
        },
        equity: {
          shareCapital: 5000000,
          retainedEarnings: 3000000,
        },
      })),
      cashflow: productsInSelectedproductBu.map((p) => ({
        p,
        productId: p._id,
        operatingActivities: {
          interestIncome: 12000000,
          interestExpense: -8000000,
          netFeeIncome: 2000000,
        },
        investingActivities: {
          purchaseOfInvestments: -3000000,
          proceedsFromInvestments: 4000000,
          purchaseOfFixedAssets: -1000000,
        },
        financingActivities: {
          issuanceOfShares: 2000000,
          repaymentOfBorrowings: -1000000,
          dividendPaid: -500000,
        },
      })),
    };

    if (!thisTeamPrevRoundResult) {
      thisTeamPrevRoundResult = hardcodedRound0ProjectionForCumulativeFeedback;
    }

    const balanceSheetConfig = await BalanceSheetConfig.findOne({
      simulationTypeId: simulation.simulationTypeId,
    });

    const cashflowConfig = await CashflowConfig.findOne({
      simulationTypeId: simulation.simulationTypeId,
    });

    const bizperfConfig = await BizPerfConfig.findOne({
      simulationTypeId: simulation.simulationTypeId,
    });

    const pnlConfig = await PnLConfig.findOne({
      simulationTypeId: simulation.simulationTypeId,
    });

    // Respond with the latest projections data
    res.status(200).json([
      {
        ...thisTeamPrevRoundResult,
        roundNumber: currentRoundNumber - offset,
        cashflow: CashflowFieldHelper.transformCashflowArray(
          thisTeamPrevRoundResult?.cashflow || [],
          cashflowConfig
        ),
        balanceSheet: BalanceSheetFieldHelper.transformBalanceSheetArray(
          thisTeamPrevRoundResult?.balanceSheet || [],
          balanceSheetConfig
        ),
        bizperf: BizPerfFieldHelper.transformBizPerfArray(
          thisTeamPrevRoundResult?.bizperf || [],
          bizperfConfig
        ),
        bizperfRaw: thisTeamPrevRoundResult?.bizperf || [],
        pnl: PnLFieldHelper.transformPnLArray(
          thisTeamPrevRoundResult?.pnl || [],
          pnlConfig
        ),
        cashflowConfig: cashflowConfig
          ? {
              showGroupHeaders: cashflowConfig.showGroupHeaders,
            }
          : undefined,
      },
      {
        ...currentRoundProjection,
        cashflow: CashflowFieldHelper.transformCashflowArray(
          currentRoundProjection?.cashflow || [],
          cashflowConfig
        ),
        balanceSheet: BalanceSheetFieldHelper.transformBalanceSheetArray(
          currentRoundProjection?.balanceSheet || [],
          balanceSheetConfig
        ),
        bizperf: BizPerfFieldHelper.transformBizPerfArray(
          currentRoundProjection?.bizperf || [],
          bizperfConfig
        ),
        bizperfRaw: currentRoundProjection?.bizperf || [],
        pnl: PnLFieldHelper.transformPnLArray(
          currentRoundProjection?.pnl || [],
          pnlConfig
        ),
        cashflowConfig: cashflowConfig
          ? {
              showGroupHeaders: cashflowConfig.showGroupHeaders,
            }
          : undefined,
      },
    ]);
  } catch (error) {
    console.error("Error in getProjections:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const aggregateProjection = async ({
  teamId,
  simulationId,
  roundNumber,
  productBu,
}: {
  teamId: mongoose.Types.ObjectId;
  simulationId: mongoose.Types.ObjectId;
  roundNumber: number;
  productBu: string;
}): Promise<ExtendedProjection | null> => {
  return Projection.aggregate([
    {
      $match: {
        teamId,
        simulationId,
        roundNumber,
      },
    },
    {
      $lookup: {
        from: "decisions",
        localField: "decisionId",
        foreignField: "_id",
        as: "decision",
        pipeline: [
          {
            $match: {
              productBu,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$decision",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "decision.productBu": productBu,
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "pnl.productId",
        foreignField: "_id",
        as: "productData",
      },
    },
    {
      $set: {
        pnl: {
          $map: {
            input: "$pnl",
            as: "pnlElement",
            in: {
              $mergeObjects: [
                "$$pnlElement",
                {
                  product: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$productData",
                          as: "prod",
                          cond: {
                            $eq: ["$$prod._id", "$$pnlElement.productId"],
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
    { $unset: "productData" },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 1,
        teamId: 1,
        simulationId: 1,
        roundNumber: 1,
        decision: 1,
        kpi: 1,
        pnl: 1,
      },
    },
  ])
    .then((projections) => projections[0])
    .catch((error) => {
      console.error("Error in aggregation:", error);
      return null;
    });
};

const getProjectionsForproductBus = async (
  user: any,
  currentRoundNumber: number,
  productBus: string[]
) => {
  const latestProjections: Array<ExtendedProjection | HardcodedPastProjection> =
    [];
  const prevRoundProjections: Array<
    ExtendedProjection | HardcodedPastProjection
  > = [];

  for (const productBu of productBus) {
    const latestProjection: ExtendedProjection | null =
      await aggregateProjection({
        teamId: new mongoose.Types.ObjectId(user.teamId),
        simulationId: new mongoose.Types.ObjectId(user.simulationId),
        roundNumber: currentRoundNumber,
        productBu,
      });

    if (latestProjection && latestProjection.decision) {
      latestProjections.push(latestProjection);
    } else {
      const prevRoundProjection: ExtendedProjection | null =
        await aggregateProjection({
          teamId: new mongoose.Types.ObjectId(user.teamId),
          simulationId: new mongoose.Types.ObjectId(user.simulationId),
          roundNumber: currentRoundNumber - 1,
          productBu,
        });

      if (prevRoundProjection && prevRoundProjection.decision) {
        latestProjections.push(prevRoundProjection);
      } else {
        const hardcodedPrevRoundProjectionWithCurrentproductBu =
          pastProjections.find((pp) => pp.productBu === productBu);

        if (hardcodedPrevRoundProjectionWithCurrentproductBu !== undefined) {
          latestProjections.push(
            hardcodedPrevRoundProjectionWithCurrentproductBu
          );
        }
      }
    }

    // Handle previous round projections
    if (currentRoundNumber > 1) {
      const prevRoundProjection: ExtendedProjection | null =
        await aggregateProjection({
          teamId: new mongoose.Types.ObjectId(user.teamId),
          simulationId: new mongoose.Types.ObjectId(user.simulationId),
          roundNumber: currentRoundNumber - 1,
          productBu,
        });

      if (prevRoundProjection && prevRoundProjection.decision) {
        prevRoundProjections.push(prevRoundProjection);
      } else {
        const hardcodedPrevRoundProjectionWithCurrentproductBu =
          pastProjections.find((pp) => pp.productBu === productBu);

        if (hardcodedPrevRoundProjectionWithCurrentproductBu !== undefined) {
          prevRoundProjections.push(
            hardcodedPrevRoundProjectionWithCurrentproductBu
          );
        }
      }
    } else {
      // Use hardcoded projections for round 1
      const hardcodedPrevRoundProjectionWithCurrentproductBu =
        pastProjections.find((pp) => pp.productBu === productBu);

      if (hardcodedPrevRoundProjectionWithCurrentproductBu !== undefined) {
        prevRoundProjections.push(
          hardcodedPrevRoundProjectionWithCurrentproductBu
        );
      }
    }
  }

  return { latestProjections, prevRoundProjections };
};

export const getLatestCombinedKPI = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;
    const { simulationId } = user;

    const simulation = await Simulation.findById(simulationId);

    if (!simulation) {
      res
        .status(404)
        .json({ error: `No simulation found for Team ID ${user.teamId}.` });
      return;
    }

    const currentRoundNumber = simulation.config.currRounds;
    const productBus = [
      "Mass Consumer",
      "Affluent Consumer",
      "SME",
      "Corporate",
    ];

    const { latestProjections, prevRoundProjections } =
      await getProjectionsForproductBus(user, currentRoundNumber, productBus);

    const combinedKPI = latestProjections.reduce(
      (acc: any, projection: any, index, array) => {
        acc.revenue += projection.kpi.revenue || 0;
        acc.csat += projection.kpi.csat || 0;
        acc.esat += projection.kpi.esat || 0;
        acc.cir += projection.kpi.cir || 0;
        acc.profit += projection.kpi.profit || 0;

        if (index === array.length - 1) {
          acc.csat /= array.length;
          acc.esat /= array.length;
        }

        return acc;
      },
      {
        revenue: 0,
        csat: 0,
        esat: 0,
        cir: 0,
        profit: 0,
      }
    );

    const prevRoundCombinedKPI = prevRoundProjections.reduce(
      (acc: any, projection: any, index, array) => {
        acc.revenue += projection.kpi.revenue || 0;
        acc.csat += projection.kpi.csat || 0;
        acc.esat += projection.kpi.esat || 0;
        acc.cir += projection.kpi.cir || 0;
        acc.profit += projection.kpi.profit || 0;

        if (index === array.length - 1) {
          acc.csat /= array.length;
          acc.esat /= array.length;
        }

        return acc;
      },
      {
        revenue: 0,
        csat: 0,
        esat: 0,
        cir: 0,
        profit: 0,
      }
    );

    res.status(200).json({ combinedKPI, prevRoundCombinedKPI });
  } catch (error) {
    console.error("Error fetching combined KPI:", error);
    res.status(500).json({ error: "Failed to retrieve combined KPI" });
  }
};
