import { Router } from "express";
import {
  createParamList,
  getParamLists,
  getParamListById,
  upsertParameter,
  deleteParamList,
} from "../controllers/paramController";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createParamList);
router.get("/", getParamLists);
router.get("/:id", getParamListById);
router.patch("/:id/parameters", authorize([ROLES.ADMIN]), upsertParameter);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteParamList);

export default router;