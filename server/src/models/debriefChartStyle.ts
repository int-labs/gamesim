import mongoose, { Document, Schema } from "mongoose";

/** The chart gallery: every shape the app can draw, as data. Global, not per simulation type. */

export interface DebriefChartStyleInterface extends Document {
  /** The variant, "Stacked Bar chart", "Cluster chart", "Volume chart". */
  name: string;
  /** The family, "2D chart", "line chart", "bar chart". */
  category: string;
  /** !important sanitised at the console, never at render, like `products.segments`. */
  shape: string;
  createdAt: Date;
  updatedAt: Date;
}

const debriefChartStyleSchema = new Schema<DebriefChartStyleInterface>(
  {
    name:     { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, default: "", trim: true, maxlength: 64 },
    shape:    { type: String, default: "", maxlength: 20000 },
  },
  { timestamps: true }
);

// One variant per family. Two "Stacked Bar" rows under "bar chart" would be
// indistinguishable in the picker.
debriefChartStyleSchema.index({ category: 1, name: 1 }, { unique: true });

export default mongoose.model<DebriefChartStyleInterface>(
  "DebriefChartStyle",
  debriefChartStyleSchema,
  "debriefChartStyles"
);
