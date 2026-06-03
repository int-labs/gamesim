import mongoose, { Document, Schema } from "mongoose";

interface YearData {
  interestRate: { weight: number; direction: number };
  averageFee: { weight: number; direction: number };
  marketing: { weight: number; direction: number };
  productFeatures: { weight: number; direction: number };
}

interface DriverDocument extends Document {
  productId: mongoose.Types.ObjectId;
  segmentId: string; // 👈 segmentId is now a string
  years: {
    year0: YearData;
    year1: YearData;
    year2: YearData;
    year3: YearData;
    year4: YearData;
    year5: YearData;
  };
}

// 👇 Disabling _id for each year subdocument
const YearSchema = new Schema<YearData>(
  {
    interestRate: { weight: Number, direction: Number },
    averageFee: { weight: Number, direction: Number },
    marketing: { weight: Number, direction: Number },
    productFeatures: { weight: Number, direction: Number }
  },
  { _id: false } // 🚀 Disables _id generation for this subdocument
);

const DriverSchema = new Schema<DriverDocument>({
  productId: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
  segmentId: { type: String, required: true }, // 👈 Changed segmentId to string
  years: {
    year0: { type: YearSchema, required: true },
    year1: { type: YearSchema, required: true },
    year2: { type: YearSchema, required: true },
    year3: { type: YearSchema, required: true },
    year4: { type: YearSchema, required: true },
    year5: { type: YearSchema, required: true }
  }
});

export default mongoose.model<DriverDocument>("Driver", DriverSchema);
