import { Request, Response } from "express";
import GlobalInput from "../models/globalInputs";

// POST /global-inputs
export const createGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, category, key, label, description, type, maxSelections } = req.body;

    if (!simulationTypeId || !category || !key || !label || !type) {
      res.status(400).json({ message: "simulationTypeId, category, key, label, and type are required." });
      return;
    }

    const globalInput = await GlobalInput.create({ simulationTypeId, category, key, label, description, type, maxSelections });
    res.status(201).json(globalInput);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A global input with this key already exists for this simulation type." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create global input." });
  }
};

// GET /global-inputs?simulationTypeId=&category=
export const getGlobalInputs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, category } = req.query;

    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId query param is required." });
      return;
    }

    const filter: Record<string, any> = { simulationTypeId };
    if (category) filter.category = category;

    const globalInputs = await GlobalInput.find(filter);
    res.status(200).json(globalInputs);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch global inputs." });
  }
};

// GET /global-inputs/:id
export const getGlobalInputById = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findById(req.params.id);
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch global input." });
  }
};

// PATCH /global-inputs/:id  (container-level fields only — category/key/label/description/maxSelections)
export const updateGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    // updateGlobalInput
    const { category, label, description, type, maxSelections } = req.body;
    const globalInput = await GlobalInput.findByIdAndUpdate(
      req.params.id,
      { category, label, description, type, maxSelections },
      { new: true, runValidators: true }
    );
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update global input." });
  }
};

// DELETE /global-inputs/:id
export const deleteGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findByIdAndDelete(req.params.id);
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json({ message: "Global input deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete global input." });
  }
};

// ---- Item-level CRUD ----

// POST /global-inputs/:id/items
export const createGlobalInputItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      key, label, description,
      minPossibleValue, maxPossibleValue, minDelta, maxDelta,
      cost, energy, productsImpacted, impacts, impactLevel, options
    } = req.body;

    if (!key || !label) {
      res.status(400).json({ message: "key and label are required." });
      return;
    }

    const globalInput = await GlobalInput.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          inputs: {
            key, label, description,
            minPossibleValue, maxPossibleValue, minDelta, maxDelta,
            cost, energy, productsImpacted, impacts, impactLevel,
            options: options ?? {},
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }

    res.status(201).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create global input item." });
  }
};

// GET /global-inputs/:id/items
export const getGlobalInputItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findById(req.params.id);
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json(globalInput.inputs);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch global input items." });
  }
};

// PATCH /global-inputs/:id/items/:itemId
export const updateGlobalInputItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      label, description,
      minPossibleValue, maxPossibleValue, minDelta, maxDelta,
      cost, energy, productsImpacted, impacts, impactLevel, options
    } = req.body;

    const globalInput = await GlobalInput.findOneAndUpdate(
      { _id: req.params.id, "inputs._id": req.params.itemId },
      {
        $set: {
          "inputs.$.label":            label,
          "inputs.$.description":      description,
          "inputs.$.minPossibleValue": minPossibleValue,
          "inputs.$.maxPossibleValue": maxPossibleValue,
          "inputs.$.minDelta":         minDelta,
          "inputs.$.maxDelta":         maxDelta,
          "inputs.$.cost":             cost,
          "inputs.$.energy":           energy,
          "inputs.$.productsImpacted": productsImpacted,
          "inputs.$.impacts":          impacts,
          "inputs.$.impactLevel":      impactLevel,
          "inputs.$.options":          options ?? {},
        },
      },
      { new: true, runValidators: true }
    );

    if (!globalInput) {
      res.status(404).json({ message: "Global input or item not found." });
      return;
    }

    res.status(200).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update global input item." });
  }
};

// DELETE /global-inputs/:id/items/:itemId
export const deleteGlobalInputItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findByIdAndUpdate(
      req.params.id,
      { $pull: { inputs: { _id: req.params.itemId } } },
      { new: true }
    );

    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }

    res.status(200).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete global input item." });
  }
};