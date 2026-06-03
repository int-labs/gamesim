import mongoose from "mongoose";

import connectDB from "../src/db/db";

async function clean() {
  if (process.env.NODE_ENV === "production") {
    console.log("🚨 Cleaning in production mode is not allowed.");
    process.exit(1);
  }

  const db = await connectDB();

  console.log("Cleaning database...");

  const collections = await db.listCollections();
  for (const col of collections) {
    try {
      console.log(`Clearing: ${col.name}`);

      await db.collection(col.name).deleteMany({});
      console.log(`✅ Cleared: ${col.name}`);
    } catch (err) {
      console.error(`⚠️ Error clearing ${col.name}:`, err);
    }
  }

  await mongoose.disconnect();
  console.log("🎉 All collections cleaned.");
}

clean().catch((err) => {
  console.error("❌ Clean script failed:", err);
  process.exit(1);
});
