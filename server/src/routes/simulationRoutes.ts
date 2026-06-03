import express from "express";

import {
  createPredefinedDecisions,
  getPredefinedDecision,
} from "../controllers/decisionControllers";
import {
  createSimulation,
  createSimulationWithDecisions,
  deleteSimulation,
  endCurrentRound,
  getAllSimulations,
  getAnalysisReportPreview,
  getCurrentRoundAnalysis,
  getProductUnlockState,
  getSimulationAnalysisByRound,
  getSimulationAvailability,
  getSimulationByName,
  getSimulationCompetitorReportByRound,
  getSimulationFeedbackByRound,
  getSimulationProjections,
  getSimulationWinningMetrics,
  getSimulationWinningMetricsWithComparison,
  goToNextRoundWithoutStarting,
  recalculateByRound,
  startCurrentRound,
  startNextRound,
} from "../controllers/simulationControllers";
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getAllSimulations
);
router.get(
  "/availability",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getSimulationAvailability
);
router.post(
  "/",
  authenticate,
  authorize(["admin", "operator", "client"]),
  createSimulation
);
router.post(
  "/create-with-decisions",
  authenticate,
  authorize(["admin", "operator", "client"]),
  createSimulationWithDecisions
);
router.get(
  "/:simulationNameOrSimulationId",
  authenticate,
  authorize(["admin", "operator", "client", "team"]),
  getSimulationByName
);
router.delete(
  "/:simulationId",
  authenticate,
  authorize(["admin"]),
  deleteSimulation
);
router.post(
  "/:simulationId/end-round",
  authenticate,
  authorize(["admin", "operator", "client"]),
  endCurrentRound
);
router.post(
  "/:simulationId/start-round",
  authenticate,
  authorize(["admin", "operator", "client"]),
  startNextRound
);
router.post(
  "/:simulationId/start-current-round",
  authenticate,
  authorize(["admin", "operator", "client"]),
  startCurrentRound
);
router.post(
  "/:simulationId/next-round",
  authenticate,
  authorize(["admin", "operator", "client"]),
  goToNextRoundWithoutStarting
);
router.get(
  "/:simulationId/projections",
  authenticate,
  authorize(["admin", "operator", "client", "team"]),
  getSimulationProjections
);
router.post(
  "/:simulationId/recalculate/:roundNumber",
  authenticate,
  authorize(["admin", "operator", "client"]),
  recalculateByRound
);
router.get(
  "/:simulationId/winning-metrics",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getSimulationWinningMetrics
);
router.get(
  "/:simulationId/winning-metrics-with-comparison",
  authenticate,
  authorize(["team"]),
  getSimulationWinningMetricsWithComparison
);
// router.get("/:simulationId/analysis", authenticate, authorize(["admin"]), getSimulationAnalysis);
router.get(
  "/:simulationId/analysis/current-round",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getCurrentRoundAnalysis
);
router.get(
  "/:simulationId/feedback-sheet/:roundNumber",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getSimulationFeedbackByRound
);
router.get(
  "/:simulationId/analysis-sheet/:roundNumber",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getSimulationAnalysisByRound
);
router.get(
  "/:simulationId/competitor-report/:roundNumber",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getSimulationCompetitorReportByRound
);

router.get(
  "/:simulationId/predefined-decision",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getPredefinedDecision
);
router.post(
  "/:simulationId/predefined-decisions",
  authenticate,
  authorize(["admin", "operator", "client"]),
  createPredefinedDecisions
);
router.get(
  "/:simulationId/analysis/current-round/preview",
  authenticate,
  authorize(["admin", "operator", "client"]),
  getAnalysisReportPreview
);
router.get(
  "/:simulationId/teams/:teamId/product-unlock-state",
  authenticate,
  authorize(["admin", "team", "operator", "client"]),
  getProductUnlockState
);

export default router;
