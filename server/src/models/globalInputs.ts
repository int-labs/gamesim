import mongoose, { Document, Schema, Types } from "mongoose";

export interface GlobalInputInterface extends Document {
  simulationTypeId: Types.ObjectId;
  category:          string;
  key:               string;
  label:             string;
  details:           string | null;
  costConsumption:   number;
  energyConsumption: number;
  createdAt:         Date;
  updatedAt:         Date;
}

const globalInputSchema = new Schema<GlobalInputInterface>(
  {
    simulationTypeId: { type: Schema.Types.ObjectId, required: true, ref: "SimulationType", index: true },
    category:          { type: String, required: true },
    key:               { type: String, required: true },
    label:             { type: String, required: true },
    details:           { type: String, default: null },
    costConsumption:   { type: Number, required: true, default: 0 },
    energyConsumption: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

globalInputSchema.index({ simulationTypeId: 1, key: 1 }, { unique: true });

const GlobalInput = mongoose.model<GlobalInputInterface>("GlobalInput", globalInputSchema, "globalInputs");

export default GlobalInput;