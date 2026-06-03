import express, { Request, Response } from "express";
import authRoutes from "./authRoutes";
import decisionRoutes from "./decisionRoutes";
import eventRoutes from "./eventRoutes";
import feedbackRoutes from "./feedbackRoutes";
import productRoutes from "./productRoutes";
import projectionRoutes from "./projectionRoutes";
import roundRoutes from "./roundRoutes";
import seedRoutes from "./seedRoutes";
import simulationRoutes from "./simulationRoutes";
import simulationTypeRoutes from "./simulationTypeRoutes";
import teamRoutes from "./teamRoutes";
import translationRoutes from "./translationRoutes";
import uploadRoutes from "./uploadRoutes";
import userRoutes from "./userRoutes";

const app = express();

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Attach each module's routes to a path
app.use("/auth", authRoutes);
app.use("/decisions", decisionRoutes);
app.use("/products", productRoutes);
app.use("/simulations", simulationRoutes);
app.use("/events", eventRoutes);
app.use("/teams", teamRoutes);
app.use("/rounds", roundRoutes);
app.use("/users", userRoutes);
app.use("/projections", projectionRoutes);
app.use("/simulation-types", simulationTypeRoutes);
app.use("/translate", translationRoutes);
app.use("/upload", uploadRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", seedRoutes);

export default app;
