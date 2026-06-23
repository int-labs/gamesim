import { Router } from "express";
import {
  createInitiative,
  getInitiatives,
  getInitiativeById,
  updateInitiative,
  deleteInitiative,
} from "../controllers/initiativesController";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createInitiative);
router.get("/", getInitiatives);
router.get("/:id", getInitiativeById);
router.patch("/:id", authorize([ROLES.ADMIN]), updateInitiative);
router.delete("/:id",authorize([ROLES.ADMIN]), deleteInitiative);

export default router;