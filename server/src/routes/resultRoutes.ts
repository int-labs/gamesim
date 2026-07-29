import { Router } from "express";
import {
  getResults,
  getResultById,
  createResult,
  updateResult,
  deleteResult,
} from "../controllers/resultControllers";
import { deleteResultsByRound } from "../controllers/roundControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET    /results?simulationId=&roundNumber=&productId=&segmentId=
//          → query results by any combination of the compound index fields
// POST   /results           → write result record (admin/operator)
// GET    /results/:id       → get single result
// PATCH  /results/:id       → update result (admin/operator)
// DELETE /results/:id       → delete result (admin)
// DELETE /results?simulationId=&roundNumber=
//          → bulk-clear a round's results (admin) — the admin "Reset round"
//            action calls this; it has no /:id so it must be declared here,
//            not on the rounds router.
router.get("/", getResults);
router.delete("/", authorize([ROLES.ADMIN]), deleteResultsByRound);
router.post( "/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), createResult);
router.get("/:id", getResultById);
router.patch( "/:id", authorize([ROLES.ADMIN, ROLES.OPERATOR]), updateResult);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteResult);

export default router;
