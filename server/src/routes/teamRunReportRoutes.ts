import { Router } from "express";
import { getRunReports, putRunReport } from "../controllers/teamRunReportControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// Role handling lives in the controller: the WRITE is team-only and the READ
// is scoped differently per role (staff see the cohort, a team sees itself),
// which `authorize` cannot express.
router.put("/", putRunReport);
router.get("/", getRunReports);

export default router;
