import mongoose, { Document, Schema, Types } from "mongoose";
import Team from "./teams";
import Product from "./products";

export interface DriverYearData {
  [year: string]: number;
}

export interface DriverInterface extends Document {
  productId: Types.ObjectId;
  teamId:    Types.ObjectId;
  years:     DriverYearData;
}

const driverSchema = new Schema<DriverInterface>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: "Product", index: true },
    teamId:    { type: Schema.Types.ObjectId, required: true, ref: "Team",    index: true },
    years:     {
      type:    Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v: any) =>
          v === null ||
          (typeof v === "object" &&
            Object.entries(v).every(
              ([k, val]) => typeof k === "string" && typeof val === "number"
            )),
        message: "years must be a record of numeric values keyed by year string",
      },
    },
  },
  { timestamps: false }
);

driverSchema.pre("save", async function (next) {
  try {
    const [product, team] = await Promise.all([
      Product.findById(this.productId),
      Team.findById(this.teamId),
    ]);

    if (!product) {
      return next(new Error(`Product with ID "${this.productId}" does not exist.`));
    }

    if (!team) {
      return next(new Error(`Team with ID "${this.teamId}" does not exist.`));
    }

    next();
  } catch (err: any) {
    next(err);
  }
});

driverSchema.index({ productId: 1, teamId: 1 }, { unique: true });

export default mongoose.model<DriverInterface>("Driver", driverSchema, "drivers");