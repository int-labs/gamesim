import fs from "fs/promises";
import { Types } from "mongoose";
import path from "path";

import connectToDatabase from "../src/db/db";

const BASE_DIR = path.join(__dirname, "./seed-data/base");
const DEV_DIR = path.join(__dirname, "./seed-data/development");
const MERGE_CONFIG_PATH = path.join(__dirname, "./seed-data/merge-config.json");

interface MergeConfig {
  collections: {
    [collectionName: string]: {
      strategy: "replace" | "append";
    };
  };
}

function convertOids(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertOids);
  }

  if (obj && typeof obj === "object") {
    // Handle mongoexport ObjectId format: { "$oid": "..." }
    if (
      Object.keys(obj).length === 1 &&
      Object.prototype.hasOwnProperty.call(obj, "$oid")
    ) {
      return new Types.ObjectId((obj as any).$oid);
    }

    // Handle mongoexport Date formats
    // { "$date": "2025-01-01T00:00:00.000Z" } or { "$date": 1699812345678 }
    // or { "$date": { "$numberLong": "1699812345678" } }
    if (
      Object.keys(obj).length === 1 &&
      Object.prototype.hasOwnProperty.call(obj, "$date")
    ) {
      const raw: any = (obj as any).$date;
      if (typeof raw === "string" || typeof raw === "number") {
        return new Date(raw);
      }
      if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "$numberLong")) {
        const n = Number((raw as any)["$numberLong"]);
        return new Date(n);
      }
      return new Date(raw);
    }

    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertOids(obj[key]);
    }
    return newObj;
  }

  return obj;
}

async function loadMergeConfig(): Promise<MergeConfig> {
  try {
    const config = await fs.readFile(MERGE_CONFIG_PATH, "utf-8");
    return JSON.parse(config);
  } catch {
    return { collections: {} };
  }
}

function mergeData<T>(
  base: T[],
  development: T[],
  config: MergeConfig["collections"][string]
): T[] {
  if (!config || config.strategy === "replace") {
    // Replace: use development data if available, otherwise use base
    return development.length > 0 ? development : base;
  }

  if (config.strategy === "append") {
    // Append: combine base + development
    return [...base, ...development];
  }

  // Default: use base if no strategy specified
  return base;
}

async function getSeedFiles(): Promise<string[]> {
  const baseFiles = await fs.readdir(BASE_DIR).catch(() => []);
  const devFiles = await fs.readdir(DEV_DIR).catch(() => []);

  const allFiles = new Set([
    ...baseFiles.filter((f) => f.endsWith(".json")),
    ...devFiles.filter((f) => f.endsWith(".json")),
  ]);

  return Array.from(allFiles);
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.log("🚨 Seeding in production mode is not allowed.");
    process.exit(1);
  }

  const db = await connectToDatabase();
  const mergeConfig = await loadMergeConfig();

  try {
    const files = await getSeedFiles();

    for (const file of files) {
      const collectionName = path.basename(file, ".json");
      const basePath = path.join(BASE_DIR, file);
      const devPath = path.join(DEV_DIR, file);

      let baseData: any[] = [];
      let devData: any[] = [];

      // Load base data
      try {
        const baseContent = await fs.readFile(basePath, "utf-8");
        baseData = JSON.parse(baseContent);
      } catch {
        console.log(`ℹ️  No base data for ${collectionName}`);
      }

      // Load development data
      try {
        const devContent = await fs.readFile(devPath, "utf-8");
        devData = JSON.parse(devContent);
      } catch {
        // No dev data - that's fine
      }

      if (baseData.length === 0 && devData.length === 0) {
        console.warn(`⚠️  No data to seed for ${collectionName}`);
        continue;
      }

      // Merge data (handle development-only collections explicitly)
      const config = mergeConfig.collections[collectionName] || {
        strategy: "append",
      };

      let mergedData: any[] = [];

      if (baseData.length === 0 && devData.length > 0) {
        // Development-only collection
        mergedData = devData;
        console.log(
          `ℹ️  Using development-only data for ${collectionName} (${devData.length} docs)`
        );
      } else if (devData.length > 0 && baseData.length > 0) {
        // Both base and dev exist → merge according to strategy
        mergedData = mergeData(baseData, devData, config);
      } else {
        // Only base exists
        mergedData = baseData;
      }

      const dataWithConvertedOids = convertOids(mergedData);

      if (!Array.isArray(dataWithConvertedOids)) {
        console.warn(`⚠️  Skipping ${file}: not an array after merge`);
        continue;
      }

      try {
        const collection = db.collection(collectionName);
        await collection.deleteMany({});
        await collection.insertMany(dataWithConvertedOids);

        const stats = {
          base: baseData.length,
          dev: devData.length,
          total: mergedData.length,
        };

        const strategy = config.strategy || "append";
        console.log(
          `✅ Seeded ${collectionName} (${stats.total} docs: ${stats.base} base + ${stats.dev} dev (${strategy}))`
        );
      } catch (err) {
        console.error(`❌ Error seeding ${collectionName}:`, err);
      }
    }
  } finally {
    await db.close();
  }
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
