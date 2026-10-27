import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * One chart on a simulation type's debrief slide — the CONFIGURATION layer.
 *
 * OWNED BY THE TYPE, NOT THE SIMULATION: one `simulationTypeId` has one set of
 * charts, shared by every simulation under it. `GET /round-debrief` derives the
 * type from `simulationId` and reads this collection with it.
 *
 * A type with NO rows here has an empty debrief. That is the starting state of
 * a type nobody has configured, not a migration event.
 *
 * ⚠ TWO NAMESPACES, SAME TWO WORDS. `category` and `name` here are the SLIDE's
 * — where this renders and what it is called in this sim. The gallery's
 * (`DebriefChartStyle`) are the chart's FAMILY and VARIANT. See that file.
 *
 * ⚠ AN INCOMPLETE CONFIG IS NOT AN ERROR. The axes and `grouping` are optional
 * and a half-configured chart still renders with whatever it holds. The only
 * thing that hides a chart is a missing description — a `RoundNote` whose
 * `chartId` is this document's `_id`.
 */

export interface DebriefChartInterface extends Document {
  simulationTypeId: Types.ObjectId;
  /** What this chart is called on this sim's slide. SAFE TO RENAME — a
   *  description points at `_id`, so nothing is keyed by this. */
  name: string;
  /** Where on the slide it renders — the slide group, not the chart family. */
  category: string;
  /** Position within the slide. */
  order: number;
  /**
   * `overall` draws one chart for the whole set. `each` draws ONE PER NOTEBOOK
   * PLUS an all-notebooks summary — N + 1 instances from this one row.
   *
   * Each instance carries its own description, strictly: a per-notebook chart
   * does NOT fall back to the summary's copy, so an unwritten one is hidden
   * while its siblings show.
   */
  scope: "overall" | "each";
  /** Which gallery shape draws it. An ObjectId, not the style's name, so
   *  renaming a gallery entry costs nothing here. */
  chartStyle: Types.ObjectId | null;
  /** The bindings. Nullable BY DESIGN — see the note above. */
  xAxis: string | null;
  yAxis: string | null;
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

    xAxis:    { type: String, default: null, trim: true, maxlength: 64 },
    yAxis:    { type: String, default: null, trim: true, maxlength: 64 },
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
