import { Router } from "express";
import {
  getBaseDataBySimulationType,
  getBaseDataById,
  createBaseData,
  updateBaseData,
  deleteBaseData,
} from "../controllers/baseDataControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise }    from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /base-data?simulationTypeId=   → get base data for a simulation type
// POST   /base-data                     → create base data record (admin)
// GET    /base-data/:id                 → get single base data document
// PATCH  /base-data/:id                 → update base data (admin)
// DELETE /base-data/:id                 → delete base data (admin)
router.get("/",    getBaseDataBySimulationType);
router.post("/",    authorise("admin"), createBaseData);
router.get("/:id", getBaseDataById);
router.patch( "/:id", authorise("admin"), updateBaseData);
router.delete("/:id", authorise("admin"), deleteBaseData);

export default router;
