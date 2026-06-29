import { Router } from "express";
import {
  createGlobalInput,
  getGlobalInputs,
  getGlobalInputById,
  updateGlobalInput,
  deleteGlobalInput,
  createGlobalInputItem,
  getGlobalInputItems,
  updateGlobalInputItem,
  deleteGlobalInputItem,
} from "../controllers/globalInputControllers";
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

router.post("/:id/items", authorize([ROLES.ADMIN]), createGlobalInputItem);
router.get("/:id/items", getGlobalInputItems);
router.patch("/:id/items/:itemId", authorize([ROLES.ADMIN]), updateGlobalInputItem);
router.delete("/:id/items/:itemId", authorize([ROLES.ADMIN]), deleteGlobalInputItem);

export default router;