import { Router } from "express";
import { getDebriefDimensions } from "../controllers/debriefDimensionControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// Read-only, and read-only by nature: this is derived from a type's own
// products and global inputs. There is nothing here to write.
router.get("/", getDebriefDimensions);

export default router;
