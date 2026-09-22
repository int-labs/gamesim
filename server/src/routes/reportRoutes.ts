import { Router } from "express";
import { getRoundReport } from "../controllers/reportControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET /reports/decisions?simulationId=&roundNumber=   → decision comparison PDF
// GET /reports/competitor?simulationId=&roundNumber=  → competitor report PDF
//
// ADMIN/OPERATOR only. These show every team's figures side by side — a team
// token must never be able to pull one and read its competitors' decisions
// before the round is debriefed.
router.get("/:kind", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getRoundReport);

export default router;
