import { Router } from "express";
import {
  createGlobalInput,
  getGlobalInputs,
  getGlobalInputById,
  updateGlobalInput,
  deleteGlobalInput,
} from "../controllers/globalInputControllers"; // adjust path to match your controllers folder
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();
router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createGlobalInput);
router.get("/", getGlobalInputs);
router.get("/:id", getGlobalInputById);
router.patch("/:id", authorize([ROLES.ADMIN]), updateGlobalInput);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteGlobalInput);

export default router;