import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../models/users";

dotenv.config(); // Load environment variables

const renameField = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);

    const result = await User.updateMany(
      { token: { $exists: true } },
      { $rename: { token: "passkey" } }
    );

    console.log(`Updated ${result.modifiedCount} documents.`);

    mongoose.connection.close();
  } catch (error) {
    console.error("Migration failed:", error);
    mongoose.connection.close();
  }
};

renameField();
