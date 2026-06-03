import { Request, Response, NextFunction } from "express";
import Param from "../models/param";
import mongoose from "mongoose";

export const getAllParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = await Param.find();
    res.status(200).json(params);
  } catch (err) {
    next(err);
  }
};

export const getParamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const param = await Param.findById(req.params.id);
    if (!param) return res.status(404).json({ message: "Not found" });
    res.json(param);
  } catch (err) {
    next(err);
  }
};

export const fetchParamBySegmentProduct = async ({
  segmentId,
  productId,
}: {
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
}) => {
  return await Param.findOne({ segmentId, productId });
};


export const getParamBySegmentProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { segmentId, productId } = req.query;

    if (!segmentId || !productId) {
      return res.status(400).json({ message: "segmentId and productId are required" });
    }

    const param = await Param.findOne({
      segmentId: new mongoose.Types.ObjectId(segmentId as string),
      productId: new mongoose.Types.ObjectId(productId as string),
    });

    if (!param) return res.status(404).json({ message: "No matching param" });

    res.json(param);
  } catch (err) {
    next(err);
  }
};
