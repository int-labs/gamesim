import express from "express";

import {
  loginAsAdmin,
  loginAsTeam,
  logout,
  refreshToken,
} from "../controllers/authControllers";

const router = express.Router();

// Routes for managing teams
router.post("/login/admin", loginAsAdmin); // Get all teams with pagination and filtering
router.post("/login/team", loginAsTeam); // Create a new team
router.post("/refresh", refreshToken);
router.post("/logout", logout);

export default router;
