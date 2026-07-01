import { Request, Response } from "express";
import mongoose from "mongoose";
import Projection from "../models/projections";
import Product from "../models/products";
import Projections from "../models/projections";
import { calcFinancials, ProductField, BaseVariables } from "../sim/calcFinancials";


// GET /projections?simulationId=&teamId=&roundNumber=
export const getProjectionsByTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.query;

    if (!simulationId || !teamId) {
      res.status(400).json({ message: "simulationId and teamId are required." });
      return;
    }

    const filter: Record<string, any> = { simulationId, teamId };
    if (roundNumber !== undefined) filter.roundNumber = Number(roundNumber);

    const projections = await Projection.find(filter).sort({ roundNumber: 1 });
    res.status(200).json(projections);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch projections." });
  }
};

// GET /projections/:id
export const getProjectionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const projection = await Projection.findById(req.params.id);
    if (!projection) {
      res.status(404).json({ message: "Projection not found." });
      return;
    }
    res.status(200).json(projection);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch projection." });
  }
};

// DELETE /projections/:id
export const deleteProjection = async (req: Request, res: Response): Promise<void> => {
  try {
    const projection = await Projection.findByIdAndDelete(req.params.id);
    if (!projection) {
      res.status(404).json({ message: "Projection not found." });
      return;
    }
    res.status(200).json({ message: "Projection deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete projection." });
  }
};

export const recalcProjections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber, productId, fields } = req.body;

    if (!simulationId || !teamId || roundNumber === undefined || !productId || !Array.isArray(fields)) {
      res.status(400).json({ message: "simulationId, teamId, roundNumber, productId, and fields are required." });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }

    const productFields: ProductField[] = product.fields as unknown as ProductField[];

    // Resolve the team's own projected_market_share from the in-progress
    // draft fields, rather than from a saved Decision (none exists yet).
    const pmsField = productFields.find((f) => f.key === "projected_market_share");
    const pmsEntry = fields.find((f: any) => String(f.fieldId) === String(pmsField?._id));
    const pmsRaw   = Number(pmsEntry?.value ?? 0);
    const marketShareFraction = Math.min(Math.max(pmsRaw, 0), 100) / 100;

    // One-off in-memory "decision" — never saved, just feeds calcFinancials.
    const draftDecision = {
      teamId: new mongoose.Types.ObjectId(teamId),
      inputs: [{
        productId: new mongoose.Types.ObjectId(productId),
        fields: fields.map((f: any) => ({
          fieldId: new mongoose.Types.ObjectId(f.fieldId),
          value:   f.value,
        })),
      }],
      globalInputs: [],
    };

    const baseVariables: BaseVariables = (product.baseVariables as BaseVariables) ?? { availableMarket: 0 };

    const { results } = calcFinancials({
      productId: new mongoose.Types.ObjectId(productId),
      marketShares:  [{ teamId: draftDecision.teamId, value: marketShareFraction }],
      productFields,
      decisions:     [draftDecision],
      globalInputs:  [], // deferred — not part of this stage
      baseVariables,
    });

    const { customersObtained, dynamicPrice, dynamicCost, productCostBreakdown, revenue } = results[0];

    // productKey: using productId as the string key — flag if a different
    // identifier (e.g. a product "key" field) was intended instead.
    const productKey = String(productId);

    const projection = await Projections.findOneAndUpdate(
      { simulationId, teamId, roundNumber },
      {
        $set: {
          [`projections.${productKey}`]: {
            customersObtained,
            dynamicPrice,
            dynamicCost,
            revenue,
            productCostBreakdown,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json(projection);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to recalculate projections." });
  }
};
