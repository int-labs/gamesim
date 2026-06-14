import { Router } from "express";
import {
  getProjectionsByTeam,
  getProjectionById,
  deleteProjection,
} from "../controllers/projectionControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

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
// router.post("/submit", submitDecision);           // team decision entry point
// router.post("/:id/recalc", authorize([ROLES.ADMIN, ROLES.OPERATOR]), recalcProjections);
router.get("/:id", getProjectionById);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteProjection);

export default router;
