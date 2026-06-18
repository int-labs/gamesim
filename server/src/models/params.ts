import mongoose, { Document, Schema, Types } from "mongoose";

interface Parameter {
  paramCode:  string;
  paramTitle: string;
  paramType:  string;
  paramValue: number;
  paramCount: number;
}

export interface ParamListInterface extends Document {
  segmentId:  Types.ObjectId;
  productId:  Types.ObjectId;
  parameters: Parameter[];
}

const ParameterSchema = new Schema<Parameter>(
  {
    paramCode:  { type: String, required: true },
    paramTitle: { type: String, required: true },
    paramType:  { type: String, required: true },
    paramValue: { type: Number, required: true },
    paramCount: { type: Number, required: true },
  },
  { _id: false }
);

const ParamListSchema = new Schema<ParamListInterface>(
  {
    segmentId:  { type: Schema.Types.ObjectId, ref: "Segment", required: true },
    productId:  { type: Schema.Types.ObjectId, ref: "Product", required: true },
    parameters: { type: [ParameterSchema], default: [] },
  },
  { timestamps: false }
);

ParamListSchema.index({ segmentId: 1, productId: 1 }, { unique: true });

export default mongoose.model<ParamListInterface>("ParamList", ParamListSchema);