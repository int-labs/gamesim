import mongoose from "mongoose";

import { EventInterface } from "./events";
import { IGlobalInput } from "./globalInputs";
import { ProductInterface } from "./products";
import { SegmentInterface } from "./segments";
import Simulation, { SimulationInterface } from "./simulations";
import Team from "./teams";

// Interfaces
export interface DecisionDetailField {
  key: string;
  value: number;
  textValue?: string;
  subProductKey?: string;
  complexValues?: Array<{
    optionKey: string;
    tab: string;
    itemKey: string;
    value: number;
    textValue?: string;
  }>;
}

export interface DecisionDetailInterface {
  productId: mongoose.Types.ObjectId;
  segmentId: mongoose.Types.ObjectId;
  product?: ProductInterface; // Virtual field
  segment?: SegmentInterface; // Virtual field
  fields: DecisionDetailField[];
  // Unlock system fields
  unlockRequested?: boolean; // Team requested unlock this round
  isUnlocked?: boolean; // Current unlock status (default: true)
  unlockCostPaid?: number; // Cost paid when unlocking (for later calculation)
  // Keep deprecated fields for backward compatibility
  productName?: string;
  interestRate?: number;
  marketingSpend?: number;
  fees?: number;
  productLevel?: number;
  risk?: number;
  commission?: number;
}

export interface SegmentDecisionDetailInterface {
  segmentId: mongoose.Types.ObjectId;
  segment?: SegmentInterface;
  fields: DecisionDetailField[];
}

export interface GlobalDecisionDetailInterface {
  globalInputId: mongoose.Types.ObjectId;
  globalInput?: IGlobalInput;
  key: string;
  value?: number;
  textValue?: string;
  selected?: boolean;
  selectedInPreviousRounds?: boolean;
}

interface InitiativeDetail {
  selectedId: mongoose.Types.ObjectId;
  position: number;
}

export interface EventDecisionInterface {
  eventTriggeredId?: mongoose.Types.ObjectId; // ID of the specific eventTriggered instance
  eventId: mongoose.Types.ObjectId; // Keep for backward compatibility
  chosenKey: string;
  event?: EventInterface;
}

export interface DecisionInterface {
  simulationId: mongoose.Types.ObjectId;
  simulation?: SimulationInterface;
  teamId: mongoose.Types.ObjectId;
  roundNumber: number;
  decisionDetails: DecisionDetailInterface[];
  segmentDecisionDetails: SegmentDecisionDetailInterface[];
  globalDecisionDetails: GlobalDecisionDetailInterface[];
  // initiatives: InitiativeDetail[];
  eventDecisions?: EventDecisionInterface[];
  createdAt: Date;
}

// Schemas
const decisionDetailFieldSchema = new mongoose.Schema<DecisionDetailField>(
  {
    key: { type: String, required: true },
    value: { type: Number, required: true },
    textValue: { type: String, required: false },
    subProductKey: { type: String, required: false },
    complexValues: {
      type: [
        {
          optionKey: { type: String, required: true },
          tab: { type: String, required: true },
          itemKey: { type: String, required: true },
          value: { type: Number, required: true },
          textValue: { type: String, required: false },
        },
      ],
      required: false,
      default: undefined,
    },
  },
  { _id: false }
);

const decisionDetailSchema = new mongoose.Schema<DecisionDetailInterface>(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Segment",
    },
    fields: {
      type: [decisionDetailFieldSchema],
      required: true,
      default: [],
    },
    // Unlock system fields
    unlockRequested: { type: Boolean, default: false },
    isUnlocked: { type: Boolean, default: true }, // Default unlocked
    unlockCostPaid: { type: Number, required: false },
    // Deprecated fields
    productName: { type: String, required: false, default: "" },
    interestRate: { type: Number, default: 0 },
    marketingSpend: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
    productLevel: { type: Number, default: 0 },
    risk: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add virtual for product
decisionDetailSchema.virtual("product", {
  ref: "Product",
  localField: "productId",
  foreignField: "_id",
  justOne: true,
});

// Add virtual for segment
decisionDetailSchema.virtual("segment", {
  ref: "Segment",
  localField: "segmentId",
  foreignField: "_id",
  justOne: true,
});

const segmentDecisionDetailFieldSchema =
  new mongoose.Schema<DecisionDetailField>(
    {
      key: { type: String, required: true },
      value: { type: Number, required: true },
      textValue: { type: String, required: false },
      complexValues: {
        type: [
          {
            optionKey: { type: String, required: true },
            tab: { type: String, required: true },
            itemKey: { type: String, required: true },
            value: { type: Number, required: true },
            textValue: { type: String, required: false },
          },
        ],
        required: false,
        default: undefined,
      },
    },
    { _id: false }
  );

const segmentDecisionDetailSchema =
  new mongoose.Schema<SegmentDecisionDetailInterface>(
    {
      segmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
      fields: { type: [segmentDecisionDetailFieldSchema], required: true },
    },
    { _id: false }
  );

segmentDecisionDetailSchema.virtual("segment", {
  ref: "Segment",
  localField: "segmentId",
  foreignField: "_id",
  justOne: true,
});

const globalDecisionDetailSchema =
  new mongoose.Schema<GlobalDecisionDetailInterface>(
    {
      globalInputId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      key: {
        type: String,
        required: true,
      },
      value: {
        type: Number,
        required: true,
        default: 0,
      },
      textValue: {
        type: String,
        required: false,
      },
      selected: {
        type: Boolean,
        required: true,
        default: false,
      },
      selectedInPreviousRounds: {
        type: Boolean,
        required: false,
        default: false,
      },
    },
    { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
  );

globalDecisionDetailSchema.virtual("globalInput", {
  ref: "GlobalInput",
  localField: "globalInputId",
  foreignField: "_id",
  justOne: true,
});

const initiativeDetailSchema = new mongoose.Schema<InitiativeDetail>(
  {
    selectedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Initiative",
      default: null,
    },
    position: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

const eventDecisionSchema = new mongoose.Schema<EventDecisionInterface>(
  {
    eventTriggeredId: { type: mongoose.Schema.Types.ObjectId, required: false },
    eventId: { type: mongoose.Schema.Types.ObjectId, required: false },
    chosenKey: {
      type: String,
      required: false,
      validate: {
        validator: (v: string) => v !== null && v !== undefined,
        message: "Field is required",
      },
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

eventDecisionSchema.virtual("event", {
  ref: "Event",
  localField: "eventId",
  foreignField: "_id",
  justOne: true,
});

interface DecisionInterfaceDocument
  extends DecisionInterface,
    mongoose.Document {}

const decisionSchema = new mongoose.Schema<DecisionInterfaceDocument>(
  {
    simulationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Simulation ID is required"],
      ref: "Simulation",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Team ID is required"],
      ref: "Team",
    },
    roundNumber: {
      type: Number,
      required: [true, "Round number is required"],
    },
    decisionDetails: {
      type: [decisionDetailSchema],
      required: [true, "Decision details are required"],
      default: [],
    },
    segmentDecisionDetails: {
      type: [segmentDecisionDetailSchema],
      required: [true, "Segment decision details are required"],
      default: [],
    },
    globalDecisionDetails: {
      type: [globalDecisionDetailSchema],
      required: [true, "Global decision details are required"],
      default: [],
    },
    // initiatives: {
    //   type: [initiativeDetailSchema],
    //   required: true,
    // },
    eventDecisions: {
      type: [eventDecisionSchema],
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook for validation
decisionSchema.pre("save", async function (next) {
  const decision = this;
  const session = this.$session();

  if (session) {
    try {
      // Validate if simulation exists
      const simulation = await Simulation.findById(
        decision.simulationId
      ).session(session);
      if (!simulation) {
        throw new Error(
          `Simulation with ID ${decision.simulationId} does not exist.`
        );
      }

      // Validate if team exists
      const team = await Team.findById(decision.teamId).session(session);
      if (!team) {
        throw new Error(`Team with ID ${decision.teamId} does not exist.`);
      }

      // Validate if the current round is active (or completed for round 0)
      const allowedStatuses =
        decision.roundNumber <= 0 ? ["Active", "Completed"] : ["Active"];

      const roundStatus = await mongoose
        .model("Round")
        .findOne({
          simulationId: decision.simulationId,
          roundNumber: decision.roundNumber,
          status: { $in: allowedStatuses },
        })
        .session(session);
      if (!roundStatus) {
        throw new Error(
          `Round ${decision.roundNumber} for simulation with ID "${decision.simulationId}" must be ${allowedStatuses.join(" or ")}.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof Error) {
        next(error);
      } else {
        next(new Error("An unexpected error occurred."));
      }
    }
  } else {
    try {
      // Validate if simulation exists
      const simulation = await Simulation.findById(decision.simulationId);
      if (!simulation) {
        throw new Error(
          `Simulation with ID ${decision.simulationId} does not exist.`
        );
      }

      // Validate if team exists
      const team = await Team.findById(decision.teamId);
      if (!team) {
        throw new Error(`Team with ID ${decision.teamId} does not exist.`);
      }

      // Validate if the current round is active (or completed for round 0)
      const allowedStatuses =
        decision.roundNumber <= 0 ? ["Active", "Completed"] : ["Active"];

      const roundStatus = await mongoose.model("Round").findOne({
        simulationId: decision.simulationId,
        roundNumber: decision.roundNumber,
        status: { $in: allowedStatuses },
      });
      if (!roundStatus) {
        throw new Error(
          `Round ${decision.roundNumber} for simulation with ID "${decision.simulationId}" must be ${allowedStatuses.join(" or ")}.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof Error) {
        next(error);
      } else {
        next(new Error("An unexpected error occurred."));
      }
    }
  }
});

decisionSchema.virtual("simulation", {
  ref: "Simulation",
  localField: "simulationId",
  foreignField: "_id",
  justOne: true,
});

const Decision = mongoose.model<DecisionInterface>("Decision", decisionSchema);

export default Decision;
