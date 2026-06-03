import { Router } from "express";
import {
  createProduct,
  deleteProductById,
  getAllProducts,
  getProductAvailableVariables,
  getProductById,
  updateProductById,
  updateProductFields,
  updateProductOutputs,
  updateProductParams,
  updateProductPrerequisites,
  updateProductTranslations,
} from "../controllers/productControllers";
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

const router = Router();

// General product routes
router.get("/", getAllProducts); // Get all products
router.post("/", authenticate, authorize(["admin"]), createProduct); // Create a product

// Routes for productId-based operations
router.get("/:productId", getProductById); // Get product by productId
router.put("/:productId", updateProductById); // Update product by productId
router.delete("/:productId", deleteProductById); // Delete product by productId
router.put(
  "/:productId/fields",
  authenticate,
  authorize(["admin"]),
  updateProductFields
); // Update product fields by productId
router.put(
  "/:productId/outputs",
  authenticate,
  authorize(["admin"]),
  updateProductOutputs
); // Update product outputs by productId
router.put(
  "/:productId/prerequisites",
  authenticate,
  authorize(["admin"]),
  updateProductPrerequisites
); // Update product prerequisites by productId
router.put(
  "/:productId/params",
  authenticate,
  authorize(["admin"]),
  updateProductParams
); // Update product simulation parameters by productId
router.get("/:productId/available-variables", getProductAvailableVariables); // Update product available variables by productId
router.put(
  "/:productId/translations",
  authenticate,
  authorize(["admin"]),
  updateProductTranslations
);

export default router;
