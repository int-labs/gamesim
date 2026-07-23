import { Router } from "express";
import {
  bootstrap,
  getCurrentDecision,
  putCurrentDecision,
  previewCurrentRound,
  submitCurrentDecision,
  listResults,
  getCurrentResult,
  getResultByRoundNumber,
} from "../controllers/playerControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// GET  /player/bootstrap                          → user/team/simulation/round/permissions context
// GET  /player/rounds/current/decision             → current round's saved draft (or null)
// PUT  /player/rounds/current/decision             → save/overwrite draft (optimistic concurrency via `version`)
// POST /player/rounds/current/preview              → canonical, non-persistent projection
// POST /player/rounds/current/decision/submit      → lock in the draft for finalization (idempotent)
// GET  /player/results                             → all finalized results for this team
// GET  /player/results/current                     → finalized result for the current round
// GET  /player/results/:roundNumber                → finalized result for a specific round
router.get("/bootstrap", bootstrap);
router.get("/rounds/current/decision", getCurrentDecision);
router.put("/rounds/current/decision", putCurrentDecision);
router.post("/rounds/current/preview", previewCurrentRound);
router.post("/rounds/current/decision/submit", submitCurrentDecision);
router.get("/results", listResults);
router.get("/results/current", getCurrentResult);
router.get("/results/:roundNumber", getResultByRoundNumber);

export default router;
