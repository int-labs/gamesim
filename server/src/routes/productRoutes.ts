import { Router } from "express";
import {
  getProductsBySimulationType,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET    /products?simulationTypeId=&segmentId=
//          → list products; filter by simulationTypeId and/or segmentId
// POST   /products           → create product (admin)
// GET    /products/:id       → get single product (includes merged productType fields)
// PATCH  /products/:id       → update product (admin)
// DELETE /products/:id       → delete product (admin)
router.get("/", getProductsBySimulationType);
router.post("/", authorize([ROLES.ADMIN]), createProduct);
router.get("/:id", getProductById);
router.patch( "/:id", authorize([ROLES.ADMIN]), updateProduct);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteProduct);

export default router;