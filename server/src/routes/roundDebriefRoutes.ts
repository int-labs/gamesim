import { Router } from "express";
import { getRoundDebrief } from "../controllers/roundDebriefControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// GET /round-debrief?simulationId=&roundNumber=
//
// NO `authorize` on purpose — this endpoint is readable by TEAMS as well as
// operators, and the rule that separates them is conditional on the caller's
// role, which `authorize` cannot express. The gate lives in the controller:
// a team may read only a round whose status is "Completed", and only for a
// simulation it is on. Admin and operator read any round.
router.get("/", getRoundDebrief);

export default router;
