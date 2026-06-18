import { Request, Response } from "express";
import Segment from "../models/segment";
import Product from "../models/products";

// POST /segments
export const createSegment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, name, description, key, fields, icon, order } = req.body;

    if (!simulationTypeId || !name || !key) {
      res.status(400).json({ message: "simulationTypeId, name and key are required." });
      return;
    }

    const segment = await Segment.create({
      simulationTypeId, name, description, key, fields, icon, order
    });

    res.status(201).json(segment);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Segment with this key already exists for this simulation type." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create segment." });
  }
};

// GET /segments
export const getSegments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.query;

    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId is required." });
      return;
    }

    const segments = await Segment.find({ simulationTypeId }).sort({ order: 1 });
    res.status(200).json(segments);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch segments." });
  }
};

// GET /segments/:id
export const getSegmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) {
      res.status(404).json({ message: "Segment not found." });
      return;
    }
    res.status(200).json(segment);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch segment." });
  }
};

// PATCH /segments/:id
export const updateSegment = async (req: Request, res: Response): Promise<void> => {
  try {
    const segment = await Segment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!segment) {
      res.status(404).json({ message: "Segment not found." });
      return;
    }
    res.status(200).json(segment);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update segment." });
  }
};

// PATCH /segments/:id/deactivate
export const deactivateSegment = async (req: Request, res: Response): Promise<void> => {
  try {
    const segment = await Segment.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    );
    if (!segment) {
      res.status(404).json({ message: "Segment not found." });
      return;
    }

    await Product.updateMany(
      { segmentId: req.params.id },
      { $set: { active: false } }
    );

    res.status(200).json({ message: "Segment and associated products deactivated.", segment });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to deactivate segment." });
  }
};

// PATCH /segments/:id/activate
export const activateSegment = async (req: Request, res: Response): Promise<void> => {
  try {
    const segment = await Segment.findByIdAndUpdate(
      req.params.id,
      { $set: { active: true } },
      { new: true }
    );
    if (!segment) {
      res.status(404).json({ message: "Segment not found." });
      return;
    }
    res.status(200).json({ message: "Segment activated.", segment });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to activate segment." });
  }
};