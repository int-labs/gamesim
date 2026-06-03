import express from "express";

import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";
import {
  createAdmin,
  getAllUsers,
  updateUserPasskey,
  updateUserStatus,
  changeOwnPassword,
  changeUserPassword,
} from "../controllers/userControllers";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["admin", "operator"]),
  getAllUsers
);
router.post(
  "/admin",
  authenticate,
  authorize(["admin", "operator"]),
  createAdmin
);

router.put(
  "/:userId/passkey",
  authenticate,
  authorize(["admin"]),
  updateUserPasskey
);

router.put(
  "/:userId/status",
  authenticate,
  authorize(["admin"]),
  updateUserStatus
);

router.put(
  "/me/password",
  authenticate,
  changeOwnPassword
);

router.put(
  "/:userId/password",
  authenticate,
  authorize(["admin"]),
  changeUserPassword
);

export default router;
