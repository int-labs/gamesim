import mongoose, { Document, Schema, Types } from "mongoose";
import Simulation from "./simulations";

interface RoundTimer {
  startDate?:       Date;
  durationMinutes?: number;
  endDate?:         Date;
}

export interface RoundInterface extends Document {
  simulationId: Types.ObjectId;
  roundNumber:  number;
  status:       "Pending" | "Active" | "Completed";
  timer?:       RoundTimer;
  createdAt:    Date;
  updatedAt:    Date;
}

const RoundTimerSchema = new Schema<RoundTimer>(
  {
    startDate:       { type: Date },
    durationMinutes: { type: Number },
    endDate:         { type: Date },
  },
  { _id: false }
);

const RoundSchema = new Schema<RoundInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    roundNumber:  { type: Number, required: true },
    status:       { type: String, enum: ["Pending", "Active", "Completed"], required: true },
    timer:        { type: RoundTimerSchema },
  },
  { timestamps: true }
);

RoundSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const round = this as RoundInterface;
  const session = round.$session();

  try {
    const simulation = await Simulation.findById(round.simulationId).session(session);

    if (!simulation) {
      throw new Error(`Simulation with ID "${round.simulationId}" does not exist.`);
    }

    const { currRounds, totalRounds } = simulation.config;
    const { status } = simulation;

    if (round.roundNumber > totalRounds) {
      throw new Error(`roundNumber exceeds totalRounds in simulation.`);
    }

    if (status === "Completed") {
      throw new Error(`Simulation with ID "${round.simulationId}" has already completed.`);
    }

    if (status === "Inactive") {
      throw new Error(`Simulation with ID "${round.simulationId}" has not yet started.`);
    }

    if (status === "Active") {
      if (round.roundNumber === currRounds && round.status === "Completed") {
        throw new Error(`Round number ${round.roundNumber} cannot be "Completed" when it's the current round.`);
      }
      if (round.roundNumber > currRounds && round.status !== "Pending") {
        throw new Error(`Round number ${round.roundNumber} must be "Pending".`);
      }
      if (round.roundNumber > 0 && round.roundNumber < currRounds && round.status !== "Completed") {
        throw new Error(`Round number ${round.roundNumber} must be "Completed" as it's a past round.`);
      }
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

export default mongoose.model<RoundInterface>("Round", RoundSchema, "rounds");