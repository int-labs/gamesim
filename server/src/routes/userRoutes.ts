import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  regeneratePasskey,
  deleteUser,
  loginWithPasskey,
} from "../controllers/userControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.post("/login-passkey", loginWithPasskey); // place BEFORE router.use(authenticate), or on a separate unauthenticated router

router.use(authenticate);

router.post("/", authorize([ROLES.ADMIN]), createUser);
router.get("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getUsers);
router.get("/:id", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getUserById);
router.patch("/:id", updateUser);
router.patch("/:id/regenerate-passkey", authorize([ROLES.ADMIN]), regeneratePasskey);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteUser);

export default router;