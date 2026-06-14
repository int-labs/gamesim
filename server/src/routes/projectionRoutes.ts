import { Router } from "express";
import {
  getProjectionsByTeam,
  getProjectionById,
  submitDecision,
  recalcProjections,
  deleteProjection,
} from "../controllers/projectionControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /projections?simulationId=&teamId=&roundNumber=
//          → fetch projections for a team (filtered by sim / round)
//
// POST   /projections/submit
//          → team submits decisions for a round;
//            writes decision payload directly into the projections document
//            (replaces the dropped /decisions endpoint)
//
// POST   /projections/:id/recalc
//          → trigger recalculation for a projection document (admin/operator)
//
// GET    /projections/:id
//          → get a single projection document
//
// DELETE /projections/:id
//          → delete a projection document (admin)

router.get("/", getProjectionsByTeam);
router.post("/submit", submitDecision);           // team decision entry point
router.post("/:id/recalc", authorise("admin", "operator"), recalcProjections);
router.get("/:id", getProjectionById);
router.delete("/:id", authorise("admin"), deleteProjection);

export default router;
