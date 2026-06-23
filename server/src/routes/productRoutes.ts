import { Router } from "express";
import {
  getProductsBySimulationType,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductField,
  getProductFields,
  updateProductField,
  deleteProductField,
} from "../controllers/productControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

router.get("/", getProductsBySimulationType);
router.post("/", authorize([ROLES.ADMIN]), createProduct);
router.get("/:id", getProductById);
router.patch( "/:id", authorize([ROLES.ADMIN]), updateProduct);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteProduct);

router.post("/:id/fields", authorize([ROLES.ADMIN]), createProductField);
router.get("/:id/fields", getProductFields);
router.patch("/:id/fields/:fieldId", authorize([ROLES.ADMIN]), updateProductField);
router.delete("/:id/fields/:fieldId", authorize([ROLES.ADMIN]), deleteProductField);

export default router;