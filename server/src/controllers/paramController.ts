import { Request, Response } from "express";
import ParamList from "../models/params";

// POST /param-list
export const createParamList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { segmentId, productId, parameters } = req.body;

    if (!segmentId || !productId) {
      res.status(400).json({ message: "segmentId and productId are required." });
      return;
    }

    const paramList = await ParamList.create({ segmentId, productId, parameters });
    res.status(201).json(paramList);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "ParamList already exists for this segment and product." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create param list." });
  }
};

// GET /param-list
export const getParamLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { segmentId, productId } = req.query;

    const filter: Record<string, any> = {};
    if (segmentId) filter.segmentId = segmentId;
    if (productId) filter.productId = productId;

    const paramLists = await ParamList.find(filter);
    res.status(200).json(paramLists);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch param lists." });
  }
};

// GET /param-list/:id
export const getParamListById = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramList = await ParamList.findById(req.params.id);
    if (!paramList) {
      res.status(404).json({ message: "Param list not found." });
      return;
    }
    res.status(200).json(paramList);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch param list." });
  }
};

// PATCH /param-list/:id/parameters
export const upsertParameter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paramCode, paramTitle, paramType, paramValue, paramCount } = req.body;

    if (!paramCode) {
      res.status(400).json({ message: "paramCode is required." });
      return;
    }

    // Try to update existing parameter by paramCode
    const updated = await ParamList.findOneAndUpdate(
      { _id: req.params.id, "parameters.paramCode": paramCode },
      {
        $set: {
          "parameters.$.paramTitle": paramTitle,
          "parameters.$.paramType":  paramType,
          "parameters.$.paramValue": paramValue,
          "parameters.$.paramCount": paramCount,
        },
      },
      { new: true }
    );

    // If no existing parameter found, push a new one
    if (!updated) {
      const pushed = await ParamList.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            parameters: { paramCode, paramTitle, paramType, paramValue, paramCount },
          },
        },
        { new: true }
      );

      if (!pushed) {
        res.status(404).json({ message: "Param list not found." });
        return;
      }

      res.status(201).json(pushed);
      return;
    }

    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to upsert parameter." });
  }
};

// DELETE /param-list/:id
export const deleteParamList = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramList = await ParamList.findByIdAndDelete(req.params.id);
    if (!paramList) {
      res.status(404).json({ message: "Param list not found." });
      return;
    }
    res.status(200).json({ message: "Param list deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete param list." });
  }
};