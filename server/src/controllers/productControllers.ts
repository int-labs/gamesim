import { Request, Response } from "express";
import Product from "../models/products";

// GET /products?simulationTypeId=&segmentId=
export const getProductsBySimulationType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, segmentId } = req.query;

    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId is required." });
      return;
    }

    const filter: Record<string, any> = { simulationTypeId };
    if (segmentId) filter.segmentId = segmentId;

    const products = await Product.find(filter).sort({ order: 1 });
    res.status(200).json(products);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch products." });
  }
};

// GET /products/:id
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    res.status(200).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch product." });
  }
};

// POST /products
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A product with this name already exists in this simulation type and segment." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create product." });
  }
};

// PATCH /products/:id
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    res.status(200).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update product." });
  }
};

// DELETE /products/:id
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    res.status(200).json({ message: "Product deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete product." });
  }
};


// POST /products/:id/fields
export const createProductField = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, label, type, order, required } = req.body;

    if (!key || !label || !type) {
      res.status(400).json({ message: "key, label, and type are required." });
      return;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $push: { fields: { key, label, type, order, required } } },
      { new: true, runValidators: true }
    );

    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }

    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create product field." });
  }
};

// GET /products/:id/fields
export const getProductFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }

    res.status(200).json(product.fields);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch product fields." });
  }
};

// PATCH /products/:id/fields/:fieldId
export const updateProductField = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, type, order, required } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, "fields._id": req.params.fieldId },
      {
        $set: {
          "fields.$.label":    label,
          "fields.$.type":     type,
          "fields.$.order":    order,
          "fields.$.required": required,
        },
      },
      { new: true, runValidators: true }
    );

    if (!product) {
      res.status(404).json({ message: "Product or field not found." });
      return;
    }

    res.status(200).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update product field." });
  }
};

// DELETE /products/:id/fields/:fieldId
export const deleteProductField = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $pull: { fields: { _id: req.params.fieldId } } },
      { new: true }
    );

    if (!product) {
      res.status(404).json({ message: "Product not found." });
      return;
    }

    res.status(200).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete product field." });
  }
};