import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/products";
import Team from "../models/teams";

export const getResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { simulationId } = req.query;

    if (!simulationId || typeof simulationId !== "string") {
      res.status(400).json({ error: "simulationId query parameter is required." });
      return;
    }

    const simObjectId = new mongoose.Types.ObjectId(simulationId);

    // Fetch teams and products in parallel, both scoped to the simulation
    const [teams, products] = await Promise.all([
      Team.find({ simulationId: simObjectId }).lean(),
      Product.find({ simulationId: simObjectId }).lean(),
    ]);

    // Map products by productName for O(1) lookup
    const productMap = new Map<string, any>();
    products.forEach((product) => {
      productMap.set(product.productName, product.baseVariables);
    });

    const results = teams.map((team: any) => {
      const teamProducts = (team.products ?? []).map((product: any) => ({
        productName: product.productName,
        inputVariables: product.inputVariables,
        baseVariables: productMap.get(product.productName) ?? null,
      }));

      return { ...team, products: teamProducts };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    next(error);
  }
};