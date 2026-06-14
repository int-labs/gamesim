import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET    /users            → list all users (admin/operator)
// POST   /users            → create user   (admin)
// GET    /users/:id        → get single user
// PATCH  /users/:id        → update user
// DELETE /users/:id        → delete user   (admin)
router.get("/", authorise("admin", "operator"), getAllUsers);
router.post("/", authorise("admin"), createUser);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.delete("/:id", authorise("admin"), deleteUser);

export default router;
