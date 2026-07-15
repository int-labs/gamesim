import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/products";
import Projection from "../models/projections";
import { calcFinancials, ProductField, BaseVariables, DecisionGlobalInputEntry } from "../sim/calcFinancials";

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
    const {
      simulationId,
      simulationTypeId,
      teamId,
      roundNumber,
      productId,
      focusedProductId,
      fields,
      globalInputs = [],
    } = req.body;

    if (!simulationId || !simulationTypeId || !teamId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId, simulationTypeId, teamId, and roundNumber are required." });
      return;
    }

    // ── Resolve which products to recompute ───────────────────────────────
    let productsToCalc: any[] = [];

    if (productId) {
      // Single-product mode
      const product = await Product.findById(productId);
      if (!product) {
        res.status(404).json({ message: "Product not found." });
        return;
      }
      productsToCalc = [{ product, fields }];
    } else {
      const allProducts = await Product.find({ simulationTypeId });
      productsToCalc = allProducts.map(product => ({
        product,
        // use submitted fields if this product matches the focused one,
        // empty array for all others (their contribution comes from a separate recalc)
        fields: String(product._id) === String(focusedProductId ?? "")
          ? fields
          : [],
      }));
    }

    // ── Build the in-memory draft decision ────────────────────────────────
    // Single-product mode: use the submitted fields for that product.
    // All-products mode: no product fields submitted — each product
    // contributes an empty fields array (global input change only).
    const teamObjectId = new mongoose.Types.ObjectId(teamId);

    // ── Compute projections for each product ──────────────────────────────
    const projectionUpdates: Record<string, any> = {};

    for (const { product, fields: productFields } of productsToCalc) {
      const productFieldConfigs: ProductField[] = product.fields as unknown as ProductField[];

      const pmsField = productFieldConfigs.find((f) => f.key === "projected_market_share");
      const pmsEntry = (productFields ?? []).find((f: any) => String(f.fieldId) === String(pmsField?._id));
      const pmsRaw   = Number(pmsEntry?.value ?? 0);
      const marketShareFraction = Math.min(Math.max(pmsRaw, 0), 100) / 100;

      const draftDecision = {
        teamId:       teamObjectId,
        inputs:       [{
          productId: product._id,
          fields:    (productFields ?? []).map((f: any) => ({
            fieldId: new mongoose.Types.ObjectId(f.fieldId),
            value:   f.value,
          })),
        }],
        globalInputs: (globalInputs as any[]).map((gi: any) => ({
          globalInputItemId: new mongoose.Types.ObjectId(gi.globalInputItemId),
          category:          gi.category,
          key:               gi.key,
          label:             gi.label,
          selectedStepKey:   gi.selectedStepKey ?? null,
          options:           gi.options,
          impacts:           gi.impacts,
          impactLevel:       gi.impactLevel,
          cost:              gi.cost,
          energy:            gi.energy,
          productsImpacted:  (gi.productsImpacted ?? []).map((id: any) => new mongoose.Types.ObjectId(id)),
        })),
      };

      const baseVariables: BaseVariables = (product.baseVariables as BaseVariables) ?? { availableMarket: 0 };

      // Filter globalInputs to those that impact this specific product
      // (productsImpacted is empty = impacts all products)
      const relevantGlobalInputs = draftDecision.globalInputs.filter((gi: any) =>
        gi.productsImpacted.length === 0 ||
        gi.productsImpacted.some((pid: mongoose.Types.ObjectId) => pid.equals(product._id))
      );

      const { results } = calcFinancials({
        productId:     product._id,
        marketShares:  [{ teamId: teamObjectId, value: marketShareFraction }],
        productFields: productFieldConfigs,
        decisions:     [draftDecision],
        globalInputs:  relevantGlobalInputs,
        baseVariables,
      });

      const { customersObtained, dynamicPrice, dynamicCost, productCostBreakdown, revenue, COGS, grossProfit, incurredCosts, sellingPrice, productScore } = results[0];
      const productKey = String(product._id);

      projectionUpdates[`projections.${productKey}`] = {
        customersObtained,
        dynamicPrice,
        dynamicCost,
        sellingPrice,
        productScore,
        revenue,
        COGS,
        grossProfit,
        productCostBreakdown,
        incurredCosts,
      };
    }

    // ── Upsert all product projections in one operation ───────────────────
    const projection = await Projection.findOneAndUpdate(
      { simulationId, teamId, roundNumber },
      { $set: projectionUpdates },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json(projection);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to recalculate projections." });
  }
};