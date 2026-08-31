import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/products";
import Projection from "../models/projections";
import { ROLES } from "../constants/roles";
import BaseData from "../models/baseData";
import Round from "../models/rounds";
import { calcFinancials, readCostTreatment, toProjectionMetrics, ProductField, BaseVariables } from "../sim/calcFinancials";

// GET /projections?simulationId=&teamId=&roundNumber=
export const getProjectionsByTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    const caller = (req as any).user ?? {};

    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    /**
     * ── A TEAM MAY ONLY EVER READ ITSELF ────────────────────────────────
     * This route took `teamId` straight from the query with no role check,
     * so any team token could read any other team's P&L, cash and cost
     * breakdown — mid-round, while they were still competing. Scoping to the
     * token closes that; a team asking for someone else now silently gets its
     * own row rather than an error, because the request is not one a correct
     * client can make.
     */
    const isTeam = caller.role === ROLES.TEAM;
    const teamId = isTeam ? caller.teamId : req.query.teamId;

    // Staff may omit teamId entirely to read the whole cohort — that is what
    // the debrief's charts are built from. A team may not.
    if (!teamId && isTeam) {
      res.status(403).json({ message: "This token can only read its own projections." });
      return;
    }

    const filter: Record<string, any> = { simulationId };
    if (teamId) filter.teamId = teamId;
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

    /**
     * ── A CALCULATED ROUND IS READ-ONLY ─────────────────────────────────
     * Despite the name, this route is NOT a read-only what-if: it upserts
     * `Projections` on the same `{simulationId, teamId, roundNumber}` key and
     * `$set`s the whole `projections.<productId>` sub-object that the round
     * close writes.
     *
     * Its payload has no `marketShare`, so running it against an already
     * calculated round silently strips the COMPETED share and replaces the
     * official financials with the team's own self-declared what-if numbers —
     * quietly rewriting a scored result with a worse one. The console's
     * standings would keep working and simply be wrong.
     *
     * The round's own status is the authority: a `Completed` round has been
     * scored, so recalculation is refused rather than allowed to overwrite it.
     */
    const round = await Round.findOne({ simulationId, roundNumber });
    if (round?.status === "Completed") {
      res.status(409).json({
        message:
          "Round " +
          roundNumber +
          " has already been scored. Recalculating would overwrite its official " +
          "results with a what-if projection.",
      });
      return;
    }

    const baseData = await BaseData.findOne({ simulationTypeId });
    if (!baseData) {
      res.status(404).json({ message: "Base data not found for this simulation type." });
      return;
    }

    const yearKey = String(roundNumber);

    // helper to get availableMarket for a specific product/segment from baseData
    const getAvailableMarket = (segmentId: string, productId: string): number => {
      const segment = baseData.marketData.segments.find((s: any) =>
        String(s.segmentId) === segmentId
      );
      const product = segment?.products.find((p: any) =>
        String(p.productId) === productId
      );
      return product?.yearlyData?.[yearKey]?.marketSize ?? 0;
    };

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

      // pms comes from the input entry, not from productFields
      const pmsFieldConfig = productFieldConfigs.find((f: any) => f.key === "projected_market_share");
      const availableMarket = getAvailableMarket(String(product.segmentId), String(product._id));
      const pmsEntry = (productFields ?? []).find((f: any) =>
        String(f.fieldId) === String(pmsFieldConfig?._id)
      );

      const pmsRaw          = Number(pmsEntry?.value ?? 20); // default 20%
      const marketShareFraction = Math.min(Math.max(pmsRaw, 0), 1); 

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
          costTreatment:     readCostTreatment(gi),
          energy:            gi.energy,
          productsImpacted:  (gi.productsImpacted ?? []).map((id: any) => new mongoose.Types.ObjectId(id)),
        })),
      };

      const baseVariables: BaseVariables = {
        ...(product.baseVariables as BaseVariables ?? {}),
        availableMarket, // override with year-specific value from baseData
      };
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

      const productKey = String(product._id);

      // Shared shape — see toProjectionMetrics. Do not inline a literal here;
      // the round-close writer must stay in step with this one.
      projectionUpdates[`projections.${productKey}`] = toProjectionMetrics(results[0]);
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