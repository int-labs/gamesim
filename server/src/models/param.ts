import mongoose, { Document, Schema } from "mongoose";

interface Parameter {
  paramCode: string;
  paramTitle: string;
  paramType: string; // e.g., "R"
  paramValue: number;
  paramCount: number;
  /**
   * please just use this, make it the same between products if it is really the same
   * for example churn; do not need to differentiate code since it is churn.
   */
  betterCode: string;
}

export interface ParamDocument extends Document {
  paramList: string;
  segmentId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  parameters: Parameter[];
}

const ParameterSchema = new Schema<Parameter>({
  paramCode: { type: String, required: true },
  paramTitle: { type: String, required: true },
  paramType: { type: String, required: true },
  paramValue: { type: Number, required: true },
  paramCount: { type: Number, required: true },
  betterCode: { type: String, required: true, default: "" },
});

const ParamSchema = new Schema<ParamDocument>(
  {
    paramList: { type: String, required: true },
    segmentId: { type: Schema.Types.ObjectId, ref: "Segment", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    parameters: { type: [ParameterSchema], required: true },
  },
  { timestamps: true }
);

const Param = mongoose.model<ParamDocument>("Param", ParamSchema, "paramList");

export default Param;
