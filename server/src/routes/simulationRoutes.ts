import { Router } from "express";
import {
  getAllSimulations,
  getSimulationById,
  createSimulation,
  updateSimulation,
  deleteSimulation,
} from "../controllers/simulationControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /simulations        → list all simulations
// POST   /simulations        → create simulation (admin/operator)
// GET    /simulations/:id    → get single simulation
// PATCH  /simulations/:id    → update simulation (admin/operator)
// DELETE /simulations/:id    → delete simulation (admin)
router.get("/", getAllSimulations);
router.post("/", authorise("admin", "operator"), createSimulation);
router.get("/:id", getSimulationById);
router.patch("/:id", authorise("admin", "operator"), updateSimulation);
router.delete("/:id", authorise("admin"), deleteSimulation);

export default router;
