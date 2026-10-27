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
  /**
   * THE ESCAPE HATCH: a chart the PLAYER CLIENT draws itself.
   *
   * Set, and the server renders nothing — `chartStyle` and the bindings are
   * ignored and `svg` comes out null. The slide looks the key up among its own
   * components and draws it.
   *
   * ⚠ IT IS NOT A LOOPHOLE FOR CHARTS THAT ARE MERELY AWKWARD. A configured
   * chart binds to figures the server has already derived. This exists for the
   * one case where the chart's CONTENT IS a derivation that only this
   * simulation has — the VoC plot, whose weights come out of
   * `diminishingReturnsFactor`, a calculation layer that means something
   * different in the next sim. Binding it would mean the server owning a
   * formula that cannot be generalised.
   *
   * Everything else about the row still applies: order, slide group, name,
   * scope, and the description that decides whether players see it at all.
   *
   * ⚠ `order` DOES NOT PLACE IT. The slide draws client-drawn segments first,
   * whatever they are numbered — owner's rule, see `toSegments` in the player's
   * LimboScreen.
   */
  clientChart: string | null;
  /** The bindings. Nullable BY DESIGN — see the note above. */
  xAxis: string | null;
  /**
   * The measures plotted — ONE CHART MAY DRAW SEVERAL.
   *
   * "Units sold vs customers obtained" is two measures on one scale, not two
   * charts; so is a cash walk. With more than one bound, the series is the
   * MEASURE rather than a team or a notebook — `measure` is a categorical the
   * registry offers, and the row builder falls back to it rather than drawing
   * two measures on top of each other.
   *
   * ⚠ WAS A SINGLE STRING until 2026-10-27, and documents written before that
   * still hold one. Everything that reads this goes through `toMeasures()` in
   * `services/debriefChartData.ts`; never index it directly.
   */
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
    // No `default: null` — an array path defaults to [], and a null here would
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
