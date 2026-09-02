import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * How a simulation is run.
 *
 *   competitive   — an operator drives it. Rounds are scored by
 *                   `POST /rounds/:id/calculate`, market share is competed
 *                   across teams, and a team waits after confirming until the
 *                   operator calculates.
 *   single_player — nobody drives it. The team's own projections ARE the
 *                   result, carried through to the end; there is no wait and no
 *                   competed share, and final scoring uses its own weights.
 *
 * ABSENT MEANS COMPETITIVE. Every simulation already in the database predates
 * this field and is operator-run, so absence must not silently turn one into a
 * single-player game. Single player is opt-in.
 */
export type SimulationMode = "single_player" | "competitive";

export const SIMULATION_MODES: SimulationMode[] = ["single_player", "competitive"];

export interface SimulationInterface extends Document {
  simulationName:   string;
  status:           "Active" | "Inactive" | "Completed";
  simulationTypeId: Types.ObjectId;
  /** `mode` lives in `config`, where the operator's settings are set. The
   *  console's simulation configuration menu offers it as a SELECT, so the
   *  stored value is constrained at the point it is written. */
  config:           { totalRounds?: number; currRounds?: number; mode?: SimulationMode } & Record<string, any>;
  startDate?:       Date;
  endDate?:         Date;
  createdAt:        Date;
  updatedAt:        Date;
}

const SimulationSchema = new Schema<SimulationInterface>(
  {
    simulationName:   { type: String, required: true },
    status:           { type: String, enum: ["Active", "Inactive", "Completed"], required: true },
    simulationTypeId: { type: Schema.Types.ObjectId, ref: "SimulationType", required: true },
    config:           { type: Schema.Types.Mixed },
    startDate:        { type: Date },
    endDate:          { type: Date },
  },
  { timestamps: true }
);

SimulationSchema.pre("save", function (next) {
  const config = this.config as { totalRounds?: number; currRounds?: number };

  if (
    config?.totalRounds !== undefined &&
    config?.currRounds !== undefined &&
    config.currRounds > config.totalRounds
  ) {
    return next(new Error("currRounds cannot be greater than totalRounds."));
  }

  next();
});

export default mongoose.model<SimulationInterface>("Simulation", SimulationSchema);