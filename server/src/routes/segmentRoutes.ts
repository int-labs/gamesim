import { Router } from "express";
import {
  createSegment,
  getSegments,
  getSegmentById,
  updateSegment,
  deactivateSegment,
  activateSegment,
} from "../controllers/segmentControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createSegment);
router.get("/", getSegments);
router.get("/:id", getSegmentById);
router.patch("/:id", authorize([ROLES.ADMIN]), updateSegment);
router.patch("/:id/deactivate", authorize([ROLES.ADMIN]), deactivateSegment);
router.patch("/:id/activate", authorize([ROLES.ADMIN]), activateSegment);

export default router;