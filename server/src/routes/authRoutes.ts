import { Router } from "express";
import {
  login,
  passkeyLogin,
  logout,
  refreshToken,
  getMe,
} from "../controllers/authControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.post("/login", login);
router.post("/login/passkey", passkeyLogin);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.get("/me", authenticate, getMe);

export default router;