import { Router } from "express";
import { getRoundReport } from "../controllers/reportControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// GET /reports/decisions?simulationId=&roundNumber=   → analysis report PDF
//   The kind is still spelled `decisions` in the URL.
// GET /reports/competitor?simulationId=&roundNumber=  → competitor report PDF
//
// Any signed-in user, teams included: players are meant to read these.
// !important the controller checks neither simulation membership nor whether
// the round is scored, so a team token can pull any simulation's report for an
// uncalculated round.
router.get("/:kind", getRoundReport);

export default router;
