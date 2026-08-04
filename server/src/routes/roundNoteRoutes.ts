import { Router } from "express";
import {
  createRoundNote,
  deleteRoundNote,
  getRoundNotes,
  updateRoundNote,
} from "../controllers/roundNoteControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// Readable by any authenticated caller; the controller narrows a team token to
// the general notes plus its own.
router.get("/", getRoundNotes);

const WRITE = [authorize([ROLES.ADMIN, ROLES.OPERATOR])];
router.post("/", ...WRITE, createRoundNote);
router.patch("/:id", ...WRITE, updateRoundNote);
router.delete("/:id", ...WRITE, deleteRoundNote);

export default router;
