import { Router } from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
} from "../controllers/driversControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

// router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createDriver);
router.get("/", getDrivers);
router.get("/:id", getDriverById);
router.patch("/:id", authorize([ROLES.ADMIN]), updateDriver);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteDriver);

export default router;