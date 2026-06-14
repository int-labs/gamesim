import { Router } from "express";
import {
  login,
  logout,
  refreshToken,
  getMe,
} from "../controllers/authControllers";
import { authenticate } from "../middleware/authenticate";

const router = Router();

// POST   /auth/login        → issue access token + set refresh token cookie
// POST   /auth/logout       → clear refresh token cookie + invalidate DB token
// POST   /auth/refresh      → use httpOnly cookie to issue new access token
// GET    /auth/me           → return current user from token
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/refresh", refreshToken);
router.get("/me", authenticate, getMe);

export default router;
