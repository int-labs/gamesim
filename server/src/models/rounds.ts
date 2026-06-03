import mongoose, { Document, Schema, Types } from "mongoose";
import { EventInterface } from "./events";
import Simulation from "./simulations";

// ─────────────────────────────────────────────────────────────
// Subdocument type for eventsTriggered
export type EventTriggeredSubdoc = {
  _id?: Types.ObjectId;
  eventId: Types.ObjectId;
  event?: EventInterface;
  delayed: boolean;
  delayTime: number;
  delayStartFrom?: "roundStart" | "creation";
  scheduledAt?: Date | null;
};

// ─────────────────────────────────────────────────────────────
// Main Round document interface
export interface RoundInterface extends Document {
  simulationId: Types.ObjectId;
  roundNumber: number;
  status: "Pending" | "Active" | "Completed";
  eventId: Types.ObjectId | null;
  eventsTriggered: Array<EventTriggeredSubdoc>;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  earlySubmissions?: Array<Types.ObjectId>;
}

// ─────────────────────────────────────────────────────────────
// Subschema for eventsTriggered
const eventTriggeredSchema = new Schema<EventTriggeredSubdoc>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    delayed: { type: Boolean, default: false },
    delayTime: { type: Number, default: 0 },
    delayStartFrom: {
      type: String,
      enum: ["roundStart", "creation"],
      default: "roundStart",
    },
    scheduledAt: { type: Date, default: null },
  },
  {
    _id: true, // ensures each subdoc gets its own _id
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// Optional virtual population for embedded event details
eventTriggeredSchema.virtual("event", {
  ref: "Event",
  localField: "eventId",
  foreignField: "_id",
  justOne: true,
});

// ─────────────────────────────────────────────────────────────
// Main schema for Round
const roundSchema = new Schema<RoundInterface>(
  {
    simulationId: {
      type: Schema.Types.ObjectId,
      ref: "Simulation",
      required: true,
    },
    roundNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Active", "Completed"],
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event", // ✅ fixed from "Simulation" to "Event"
      default: null,
    },
    eventsTriggered: {
      type: [eventTriggeredSchema],
      default: [],
    },
    earlySubmissions: {
      type: [Schema.Types.ObjectId],
      ref: "Team",
      default: [],
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────
// Virtual population for main event (from eventId)
roundSchema.virtual("event", {
  ref: "Event",
  localField: "eventId",
  foreignField: "_id",
  justOne: true,
});

roundSchema.virtual("eventsTriggered.event", {
  ref: "Event",
  localField: "eventsTriggered.eventId",
  foreignField: "_id",
  justOne: true,
});

// ─────────────────────────────────────────────────────────────
// Pre-save validation hook (optional - keep if needed)
roundSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const round = this as RoundInterface;
  const session = round.$session();

  try {
    const simulation = await Simulation.findById(round.simulationId).session(
      session
    );

    if (!simulation) {
      throw new Error(
        `Simulation with ID "${round.simulationId}" does not exist.`
      );
    }

    const { currRounds, totalRounds } = simulation.config;
    const { status } = simulation;

    if (round.roundNumber > totalRounds) {
      throw new Error(`roundNumber exceeds totalRounds in simulation.`);
    }

    if (status === "Completed") {
      throw new Error(
        `Simulation with ID "${round.simulationId}" has already completed.`
      );
    }

    if (status === "Pending") {
      throw new Error(
        `Simulation with ID "${round.simulationId}" has not yet started.`
      );
    }

    if (status === "Active") {
      // Current round can be "Active" or "Pending" (Pending when simulation is created but round not started yet)
      if (round.roundNumber === currRounds && round.status === "Completed") {
        throw new Error(`Round number ${round.roundNumber} cannot be "Completed" when it's the current round.`);
      }
      // Future rounds must be "Pending"
      if (round.roundNumber > currRounds && round.status !== "Pending") {
        throw new Error(`Round number ${round.roundNumber} must be "Pending".`);
      }
      // Round 0 is a special case - it can be "Completed" for predefined decisions
      // Past rounds (between 0 and currRounds) should be "Completed"
      if (round.roundNumber > 0 && round.roundNumber < currRounds && round.status !== "Completed") {
        throw new Error(`Round number ${round.roundNumber} must be "Completed" as it's a past round.`);
      }
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Export model
const Round = mongoose.model<RoundInterface>("Round", roundSchema, "rounds");
export default Round;
