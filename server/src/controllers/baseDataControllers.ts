import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { z } from "zod";

import BaseData from "../models/baseData";
import GlobalInput from "../models/globalInputs";
import Product from "../models/products";
import Segment from "../models/segments";
import SimulationType from "../models/simulationTypes";

interface YearlyData {
  marketSize: number;
  marketGrowth: number;
}

interface MarketDataProduct {
  productId: mongoose.Types.ObjectId;
  yearlyData: Record<string, YearlyData>;
}

const yearlyDataSchema = z.record(
  z.string(),
  z.object({
    marketSize: z.number(),
    marketGrowth: z.number(),
  })
);

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  formula: z.string().optional(),
  type: z.string().optional(),
  level: z
    .enum(["global", "segment", "product", "subproduct", "dynamic"])
    .optional(),
  coefficients: z.record(z.string(), z.number()),
  direction: z.number(),
  tightening: z.number(),
  elasticity: z.number().optional(),
});

const subProductDataSchema = z.object({
  key: z.string(),
  yearlyData: yearlyDataSchema,
});

const subProductModelSchema = z.object({
  key: z.string(),
  fields: z.array(fieldSchema),
});

const upsertBaseDataSchema = z.object({
  segmentId: z.string().min(1, "Segment ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  yearlyData: yearlyDataSchema.optional(),
  subProductsData: z.array(subProductDataSchema).optional(),
  fields: z.array(fieldSchema).optional(),
  segmentFields: z.array(fieldSchema).optional(),
  globalFields: z.array(fieldSchema).optional(),
  subProductsModel: z.array(subProductModelSchema).optional(),
});

type UpsertBaseDataInput = z.infer<typeof upsertBaseDataSchema>;

// Get base data by simulation type ID
export const getBaseDataBySimulationTypeId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).populate([
      {
        path: "simulationTypeId",
      },
      {
        path: "marketData.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketData.segments.products.productId",
        model: "Product",
      },
      {
        path: "marketModel.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketModel.segments.products.productId",
        model: "Product",
      },
    ]);

    if (!baseData) {
      res
        .status(404)
        .json({ error: "Base data not found for this simulation type" });
      return;
    }

    res.status(200).json(baseData);
  } catch (err) {
    console.error("Error fetching base data:", err);
    next(err);
  }
};

// Create or update entire base data with active segments and products
export const upsertBaseData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Fetch active segments and product
    const activeSegments = await Segment.find({ active: true });
    const activeProducts = await Product.find({
      // TODO later implement active field in product model
      // active: true,
    }).populate("selectedGlobalInputs.globalInputId");

    // Create combinations of active segments and products
    const formattedBaseData = activeSegments.flatMap((segment) =>
      activeProducts.map((product) => ({
        segmentId: segment._id,
        productId: product._id,
        config: {},
      }))
    );

    // Upsert the base data
    const updatedBaseData = await BaseData.findOneAndUpdate(
      { simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId) },
      {
        simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        constants: formattedBaseData,
      },
      {
        new: true,
        upsert: true,
      }
    )
      .populate("simulationTypeId")
      .populate("constants.segmentId")
      .populate("constants.productId");

    res.status(200).json(updatedBaseData);
  } catch (err) {
    console.error("Error upserting base data:", err);
    next(err);
  }
};

// Sync base data to match latest active segments and products
export const syncBaseData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Fetch active segments and products
    const activeSegments = await Segment.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
      active: true,
    });
    const activeProducts = await Product.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).populate("fields");

    const activeGlobalInputs = await GlobalInput.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).sort({ order: 1 });

    const globalInputsArray = activeGlobalInputs.reduce((acc, globalInput) => {
      const inputsWithGroup = globalInput.inputs.map((input: any) => ({
        ...(input.toObject ? input.toObject() : input),
        groupName: globalInput.name,
      }));
      return [...acc, ...inputsWithGroup];
    }, [] as Array<any>);

    // Retrieve existing base data
    const existingBaseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).lean();

    // Fetch the simulation type for year range
    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }
    const { startYear, endYear } = simulationType.yearRange;

    // Initialize new base data structure
    const formattedBaseData = {
      marketData: {
        segments: activeSegments.map((segment) => ({
          segmentId: segment._id,
          products: activeProducts
            .filter((product) => product.segmentId.equals(segment._id))
            .map((product) => {
              // Find existing market data if any
              const existingSegment =
                existingBaseData?.marketData?.segments?.find(
                  (s) => s.segmentId.toString() === segment._id.toString()
                );
              const existingProduct = existingSegment?.products?.find(
                (p) => p.productId.toString() === product._id.toString()
              );

              // Create yearlyData object
              const yearlyData: Record<string, YearlyData> = {};

              for (let year = startYear; year <= endYear; year++) {
                const yearStr = year.toString();
                const existingYearData = existingProduct?.yearlyData?.[yearStr];
                yearlyData[yearStr] = {
                  marketSize: existingYearData?.marketSize || 0,
                  marketGrowth: existingYearData?.marketGrowth || 0,
                };
              }

              return {
                productId: product._id,
                yearlyData,
                subProducts: (product.subProducts || []).map((subProd) => {
                  const existingSubProduct = existingProduct?.subProducts?.find(
                    (sp: any) => sp.key === subProd.key
                  );
                  const subYearlyData: Record<string, YearlyData> = {};
                  for (let year = startYear; year <= endYear; year++) {
                    const yearStr = year.toString();
                    const existingYearData =
                      existingSubProduct?.yearlyData?.[yearStr];
                    subYearlyData[yearStr] = {
                      marketSize: existingYearData?.marketSize || 0,
                      marketGrowth: existingYearData?.marketGrowth || 0,
                    };
                  }
                  return {
                    key: subProd.key,
                    yearlyData: subYearlyData,
                  };
                }),
              };
            }),
        })),
      },
      marketModel: {
        segments: activeSegments.map((segment) => ({
          segmentId: segment._id,
          products: activeProducts
            .filter((product) => product.segmentId.equals(segment._id))
            .map((product) => {
              // Find existing market model if any
              const existingSegment =
                existingBaseData?.marketModel?.segments?.find(
                  (s) => s.segmentId.toString() === segment._id.toString()
                );
              const existingProduct = existingSegment?.products?.find(
                (p) => p.productId.toString() === product._id.toString()
              );

              const existingGlobalFields = Array.isArray(
                existingProduct?.globalFields
              )
                ? existingProduct?.globalFields
                : [];

              const existingSegmentFields = Array.isArray(
                existingProduct?.segmentFields
              )
                ? existingProduct?.segmentFields
                : [];

              return {
                productId: product._id,
                fields: [
                  ...product.fields.map((field) => {
                    // Find existing field if any
                    const existingField = existingProduct?.fields.find(
                      (f) => f.key === field.key
                    );

                    // Create coefficients object
                    const coefficients: Record<string, number> = {};

                    for (let year = startYear; year <= endYear; year++) {
                      const yearStr = year.toString();
                      coefficients[yearStr] =
                        existingField?.coefficients?.[yearStr] || 0;
                    }

                    return {
                      key: field.key,
                      label: field.label,
                      direction: existingField?.direction || 1,
                      tightening: existingField?.tightening || 3.0,
                      coefficients,
                      level: existingField?.level,
                    };
                  }),
                  ...(existingProduct?.fields || [])
                    .filter(
                      (f) =>
                        f.level === "dynamic" &&
                        !product.fields.some((pf) => pf.key === f.key)
                    )
                    .map((field) => {
                      const coefficients: Record<string, number> = {};

                      for (let year = startYear; year <= endYear; year++) {
                        const yearStr = year.toString();
                        coefficients[yearStr] =
                          field.coefficients?.[yearStr] || 0;
                      }

                      return {
                        key: field.key,
                        label: field.label,
                        direction: field.direction || 1,
                        tightening: field.tightening || 3.0,
                        coefficients,
                        level: "dynamic",
                        formula: field.formula,
                        type: field.type,
                      };
                    }),
                ],
                segmentFields: segment.fields.map((field) => {
                  // Find existing field if any
                  const existingField = existingSegmentFields.find(
                    (f) => f.key === field.key
                  );

                  // Create coefficients object
                  const coefficients: Record<string, number> = {};

                  for (let year = startYear; year <= endYear; year++) {
                    const yearStr = year.toString();
                    coefficients[yearStr] =
                      existingField?.coefficients[yearStr] || 0;
                  }

                  return {
                    key: field.key,
                    label: field.label,
                    direction: existingField?.direction || 1,
                    tightening: existingField?.tightening || 3.0,
                    coefficients,
                  };
                }),
                globalFields: globalInputsArray.map((globalInput) => {
                  const existingField = existingGlobalFields?.find(
                    (f) => f.key === globalInput.key
                  );

                  // Create coefficients object
                  const coefficients: Record<string, number> = {};

                  for (let year = startYear; year <= endYear; year++) {
                    const yearStr = year.toString();
                    coefficients[yearStr] =
                      existingField?.coefficients?.[yearStr] || 0;
                  }

                  return {
                    key: globalInput.key,
                    label: globalInput.name,
                    direction: existingField?.direction || 1,
                    tightening: existingField?.tightening || 3.0,
                    coefficients,
                  };
                }),
                subProducts: (product.subProducts || []).map((subProd) => {
                  const existingSubProdModel =
                    existingProduct?.subProducts?.find(
                      (sp: any) => sp.key === subProd.key
                    );

                  // Create the consolidated fields list for this subproduct
                  const consolidatedFields = [
                    // 1. Global Drivers
                    ...globalInputsArray.map((gi) => {
                      const existingLocal = existingSubProdModel?.fields?.find(
                        (f: any) => f.key === gi.key && f.level === "global"
                      );
                      const existingGlobal = existingGlobalFields?.find(
                        (f: any) => f.key === gi.key
                      );
                      const source = existingLocal || existingGlobal;

                      const coefficients: Record<string, number> = {};
                      for (let year = startYear; year <= endYear; year++) {
                        const yearStr = year.toString();
                        coefficients[yearStr] =
                          source?.coefficients?.[yearStr] || 0;
                      }
                      return {
                        key: gi.key,
                        label: gi.name,
                        level: "global" as const,
                        groupName: gi.groupName,
                        direction: source?.direction || 1,
                        tightening: source?.tightening || 3.0,
                        coefficients,
                      };
                    }),
                    // 2. Segment Drivers
                    ...segment.fields.map((sf) => {
                      const existingLocal = existingSubProdModel?.fields?.find(
                        (f: any) => f.key === sf.key && f.level === "segment"
                      );
                      const existingSegment = existingSegmentFields?.find(
                        (f: any) => f.key === sf.key
                      );
                      const source = existingLocal || existingSegment;

                      const coefficients: Record<string, number> = {};
                      for (let year = startYear; year <= endYear; year++) {
                        const yearStr = year.toString();
                        coefficients[yearStr] =
                          source?.coefficients?.[yearStr] || 0;
                      }
                      return {
                        key: sf.key,
                        label: sf.label,
                        level: "segment" as const,
                        direction: source?.direction || 1,
                        tightening: source?.tightening || 3.0,
                        coefficients,
                      };
                    }),
                    // 3. Product & Channel Drivers
                    ...product.fields.map((pf) => {
                      const expectedLevel = pf.scope === "subproduct" ? "subproduct" : "product";
                      const existingLocal = existingSubProdModel?.fields?.find(
                        (f: any) => f.key === pf.key && f.level === expectedLevel
                      );
                      const existingProdLevel = existingProduct?.fields?.find(
                        (f) => f.key === pf.key
                      );
                      const source = existingLocal || existingProdLevel;

                      const coefficients: Record<string, number> = {};
                      for (let year = startYear; year <= endYear; year++) {
                        const yearStr = year.toString();
                        coefficients[yearStr] =
                          source?.coefficients?.[yearStr] || 0;
                      }
                      return {
                        key: pf.key,
                        label: pf.label,
                        level: expectedLevel,
                        direction: source?.direction || 1,
                        tightening: source?.tightening || 3.0,
                        coefficients,
                      };
                    }),
                  ];

                  const dynamicFields = (existingSubProdModel?.fields || [])
                    .filter(
                      (f: any) =>
                        f.level === "dynamic" &&
                        !consolidatedFields.some((cf: any) => cf.key === f.key)
                    )
                    .map((field: any) => {
                      const coefficients: Record<string, number> = {};
                      for (let year = startYear; year <= endYear; year++) {
                        const yearStr = year.toString();
                        coefficients[yearStr] =
                          field.coefficients?.[yearStr] || 0;
                      }
                      return {
                        key: field.key,
                        label: field.label,
                        level: "dynamic" as const,
                        direction: field.direction || 1,
                        tightening: field.tightening || 3.0,
                        coefficients,
                        formula: field.formula,
                        type: field.type,
                      };
                    });

                  return {
                    key: subProd.key,
                    fields: [...consolidatedFields, ...dynamicFields],
                  };
                }),
              };
            }),
        })),
      },
    };

    // Update the base data
    const updatedBaseData = await BaseData.findOneAndUpdate(
      { simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId) },
      {
        $set: {
          simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
          marketData: formattedBaseData.marketData,
          marketModel: formattedBaseData.marketModel,
        },
      },
      {
        new: true,
        upsert: true,
      }
    ).populate([
      {
        path: "marketData.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketData.segments.products.productId",
        model: "Product",
      },
      {
        path: "marketModel.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketModel.segments.products.productId",
        model: "Product",
      },
    ]);

    res.status(200).json(updatedBaseData);
  } catch (err) {
    console.error("Error syncing base data:", err);
    next(err);
  }
};

export const upsertBaseDataEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    // Validate request body using Zod
    const validationResult = upsertBaseDataSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: validationResult.error.errors,
      });
      return;
    }

    const {
      segmentId,
      productId,
      yearlyData,
      subProductsData,
      fields,
      globalFields = [],
      segmentFields = [],
      subProductsModel,
    } = validationResult.data;

    const simTypeObjId = new mongoose.Types.ObjectId(simulationTypeId);
    const segmentObjId = new mongoose.Types.ObjectId(segmentId);
    const productObjId = new mongoose.Types.ObjectId(productId);

    // Find base data
    let baseData = await BaseData.findOne({
      simulationTypeId: simTypeObjId,
    });

    if (!baseData) {
      baseData = await BaseData.create({
        simulationTypeId: simTypeObjId,
        marketData: { segments: [] },
        marketModel: { segments: [] },
      });
    }

    // Update market data
    if (yearlyData) {
      // Find the segment index
      const marketDataSegmentIndex = baseData.marketData.segments.findIndex(
        (s) => s.segmentId.toString() === segmentId
      );

      if (marketDataSegmentIndex === -1) {
        // If segment doesn't exist, create it with the new product
        baseData.marketData.segments.push({
          segmentId: segmentObjId,
          products: [
            {
              productId: productObjId,
              yearlyData,
              subProducts: subProductsData,
            },
          ],
        });
      } else {
        // Find the product index within the segment
        const productIndex = baseData.marketData.segments[
          marketDataSegmentIndex
        ].products.findIndex((p) => p.productId.toString() === productId);

        if (productIndex === -1) {
          // If product doesn't exist in this segment, add it
          baseData.marketData.segments[marketDataSegmentIndex].products.push({
            productId: productObjId,
            yearlyData,
            subProducts: subProductsData,
          });
        } else {
          // Update existing product's yearlyData
          if (yearlyData) {
            baseData.marketData.segments[marketDataSegmentIndex].products[
              productIndex
            ].yearlyData = {
              ...baseData.marketData.segments[marketDataSegmentIndex].products[
                productIndex
              ].yearlyData,
              ...yearlyData,
            };
          }
          if (subProductsData) {
            baseData.marketData.segments[marketDataSegmentIndex].products[
              productIndex
            ].subProducts = subProductsData as any;
          }
        }
      }
    }

    // Update market model
    if (fields && globalFields) {
      // Find the segment index
      const marketModelSegmentIndex = baseData.marketModel.segments.findIndex(
        (s) => s.segmentId.toString() === segmentId
      );

      if (marketModelSegmentIndex === -1) {
        // If segment doesn't exist, create it with the new product
        baseData.marketModel.segments.push({
          segmentId: segmentObjId,
          products: [
            {
              productId: productObjId,
              fields,
              segmentFields,
              globalFields,
              subProducts: subProductsModel,
            },
          ],
        });
      } else {
        // Find the product index within the segment
        const productIndex = baseData.marketModel.segments[
          marketModelSegmentIndex
        ].products.findIndex((p) => p.productId.toString() === productId);

        if (productIndex === -1) {
          // If product doesn't exist in this segment, add it
          baseData.marketModel.segments[marketModelSegmentIndex].products.push({
            productId: productObjId,
            fields,
            segmentFields,
            globalFields,
            subProducts: subProductsModel,
          });
        } else {
          // Update existing product's fields
          if (fields) {
            baseData.marketModel.segments[marketModelSegmentIndex].products[
              productIndex
            ].fields = fields;
          }
          if (segmentFields && segmentFields.length > 0) {
            baseData.marketModel.segments[marketModelSegmentIndex].products[
              productIndex
            ].segmentFields = segmentFields;
          }
          if (globalFields && globalFields.length > 0) {
            baseData.marketModel.segments[marketModelSegmentIndex].products[
              productIndex
            ].globalFields = globalFields;
          }
          if (subProductsModel) {
            baseData.marketModel.segments[marketModelSegmentIndex].products[
              productIndex
            ].subProducts = subProductsModel;
          }
        }
      }
    }

    // Save and populate
    await baseData.save();

    const updatedBaseData = await BaseData.findById(baseData._id).populate([
      {
        path: "marketData.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketData.segments.products.productId",
        model: "Product",
      },
      {
        path: "marketModel.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketModel.segments.products.productId",
        model: "Product",
      },
    ]);

    res.status(200).json(updatedBaseData);
  } catch (err) {
    console.error("Error upserting base data entry:", err);
    next(err);
  }
};

export const deleteBaseDataEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;
    const { segmentId, productId } = req.body;

    // Validate required fields
    if (!segmentId || !productId) {
      res.status(400).json({ error: "segmentId and productId are required" });
      return;
    }

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    // Remove product from marketData segments
    baseData.marketData.segments = baseData.marketData.segments
      .map((segment) => {
        if (segment.segmentId.toString() === segmentId) {
          segment.products = segment.products.filter(
            (product) => product.productId.toString() !== productId
          );
        }
        return segment;
      })
      .filter((segment) => segment.products.length > 0);

    // Remove product from marketModel segments
    baseData.marketModel.segments = baseData.marketModel.segments
      .map((segment) => {
        if (segment.segmentId.toString() === segmentId) {
          segment.products = segment.products.filter(
            (product) => product.productId.toString() !== productId
          );
        }
        return segment;
      })
      .filter((segment) => segment.products.length > 0);

    // Save and populate
    await baseData.save();

    const updatedBaseData = await BaseData.findById(baseData._id).populate([
      {
        path: "marketData.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketData.segments.products.productId",
        model: "Product",
      },
      {
        path: "marketModel.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketModel.segments.products.productId",
        model: "Product",
      },
    ]);

    res.status(200).json(updatedBaseData);
  } catch (err) {
    console.error("Error deleting base data entry:", err);
    next(err);
  }
};

const upsertSatDriversSchema = z.object({
  satType: z.enum(["esat", "csat"]),
  segmentId: z.string(),
  drivers: z.array(
    z.object({
      level: z.string(),
      key: z.string(),
      label: z.string(),
      productId: z.string().optional().nullable(),
      globalInputId: z.string().optional().nullable(),
      eventId: z.string().optional().nullable(),
      choiceKey: z.string().optional(),
      coefficients: z.record(z.string(), z.number()),
    })
  ),
});

export const upsertBaseDataSatDrivers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const validationResult = upsertSatDriversSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: validationResult.error.errors,
      });
      return;
    }

    const { drivers, segmentId, satType } = validationResult.data;

    const satMMToUpdate = (
      baseData[
        (satType + "MarketModel") as "esatMarketModel" | "csatMarketModel"
      ].segments || []
    ).find((segment) => segment.segmentId.toString() === segmentId);

    if (!satMMToUpdate) {
      baseData[
        (satType + "MarketModel") as "esatMarketModel" | "csatMarketModel"
      ].segments.push({
        segmentId: new mongoose.Types.ObjectId(segmentId),
        drivers: drivers.map((driver) => ({
          ...driver,
          productId: driver.productId
            ? new mongoose.Types.ObjectId(driver.productId)
            : null,
          globalInputId: driver.globalInputId
            ? new mongoose.Types.ObjectId(driver.globalInputId)
            : null,
          eventId: driver.eventId
            ? new mongoose.Types.ObjectId(driver.eventId)
            : null,
          choiceKey: driver.choiceKey || null,
        })),
      });
    } else {
      baseData[
        (satType + "MarketModel") as "esatMarketModel" | "csatMarketModel"
      ].segments = baseData[
        (satType + "MarketModel") as "esatMarketModel" | "csatMarketModel"
      ].segments.map((segment) => {
        if (segment.segmentId.toString() === segmentId) {
          segment.drivers = drivers.map((driver) => ({
            ...driver,
            productId: driver.productId
              ? new mongoose.Types.ObjectId(driver.productId)
              : null,
            globalInputId: driver.globalInputId
              ? new mongoose.Types.ObjectId(driver.globalInputId)
              : null,
            eventId: driver.eventId
              ? new mongoose.Types.ObjectId(driver.eventId)
              : null,
            choiceKey: driver.choiceKey || null,
          }));
        }
        return segment;
      });
    }

    await baseData.save();

    res.status(200).json(baseData);
  } catch (err) {
    const { satType } = req.body;

    console.error(`Error upserting ${satType} drivers:`, err);
  }
};

export const downloadMarketDataCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).populate([
      {
        path: "marketData.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketData.segments.products.productId",
        model: "Product",
      },
    ]);

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    const { startYear, endYear } = simulationType.yearRange;
    const rows: any[] = [];

    // Header row
    rows.push([
      "Segment Name",
      "Product Name",
      "Product ID",
      "Subproduct Key",
      "Year",
      "Market Size",
    ]);

    baseData.marketData.segments.forEach((seg: any) => {
      const segmentName = seg.segmentId?.name || "Unknown Segment";

      seg.products.forEach((prod: any) => {
        const productName = prod.productId?.productName || "Unknown Product";
        const productId = prod.productId?._id.toString();

        // Product level data
        for (let year = startYear; year <= endYear; year++) {
          const yearStr = year.toString();
          const yearData = prod.yearlyData?.[yearStr];
          rows.push([
            segmentName,
            productName,
            productId,
            "", // No subproduct key for product level
            yearStr,
            yearData?.marketSize || 0,
          ]);
        }

        // Subproduct level data
        (prod.subProducts || []).forEach((subProd: any) => {
          for (let year = startYear; year <= endYear; year++) {
            const yearStr = year.toString();
            const yearData = subProd.yearlyData?.[yearStr];
            rows.push([
              segmentName,
              productName,
              productId,
              subProd.key,
              yearStr,
              yearData?.marketSize || 0,
            ]);
          }
        });
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Market Data");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "csv" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=market_data.csv"
    );
    res.setHeader("Content-Type", "text/csv");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Error downloading market data CSV:", err);
    next(err);
  }
};

export const uploadMarketDataCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Filter and update baseData
    data.forEach((row: any) => {
      const productId = row["Product ID"];
      const subProductKey = row["Subproduct Key"];
      const year = row["Year"]?.toString();
      const marketSize = parseFloat(row["Market Size"]);

      if (!productId || !year || isNaN(marketSize)) return;

      // Find the product in baseData
      for (const seg of baseData.marketData.segments) {
        const prod = seg.products.find(
          (p) => p.productId.toString() === productId
        );

        if (prod) {
          if (!subProductKey || subProductKey.trim() === "") {
            // Update product level
            if (!prod.yearlyData) prod.yearlyData = {};
            if (!prod.yearlyData[year]) {
              prod.yearlyData[year] = { marketSize: 0, marketGrowth: 0 };
            }
            prod.yearlyData[year].marketSize = marketSize;
          } else {
            // Update subproduct level
            const subProd = prod.subProducts?.find(
              (sp: any) => sp.key === subProductKey
            );
            if (subProd) {
              if (!subProd.yearlyData) subProd.yearlyData = {};
              if (!subProd.yearlyData[year]) {
                subProd.yearlyData[year] = { marketSize: 0, marketGrowth: 0 };
              }
              subProd.yearlyData[year].marketSize = marketSize;
            }
          }
          break; // Found and updated (or tried to), move to next row
        }
      }
    });

    // Recalculate marketGrowth for all products and subproducts
    baseData.marketData.segments.forEach((seg: any) => {
      seg.products.forEach((prod: any) => {
        // Product level growth calculation
        const years = Object.keys(prod.yearlyData || {}).sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        for (let i = 1; i < years.length; i++) {
          const prevYear = years[i - 1];
          const currYear = years[i];
          const prevSize = prod.yearlyData[prevYear].marketSize;
          const currSize = prod.yearlyData[currYear].marketSize;
          if (prevSize > 0) {
            prod.yearlyData[currYear].marketGrowth =
              (currSize - prevSize) / prevSize;
          } else {
            prod.yearlyData[currYear].marketGrowth = 0;
          }
        }

        // Subproduct level growth calculation
        (prod.subProducts || []).forEach((subProd: any) => {
          const subYears = Object.keys(subProd.yearlyData || {}).sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          for (let i = 1; i < subYears.length; i++) {
            const prevYear = subYears[i - 1];
            const currYear = subYears[i];
            const prevSize = subProd.yearlyData[prevYear].marketSize;
            const currSize = subProd.yearlyData[currYear].marketSize;
            if (prevSize > 0) {
              subProd.yearlyData[currYear].marketGrowth =
                (currSize - prevSize) / prevSize;
            } else {
              subProd.yearlyData[currYear].marketGrowth = 0;
            }
          }
        });
      });
    });

    // Save updated baseData
    baseData.markModified("marketData");
    await baseData.save();

    res.status(200).json({ message: "Market data updated successfully" });
  } catch (err) {
    console.error("Error uploading market data CSV:", err);
    next(err);
  }
};

export const downloadMarketModelCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).populate([
      {
        path: "marketModel.segments.segmentId",
        model: "Segment",
      },
      {
        path: "marketModel.segments.products.productId",
        model: "Product",
      },
    ]);

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }

    const { startYear, endYear } = simulationType.yearRange;
    const rows: any[] = [];

    // Header row
    const headers = [
      "Segment Name",
      "Product Name",
      "Product ID",
      "Subproduct Key",
      "Field Type",
      "Field Key",
      "Field Label",
      "Direction",
      "Tightening",
      "Elasticity",
    ];

    for (let year = startYear; year <= endYear; year++) {
      headers.push(year.toString());
    }
    rows.push(headers);

    baseData.marketModel.segments.forEach((seg: any) => {
      const segmentName = seg.segmentId?.name || "Unknown Segment";

      seg.products.forEach((prod: any) => {
        const productName = prod.productId?.productName || "Unknown Product";
        const productId = prod.productId?._id.toString();

        const addFieldRows = (
          fields: any[],
          fieldType: string,
          subProductKey: string = ""
        ) => {
          fields.forEach((field) => {
            const row = [
              segmentName,
              productName,
              productId,
              subProductKey,
              fieldType,
              field.key,
              field.label,
              field.direction,
              field.tightening,
              field.elasticity || 0, // Default to 0 or appropriate default if undefined
            ];

            for (let year = startYear; year <= endYear; year++) {
              row.push(field.coefficients?.[year.toString()] || 0);
            }
            rows.push(row);
          });
        };

        addFieldRows(prod.fields || [], "Product");
        addFieldRows(prod.segmentFields || [], "Segment");
        addFieldRows(prod.globalFields || [], "Global");

        (prod.subProducts || []).forEach((subProd: any) => {
          addFieldRows(subProd.fields || [], "Subproduct", subProd.key);
        });
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Market Model");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "csv" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=market_model.csv"
    );
    res.setHeader("Content-Type", "text/csv");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Error downloading market model CSV:", err);
    next(err);
  }
};

export const uploadMarketModelCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const simulationType = await SimulationType.findById(simulationTypeId);
    if (!simulationType) {
      res.status(404).json({ error: "Simulation type not found" });
      return;
    }
    const { startYear, endYear } = simulationType.yearRange;

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    let updated = false;

    data.forEach((row: any) => {
      const productId = row["Product ID"];
      const subProductKey = row["Subproduct Key"];
      const fieldType = row["Field Type"];
      const fieldKey = row["Field Key"];
      const direction = parseFloat(row["Direction"]);
      const tightening = parseFloat(row["Tightening"]);
      const elasticity = parseFloat(row["Elasticity"]);

      if (!productId || !fieldKey) return;

      // Find the product
      for (const seg of baseData.marketModel.segments) {
        const prod = seg.products.find(
          (p) => p.productId.toString() === productId
        );

        if (prod) {
          let fieldsToUpdate: any[] | undefined;

          if (fieldType === "Product") {
            fieldsToUpdate = prod.fields;
          } else if (fieldType === "Segment") {
            fieldsToUpdate = prod.segmentFields;
          } else if (fieldType === "Global") {
            fieldsToUpdate = prod.globalFields;
          } else if (fieldType === "Subproduct") {
            const subProd = prod.subProducts?.find(
              (sp: any) => sp.key === subProductKey
            );
            fieldsToUpdate = subProd?.fields;
          }

          if (fieldsToUpdate) {
            const field = fieldsToUpdate.find((f: any) => f.key === fieldKey);
            if (field) {
              // Update direction and tightening
              if (!isNaN(direction)) field.direction = direction;
              if (!isNaN(tightening)) field.tightening = tightening;
              if (!isNaN(elasticity)) field.elasticity = elasticity;

              // Update coefficients
              if (!field.coefficients) field.coefficients = {};
              for (let year = startYear; year <= endYear; year++) {
                const val = parseFloat(row[year.toString()]);
                if (!isNaN(val)) {
                  field.coefficients[year.toString()] = val;
                }
              }
              updated = true;
            }
          }
        }
      }
    });

    if (updated) {
      baseData.markModified("marketModel");
      await baseData.save();
    }

    res.status(200).json({ message: "Market model updated successfully" });
  } catch (err) {
    console.error("Error uploading market model CSV:", err);
    next(err);
  }
};
