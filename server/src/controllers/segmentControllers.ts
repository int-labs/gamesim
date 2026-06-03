import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Segment from "../models/segments";
import { getPaginationQuery } from "../utils/paginationHelper";

// Create a new segment
export const createSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { name, description, key, sidebarIconName } = req.body;

    // Check for duplicate name within the same simulation type
    const existingSegment = await Segment.findOne({
      simulationTypeId,
      name,
    });

    if (existingSegment) {
      res
        .status(400)
        .json({ error: "Segment name already exists in this simulation type" });
      return;
    }

    // Create the segment
    const newSegment = await Segment.create({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
      name,
      description,
      key,
      sidebarIconName,
    });

    // Fetch the complete segment
    const completeSegment = await Segment.findById(newSegment._id).lean();

    res.status(201).json(completeSegment);
  } catch (err) {
    next(err);
  }
};

// Update a segment
export const updateSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { segmentId: id } = req.params;
    const updateData = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update segment
      const updatedSegment = await Segment.findByIdAndUpdate(
        id,
        {
          name: updateData.name,
          description: updateData.description,
          key: updateData.key,
          icon: updateData.icon,
          active: updateData.active,
          sidebarIconName: updateData.sidebarIconName,
        },
        { new: true, session }
      );

      if (!updatedSegment) {
        res.status(404).json({ error: "Segment not found" });
        return;
      }

      await session.commitTransaction();

      // Fetch updated segment
      const completeSegment = await Segment.findById(id)
        .populate("simulationType")
        .lean();

      res.status(200).json(completeSegment);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
};

// Read a segment by ID
export const readSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { segmentId: id } = req.params;

    // Find segment
    const segment = await Segment.findById(id)
      .populate("simulationType")
      .lean();

    if (!segment) {
      res.status(404).json({ error: "Segment not found" });
      return;
    }

    res.status(200).json(segment);
  } catch (err) {
    next(err);
  }
};

// List all segments with pagination
export const listSegments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, sortField, sortOrder, filters } =
      getPaginationQuery(req, {
        fieldsAvailableForSearch: ["name"],
      });

    const { simulationTypeId } = req.params;

    // Add simulationTypeId to filters if provided in query
    if (simulationTypeId) {
      filters.simulationTypeId = new mongoose.Types.ObjectId(
        simulationTypeId as string
      ).toString();
    }

    // Find segments with pagination
    const segments = await Segment.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(
        sortField && sortOrder
          ? { order: 1, [sortField]: sortOrder }
          : {
              order: 1,
            }
      )
      .lean();

    // Get total count for pagination
    const totalCount = await Segment.countDocuments(filters);

    res.status(200).json({
      segments,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err);
  }
};

const fieldsSchema = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    isConsumingEnergy: z.boolean().optional(),
    consumptionMultiplier: z.number().optional(),
    energyCosts: z
      .array(z.object({ changeValue: z.number(), cost: z.number() }))
      .optional(),
    isIncurringCost: z.boolean().optional(),
    costs: z
      .array(z.object({ selectedValue: z.number(), cost: z.number() }))
      .optional(),
    isCostRatio: z.boolean().optional(),
    costRatioOf: z.string().optional(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          numericValue: z.number().optional(),
        })
      )
      .optional()
      .nullable(),
    description: z.string().optional().nullable(),
    impactMultipliers: z.array(z.number()).optional(),
    resetEachRound: z.boolean().optional(),
    complexCheckboxConfig: z.any().optional(),
    budgetAllocationConfig: z
      .object({
        budgetPerRound: z.array(
          z.object({
            round: z.number(),
            budget: z.number(),
          })
        ),
        isBiRoundCycle: z.boolean().optional(),
      })
      .optional(),
  })
);

export const updateSegmentFields = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { segmentId: id } = req.params;
    const { fields } = req.body;

    const validationResult = fieldsSchema.safeParse(fields);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.message });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update segment
      const updatedSegment = await Segment.findByIdAndUpdate(
        id,
        { fields: validationResult.data },
        { new: true, session }
      );

      if (!updatedSegment) {
        res.status(404).json({ error: "Segment not found" });
        return;
      }

      await session.commitTransaction();

      res.status(200).json(updatedSegment);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
};

export const updateSegmentOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { simulationTypeId } = req.params;

  if (!simulationTypeId) {
    res.status(400).json({ error: "Simulation type ID is required" });
    return;
  }

  const validation = z
    .object({
      segmentIds: z.array(z.string()),
    })

    .safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({ error: validation.error.message });
    return;
  }

  try {
    const bulkOps = validation.data.segmentIds.map((id, index) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(id),
          simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        },
        update: {
          $set: {
            order: index,
          },
        },
      },
    }));

    await Segment.bulkWrite(bulkOps);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const updateSegmentTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { segmentId: id } = req.params;

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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await Segment.findById(id).session(session);
      if (!current) {
        res.status(404).json({ error: "Segment not found" });
        return;
      }

      let segmentTranslations = current.translations || [];

      updates.forEach((update) => {
        let langIndex = segmentTranslations.findIndex(
          (t) => t.languageCode === update.languageCode
        );

        if (langIndex === -1) {
          // Add new language entry
          segmentTranslations.push({
            languageCode: update.languageCode,
            keys: [],
          });
          langIndex = segmentTranslations.length - 1;
        }

        // Merge strings into the keys array
        const keysArr = segmentTranslations[langIndex].keys;
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

      current.translations = segmentTranslations;
      current.markModified("translations");
      await current.save({ session });

      await session.commitTransaction();

      // Return the updated segment with populated sim type
      const updatedSegment = await Segment.findById(id)
        .populate("simulationType")
        .lean();

      res.status(200).json(updatedSegment);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    next(err);
  }
};
