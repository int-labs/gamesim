import { Router } from "express";
import {
  createSimulationType,
  getSimulationTypes,
  getSimulationTypeById,
  updateSimulationType,
  updateOutputs,
  getOutputs,
  updatePastData,
  getPastData,
  upsertProductPastData,
  upsertSegmentPastData,
  upsertOutputPastData,
  deleteSimulationType,
} from "../controllers/simulationTypeControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

// router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createSimulationType);
router.get("/", getSimulationTypes);
router.get("/:id", getSimulationTypeById);
router.patch("/:id", authorize([ROLES.ADMIN]), updateSimulationType);
router.patch("/:id/outputs", authorize([ROLES.ADMIN]), updateOutputs);
router.get("/:id/outputs", getOutputs);
router.patch("/:id/past-data", authorize([ROLES.ADMIN]), updatePastData);
router.get("/:id/past-data", getPastData);
router.patch("/:id/past-data/product", authorize([ROLES.ADMIN]), upsertProductPastData);
router.patch("/:id/past-data/segment", authorize([ROLES.ADMIN]), upsertSegmentPastData);
router.patch("/:id/past-data/output", authorize([ROLES.ADMIN]), upsertOutputPastData);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteSimulationType);

export default router;