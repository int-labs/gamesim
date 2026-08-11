import { Router } from "express";
import { getTeamProgress, putTeamProgress } from "../controllers/teamProgressControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// Both sides are role-gated inside the controller rather than by `authorize`:
// the WRITE is team-only and the READ is staff-only, which is the opposite of
// every other route here and would read as a mistake expressed as middleware.
router.put("/", putTeamProgress);
router.get("/", getTeamProgress);

export default router;
