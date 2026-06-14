import { Router } from "express";
import {
  getAllSimulationTypes,
  getSimulationTypeById,
  createSimulationType,
  updateSimulationType,
  deleteSimulationType,
} from "../controllers/simulationTypeControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET    /simulation-types        → list all simulation types
// POST   /simulation-types        → create (admin)
// GET    /simulation-types/:id    → get single simulation type
// PATCH  /simulation-types/:id    → update (admin)
// DELETE /simulation-types/:id    → delete (admin)
router.get("/", getAllSimulationTypes);
router.post("/", authorize([ROLES.ADMIN]), createSimulationType);
router.get("/:id", getSimulationTypeById);
router.patch( "/:id", authorize([ROLES.ADMIN]), updateSimulationType);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteSimulationType);

export default router;
