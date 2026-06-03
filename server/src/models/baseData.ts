import mongoose from "mongoose";
import { EventInterface } from "./events";
import { IGlobalInput } from "./globalInputs";

// Type definitions
export interface MarketData {
  segments: Array<{
    segmentId: mongoose.Types.ObjectId;
    products: Array<{
      productId: mongoose.Types.ObjectId;
      yearlyData: Record<
        string,
        {
          marketSize: number;
          marketGrowth: number;
        }
      >;
      subProducts?: Array<{
        key: string;
        yearlyData: Record<
          string,
          {
            marketSize: number;
            marketGrowth: number;
          }
        >;
      }>;
    }>;
  }>;
}

export interface MarketModel {
  segments: Array<{
    segmentId: mongoose.Types.ObjectId;
    products: Array<{
      productId: mongoose.Types.ObjectId;
      fields: Array<{
        key: string;
        label: string;
        formula?: string;
        type?: string;
        coefficients: Record<string, number>;
        direction: number;
        tightening: number;
        elasticity?: number;
        level?: "global" | "segment" | "product" | "subproduct" | "dynamic";
      }>;
      segmentFields: Array<{
        key: string;
        label: string;
        formula?: string;
        type?: string;
        coefficients: Record<string, number>;
        direction: number;
        tightening: number;
        elasticity?: number;
        level?: "global" | "segment" | "product" | "subproduct" | "dynamic";
      }>;
      globalFields: Array<{
        key: string;
        label: string;
        formula?: string;
        type?: string;
        coefficients: Record<string, number>;
        direction: number;
        tightening: number;
        elasticity?: number;
        level?: "global" | "segment" | "product" | "subproduct" | "dynamic";
      }>;
      subProducts?: Array<{
        key: string;
        fields: Array<{
          key: string;
          label: string;
          formula?: string;
          type?: string;
          coefficients: Record<string, number>;
          direction: number;
          tightening: number;
          elasticity?: number;
          level?: "global" | "segment" | "product" | "subproduct" | "dynamic";
        }>;
      }>;
    }>;
  }>;
}

export interface EsatMarketModel {
  segments: Array<{
    segmentId: mongoose.Types.ObjectId;
    drivers: Array<ESATMarketModelField>;
  }>;
}

export interface CSATMarketModel {
  segments: Array<{
    segmentId: mongoose.Types.ObjectId;
    drivers: Array<CSATMarketModelField>;
  }>;
}

export interface CSATData {
  [year: string]: {
    [driver: string]: number;
  };
}

export interface BaseDataInterface extends mongoose.Document {
  simulationTypeId: mongoose.Types.ObjectId;
  marketData: MarketData;
  marketModel: MarketModel;
  esatMarketModel: EsatMarketModel;
  csatMarketModel: CSATMarketModel;
  csatData?: CSATData;
}

// Schema definitions
const yearlyDataSchema = new mongoose.Schema(
  {
    marketSize: { type: Number, required: true },
    marketGrowth: { type: Number, required: true },
  },
  { _id: false }
);

const marketDataProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    yearlyData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
      validate: {
        validator: function (v: any) {
          // Validate that it's an object with string keys and valid yearlyData values
          return (
            v &&
            typeof v === "object" &&
            Object.entries(v).every(([key, value]) => {
              return (
                typeof key === "string" &&
                typeof value === "object" &&
                value !== null &&
                "marketSize" in value &&
                "marketGrowth" in value &&
                typeof value.marketSize === "number" &&
                typeof value.marketGrowth === "number"
              );
            })
          );
        },
        message: "yearlyData must be a record of market size and growth data",
      },
    },
    subProducts: {
      type: [
        {
          key: { type: String, required: true },
          yearlyData: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
            default: {},
          },
        },
      ],
      required: false,
      default: [],
    },
  },
  { _id: false }
);

const marketDataSegmentSchema = new mongoose.Schema(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    products: { type: [marketDataProductSchema], required: true, default: [] },
  },
  { _id: false }
);

const marketModelFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    formula: { type: String, required: false },
    type: { type: String, required: false },
    level: {
      type: String,
      enum: ["global", "segment", "product", "subproduct", "dynamic"],
      required: false,
    },
    direction: {
      type: Number,
      required: true,
      default: 1,
    },
    tightening: {
      type: Number,
      required: true,
      default: 3.0,
    },
    elasticity: {
      type: Number,
      required: false,
      default: 1.0,
    },
    coefficients: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
      validate: {
        validator: function (v: any) {
          return (
            v &&
            typeof v === "object" &&
            Object.entries(v).every(([key, value]) => {
              return typeof key === "string" && typeof value === "number";
            })
          );
        },
        message: "coefficients must be a record of numeric values",
      },
    },
  },
  { _id: false }
);

const marketModelProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    fields: { type: [marketModelFieldSchema], required: true, default: [] },
    segmentFields: {
      type: [marketModelFieldSchema],
      required: true,
      default: [],
    },
    globalFields: {
      type: [marketModelFieldSchema],
      required: true,
      default: [],
    },
    subProducts: {
      type: [
        {
          key: { type: String, required: true },
          fields: {
            type: [marketModelFieldSchema],
            required: true,
            default: [],
          },
        },
      ],
      required: false,
      default: [],
    },
  },
  { _id: false }
);

const marketModelSegmentSchema = new mongoose.Schema(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    products: { type: [marketModelProductSchema], required: true, default: [] },
  },
  { _id: false }
);

interface ESATMarketModelField {
  level: string;
  key: string;
  label: string;
  productId: mongoose.Types.ObjectId | null;
  globalInputId: mongoose.Types.ObjectId | null;
  globalInput?: IGlobalInput;
  eventId: mongoose.Types.ObjectId | null;
  event?: EventInterface;
  choiceKey: string | null;
  coefficients: Record<string, number>;
}

const esatMarketModelFieldSchema = new mongoose.Schema<ESATMarketModelField>(
  {
    level: {
      type: String,
      required: true,
      enum: ["global", "segment", "product", "event"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Product",
    },
    globalInputId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "GlobalInput",
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Event",
    },
    choiceKey: {
      type: String,
      required: false,
    },
    key: { type: String, required: true },
    label: { type: String, required: true },
    coefficients: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
      validate: {
        validator: function (v: any) {
          return (
            v &&
            typeof v === "object" &&
            Object.entries(v).every(([key, value]) => {
              return typeof key === "string" && typeof value === "number";
            })
          );
        },
        message: "coefficients must be a record of numeric values",
      },
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

esatMarketModelFieldSchema.virtual("globalInput", {
  ref: "GlobalInput",
  localField: "globalInputId",
  foreignField: "_id",
  justOne: true,
});

const esatMarketModelSegmentSchema = new mongoose.Schema(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    drivers: {
      type: [esatMarketModelFieldSchema],
      required: true,
      default: [],
    },
  },
  { _id: false }
);

interface CSATMarketModelField {
  level: string;
  key: string;
  label: string;
  productId: mongoose.Types.ObjectId | null;
  globalInputId: mongoose.Types.ObjectId | null;
  globalInput?: IGlobalInput;
  eventId: mongoose.Types.ObjectId | null;
  event?: EventInterface;
  choiceKey: string | null;
  coefficients: Record<string, number>;
}

const csatMarketModelFieldSchema = new mongoose.Schema<CSATMarketModelField>(
  {
    level: {
      type: String,
      required: true,
      enum: ["global", "segment", "product", "event"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Product",
    },
    globalInputId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "GlobalInput",
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Event",
    },
    choiceKey: {
      type: String,
      required: false,
    },
    key: { type: String, required: true },
    label: { type: String, required: true },
    coefficients: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
      validate: {
        validator: function (v: any) {
          return (
            v &&
            typeof v === "object" &&
            Object.entries(v).every(([key, value]) => {
              return typeof key === "string" && typeof value === "number";
            })
          );
        },
        message: "coefficients must be a record of numeric values",
      },
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

csatMarketModelFieldSchema.virtual("globalInput", {
  ref: "GlobalInput",
  localField: "globalInputId",
  foreignField: "_id",
  justOne: true,
});

const csatMarketModelSegmentSchema = new mongoose.Schema(
  {
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    drivers: {
      type: [csatMarketModelFieldSchema],
      required: true,
      default: [],
    },
  },
  { _id: false }
);

const baseDataSchema = new mongoose.Schema<BaseDataInterface>(
  {
    simulationTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "SimulationType",
    },
    marketData: {
      segments: {
        type: [marketDataSegmentSchema],
        required: true,
        default: [],
      },
    },
    marketModel: {
      segments: {
        type: [marketModelSegmentSchema],
        required: true,
        default: [],
      },
    },
    esatMarketModel: {
      segments: {
        type: [esatMarketModelSegmentSchema],
        required: true,
        default: [],
      },
    },
    csatMarketModel: {
      segments: {
        type: [csatMarketModelSegmentSchema],
        required: true,
        default: [],
      },
    },
    // csatData: {
    //   type: mongoose.Schema.Types.Map,
    //   of: mongoose.Schema.Types.Mixed,
    //   default: undefined,
    // },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

baseDataSchema.virtual("esatMarketModel.segments.drivers.globalInput", {
  ref: "GlobalInput",
  localField: "esatMarketModel.segments.drivers.globalInputId",
  foreignField: "_id",
  justOne: true,
});

baseDataSchema.virtual("csatMarketModel.segments.drivers.globalInput", {
  ref: "GlobalInput",
  localField: "csatMarketModel.segments.drivers.globalInputId",
  foreignField: "_id",
  justOne: true,
});

// Helper methods
baseDataSchema.methods.getYearlyDataForProduct = function (
  this: BaseDataInterface,
  segmentId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  year: number,
  subProductKey?: string
) {
  const segment = this.marketData.segments.find((s) =>
    s.segmentId.equals(segmentId)
  );
  if (!segment) return null;

  const product = segment.products.find((p) => p.productId.equals(productId));
  if (!product) return null;

  if (subProductKey && product.subProducts) {
    const subProduct = product.subProducts.find(
      (sp) => sp.key === subProductKey
    );
    if (subProduct) {
      return subProduct.yearlyData[year.toString()];
    }
  }

  return product.yearlyData[year.toString()];
};

baseDataSchema.methods.getCoefficientsForProduct = function (
  this: BaseDataInterface,
  segmentId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  fieldKey: string,
  year: number,
  subProductKey?: string,
  level?: string
) {
  const segment = this.marketModel.segments.find((s) =>
    s.segmentId.equals(segmentId)
  );
  if (!segment) return null;

  const product = segment.products.find((p) => p.productId.equals(productId));
  if (!product) return null;

  let fields = product.fields;

  if (subProductKey && product.subProducts) {
    const subProdModel = product.subProducts.find(
      (sp) => sp.key === subProductKey
    );
    if (subProdModel) {
      fields = subProdModel.fields;
    }
  }

  const field = fields.find(
    (f) => f.key === fieldKey && (!level || (f.level || "product") === level)
  );
  if (!field) return null;

  return field.coefficients[year.toString()];
};

// Utility method to get sorted years
baseDataSchema.methods.getAvailableYears = function (this: BaseDataInterface) {
  const years = new Set<string>();

  // Collect years from marketData
  this.marketData.segments.forEach((segment) => {
    segment.products.forEach((product) => {
      Object.keys(product.yearlyData).forEach((year) => {
        years.add(year);
      });
    });
  });

  // Collect years from marketModel
  this.marketModel.segments.forEach((segment) => {
    segment.products.forEach((product) => {
      product.fields.forEach((field) => {
        Object.keys(field.coefficients).forEach((year) => {
          years.add(year);
        });
      });
    });
  });

  return Array.from(years).sort((a, b) => Number(a) - Number(b));
};

const BaseData = mongoose.model<BaseDataInterface>(
  "BaseData",
  baseDataSchema,
  "baseData"
);

export default BaseData;
