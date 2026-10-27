import mongoose, { Document, Schema } from "mongoose";

/**
 * THE CHART GALLERY — every chart shape the app can draw, as data.
 *
 * GLOBAL, not per simulation type: a shape is the same wherever it is used, and
 * a sim picks from this one list. Adding a chart is a row here rather than a
 * frontend deploy, which is the whole reason the shape lives in the database.
 *
 * ⚠ ITS NAMESPACE IS NOT THE SLIDE'S. `category` here is the chart FAMILY
 * ("bar chart", "line chart") and `name` is the variant ("Stacked Bar",
 * "Cluster"). The per-sim `DebriefChart` has fields of the same two names
 * meaning where on the slide it renders and what it is called there — different
 * axes entirely, and conflating them is the easy mistake.
 *
 * No `order`. The gallery is shown whole and unsorted; ordering is a property
 * of a sim's slide, not of the catalogue.
 */

export interface DebriefChartStyleInterface extends Document {
  /** The variant — "Stacked Bar chart", "Cluster chart", "Volume chart". */
  name: string;
  /** The family — "2D chart", "line chart", "bar chart". */
  category: string;
  /**
   * The renderable shape the player applies.
   *
   * ⚠ SANITISED AT THE CONSOLE, never at render — the same boundary rule as
   * `products.segments`. It needs its OWN sanitiser, not `sanitizeSegmentsHtml`:
   * that one strips `href`/`xlink:href` and any `style` carrying `url(`, which
   * are ordinary SVG (`<use>`, gradients, markers), not links.
   */
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
