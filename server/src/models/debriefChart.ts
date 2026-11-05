import mongoose, { Document, Schema, Types } from "mongoose";

/** One chart on a type's debrief slide. Owned by the TYPE, not the simulation. */

export interface DebriefChartInterface extends Document {
  simulationTypeId: Types.ObjectId;
  /** What this chart is called on this sim's slide. SAFE TO RENAME, a
   *  description points at `_id`, so nothing is keyed by this. */
  name: string;
  /** Where on the slide it renders, the slide group, not the chart family. */
  category: string;
  /** Position within the slide. */
  order: number;
  /** `overall` draws one chart; `each` draws one per notebook, with no summary. */
  scope: "overall" | "each";
  /** Which gallery shape draws it. An ObjectId, not the style's name, so
   *  renaming a gallery entry costs nothing here. */
  chartStyle: Types.ObjectId | null;
  /** The escape hatch: a chart the player client draws itself. `chartStyle` and the bindings are then ignored. */
  clientChart: string | null;
  /** The bindings. Nullable BY DESIGN, see the note above. */
  xAxis: string | null;
  /** !important one chart may plot several measures; the series is then the measure. */
  yAxis: string[];
  grouping: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const debriefChartSchema = new Schema<DebriefChartInterface>(
  {
    simulationTypeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "SimulationType",
      index: true,
    },
    name:     { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, default: "", trim: true, maxlength: 64 },
    order:    { type: Number, required: true, default: 0 },
    scope:    { type: String, enum: ["overall", "each"], default: "overall" },

    chartStyle: {
      type: Schema.Types.ObjectId,
      ref: "DebriefChartStyle",
      default: null,
    },

    clientChart: { type: String, default: null, trim: true, maxlength: 40 },

    xAxis:    { type: String, default: null, trim: true, maxlength: 64 },
    // No `default: null`, an array path defaults to [], and a null here would
    // have to be unwrapped by every reader on top of the string case.
    yAxis:    { type: [String], default: undefined },
    grouping: { type: String, default: null, trim: true, maxlength: 64 },
  },
  { timestamps: true }
);

// Read as a slide: every chart for a type, in render order.
debriefChartSchema.index({ simulationTypeId: 1, order: 1 });

export default mongoose.model<DebriefChartInterface>(
  "DebriefChart",
  debriefChartSchema,
  "debriefCharts"
);
