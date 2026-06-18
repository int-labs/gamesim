import mongoose, { Document, Schema, Types } from "mongoose";

export interface SimulationInterface extends Document {
  simulationName:   string;
  status:           "Active" | "Inactive" | "Completed";
  simulationTypeId: Types.ObjectId;
  config:           Record<string, any>;
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