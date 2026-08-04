import { Request, Response } from "express";
import Driver from "../models/Drivers";

// POST /drivers
export const createDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, years } = req.body;

    // `segmentId` used to be demanded here, but the model has no such path —
    // Mongoose stripped it on the way in, so the only thing the check ever did
    // was make it impossible to create a driver without sending a value that
    // was then thrown away. A driver hangs off a product and nothing else.
    if (!productId) {
      res.status(400).json({ message: "productId is required." });
      return;
    }

    const driver = await Driver.create({ productId, years });
    res.status(201).json(driver);
  } catch (err: any) {
    if (err.code === 11000) {
      // The unique index is on productId alone.
      res.status(409).json({ message: "This product already has a driver." });
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
      res.status(400).json({ message: "productId is required." });
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