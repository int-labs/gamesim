import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import BalanceSheetConfig from "../models/balanceSheetConfig";
import BizPerfConfig from "../models/bizperfConfig";
import CashflowConfig from "../models/cashflowConfig";
import GlobalInput from "../models/globalInputs";
import PnLConfig from "../models/pnlConfig";
import Product from "../models/products";
import Segment from "../models/segments";
import SimulationType from "../models/simulationTypes";
import { getPaginationQuery } from "../utils/paginationHelper";

// Create a new simulation type
export const createSimulationType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      description,
      brandName,
      defaultConfig,
      baseYear,
      startYear,
      endYear,
      showSegmentTag,
      maxEnergy,
      maxEnergyPerRound,
      constants,
      disallowEnergyOveruse,
    } = req.body;

    // Check for duplicate name
    const existingSimType = await SimulationType.findOne({ name });
    if (existingSimType) {
      res.status(400).json({ error: "Simulation type name already exists" });
      return;
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Create the simulation type
      const newSimulationType = await SimulationType.create(
        [
          {
            name,
            description,
            brandName,
            defaultConfig,
            showSegmentTag,
            yearRange: {
              baseYear,
              startYear,
              endYear,
            },
            maxEnergy,
            maxEnergyPerRound,
            constants: constants || [],
            disallowEnergyOveruse,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      // Fetch the complete simulation type
      const completeSimType = await SimulationType.findById(
        newSimulationType[0]._id
      ).lean();

      res.status(201).json(completeSimType);
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

// Update a simulation type
export const updateSimulationType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId: id } = req.params;
    const updateData = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Load current document to prevent overwriting fields unintentionally
      const current = await SimulationType.findById(id).session(session);
      if (!current) {
        res.status(404).json({ error: "Simulation type not found" });
        return;
      }

      const updateSimulationTypeSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        brandName: z.string().optional(),
        businessUnitSeparatorLabel: z.string().optional(),
        segmentKpiPrefix: z.string().optional(),
        overallKpiPrefix: z.string().optional(),
        defaultConfig: z.any().optional(), // Or a more specific schema if needed
        financialLabels: z.any().optional(),
        baseYear: z.number().optional(),
        startYear: z.number().optional(),
        endYear: z.number().optional(),
        reportPlacement: z.any().optional(),
        reportLevel: z.any().optional(),
        hideCompanyLevelAndEnterpriseMenu: z.boolean().optional(),
        hideProductIfOnlyOne: z.boolean().optional(),
        translations: z
          .array(
            z.object({
              languageCode: z.string(),
              languageName: z.string(),
              strings: z.record(z.string()).optional(),
            })
          )
          .optional(),
        currency: z.string().optional(),
        comparisonRoundOffset: z.number().optional(),
        preRounds: z.number().int().min(0).optional(),
        showSegmentTag: z.boolean().optional(),
        defaultHideUnselected: z.boolean().optional(),
        tiers: z
          .array(
            z.object({
              name: z.string(),
              levelKey: z.string(),
              rounds: z.number(),
              selectedSegments: z.array(z.string()),
              selectedProducts: z.array(z.string()),
            })
          )
          .optional(),
        maxEnergy: z.number().optional(),
        maxEnergyPerRound: z.array(z.number()).optional(),
        constants: z
          .array(
            z.object({
              key: z.string(),
              label: z.string(),
              value: z.number(),
            })
          )
          .optional(),
        disallowEnergyOveruse: z.boolean().optional(),
      });

      const validationResult = updateSimulationTypeSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({ error: validationResult.error.format() });
        return;
      }

      const updateData = validationResult.data;
      const updateDoc: any = { ...updateData };

      // yearRange is a nested object in the schema, map flat year fields to it safely
      if (
        updateData.baseYear !== undefined &&
        updateData.startYear !== undefined &&
        updateData.endYear !== undefined
      ) {
        updateDoc.yearRange = {
          baseYear: updateData.baseYear,
          startYear: updateData.startYear,
          endYear: updateData.endYear,
        };
        delete updateDoc.baseYear;
        delete updateDoc.startYear;
        delete updateDoc.endYear;
      }

      const updatedSimType = await SimulationType.findByIdAndUpdate(
        id,
        updateDoc,
        { new: true, session }
      );

      if (!updatedSimType) {
        res.status(404).json({ error: "Simulation type not found" });
        return;
      }

      await session.commitTransaction();

      // Fetch updated simulation type
      const completeSimType = await SimulationType.findById(id).lean();

      res.status(200).json(completeSimType);
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

// Update simulation type translations dynamically
export const updateSimulationTypeTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId: id } = req.params;

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
      const current = await SimulationType.findById(id).session(session);
      if (!current) {
        res.status(404).json({ error: "Simulation type not found" });
        return;
      }

      let translations = current.translations || [];
      let isModified = false;

      updates.forEach((update) => {
        let langIndex = translations.findIndex(
          (t) => t.languageCode === update.languageCode
        );

        if (langIndex === -1) {
          // Add new language entry
          translations.push({
            languageCode: update.languageCode,
            languageName:
              update.languageCode === "th" ? "Thai" : update.languageCode, // Fallback name
            keys: [],
          });
          langIndex = translations.length - 1;
        }

        // Merge strings into the keys array
        const keysArr = translations[langIndex].keys;
        Object.entries(update.strings).forEach(([key, value]) => {
          const keyIndex = keysArr.findIndex((k) => k.key === key);
          if (value && value.trim() !== "") {
            if (keyIndex !== -1) {
              keysArr[keyIndex].value = value;
            } else {
              keysArr.push({ key, value });
            }
          } else if (keyIndex !== -1) {
            // Remove existing translation if value is now empty (trimming to handle whitespace only)
            keysArr.splice(keyIndex, 1);
          }
        });
        isModified = true;
      });

      if (isModified) {
        current.markModified("translations");
        await current.save({ session });
      }

      await session.commitTransaction();

      // Fetch the updated type to return
      const completeSimType = await SimulationType.findById(id).lean();

      res.status(200).json(completeSimType);
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

// Read a simulation type by ID
export const readSimulationType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId: id } = req.params;

    // Find simulation type
    const simulationType = await SimulationType.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $lookup: {
          from: "segments",
          let: { simulationTypeId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$simulationTypeId", "$$simulationTypeId"] },
              },
            },
            {
              $sort: { order: 1 },
            },
          ],
          as: "segments",
        },
      },
      {
        $lookup: {
          from: "globalInputs",
          let: { localId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$$localId", "$simulationTypeId"] } } },

            {
              $sort: { order: 1 },
            },
          ],
          as: "globalInputs",
        },
      },
    ]).then((result) => result[0]);

    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json(simulationType);
  } catch (err) {
    next(err);
  }
};

// List all simulation types with pagination
export const listSimulationType = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, sortField, sortOrder, filters } =
      getPaginationQuery(req, {
        fieldsAvailableForSearch: ["name"],
      });

    // Find simulation types with pagination
    const simulationTypes = await SimulationType.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortField && sortOrder ? { [sortField]: sortOrder } : {})
      .lean();

    // Get total count for pagination
    const totalCount = await SimulationType.countDocuments(filters);

    res.status(200).json({
      simulationTypes,
      data: simulationTypes,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err);
  }
};

// Sync past year data (year 0) for simulation type
export const syncSimulationTypePastYearData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Fetch active products with their fields
    const productsInSimulationType = await Product.find({
      simulationTypeId,
    });

    const segmentsInSimulationType = await Segment.find({
      simulationTypeId,
    });

    const globalInputs = await GlobalInput.find({
      simulationTypeId,
    });

    // Fetch existing simulation type
    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    const offset = simulationType.comparisonRoundOffset || 1;
    const yearsToSync = Array.from(
      { length: offset + 1 },
      (_, i) => -offset + i
    );

    let updatedPastData = [...(simulationType.pastData || [])];

    for (const year of yearsToSync) {
      // Create past year data structure for this year
      const pastYearData = {
        year: year,
        productData: productsInSimulationType.map((product) => ({
          productId: product._id,
          segmentId: product.segmentId,
          fields: product.subProducts?.length
            ? product.fields.flatMap((field) => {
                if (field.scope === "product") {
                  const existingField = simulationType.pastData
                    ?.find((data) => data.year === year)
                    ?.productData?.find(
                      (pd) => pd.productId.toString() === product._id.toString()
                    )
                    ?.fields.find(
                      (f) => f.key === field.key && !f.subProductKey
                    );

                  return [
                    {
                      key: field.key,
                      value: existingField?.value ?? 0,
                      textValue: existingField?.textValue,
                      complexValues: existingField?.complexValues,
                    },
                  ];
                } else {
                  return product.subProducts!.map((sub) => {
                    const existingField = simulationType.pastData
                      ?.find((data) => data.year === year)
                      ?.productData?.find(
                        (pd) =>
                          pd.productId.toString() === product._id.toString()
                      )
                      ?.fields.find(
                        (f) =>
                          f.key === field.key && f.subProductKey === sub.key
                      );

                    return {
                      key: field.key,
                      subProductKey: sub.key,
                      value: existingField?.value ?? 0,
                      textValue: existingField?.textValue,
                      complexValues: existingField?.complexValues,
                    };
                  });
                }
              })
            : product.fields.map((field) => {
                const existingField = simulationType.pastData
                  ?.find((data) => data.year === year)
                  ?.productData?.find(
                    (pd) => pd.productId.toString() === product._id.toString()
                  )
                  ?.fields.find((f) => f.key === field.key);

                return {
                  key: field.key,
                  value: existingField?.value ?? 0,
                  textValue: existingField?.textValue,
                  complexValues: existingField?.complexValues,
                };
              }),
        })),
        segmentData: segmentsInSimulationType.map((segment) => ({
          segmentId: segment._id,
          fields: segment.fields.map((field) => {
            const existingField = simulationType.pastData
              ?.find((data) => data.year === year)
              ?.segmentData?.find(
                (sd) => sd.segmentId.toString() === segment._id.toString()
              )
              ?.fields.find((f) => f.key === field.key);

            return {
              key: field.key,
              value: existingField?.value ?? 0,
              textValue: existingField?.textValue,
              complexValues: existingField?.complexValues,
            };
          }),
        })),
        globalData: globalInputs.flatMap((globalInput) =>
          globalInput.inputs.map((input) => {
            const existingField = simulationType.pastData
              ?.find((data) => data.year === year)
              ?.globalData?.find(
                (gd) =>
                  gd.globalInputId.toString() === globalInput._id.toString() &&
                  gd.key === input.key
              );

            return {
              globalInputId: globalInput._id,
              key: input.key,
              value: existingField?.value ?? 0,
            };
          })
        ),
        outputs: productsInSimulationType.flatMap((product) =>
          simulationType.outputs.map((simOutput) => {
            const existingOutput = simulationType.pastData
              ?.find((data) => data.year === year)
              ?.outputs.find(
                (o) =>
                  o.productId.toString() === product._id.toString() &&
                  o.key === simOutput.key
              );

            return {
              productId: product._id,
              key: simOutput.key,
              value: existingOutput?.value ?? 0,
            };
          })
        ),
      };

      const existingYearIndex = updatedPastData.findIndex(
        (d) => d.year === year
      );
      if (existingYearIndex !== -1) {
        updatedPastData[existingYearIndex] = pastYearData as any;
      } else {
        updatedPastData.push(pastYearData as any);
      }
    }

    // Update simulation type with new past data
    const updatedSimType = await SimulationType.findByIdAndUpdate(
      simulationTypeId,
      {
        $set: { pastData: updatedPastData },
      },
      { new: true }
    ).populate([
      {
        path: "pastData.globalData.globalInputId",
        model: "GlobalInput",
      },
    ]);

    if (!updatedSimType) {
      res.status(404).json({ error: "Failed to update simulation type" });
      return;
    }

    res.status(200).json(updatedSimType);
  } catch (err) {
    console.error("Error syncing past year data:", err);
    next(err);
  }
};

// Update past data for simulation type
export const updateSimulationTypePastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { pastData } = req.body;

    // Validate request body
    if (!Array.isArray(pastData)) {
      res.status(400).json({ error: "pastData must be an array" });
      return;
    }

    // Update simulation type with new past data
    const updatedSimType = await SimulationType.findByIdAndUpdate(
      simulationTypeId,
      {
        $set: { pastData },
      },
      { new: true }
    ).populate([
      {
        path: "pastData.globalData.globalInputId",
        model: "GlobalInput",
      },
    ]);

    if (!updatedSimType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json(updatedSimType);
  } catch (err) {
    console.error("Error updating past data:", err);
    next(err);
  }
};

export const getSimulationTypePastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const simulationType = await SimulationType.findById(simulationTypeId);

    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json(simulationType.pastData);
  } catch (err) {
    next(err);
  }
};

export const upsertSimulationTypeProductPastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Validate request body
    const pastDataSchema = z.object({
      year: z.number(),
      productId: z.string(),
          fields: z.array(
            z.object({
              key: z.string(),
              value: z.number(),
              textValue: z.string().optional(),
              subProductKey: z.string().optional(),
              complexValues: z
                .array(
                  z.object({
                    optionKey: z.string(),
                    tab: z.string(),
                    itemKey: z.string(),
                    value: z.number(),
                    textValue: z.string().optional(),
                  })
                )
                .transform((cvs) => {
                  if (!cvs) return cvs;
                  const uniqueOptionKeys = Array.from(
                    new Set(cvs.map((cv) => cv.optionKey))
                  );
                  const newCvs = [...cvs];
                  uniqueOptionKeys.forEach((optionKey) => {
                    const hasAnchor = cvs.some(
                      (cv) =>
                        cv.optionKey === optionKey &&
                        cv.tab !== "incentive" &&
                        cv.tab !== "channel" &&
                        cv.tab !== "set_your_tenant_strategy"
                    );
                    if (!hasAnchor) {
                      newCvs.push({
                        optionKey,
                        tab: "campaign",
                        itemKey: optionKey,
                        value: 0,
                      });
                    }
                  });
                  return newCvs;
                })
                .optional(),
            })
          ),
    });

    const validationResult = pastDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });

      return;
    }

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findOneAndUpdate(
      { _id: simTypeObjId },
      { _id: simTypeObjId },
      { upsert: true, new: true }
    );

    // Find the correct year entry
    let yearData = simulationType.pastData.find(
      (d) => d.year === validationResult.data.year
    );

    if (!yearData) {
      // If year doesn't exist, create it (should normally be done by sync, but handle for robustness)
      simulationType.pastData.push({
        year: validationResult.data.year,
        productData: [],
        segmentData: [],
        globalData: [],
        outputs: [],
      } as any);
      yearData = simulationType.pastData[simulationType.pastData.length - 1];
    }

    // Find the correct product entry
    let productData = yearData.productData.find(
      (p) => p.productId.toString() === validationResult.data.productId
    );

    if (!productData) {
      // If product entry doesn't exist for this year, create it
      yearData.productData.push({
        productId: new mongoose.Types.ObjectId(validationResult.data.productId),
        segmentId: new mongoose.Types.ObjectId(
          req.body.segmentId || (simulationType as any).segmentId // Fallback if segmentId not in body
        ),
        fields: validationResult.data.fields,
      } as any);
    } else {
      // Update existing product entry fields
      productData.fields = validationResult.data.fields;
    }

    // Explicitly mark modified if needed (though Mongoose usually tracks subdoc changes)
    simulationType.markModified("pastData");

    // Save and populate
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err) {
    console.error("Error upserting past data:", err);
    next(err);
  }
};

export const upsertSimulationTypeSegmentPastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Validate request body
    const pastDataSchema = z.object({
      year: z.number(),
      segmentId: z.string(),
      fields: z.array(
        z.object({
          key: z.string(),
          value: z.number(),
          textValue: z.string().optional(),
          complexValues: z
            .array(
              z.object({
                optionKey: z.string(),
                tab: z.string(),
                itemKey: z.string(),
                value: z.number(),
                textValue: z.string().optional(),
              })
            )
            .transform((cvs) => {
              if (!cvs) return cvs;
              const uniqueOptionKeys = Array.from(
                new Set(cvs.map((cv) => cv.optionKey))
              );
              const newCvs = [...cvs];
              uniqueOptionKeys.forEach((optionKey) => {
                const hasAnchor = cvs.some(
                  (cv) =>
                    cv.optionKey === optionKey &&
                    cv.tab !== "incentive" &&
                    cv.tab !== "channel" &&
                    cv.tab !== "set_your_tenant_strategy"
                );
                if (!hasAnchor) {
                  newCvs.push({
                    optionKey,
                    tab: "campaign",
                    itemKey: optionKey,
                    value: 0,
                  });
                }
              });
              return newCvs;
            })
            .optional(),
        })
      ),
    });

    const validationResult = pastDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });

      return;
    }

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findOneAndUpdate(
      { _id: simTypeObjId },
      { _id: simTypeObjId },
      { upsert: true, new: true }
    );

    // Find the correct year entry
    let yearData = simulationType.pastData.find(
      (d) => d.year === validationResult.data.year
    );

    if (!yearData) {
      // If year doesn't exist, create it
      simulationType.pastData.push({
        year: validationResult.data.year,
        productData: [],
        segmentData: [],
        globalData: [],
        outputs: [],
      } as any);
      yearData = simulationType.pastData[simulationType.pastData.length - 1];
    }

    // Find the correct segment entry
    let segmentData = yearData.segmentData.find(
      (s) => s.segmentId.toString() === validationResult.data.segmentId
    );

    if (!segmentData) {
      // If segment entry doesn't exist for this year, create it
      yearData.segmentData.push({
        segmentId: new mongoose.Types.ObjectId(validationResult.data.segmentId),
        fields: validationResult.data.fields,
      } as any);
    } else {
      // Update existing segment entry fields
      segmentData.fields = validationResult.data.fields;
    }

    // Explicitly mark modified
    simulationType.markModified("pastData");

    // Save and populate
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err) {
    console.error("Error upserting past data:", err);
    next(err);
  }
};

export const upsertSimulationTypeGlobalPastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { pastData } = req.body;

    const pastDataSchema = z.object({
      year: z.number(),
      globalInputId: z.string(),
      inputs: z.array(
        z.object({
          key: z.string(),
          value: z.number(),
        })
      ),
    });

    const validationResult = pastDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });

      return;
    }

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findOneAndUpdate(
      { _id: simTypeObjId },
      { _id: simTypeObjId },
      { upsert: true, new: true }
    );

    // Find the correct year entry
    let yearData = simulationType.pastData.find(
      (d) => d.year === validationResult.data.year
    );

    if (!yearData) {
      simulationType.pastData.push({
        year: validationResult.data.year,
        productData: [],
        segmentData: [],
        globalData: [],
        outputs: [],
      } as any);
      yearData = simulationType.pastData[simulationType.pastData.length - 1];
    }

    // Update global data entries
    validationResult.data.inputs.forEach((input) => {
      let globalEntry = yearData!.globalData.find(
        (g) =>
          g.globalInputId.toString() === validationResult.data.globalInputId &&
          g.key === input.key
      );

      if (globalEntry) {
        globalEntry.value = input.value;
      } else {
        yearData!.globalData.push({
          globalInputId: new mongoose.Types.ObjectId(
            validationResult.data.globalInputId
          ),
          key: input.key,
          value: input.value,
        } as any);
      }
    });

    simulationType.markModified("pastData");
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err) {
    next(err);
  }
};

export const upsertSimulationTypeOutputPastData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { pastData } = req.body;

    const pastDataSchema = z.object({
      year: z.number(),
      productId: z.string(),
      outputs: z.array(z.object({ key: z.string(), value: z.number() })),
    });

    const validationResult = pastDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findOneAndUpdate(
      { _id: simTypeObjId },
      { _id: simTypeObjId },
      { upsert: true, new: true }
    );

    // Find the correct year entry
    let yearData = simulationType.pastData.find(
      (d) => d.year === validationResult.data.year
    );

    if (!yearData) {
      simulationType.pastData.push({
        year: validationResult.data.year,
        productData: [],
        segmentData: [],
        globalData: [],
        outputs: [],
      } as any);
      yearData = simulationType.pastData[simulationType.pastData.length - 1];
    }

    // Update output entries
    validationResult.data.outputs.forEach((output) => {
      let outputEntry = yearData!.outputs.find(
        (o) =>
          o.productId.toString() === validationResult.data.productId &&
          o.key === output.key
      );

      if (outputEntry) {
        outputEntry.value = output.value;
      } else {
        yearData!.outputs.push({
          productId: new mongoose.Types.ObjectId(
            validationResult.data.productId
          ),
          key: output.key,
          value: output.value,
        } as any);
      }
    });

    simulationType.markModified("pastData");
    await simulationType.save();

    res.status(200).json(simulationType.pastData);
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeOutputs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;
    const outputs = req.body;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findOneAndUpdate(
      { _id: simTypeObjId },
      { _id: simTypeObjId },
      { upsert: true, new: true }
    );

    simulationType.outputs = outputs;

    await simulationType.save();

    res.status(200).json(simulationType.outputs);
  } catch (err) {
    next(err);
  }
};

export const readSimulationTypeOutputs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    // Find or create simulation type
    let simulationType = await SimulationType.findById({ _id: simTypeObjId });

    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json(simulationType.outputs);
  } catch (err) {
    next(err);
  }
};

export const readSimulationTypeOutputConfigs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    const cashflowConfig = await CashflowConfig.findOne({
      simulationTypeId: simTypeObjId,
    });
    const balanceSheetConfig = await BalanceSheetConfig.findOne({
      simulationTypeId: simTypeObjId,
    });
    const bizperfConfig = await BizPerfConfig.findOne({
      simulationTypeId: simTypeObjId,
    });
    const pnlConfig = await PnLConfig.findOne({
      simulationTypeId: simTypeObjId,
    });

    res.status(200).json({
      error: null,
      data: {
        cashflow: cashflowConfig,
        balanceSheet: balanceSheetConfig,
        bizperf: bizperfConfig,
        pnl: pnlConfig,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeBalanceSheetConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;
    const balanceSheetConfig = req.body;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    const balanceSheetFieldSchema = z.object({
      fieldKey: z.string(),
      label: z.string(),
      type: z
        .enum(["money", "number", "text", "empty"])
        .optional()
        .default("money"),
      bold: z.boolean().optional().default(false),
      indented: z.boolean().optional().default(false),
      addSpaceAbove: z.boolean().optional().default(false),
    });

    const balanceSheetConfigSchema = z.object({
      ASSETS: z.array(balanceSheetFieldSchema).min(0),
      LIABILITIES: z.array(balanceSheetFieldSchema).min(0),
      EQUITY: z.array(balanceSheetFieldSchema).min(0),
      OTHERS: z.array(balanceSheetFieldSchema).min(0).optional(),
    });

    const validationResult =
      balanceSheetConfigSchema.safeParse(balanceSheetConfig);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updatedBalanceSheetConfig = await BalanceSheetConfig.findOneAndUpdate(
      { simulationTypeId: simTypeObjId },
      { $set: { groups: validationResult.data } },
      { new: true, upsert: true }
    );

    if (!updatedBalanceSheetConfig) {
      res.status(404).json({ error: "Balance sheet config not found" });
      return;
    }

    res.status(200).json({
      error: null,
      data: {
        balanceSheet: updatedBalanceSheetConfig,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeCashflowConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;
    const cashflowConfig = req.body;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    const groupFieldSchema = z.object({
      fieldKey: z.string(),
      label: z.string(),
      type: z.enum(["money", "number", "text", "empty"]).optional(),
      bold: z.boolean().optional(),
      backgroundColor: z.string().optional(),
      indented: z.boolean().optional(),
      hasBottomBorder: z.boolean().optional(),
      showValue: z.boolean().optional(),
    });

    const cashflowConfigSchema = z.union([
      // New format with groups wrapper (what frontend sends)
      z.object({
        groups: z.object({
          OPERATING: z.array(groupFieldSchema).min(0),
          INVESTING: z.array(groupFieldSchema).min(0),
          FINANCING: z.array(groupFieldSchema).min(0),
          GENERAL: z.array(groupFieldSchema).min(0),
        }),
        showGroupHeaders: z
          .object({
            OPERATING: z.boolean().optional(),
            INVESTING: z.boolean().optional(),
            FINANCING: z.boolean().optional(),
            GENERAL: z.boolean().optional(),
          })
          .optional(),
      }),
      // Old format (backward compatibility)
      z.object({
        showGroupHeaders: z
          .object({
            OPERATING: z.boolean().optional(),
            INVESTING: z.boolean().optional(),
            FINANCING: z.boolean().optional(),
            GENERAL: z.boolean().optional(),
          })
          .optional(),
        OPERATING: z.array(groupFieldSchema).min(0),
        INVESTING: z.array(groupFieldSchema).min(0),
        FINANCING: z.array(groupFieldSchema).min(0),
        GENERAL: z.array(groupFieldSchema).min(0),
      }),
    ]);

    const validationResult = cashflowConfigSchema.safeParse(cashflowConfig);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    // Handle both old format (just groups) and new format (with showGroupHeaders)
    const updateData: any = {};
    const data = validationResult.data;

    // Extract groups (either from 'groups' key or root level for backward compatibility)
    if ("groups" in data) {
      updateData.groups = data.groups;
    } else {
      // Old format - groups at root level
      const { showGroupHeaders, ...groups } = data;
      updateData.groups = groups;
    }

    // Handle showGroupHeaders
    if ("showGroupHeaders" in data && data.showGroupHeaders !== undefined) {
      updateData.showGroupHeaders = data.showGroupHeaders;
    }

    const updatedCashflowConfig = await CashflowConfig.findOneAndUpdate(
      { simulationTypeId: simTypeObjId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    if (!updatedCashflowConfig) {
      res.status(404).json({ error: "Cashflow config not found" });
      return;
    }

    res.status(200).json({
      error: null,
      data: {
        cashflow: updatedCashflowConfig,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeBizPerfConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;
    const bizperfConfig = req.body;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    const bizperfFieldSchema = z.object({
      fieldKey: z.string(),
      label: z.string(),
      type: z.enum(["number", "percentage", "money"]).optional(),
      bold: z.boolean().optional(),
      indented: z.boolean().optional(),
      hideIfFalsy: z.boolean().optional(),
      addSpaceAbove: z.boolean().optional(),
      order: z.number().optional(),
      decimalDigit: z.number().optional(),
    });

    const bizperfConfigSchema = z.object({
      fields: z.array(bizperfFieldSchema).min(0),
      valueHeaderPrefix: z.string().optional(),
      changeHeaderPrefix: z.string().optional(),
    });

    const validationResult = bizperfConfigSchema.safeParse(bizperfConfig);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updatedBizPerfConfig = await BizPerfConfig.findOneAndUpdate(
      { simulationTypeId: simTypeObjId },
      {
        $set: {
          fields: validationResult.data.fields,
          valueHeaderPrefix: validationResult.data.valueHeaderPrefix,
          changeHeaderPrefix: validationResult.data.changeHeaderPrefix,
        },
      },
      { new: true, upsert: true }
    );

    if (!updatedBizPerfConfig) {
      res.status(404).json({ error: "BizPerf config not found" });
      return;
    }

    res.status(200).json({
      error: null,
      data: {
        bizperf: updatedBizPerfConfig,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypePnLConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationTypeId = req.params.simulationTypeId;
    const pnlConfig = req.body;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);

    const pnlFieldSchema = z.object({
      fieldKey: z.string(),
      label: z.string(),
      type: z.enum(["number", "percentage", "money", "empty"]).optional(),
      bold: z.boolean().optional(),
      indented: z.boolean().optional(),
      hideIfFalsy: z.boolean().optional(),
      addSpaceAbove: z.boolean().optional(),
      order: z.number().optional(),
      decimalDigit: z.number().optional(),
    });

    const pnlConfigSchema = z.object({
      fields: z.array(pnlFieldSchema).min(0),
    });

    const validationResult = pnlConfigSchema.safeParse(pnlConfig);

    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updatedPnLConfig = await PnLConfig.findOneAndUpdate(
      { simulationTypeId: simTypeObjId },
      { $set: { fields: validationResult.data.fields } },
      { new: true, upsert: true }
    );

    if (!updatedPnLConfig) {
      res.status(404).json({ error: "PnL config not found" });
      return;
    }

    res.status(200).json({
      error: null,
      data: {
        pnl: updatedPnLConfig,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeWinningMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { winningMetrics } = req.body;

    const simulationType = await SimulationType.findById(simulationTypeId);

    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    // Validate winning metrics if provided
    if (winningMetrics !== null && winningMetrics !== undefined) {
      if (!Array.isArray(winningMetrics)) {
        res.status(400).json({ error: "Winning metrics must be an array" });
        return;
      }

      // Validate each metric
      for (const metric of winningMetrics) {
        if (!metric.key || !metric.label) {
          res
            .status(400)
            .json({ error: "Each metric must have a key and label" });
          return;
        }
        if (!["money", "percentage", "number"].includes(metric.format)) {
          res.status(400).json({
            error: "Invalid format. Must be money, percentage, or number",
          });
          return;
        }
        if (
          !["pnl", "bizperf", "csat", "esat", "custom"].includes(metric.source)
        ) {
          res.status(400).json({
            error:
              "Invalid source. Must be pnl, bizperf, csat, esat, or custom",
          });
          return;
        }
        if (!["sum", "average"].includes(metric.aggregationType)) {
          res
            .status(400)
            .json({ error: "Invalid aggregationType. Must be sum or average" });
          return;
        }
        if (typeof metric.order !== "number") {
          res.status(400).json({ error: "Order must be a number" });
          return;
        }

        if (metric.styles) {
          if (typeof metric.styles !== "object") {
            res.status(400).json({ error: "Styles must be an object" });
            return;
          }
          for (const key in metric.styles) {
            if (typeof metric.styles[key] !== "string") {
              res.status(400).json({ error: "Styles must be an object" });
              return;
            }
          }
        }
      }

      // Check for duplicate keys
      const keys = winningMetrics.map((m: any) => m.key);
      const uniqueKeys = new Set(keys);
      if (keys.length !== uniqueKeys.size) {
        res
          .status(400)
          .json({ error: "Duplicate metric keys are not allowed" });
        return;
      }
    }

    simulationType.winningMetrics = winningMetrics;
    await simulationType.save();

    res.status(200).json({
      message: "Winning metrics updated successfully",
      winningMetrics: simulationType.winningMetrics,
    });
  } catch (err) {
    next(err);
  }
};

export const readSimulationTypeWinningMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const simulationType =
      await SimulationType.findById(simulationTypeId).select("winningMetrics");

    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json({
      winningMetrics: simulationType.winningMetrics || null,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSimulationTypeConstants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId: id } = req.params;
    const { constants } = req.body;

    const constantsSchema = z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.number(),
      })
    );

    const validation = constantsSchema.safeParse(constants);

    if (!validation.success) {
      res.status(400).json({ error: validation.error.format() });
      return;
    }

    const updatedSimType = await SimulationType.findByIdAndUpdate(
      id,
      { constants: validation.data },
      { new: true }
    );

    if (!updatedSimType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    res.status(200).json(updatedSimType);
  } catch (err) {
    next(err);
  }
};
