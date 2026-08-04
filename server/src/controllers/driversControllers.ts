import { Request, Response } from "express";
import Driver from "../models/drivers";

// POST /drivers
export const createDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, segmentId, years } = req.body;

    if (!productId || !segmentId) {
      res.status(400).json({ message: "productId and segmentId are required." });
      return;
    }

    const driver = await Driver.create({ productId, segmentId, years });
    res.status(201).json(driver);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Driver already exists for this product and team." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create driver." });
  }
};

// GET /drivers
export const getDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.query;

    if (!productId) {
      res.status(400).json({ message: "productId are required." });
      return;
    }

    const drivers = await Driver.find({ productId });
    res.status(200).json(drivers);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch drivers." });
  }
};

// GET /drivers/:id
export const getDriverById = async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      res.status(404).json({ message: "Driver not found." });
      return;
    }
    res.status(200).json(driver);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch driver." });
  }
};

// PATCH /drivers/:id
export const updateDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!driver) {
      res.status(404).json({ message: "Driver not found." });
      return;
    }
    res.status(200).json(driver);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update driver." });
  }
};

// DELETE /drivers/:id
export const deleteDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) {
      res.status(404).json({ message: "Driver not found." });
      return;
    }
    res.status(200).json({ message: "Driver deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete driver." });
  }
};