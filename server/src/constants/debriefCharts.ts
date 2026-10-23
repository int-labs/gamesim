/**
 * The debrief's chart SLOTS — what a slide can contain, and the only place
 * their order and grouping is decided.
 *
 * ⚠ A SLOT IS NOT A SLIDE. This table is shape alone; a chart resolves only
 * once a description is appended to it, which happens per round in the
 * controller by joining `RoundNote.chartId`. Nothing here is ever served as-is.
 *
 * PRESENTATION ONLY. No figure is keyed by any of this; `debriefSeries` emits
 * the numbers and never consults this table.
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
