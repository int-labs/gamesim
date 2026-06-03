import { NextFunction, Request, Response } from "express";
import { z } from "zod";

import GlobalInput, {
  BaseInputInterface,
  IGlobalInput,
} from "../models/globalInputs";
import SimulationType from "../models/simulationTypes";

// List all global inputs for a simulation type
export const listGlobalInputs = async (req: Request, res: Response) => {
  try {
    const { simulationTypeId } = req.params;

    const globalInputs = await GlobalInput.find({
      simulationTypeId: simulationTypeId,
    }).sort({ order: 1 });
    if (!globalInputs) {
      res.status(200).json({ data: [] });
      return;
    }

    res.status(200).json({ data: globalInputs });
    return;
  } catch (error) {
    console.error("Error in listGlobalInputs:", error);
    res.status(500).json({ message: "Error fetching global inputs" });
    return;
  }
};

// Create global inputs for a simulation type
export const createGlobalInput = async (req: Request, res: Response) => {
  try {
    const { simulationTypeId } = req.params;
    const { name, key, description, inputs } = req.body as {
      name: string;
      key: string;
      description?: string;
      inputs: Omit<BaseInputInterface, "_id">[];
    };

    // Validate simulation type exists
    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ message: "Simulation type not found" });
      return;
    }

    // Validate input structure
    if (!Array.isArray(inputs)) {
      res.status(400).json({ message: "Inputs must be an array" });
      return;
    }

    // Validate each input
    for (const input of inputs) {
      if (!input.key || !input.name || !input.type) {
        res.status(400).json({
          message: "Each input must have key, name, and type",
        });
        return;
      }

      // Validate key format
      if (!/^[a-zA-Z0-9_]+$/.test(input.key)) {
        res.status(400).json({
          message:
            "Input keys must only contain letters, numbers, and underscores",
        });
        return;
      }
    }

    // Check for duplicate keys
    const keys = inputs.map((input) => input.key);
    if (new Set(keys).size !== keys.length) {
      res.status(400).json({ message: "Input keys must be unique" });
      return;
    }

    const globalInput = new GlobalInput({
      simulationTypeId: simulationTypeId,
      name: name,
      key: key,
      description: description || "",
      inputs: inputs,
    });

    await globalInput.save();

    res.status(201).json(globalInput);
    return;
  } catch (error) {
    console.error("Error in createGlobalInputs:", error);
    res.status(500).json({ message: "Error creating global inputs" });
    return;
  }
};

// Get a specific global input
export const readGlobalInput = async (req: Request, res: Response) => {
  try {
    const { simulationTypeId, globalInputId } = req.params;

    const globalInput = await GlobalInput.findById(globalInputId);

    if (!globalInput) {
      res.status(404).json({ message: "Global inputs not found" });
      return;
    }

    res.status(200).json(globalInput);
    return;
  } catch (error) {
    console.error("Error in readGlobalInput:", error);
    res.status(500).json({ message: "Error fetching global input" });
    return;
  }
};

// Update a specific global input
export const updateGlobalInput = async (req: Request, res: Response) => {
  try {
    const { simulationTypeId, globalInputId } = req.params;
    const updateData = req.body as Partial<IGlobalInput>;

    // Validate key format if it's being updated
    if (updateData.key && !/^[a-zA-Z0-9_]+$/.test(updateData.key)) {
      res.status(400).json({
        message:
          "Input key must only contain letters, numbers, and underscores",
      });
      return;
    }

    const globalInput = await GlobalInput.findById(globalInputId);

    if (!globalInput) {
      res.status(404).json({ message: "Global inputs not found" });
      return;
    }

    const updated = await GlobalInput.findByIdAndUpdate(
      globalInputId,
      updateData,
      { new: true }
    );

    res.status(200).json(updated);
    return;
  } catch (error) {
    console.error("Error in updateGlobalInput:", error);
    res.status(500).json({ message: "Error updating global input" });
    return;
  }
};

// Update global input order
export const updateGlobalInputOrder = async (req: Request, res: Response) => {
  try {
    const { simulationTypeId } = req.params;
    const { globalInputIds } = req.body as { globalInputIds: string[] };

    if (!Array.isArray(globalInputIds)) {
      res.status(400).json({ message: "globalInputIds must be an array" });
      return;
    }

    // Use bulk write to update order for each global input
    const bulkOps = globalInputIds.map((id, index) => ({
      updateOne: {
        filter: {
          _id: id,
          simulationTypeId: simulationTypeId,
        },
        update: {
          $set: {
            order: index,
          },
        },
      },
    }));

    await GlobalInput.bulkWrite(bulkOps);

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.error("Error in updateGlobalInputOrder:", error);
    res.status(500).json({ message: "Error updating global input order" });
    return;
  }
};

// Update translations for a specific global input
export const updateGlobalInputTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { globalInputId: id } = req.params;

    const updateTranslationsSchema = z.object({
      updates: z.array(
        z.object({
          languageCode: z.string(),
          strings: z.record(z.string()),
        })
      ),
    });

    const validationResult = updateTranslationsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const { updates } = validationResult.data;

    const current = await GlobalInput.findById(id);
    if (!current) {
      res.status(404).json({ error: "Global input not found" });
      return;
    }

    let globalInputTranslations = current.translations || [];

    updates.forEach((update) => {
      let langIndex = globalInputTranslations.findIndex(
        (t) => t.languageCode === update.languageCode
      );

      if (langIndex === -1) {
        globalInputTranslations.push({
          languageCode: update.languageCode,
          keys: [],
        });
        langIndex = globalInputTranslations.length - 1;
      }

      const keysArr = globalInputTranslations[langIndex].keys;
      Object.entries(update.strings).forEach(([key, value]) => {
        const keyIndex = keysArr.findIndex((k) => k.key === key);
        if (value && value.trim() !== "") {
          // Add or update
          if (keyIndex !== -1) {
            keysArr[keyIndex].value = value;
          } else {
            keysArr.push({ key, value });
          }
        } else {
          // Delete if value is empty
          if (keyIndex !== -1) {
            keysArr.splice(keyIndex, 1);
          }
        }
      });
    });

    current.translations = globalInputTranslations;
    current.markModified("translations");
    await current.save();

    res.status(200).json(current);
  } catch (err) {
    next(err);
  }
};
