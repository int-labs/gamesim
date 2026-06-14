import { Router } from "express";
import {
  getProductsBySimulationType,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /products?simulationTypeId=&segmentId=
//          → list products; filter by simulationTypeId and/or segmentId
// POST   /products           → create product (admin)
// GET    /products/:id       → get single product (includes merged productType fields)
// PATCH  /products/:id       → update product (admin)
// DELETE /products/:id       → delete product (admin)
router.get("/", getProductsBySimulationType);
router.post("/", authorise("admin"), createProduct);
router.get("/:id", getProductById);
router.patch( "/:id", authorise("admin"), updateProduct);
router.delete("/:id", authorise("admin"), deleteProduct);

export default router;