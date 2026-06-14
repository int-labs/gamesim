import { Router } from "express";
import {
  getResults,
  getResultById,
  createResult,
  updateResult,
  deleteResult,
} from "../controllers/resultControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /results?simulationId=&roundNumber=&productId=&segmentId=
//          → query results by any combination of the compound index fields
// POST   /results           → write result record (admin/operator)
// GET    /results/:id       → get single result
// PATCH  /results/:id       → update result (admin/operator)
// DELETE /results/:id       → delete result (admin)
router.get("/", getResults);
router.post( "/", authorise("admin", "operator"), createResult);
router.get("/:id", getResultById);
router.patch( "/:id", authorise("admin", "operator"), updateResult);
router.delete("/:id", authorise("admin"),              deleteResult);

export default router;
