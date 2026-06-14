// routes/index.ts
import { Router } from "express";

import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import simulationRoutes from "./simulationRoutes";
import simulationTypeRoutes from "./simulationTypeRoutes";
import roundRoutes from "./roundRoutes";
import baseDataRoutes from "./baseDataRoutes";
import projectionRoutes from "./projectionRoutes";
import resultRoutes from "./resultRoutes";
import productRoutes from "./productRoutes";
import uploadRoutes from "./uploadRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/simulations", simulationRoutes);
router.use("/simulation-types", simulationTypeRoutes);
router.use("/rounds", roundRoutes);
router.use("/base-data", baseDataRoutes);
router.use("/projections", projectionRoutes);
router.use("/results", resultRoutes);
router.use("/products", productRoutes);
router.use("/upload", uploadRoutes);

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;