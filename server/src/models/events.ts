import mongoose from "mongoose";

interface ChoiceInterface {
  key: string;
  title: string;
  description: string;
  config: Record<
    string,
    {
      energyCost: number;
      financialCost: number;
      impacts: Array<{
        paramCode: string;
        value: number;
        impactedProducts: Array<mongoose.Types.ObjectId>;
      }>;
    }
  >;
}

const ChoiceSchema = new mongoose.Schema<ChoiceInterface>({
  key: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  config: {
    type: mongoose.Schema.Types.Mixed, // Record<string, { paramCode: string, value: number }>
    required: true,
    default: {},
    validate: {
      validator: function (v: any) {
        return (
          v &&
          typeof v === "object" &&
          Object.entries(v).every(
            ([year, obj]) =>
              obj &&
              typeof obj === "object" &&
              // @ts-ignore
              typeof obj.impacts === "object" &&
              // @ts-ignore
              Array.isArray(obj.impacts) &&
              // @ts-ignore
              obj.impacts.every(
                (impact: {
                  paramCode: string;
                  value: number;
                  impactedProducts: Array<mongoose.Types.ObjectId>;
                }) => {
                  const arePrimitiveValuesValid =
                    typeof impact.paramCode === "string" &&
                    typeof impact.value === "number";

                  const areImpactedProductsValid =
                    Array.isArray(impact.impactedProducts) &&
                    impact.impactedProducts.every(
                      (productId: mongoose.Types.ObjectId) =>
                        mongoose.isValidObjectId(productId)
                    );

                  return (
                    typeof impact === "object" &&
                    arePrimitiveValuesValid &&
                    areImpactedProductsValid
                  );
                }
              ) &&
              // @ts-ignore
              typeof obj.energyCost === "number" &&
              // @ts-ignore
              typeof obj.financialCost === "number"
          )
        );
      },
      message:
        "impact must be a record of { paramCode, value, impactedProducts: [ObjectId(productId)] } objects keyed by year",
    },
  },
});

// Define the Event interface
export type EventInterface = {
  _id: mongoose.Types.ObjectId;
  simulationTypeId: mongoose.Types.ObjectId;
  eventName: string;
  question: string;
  imgUrl?: string;
  choices: Array<ChoiceInterface>;
};

// Event Schema
const eventSchema = new mongoose.Schema<EventInterface>({
  simulationTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "SimulationType",
  },
  imgUrl: {
    type: String,
    required: false,
    // default:
    //   "https://peach-scarlet-83.tiiny.site/ab616cd21b4d97e758887ba34f981ec8f82ad693.jpg",
  },
  eventName: { type: String, required: true, unique: true },
  question: { type: String, required: true },
  choices: { type: [ChoiceSchema], required: true },
});

eventSchema.virtual("simulationType", {
  ref: "SimulationType",
  localField: "simulationTypeId",
  foreignField: "_id",
  justOne: true,
});

eventSchema.set("toJSON", { virtuals: true });
eventSchema.set("toObject", { virtuals: true });

// Create the Event model
const Event = mongoose.model("Event", eventSchema, "events");

export default Event;
