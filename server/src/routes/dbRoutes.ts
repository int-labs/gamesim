import { exec } from "child_process";
import express, { Request, Response } from "express";
import path from "path";

const router = express.Router();

// Reseed database endpoint
router.post("/seed-db", async (req: Request, res: Response) => {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "Database reseeding is not allowed in production",
    });

    return;
  }

  // Only allow in preview environments
  if (
    process.env.IS_PULL_REQUEST !== "true" &&
    process.env.NODE_ENV !== "preview" &&
    process.env.NODE_ENV !== "development"
  ) {
    res.status(403).json({
      error:
        "Database reseeding is only allowed in preview/development environments",
    });

    return;
  }

  try {
    console.log("🔄 Starting database reseed...");

    // Get the path to the seed script
    const seedScriptPath = path.join(__dirname, "../../scripts/seed.ts");

    // Execute the seed script
    exec(
      `npx tsx ${seedScriptPath}`,
      {
        cwd: path.join(__dirname, "../.."),
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Seed script execution failed:", error);
          return res.status(500).json({
            error: "Failed to execute seed script",
            details: error.message,
            stderr: stderr,
          });
        }

        if (stderr) {
          console.warn("⚠️ Seed script warnings:", stderr);
        }

        console.log("✅ Database reseed completed successfully");
        console.log("Seed script output:", stdout);

        res.status(200).json({
          message: "Database reseeded successfully",
          output: stdout,
        });
      }
    );
  } catch (error: any) {
    console.error("❌ Database reseed error:", error);
    res.status(500).json({
      error: "Internal server error during reseed",
      details: error.message,
    });
  }
});

// Get database info endpoint
router.get("/info", async (req: Request, res: Response) => {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;

    if (!db) {
      res.status(500).json({ error: "Database not connected" });

      return;
    }

    const collections = await db.listCollections().toArray();
    const dbInfo: any = {
      databaseName: db.databaseName,
      environment: process.env.NODE_ENV,
      isPreview: process.env.IS_PULL_REQUEST === "true",
      mongoUri: process.env.MONGO_URI?.replace(/\/\/.*@/, "//***:***@"), // Hide credentials
      collections: [],
    };

    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      dbInfo.collections.push({
        name: collection.name,
        documentCount: count,
      });
    }

    res.status(200).json(dbInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
