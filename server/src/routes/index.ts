import { Router } from "express";

import authRoutes           from "./authRoutes";
import userRoutes           from "./userRoutes";
import simulationRoutes     from "./simulationRoutes";
import simulationTypeRoutes from "./simulationTypeRoutes";
import roundRoutes          from "./roundRoutes";
import baseDataRoutes       from "./baseDataRoutes";
import decisionRoutes       from "./decisionsRoutes";
import projectionRoutes     from "./projectionRoutes";
import resultRoutes         from "./resultRoutes";
import productRoutes        from "./productRoutes";
// import uploadRoutes         from "./uploadRoutes";
import driverRoutes         from "./driverRoutes";
import imageAssetsRoutes    from "./imageAssetsRoutes";
import initiativeRoutes     from "./initiativeRoutes";
import paramRoutes          from "./paramRoutes";
import teamRoutes           from "./teamRoutes";
import segmentRoutes        from "./segmentRoutes";
import globalInputRoutes    from "./globalInputRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/simulations", simulationRoutes);
router.use("/simulation-types", simulationTypeRoutes);
router.use("/rounds", roundRoutes);
router.use("/base-data", baseDataRoutes);
router.use("/decisions", decisionRoutes);
router.use("/projections", projectionRoutes);
router.use("/results", resultRoutes);
router.use("/products", productRoutes);
router.use("/drivers", driverRoutes);
router.use("/param-list", paramRoutes);
router.use("/teams", teamRoutes);
router.use("/segments", segmentRoutes);
router.use("/global-inputs", globalInputRoutes);
// router.use("/upload", uploadRoutes);
router.use("/image-assets", imageAssetsRoutes);
router.use("/initiatives", initiativeRoutes);

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;