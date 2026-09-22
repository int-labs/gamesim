import { Router } from "express";
import {
  getLeaderboardConfig,
  upsertLeaderboardConfig,
  patchLeaderboardConfig,
  getLeaderboardSources,
  deleteLeaderboardConfig,
} from "../controllers/leaderboardConfigControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET    /leaderboard-config/sources              → the allowed `source` values
// GET    /leaderboard-config/:simulationTypeId    → the weighting (or an empty one)
// PUT    /leaderboard-config/:simulationTypeId    → REPLACE the whole set (admin)
// PATCH  /leaderboard-config/:simulationTypeId    → MERGE by metric key (admin)
//          body: { metrics?: [{ key, ...fields }], removeKeys?: [key] }
//          404s if none exists — PUT creates, PATCH edits
// DELETE /leaderboard-config/:simulationTypeId    → remove it (admin)
//
// "/sources" BEFORE "/:simulationTypeId" — otherwise the parameterised route
// matches it first and the literal is unreachable.
router.get("/sources", getLeaderboardSources);
router.get("/:simulationTypeId", getLeaderboardConfig);
router.put("/:simulationTypeId", authorize([ROLES.ADMIN]), upsertLeaderboardConfig);
router.patch("/:simulationTypeId", authorize([ROLES.ADMIN]), patchLeaderboardConfig);
router.delete("/:simulationTypeId", authorize([ROLES.ADMIN]), deleteLeaderboardConfig);

export default router;
