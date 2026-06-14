import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interfaces
// ============================================================

export interface InitiativeInterface extends Document {
  name:              string;
  details:           string | null;
  costConsumption:   number;
  energyConsumption: number;
}

// ============================================================
// Schema
// ============================================================

const initiativeSchema = new Schema<InitiativeInterface>(
  {
    name: {
      type:     String,
      required: true,
      unique:   true,
    },
    details: {
      type:    String,
      default: null,
    },
    costConsumption: {
      type:     Number,
      required: true,
      default:  0,
    },
    energyConsumption: {
      type:     Number,
      required: true,
      default:  0,
    },
  },
  { timestamps: false } // initiatives are static reference data, no need for timestamps
);

// ============================================================
// Model export
// ============================================================

const Initiative = mongoose.model<InitiativeInterface>(
  "Initiative",
  initiativeSchema,
  "initiatives"
);

export default Initiative;