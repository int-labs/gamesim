import { Router } from "express";
import {
  createTeam,
  getAllTeams,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
} from "../controllers/teamControllers"; // adjust path to match your controllers folder
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

// TODO(auth): write routes below require a JWT (ROLES.ADMIN).
// api.ts does not attach an auth header yet (no auth page in the admin
// dashboard as of this handoff). Once login + token storage are wired
// into api.ts on the frontend, these routes should work as-is —
// no backend change needed then, just confirming the header arrives.

router.use(authenticate);

router.post("/", authenticate, authorize([ROLES.ADMIN]), createTeam);
router.get("/", getAllTeams);
// router.get("/", getTeams);
router.get("/:id", getTeamById);
router.patch("/:id", authenticate, authorize([ROLES.ADMIN]), updateTeam);
router.delete("/:id", authenticate, authorize([ROLES.ADMIN]), deleteTeam);

export default router;