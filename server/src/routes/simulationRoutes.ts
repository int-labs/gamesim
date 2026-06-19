import { Router } from "express";
import {
  getAllSimulations,
  getSimulationById,
  createSimulation,
  updateSimulation,
  deleteSimulation,
} from "../controllers/simulationControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

// router.use(authenticate);

// GET    /simulations        → list all simulations
// POST   /simulations        → create simulation (admin/operator)
// GET    /simulations/:id    → get single simulation
// PATCH  /simulations/:id    → update simulation (admin/operator)
// DELETE /simulations/:id    → delete simulation (admin)
router.get("/", getAllSimulations);
router.post("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), createSimulation);
router.get("/:id", getSimulationById);
router.patch("/:id", authorize([ROLES.ADMIN, ROLES.OPERATOR]), updateSimulation);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteSimulation);

export default router;
