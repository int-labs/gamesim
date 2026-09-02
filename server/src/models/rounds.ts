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

    // Rounds are the last thing holding the simulation together: everything
    // downstream — decisions, projections, results, carried stock — is keyed on
    // a round being in a valid state. So an incomplete config is a hard failure,
    // not a reason to skip the checks.
    //
    // This used to pass silently. `config` was typed `Record<string, any>`, so
    // these reads were `any` and every comparison below was against `undefined`
    // — `n > undefined` is false — which meant ALL FOUR guards below were
    // inert for such a simulation: a round beyond `totalRounds`, a Completed
    // current round, a non-Pending future round and a non-Completed past round
    // would each have been accepted.
    if (totalRounds === undefined || currRounds === undefined) {
      throw new Error(
        `Simulation with ID "${round.simulationId}" has an incomplete config: ` +
          `both totalRounds and currRounds are required to validate a round.`
      );
    }

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