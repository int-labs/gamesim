import { Router } from "express";
import {
  getAllSimulationTypes,
  getSimulationTypeById,
  createSimulationType,
  updateSimulationType,
  deleteSimulationType,
} from "../controllers/simulationTypeControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /simulation-types        → list all simulation types
// POST   /simulation-types        → create (admin)
// GET    /simulation-types/:id    → get single simulation type
// PATCH  /simulation-types/:id    → update (admin)
// DELETE /simulation-types/:id    → delete (admin)
router.get("/", getAllSimulationTypes);
router.post("/", authorise("admin"), createSimulationType);
router.get("/:id", getSimulationTypeById);
router.patch( "/:id", authorise("admin"), updateSimulationType);
router.delete("/:id", authorise("admin"), deleteSimulationType);

export default router;
