import mongoose from "mongoose";

import Simulation from "./simulations"; // Import the Simulation model

export interface TeamInterface {
  _id: mongoose.Types.ObjectId;
  simulationId: mongoose.Types.ObjectId; // Use simulationId for unique identification
  teamName: string;
  teamLeader: string;
  avatarUrl?: string | null;
  score: number;
  marketShare: number;
  createdAt: Date;
}

// Define the Team Schema
const teamSchema = new mongoose.Schema<TeamInterface>(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    simulationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Simulation",
      index: true,
    },
    teamName: { type: String, required: true },
    teamLeader: { type: String, required: true },
    avatarUrl: { type: String, required: false },
    score: { type: Number, required: true },
    marketShare: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save hook to validate simulation existence
teamSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  const team = this;
  const session = team.$session();

  try {
    // Validate if simulation exists by simulationId
    const simulation = await Simulation.findById(team.simulationId).session(
      session
    );
    if (!simulation) {
      throw new Error(
        `Simulation with ID "${team.simulationId}" does not exist.`
      );
    }

    // Proceed with save if validation passes
    next();
  } catch (error: any) {
    next(error);
  }
});

teamSchema.virtual("simulation", {
  ref: "Simulation",
  localField: "simulationId",
  foreignField: "_id",
  justOne: true, // Retrieve one document
});

teamSchema.set("toObject", { virtuals: true });
teamSchema.set("toJSON", { virtuals: true });

// Create the Team model
const Team = mongoose.model("Team", teamSchema, "teams");

export default Team;
