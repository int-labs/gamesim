import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Product from "../models/products";
import { getPaginationQuery } from "../utils/paginationHelper";

// Get all products with pagination and filtering
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, filters } = getPaginationQuery(req);

    const products = await Product.aggregate([
      {
        $match: filters,
      },
      {
        $lookup: {
          from: "simulationTypes",
          localField: "simulationTypeId",
          foreignField: "_id",
          as: "simulationType",
        },
      },
      {
        $unwind: "$simulationType",
      },
      {
        $lookup: {
          from: "segments",
          localField: "segmentId",
          foreignField: "_id",
          as: "segmentReference",
        },
      },
      {
        $unwind: "$segmentReference",
      },
      {
        $sort: {
          "segmentReference.order": 1,
          order: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    const totalAggregate = await Product.aggregate([
      {
        $match: filters,
      },
      {
        $lookup: {
          from: "segments",
          localField: "segmentReference",
          foreignField: "_id",
          as: "segmentReference",
        },
      },
      {
        $unwind: "$segmentReference",
      },
      {
        $count: "total",
      },
    ]);

    const totalCount = totalAggregate[0]?.total || 0;

    res.status(200).json({
      products,
      data: products,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    next(err);
  }
};

// Create a new product
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      productName,
      productBu,
      simulationTypeId,
      segmentId,
      ...otherData
    } = req.body;

    // Validate required fields
    if (!productName) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    // Create product data with ObjectId casting
    const productData = {
      ...otherData,
    };

    const existingProduct = await Product.findOne({
      productName,
      productBu,

      ...(simulationTypeId && {
        simulationTypeId: productData.simulationTypeId,
      }),
    });

    if (existingProduct) {
      // res.status(400).json({
      //   error: "Product with this name and Business Unit already exists",
      // });
      // return;
    }

    // Add IDs if they are provided
    if (simulationTypeId) {
      productData.simulationTypeId = new mongoose.Types.ObjectId(
        simulationTypeId
      );
    }
    if (segmentId) {
      productData.segmentId = new mongoose.Types.ObjectId(segmentId);
    }

    const newProduct = new Product({ productName, productBu, ...productData });
    const savedProduct = await newProduct.save();

    // if (existingProduct) {
    //   res.status(400).json({
    //     error: "Product with this name already exists in this simulation type",
    //   });
    //   return;
    // }

    // Populate references before sending response
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate("simulationTypeId")
      .populate("segmentId");

    res.status(201).json(populatedProduct);
  } catch (err) {
    console.error("Error creating product:", err);
    next(err);
  }
};

// Get product by productId
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    const product =
      await Product.findById(productId).populate("segmentReference");

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json(product);
  } catch (err) {
    console.error("Error fetching product by ID:", err);
    next(err);
  }
};

const updateProductSchema = z.object({
  productName: z.string().nonempty(),
  description: z.string().optional(),
  displayTitle: z.string().optional(),
  displayDescription: z.string().optional(),
  useChargeoff: z.boolean().optional().nullable(),
  productScopedColumns: z
    .number()
    .int()
    .optional()
    .refine((v) => v === undefined || [1, 2, 3].includes(v), {
      message: "productScopedColumns must be 1, 2, or 3",
    }),
  subProducts: z
    .array(
      z.object({ key: z.string().nonempty(), name: z.string().nonempty() })
    )
    .optional()
    .nullable(),
  chargeoffCoefficient: z
    .object({
      mean: z.number().optional(),
      stdDev: z.number().optional(),
      start: z.number().optional(),
      step: z.number().optional(),
      end: z.number().optional(),
    })
    .optional()
    .nullable(),
  chartPosition: z.string().optional().nullable(),
  simulationParams: z
    .array(
      z.object({
        key: z.string().nonempty(),
        label: z.string().nonempty(),
        value: z.number(),
        subProductKey: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  decisionsPlacement: z.enum(["normal", "reportLevel"]).optional(),
  titleStyle: z.record(z.string()).optional(),
  descriptionStyle: z.record(z.string()).optional(),
  showSegmentTag: z.boolean().optional(),
  productImageUrl: z.string().optional(),
  segmentTagStyle: z.record(z.string()).optional(),
  segmentTagTextStyle: z.record(z.string()).optional(),
});

// Update product by productId
export const updateProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    const updateProductValidation = updateProductSchema.safeParse(req.body);

    if (!updateProductValidation.success) {
      res.status(400).json({ error: updateProductValidation.error.message });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Update non-Map fields
    const {
      titleStyle,
      descriptionStyle,
      segmentTagStyle,
      segmentTagTextStyle,
      ...otherData
    } = updateProductValidation.data;

    Object.assign(product, otherData);

    // Explicitly replace Map fields to ensure keys are removed if not present in the update
    if (titleStyle !== undefined) {
      product.set("titleStyle", titleStyle);
    }
    if (descriptionStyle !== undefined) {
      product.set("descriptionStyle", descriptionStyle);
    }
    if (segmentTagStyle !== undefined) {
      product.set("segmentTagStyle", segmentTagStyle);
    }
    if (segmentTagTextStyle !== undefined) {
      product.set("segmentTagTextStyle", segmentTagTextStyle);
    }

    const updatedProduct = await product.save();
    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error("Error updating product by ID:", err);
    next(err);
  }
};

// Delete product by productId
export const deleteProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product by ID:", err);
    next(err);
  }
};

export const updateProductFields = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { fields, fieldGroups } = req.body;

    // Validate fields structure
    if (fields && !Array.isArray(fields)) {
      res.status(400).json({ error: "Fields must be an array" });
      return;
    }

    // Validate fieldGroups structure
    if (fieldGroups && !Array.isArray(fieldGroups)) {
      res.status(400).json({ error: "Field groups must be an array" });
      return;
    }

    const prerequisiteSchema = z.object({
      level: z.enum(["product", "segment", "global"]),
      targetId: z.string(),
      targetName: z.string().optional(),
      fieldKey: z.string(),
      operator: z.enum([">=", "<=", "==", ">", "<", "!="]),
      value: z.number(),
    });

    const fieldsSchema = z.array(
      z.object({
        _id: z.any().optional(),
        key: z.string().nonempty(),
        label: z.string().nonempty(),
        description: z.string().optional(),
        type: z.enum([
          "percentage",
          "plain-number",
          "money",
          "numerical-dropdown",
          "text-dropdown",
          "slider",
          "text-slider",
          "readonly",
          "complex-checkbox",
          "plain-number-with-calculated-values",
          "budget-allocation",
        ]),
        calculatedValues: z
          .array(
            z.object({
              label: z.string(),
              position: z.enum(["left", "right", "top", "bottom"]).optional(),
              formula: z.string(),
              format: z.enum(["number", "currency", "percentage"]).optional(),
              prefix: z.string().optional(),
              suffix: z.string().optional(),
              decimalDigits: z.number().optional(),
              style: z
                .object({
                  color: z.string().optional(),
                  fontWeight: z.string().optional(),
                  fontSize: z.any().optional(),
                })
                .optional(),
            })
          )
          .optional(),
        readonlyTypeConfig: z
          .object({
            formula: z.string().optional(),
            prefix: z.string().optional(),
            textColor: z.string().optional(),
            showSecondaryValue: z.boolean().optional(),
            secondaryFormula: z.string().optional(),
            secondaryPrefix: z.string().optional(),
            secondaryTextColor: z.string().optional(),
            layoutTemplate: z.string().optional(),
            width: z.number().optional(),
            items: z
              .array(
                z.object({
                  formula: z.string().optional(),
                  prefix: z.string().optional(),
                  suffix: z.string().optional(),
                  position: z.string().optional(),
                  visibleIf: z.string().optional(),
                  style: z
                    .object({
                      textColor: z.string().optional(),
                      backgroundColor: z.string().optional(),
                      fontSize: z.string().optional(),
                      border: z.string().optional(),
                      padding: z.string().optional(),
                    })
                    .optional(),
                })
              )
              .optional(),
          })
          .optional(),
        subproductValidation: z
          .object({
            targetValue: z.number().optional(),
            operator: z.enum(["==", "<=", ">=", "<", ">"]).optional(),
            message: z.string().optional(),
          })
          .optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        options: z
          .array(
            z.object({
              _id: z.string().optional(),
              label: z.string(),
              value: z.string(),
              numericValue: z.number().optional(),
              prerequisites: z.array(prerequisiteSchema).optional(),
            })
          )
          .optional(),
        energyUsed: z.number().optional(),
        isConsumingEnergy: z.boolean().optional(),
        consumptionMultiplier: z.number().optional(),
        energyCosts: z
          .array(
            z.object({
              changeValue: z.number(),
              cost: z.number(),
              subProductKey: z.string().optional(),
            })
          )
          .optional(),
        isIncurringCost: z.boolean().optional(),
        costs: z
          .array(
            z.object({
              selectedValue: z.number(),
              cost: z.number(),
              subProductKey: z.string().optional(),
            })
          )
          .optional(),
        scope: z.enum(["product", "subproduct"]).optional(),
        costDecimalDigits: z.number().optional(),
        validation: z
          .object({
            mode: z.enum(["static", "delta", "percentage_of_value"]).optional(),
            minChange: z.number().optional(),
            maxChange: z.number().optional(),
            minChangePercentage: z.number().optional(),
            maxChangePercentage: z.number().optional(),
          })
          .optional(),
        visibilityConditions: z
          .array(
            z.object({
              fieldKey: z.string(),
              level: z.enum(["product", "segment", "global"]),
              operator: z.enum([">=", "<=", "==", ">", "<", "!="]),
              targetId: z.string(),
              targetName: z.string().optional(),
              value: z.number(),
            })
          )
          .optional(),
        groupTitle: z.string().optional(),
        complexCheckboxConfig: z.any().optional(),
        subproductGapConfig: z
          .object({
            enabled: z.boolean().optional(),
            targetValue: z.number().optional(),
            enforceMax: z.boolean().optional(),
            showFillButton: z.boolean().optional(),
          })
          .optional(),
        hideLabel: z.boolean().optional(),
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
        minDecimalDigits: z.number().optional(),
        maxDecimalDigits: z.number().optional(),
      })
    );

    const fieldGroupsSchema = z.array(
      z.object({
        title: z.string().nonempty(),
        order: z.number().optional(),
        backgroundColor: z.string().optional(),
        description: z.string().optional(),
        descriptionByRound: z
          .array(
            z.object({
              round: z.number(),
              description: z.string(),
            })
          )
          .optional(),
      })
    );

    const fieldsValidation = fieldsSchema.safeParse(fields);
    const fieldGroupsValidation = fieldGroupsSchema.safeParse(
      fieldGroups || []
    );

    if (fieldsValidation.error || fieldGroupsValidation.error) {
      console.log("fields", fieldsValidation.error);
      console.log("fieldGroups", fieldGroupsValidation.error);

      res.status(400).json({
        error: "Invalid data, please check fields and groups format",
      });
      return;
    }

    // Update product fields and groups
    const product = await Product.findByIdAndUpdate(
      productId,
      {
        fields: fieldsValidation.data,
        fieldGroups: fieldGroupsValidation.data,
      },
      { new: true }
    );

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProductPrerequisites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { unlockPrerequisites, unlockCost } = req.body;

    // Validate prerequisites structure
    if (unlockPrerequisites && !Array.isArray(unlockPrerequisites)) {
      res.status(400).json({ error: "unlockPrerequisites must be an array" });
      return;
    }

    // Validate unlock cost
    if (unlockCost !== undefined && typeof unlockCost !== "number") {
      res.status(400).json({ error: "unlockCost must be a number" });
      return;
    }

    const prerequisitesSchema = z.array(
      z.object({
        level: z.enum(["product", "segment", "global"]),
        targetId: z.string(),
        targetName: z.string().optional(),
        fieldKey: z.string().nonempty(),
        operator: z.enum([">=", "<=", "==", ">", "<", "!="]),
        value: z.number(),
      })
    );

    const prerequisitesValidation =
      prerequisitesSchema.safeParse(unlockPrerequisites);

    if (!prerequisitesValidation.success) {
      res.status(400).json({
        error: "Invalid prerequisites format",
        details: prerequisitesValidation.error.message,
      });
      return;
    }

    // Convert targetId strings to ObjectIds
    const formattedPrerequisites = prerequisitesValidation.data.map(
      (prereq) => ({
        ...prereq,
        targetId: new mongoose.Types.ObjectId(prereq.targetId),
      })
    );

    // Update product prerequisites and unlock cost
    const updateData: any = {
      unlockPrerequisites: formattedPrerequisites,
    };

    if (unlockCost !== undefined) {
      updateData.unlockCost = unlockCost;
    }

    const product = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json(product);
  } catch (err) {
    console.error("Error updating product prerequisites:", err);
    next(err);
  }
};

export const getProductAvailableVariables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  res.status(200).json({ status: "not implemented" });

  return;

  // try {
  //   const { productId } = req.params;

  //   // Get the product with its simulation type populated
  //   const product = await Product.findById(productId)
  //     // .populate("simulationType")
  //     .lean();

  //   if (!product) {
  //     res.status(404).json({ error: "Product not found" });
  //     return;
  //   }

  //   const variables: Array<{ key: string; type: string }> = [];

  //   // Add fields as previous decisions
  //   if (product.fields) {
  //     product.fields.forEach((field: ProductField) => {
  //       variables.push({
  //         key: `prevDec_${field.key}`,
  //         type: "previousDecision",
  //       });

  //       variables.push({
  //         key: `currDec_${field.key}`,
  //         type: "currentDecision",
  //       });
  //     });
  //   }

  //   const simType = await SimulationType.findById(product.simulationTypeId);

  //   if (simType?.outputs) {
  //     simType.outputs.forEach((output) => {
  //       // Add as previous output
  //       variables.push({
  //         key: `prevOut_${output.key}`,
  //         type: "previousOutput",
  //       });

  //       // Add as current output
  //       variables.push({
  //         key: `currOut_${output.key}`,
  //         type: "currentOutput",
  //       });
  //     });
  //   }

  //   // Add market size coefficient
  //   const baseData = await BaseData.findOne({
  //     simulationTypeId: product.simulationTypeId,
  //   }).populate("constants.config.globalInputFields.globalInputId");

  //   if (baseData) {
  //     // this is still manual population of market size, coefficient of product type - segment combination, and global inputs
  //     // it needs to be dynamic later

  //     baseData.constants
  //       .filter((baseDataEntry) => {
  //         return baseDataEntry.productId.equals(product._id);
  //       })
  //       .forEach((baseDataEntry) => {
  //         if (!variables.find((variable) => variable.key === `marketSize`)) {
  //           variables.push({
  //             key: `marketSize`,
  //             type: "coefficient",
  //           });
  //         }

  //         baseDataEntry.config.productFields.forEach((productField) => {
  //           const appendedKey = `coeffProduct_${productField.key}`;

  //           if (!variables.find((variable) => variable.key === appendedKey)) {
  //             variables.push({
  //               key: appendedKey,
  //               type: "coefficient",
  //             });
  //           }
  //         });

  //         baseDataEntry.config.globalInputFields.forEach((globalInputField) => {
  //           globalInputField.inputs.forEach((input) => {
  //             const appendedGlobalKey = `coeffGlobalInput_${(globalInputField.globalInputId as IGlobalInput).key}_${input.key}`;

  //             if (
  //               !variables.find(
  //                 (variable) => variable.key === appendedGlobalKey
  //               )
  //             ) {
  //               variables.push({
  //                 key: appendedGlobalKey,
  //                 type: "coefficient",
  //               });
  //             }
  //           });
  //         });
  //       });
  //   }

  //   res.status(200).json(variables);
  // } catch (err) {
  //   next(err);
  // }
};

export const updateProductOutputs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { outputs } = req.body;

    const product = await Product.findByIdAndUpdate(
      productId,
      { outputs },
      { new: true }
    );

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProductOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationTypeId } = req.params;

    const validation = z
      .object({
        segmentId: z.string(),
        orders: z.array(z.string()),
      })
      .safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: validation.error.message });
      return;
    }

    const { segmentId, orders } = validation.data;

    const bulkOps = orders.map((order, index) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(order),
          segmentId: new mongoose.Types.ObjectId(segmentId),
          simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        },
        update: { $set: { order: index } },
      },
    }));

    const products = await Product.bulkWrite(bulkOps);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

const simulationParamsSchema = z.array(
  z.object({
    key: z.string().nonempty(),
    label: z.string().nonempty(),
    value: z.number(),
    subProductKey: z.string().optional().nullable(),
  })
);

export const updateProductParams = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { simulationParams } = req.body;

    const validation = simulationParamsSchema.safeParse(simulationParams);

    if (!validation.success) {
      res.status(400).json({ error: validation.error.message });
      return;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { simulationParams: validation.data },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error("Error updating product simulation parameters:", err);
    next(err);
  }
};

export const updateProductTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId: id } = req.params;

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
      const current = await Product.findById(id).session(session);
      if (!current) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      let productTranslations = current.translations || [];

      updates.forEach((update) => {
        let langIndex = productTranslations.findIndex(
          (t) => t.languageCode === update.languageCode
        );

        if (langIndex === -1) {
          // Add new language entry
          productTranslations.push({
            languageCode: update.languageCode,
            keys: [],
          });
          langIndex = productTranslations.length - 1;
        }

        // Merge strings into the keys array
        const keysArr = productTranslations[langIndex].keys;
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

      current.translations = productTranslations;
      current.markModified("translations");
      await current.save({ session });

      await session.commitTransaction();

      // Return the updated product
      const updatedProduct = await Product.findById(id).lean();

      res.status(200).json(updatedProduct);
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
