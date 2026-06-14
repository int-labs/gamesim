import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET    /users            → list all users (admin/operator)
// POST   /users            → create user   (admin)
// GET    /users/:id        → get single user
// PATCH  /users/:id        → update user
// DELETE /users/:id        → delete user   (admin)
router.get("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), getAllUsers);
router.post("/", authorize([ROLES.ADMIN]), createUser);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteUser);

export default router;
