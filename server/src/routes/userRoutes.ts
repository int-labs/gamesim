import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserById,
  getMe,
  updateUser,
  regeneratePasskey,
  deleteUser,
  loginUser,
  loginWithPasskey,
} from "../controllers/userControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

// Public — both must stay ABOVE router.use(authenticate).
router.post("/login", loginUser); // staff: email + password
router.post("/login-passkey", loginWithPasskey); // teams: passkey

router.use(authenticate);

// Any signed-in caller may ask who they are; the handler reads only its own token.
router.get("/me", getMe);

router.post("/", authorize([ROLES.ADMIN]), createUser);
router.get("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getUsers);
// NOTE: keep "/me" above this — "/:id" would otherwise swallow it.
router.get("/:id", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getUserById);
router.patch("/:id", updateUser);
router.patch("/:id/regenerate-passkey", authorize([ROLES.ADMIN]), regeneratePasskey);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteUser);

export default router;