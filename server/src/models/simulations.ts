import mongoose from "mongoose";

import { ProductInterface } from "./products";
import { SegmentInterface } from "./segments";
import { SimulationTypeInterface } from "./simulationTypes";

// Define the ConfigInterface
type ConfigInterface = {
  totalRounds: number;
  currRounds: number;
  includeEvents: boolean;
  eventSettings: {
    frequency: string;
    types: Array<string>;
  };
  hideUnselectedSegmentsProducts?: boolean;
};

// Config Schema with validations for totalRounds and currRounds
const configSchema = new mongoose.Schema<ConfigInterface>({
  totalRounds: { type: Number, required: true },
  currRounds: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return value <= this.totalRounds; // currRounds should not be greater than totalRounds
      },
      message: "currRounds cannot be greater than totalRounds.",
    },
  },
  hideUnselectedSegmentsProducts: { type: Boolean, default: false },
});

export type SimulationInterface = {
  _id: mongoose.Types.ObjectId; // Changed to ObjectId
  ownerId: mongoose.Types.ObjectId; // Changed to ObjectId referencing User
  simulationTypeId: mongoose.Types.ObjectId; // Changed to ObjectId referencing SimulationType
  simulationType: SimulationTypeInterface;
  simulationName: string;
  status: string;
  activeSegments: Array<mongoose.Types.ObjectId> | null;
  activeProducts: Array<mongoose.Types.ObjectId> | null;
  activeSegmentsDetailed: Array<SegmentInterface> | null;
  activeProductsDetailed: Array<ProductInterface> | null;
  config: ConfigInterface;
  startDate: Date;
  endDate: Date | null; // Allow endDate to be null
  createdAt: Date;
};

// Main Simulation Schema with date validations
const simulationSchema = new mongoose.Schema<SimulationInterface>({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Auto-generate ObjectId
  simulationName: { type: String, required: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  status: {
    type: String,
    enum: ["Active", "Completed"],
    required: true,
  },
  simulationTypeId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Changed to ObjectId referencing SimulationType
  activeSegments: {
    type: [mongoose.Schema.Types.ObjectId],
    required: false,
    default: [],
  },
  activeProducts: {
    type: [mongoose.Schema.Types.ObjectId],
    required: false,
    default: [],
  },
  config: { type: configSchema, required: true },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
    validate: {
      validator: function (value: Date) {
        // startDate should not be after endDate (if endDate is set)
        if (this.endDate && value > this.endDate) {
          throw new Error("startDate cannot be after endDate.");
        }
        return true;
      },
      message: "startDate cannot be after endDate.",
    },
  },
  endDate: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        // endDate should not be before startDate
        if (value && value < this.startDate) {
          throw new Error("endDate cannot be before startDate.");
        }
        return true;
      },
      message: "endDate cannot be before startDate.",
    },
  },
  createdAt: { type: Date, default: Date.now },
});

simulationSchema.virtual("simulationType", {
  ref: "SimulationType",
  localField: "simulationTypeId",
  foreignField: "_id",
  justOne: true,
});

simulationSchema.virtual("activeSegmentsDetailed", {
  ref: "Segment",
  localField: "activeSegments",
  foreignField: "_id",
  justOne: false,
});

simulationSchema.virtual("activeProductsDetailed", {
  ref: "Product",
  localField: "activeProducts",
  foreignField: "_id",
  justOne: false,
});

simulationSchema.set("toJSON", { virtuals: true });
simulationSchema.set("toObject", { virtuals: true });

// Create the Simulation model
const Simulation = mongoose.model(
  "Simulation",
  simulationSchema,
  "simulations"
);

export default Simulation;
