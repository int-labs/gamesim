import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import SimulationType from "../models/simulationTypes";

// POST /simulation-types
export const createSimulationType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, yearRange, pastData, outputs, brandName, reportPlacement } = req.body;

    if (!name) {
      res.status(400).json({ message: "name is required." });
      return;
    }

    const existing = await SimulationType.findOne({ name });
    if (existing) {
      res.status(409).json({ message: "Simulation type with this name already exists." });
      return;
    }

    const simulationType = await SimulationType.create({
      name, description, yearRange, pastData, outputs, brandName, reportPlacement
    });

    res.status(201).json(simulationType);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create simulation type." });
  }
};

// GET /simulation-types
export const getSimulationTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const simulationTypes = await SimulationType.find().sort({ createdAt: -1 });
    res.status(200).json(simulationTypes);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch simulation types." });
  }
};

// GET /simulation-types/:id
export const getSimulationTypeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulationType = await SimulationType.aggregate([
      { $match: { _id: new Types.ObjectId(req.params.id) } },
      {
        $lookup: {
          from:     "segments",
          let:      { simulationTypeId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$simulationTypeId", "$$simulationTypeId"] } } },
            { $sort: { order: 1 } },
          ],
          as: "segments",
        },
      },
    ]).then((result) => result[0]);

    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    res.status(200).json(simulationType);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch simulation type." });
  }
};

// PATCH /simulation-types/:id
export const updateSimulationType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { yearRange, ...rest } = req.body;

    const updates: Record<string, any> = { ...rest };

    if (yearRange) updates.yearRange = yearRange;

    const simulationType = await SimulationType.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    res.status(200).json(simulationType);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update simulation type." });
  }
};

// PATCH /simulation-types/:id/outputs
export const updateOutputs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { outputs } = req.body;

    if (!Array.isArray(outputs)) {
      res.status(400).json({ message: "outputs must be an array." });
      return;
    }

    const simulationType = await SimulationType.findByIdAndUpdate(
      req.params.id,
      { $set: { outputs } },
      { new: true, runValidators: true }
    );

    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    res.status(200).json(simulationType.outputs);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update outputs." });
  }
};

// GET /simulation-types/:id/outputs
export const getOutputs = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulationType = await SimulationType.findById(req.params.id).select("outputs");
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }
    res.status(200).json(simulationType.outputs);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch outputs." });
  }
};

// PATCH /simulation-types/:id/past-data
export const updatePastData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pastData } = req.body;

    if (!Array.isArray(pastData)) {
      res.status(400).json({ message: "pastData must be an array." });
      return;
    }

    const simulationType = await SimulationType.findByIdAndUpdate(
      req.params.id,
      { $set: { pastData } },
      { new: true }
    );

    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    res.status(200).json(simulationType.pastData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update past data." });
  }
};

// GET /simulation-types/:id/past-data
export const getPastData = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulationType = await SimulationType.findById(req.params.id).select("pastData");
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }
    res.status(200).json(simulationType.pastData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch past data." });
  }
};

// PATCH /simulation-types/:id/past-data/product
export const upsertProductPastData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, productId, fields } = req.body;

    if (!year || !productId || !Array.isArray(fields)) {
      res.status(400).json({ message: "year, productId and fields are required." });
      return;
    }

    const simulationType = await SimulationType.findById(req.params.id);
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    let pastData = (simulationType.pastData as any[]) ?? [];
    let yearData = pastData.find((d: any) => d.year === year);

    if (!yearData) {
      pastData.push({ year, productData: [], segmentData: [], outputs: [] });
      yearData = pastData[pastData.length - 1];
    }

    const productIndex = yearData.productData.findIndex(
      (p: any) => p.productId.toString() === productId
    );

    if (productIndex !== -1) {
      yearData.productData[productIndex].fields = fields;
    } else {
      yearData.productData.push({
        productId: new Types.ObjectId(productId),
        fields,
      });
    }

    simulationType.pastData = pastData;
    simulationType.markModified("pastData");
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to upsert product past data." });
  }
};

// PATCH /simulation-types/:id/past-data/segment
export const upsertSegmentPastData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, segmentId, fields } = req.body;

    if (!year || !segmentId || !Array.isArray(fields)) {
      res.status(400).json({ message: "year, segmentId and fields are required." });
      return;
    }

    const simulationType = await SimulationType.findById(req.params.id);
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    let pastData = (simulationType.pastData as any[]) ?? [];
    let yearData = pastData.find((d: any) => d.year === year);

    if (!yearData) {
      pastData.push({ year, productData: [], segmentData: [], outputs: [] });
      yearData = pastData[pastData.length - 1];
    }

    const segmentIndex = yearData.segmentData.findIndex(
      (s: any) => s.segmentId.toString() === segmentId
    );

    if (segmentIndex !== -1) {
      yearData.segmentData[segmentIndex].fields = fields;
    } else {
      yearData.segmentData.push({
        segmentId: new Types.ObjectId(segmentId),
        fields,
      });
    }

    simulationType.pastData = pastData;
    simulationType.markModified("pastData");
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to upsert segment past data." });
  }
};

// PATCH /simulation-types/:id/past-data/output
export const upsertOutputPastData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, productId, outputs } = req.body;

    if (!year || !productId || !Array.isArray(outputs)) {
      res.status(400).json({ message: "year, productId and outputs are required." });
      return;
    }

    const simulationType = await SimulationType.findById(req.params.id);
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }

    let pastData = (simulationType.pastData as any[]) ?? [];
    let yearData = pastData.find((d: any) => d.year === year);

    if (!yearData) {
      pastData.push({ year, productData: [], segmentData: [], outputs: [] });
      yearData = pastData[pastData.length - 1];
    }

    outputs.forEach((output: any) => {
      const outputIndex = yearData.outputs.findIndex(
        (o: any) => o.productId.toString() === productId && o.key === output.key
      );

      if (outputIndex !== -1) {
        yearData.outputs[outputIndex].value = output.value;
      } else {
        yearData.outputs.push({
          productId: new Types.ObjectId(productId),
          key:       output.key,
          value:     output.value,
        });
      }
    });

    simulationType.pastData = pastData;
    simulationType.markModified("pastData");
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to upsert output past data." });
  }
};

// DELETE /simulation-types/:id
export const deleteSimulationType = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulationType = await SimulationType.findByIdAndDelete(req.params.id);
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found." });
      return;
    }
    res.status(200).json({ message: "Simulation type deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete simulation type." });
  }
};