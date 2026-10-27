/**
 * ⚠ RETIRED — REFERENCE ONLY. NOTHING IMPORTS THIS FILE.
 *
 * Charts are rows in `models/debriefChart.ts` now, owned by a simulationTypeId
 * and drawn by a shape from `models/debriefChartStyle.ts`. A type with no rows
 * has an empty debrief, which is the starting state rather than a failure.
 *
 * Kept because the fifteen entries below document the slide as it was built —
 * the groups, the order, and which charts existed — which is the seed an
 * operator configuring a type for the first time would otherwise reconstruct
 * from the player's JSX. Delete it once a type has been configured end to end.
 *
 * ── WHAT THE OLD SHAPE SAID, and what replaced it ───────────────────────────
 * `name` was the stable join key because a hardcoded array had no `_id` to
 * point at. It does now: `RoundNote.chartId` is a `DebriefChart._id`, so a
 * chart's `name` is display and free to be reworded.
 *
 * `id` was the sort ordinal. That is `order` on the document, and the gallery
 * has no ordinal at all.
 *
 * ── THE THREE FIELDS THAT WERE ONE ──────────────────────────────────────────
 * `id` used to be the name too, which tied reordering to identity. Split:
 *
 *   id        sort ordinal, renumber freely
 *   category  grouping, join a group by matching it
 *   name      THE STABLE JOIN KEY — never change one that has a note
 *   label     display, reword freely
 *
 * A `RoundNote.chartId` stores `name`. It deliberately does NOT store `id`: a
 * note against an ordinal would re-point itself the moment a slide is inserted
 * above it, which is the churn this split exists to remove.
 */

export interface DebriefChartSlot {
  /** Sort ordinal. SPACED BY 10 so a slide can be inserted between two without
   *  renumbering the rest. Unique across the catalogue, not per category. */
  id:       number;
  /** Grouping key. Mirrors the player slide's own authored groups. */
  category: string;
  /** The stable join key. Changing one orphans every note written against it. */
  name:     string;
  /** Display only. */
  label:    string;
}

/**
 * A slot once the round's copy has been joined onto it — THE WIRE SHAPE.
 *
 * `resolved` is the whole point of the split: a slot with no description is not
 * a slide, and the player hides it rather than drawing a chart nobody wrote a
 * reading for. It is a plain boolean rather than left to the client to infer
 * from `description == null`, so the rule lives in one place.
 */
export interface DebriefChart extends DebriefChartSlot {
  description: string | null;
  resolved:    boolean;
}

/**
 * Fifteen slots, in the order the player slide renders them.
 *
 * `voc` is one slot although the slide draws one chart PER NOTEBOOK — the
 * description explains what the chart means, which does not change per product.
 * Same reasoning splits the two profit breakdowns, which are one component
 * rendered twice and do need separate descriptions.
 */
// ⚠ MODULE-LEVEL ARRAY, and `.sort()` mutates in place — a consumer sorting
// this directly reorders it for every other reader on the server. Sort a copy:
// `[...DEBRIEF_CHARTS].sort((a, b) => a.id - b.id)`. The player and the console
// each get their own array off the wire, so it only bites here.
export const DEBRIEF_CHARTS: DebriefChartSlot[] = [
  { id:  10, category: "effort",   name: "totalEnergy",           label: "Total energy consumption" },

  { id:  20, category: "revenue",  name: "totalRevenue",          label: "Total revenue" },
  { id:  30, category: "revenue",  name: "revenueByNotebook",     label: "Revenue by notebook" },
  { id:  40, category: "revenue",  name: "productScore",          label: "Product score by notebook" },

  { id:  50, category: "profit",   name: "grossProfit",           label: "Total profit" },
  { id:  60, category: "profit",   name: "grossProfitByNotebook", label: "Gross profit by notebook" },
  { id:  70, category: "profit",   name: "netProfit",             label: "Total net profit" },
  { id:  80, category: "profit",   name: "netProfitByNotebook",   label: "Net profit by notebook" },

  { id:  90, category: "cost",     name: "totalCost",             label: "Total cost" },

  { id: 100, category: "capacity", name: "unitsVsDemand",         label: "Units sold vs demand" },
  { id: 110, category: "capacity", name: "priceVsUnits",          label: "Price vs units sold" },

  { id: 120, category: "tno",      name: "moneyAllocation",       label: "Money allocation" },
  { id: 130, category: "tno",      name: "energyAllocation",      label: "Energy allocation" },

  { id: 140, category: "voc",      name: "voc",                   label: "Voice of customer" },

  { id: 150, category: "trend",    name: "acrossRounds",          label: "Across rounds" },
];
