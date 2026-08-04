import { Router } from "express";
import {
  createTeam,
  getAllTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
} from "../controllers/teamControllers"; // adjust path to match your controllers folder
import {
  getTeamMembers,
  putTeamAvatar,
  putTeamMembers,
} from "../controllers/teamMemberControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

// Auth is live: `authenticate` guards every route on this router and the
// write routes add `authorize([ROLES.ADMIN])`. The console attaches its JWT
// from src/lib/auth.ts; teams sign in by passkey and get their own token.
router.use(authenticate);

router.post("/", authenticate, authorize([ROLES.ADMIN]), createTeam);
router.get("/", getAllTeams);
// router.get("/", getTeams);
router.get("/:id", getTeamById);
router.patch("/:id", authenticate, authorize([ROLES.ADMIN]), updateTeam);
router.delete("/:id", authenticate, authorize([ROLES.ADMIN]), deleteTeam);

// Roster + avatars. Deliberately NOT gated by authorize([ADMIN]): a team may
// edit its own roster, so the ownership check lives in the controller
// (`canEditTeam`), which admins and operators also satisfy.
router.get("/:id/members", getTeamMembers);
router.put("/:id/members", putTeamMembers);
router.put("/:id/avatar", putTeamAvatar);

export default router;