/** Seed the chart gallery: `npm run seed-db`. Idempotent on fixed ids, deletes nothing. */

import connectToDatabase from "../src/db/db";
import DebriefChartStyle from "../src/models/debriefChartStyle";
import { renderChartToSvg } from "../src/services/chartRenderer";

/** Mirrors `notebook-pixel-sim/src/components/charts/chartTheme`. */
const INK = { frame: "#2a2017", grid: "#bfae90", label: "#5a4a37" };

const SERIES = [
  "#4C72B0", "#DD8452", "#55A868", "#C44E52",
  "#9B59B6", "#8C8C8C", "#CCB974", "#64B5CD",
];

const FONT = "Pixelify Sans, ui-monospace, monospace";

const CONFIG = {
  // Transparent: the panel behind it is the sheet's paper.
  background: null,
  view: { stroke: null },
  axis: {
    labelFont: FONT, titleFont: FONT,
    labelColor: INK.label, titleColor: INK.label,
    labelFontSize: 13, titleFontSize: 14,
    domainColor: INK.frame, tickColor: INK.frame,
    gridColor: INK.grid, gridOpacity: 0.7,
  },
  legend: {
    labelFont: FONT, titleFont: FONT,
    labelColor: INK.label, titleColor: INK.label,
    labelFontSize: 13, titleFontSize: 13,
  },
  range: { category: SERIES },
};

/** !important `sort: null` means data order; without it a nominal domain sorts alphabetically. */
const cat = (field: string, extra: object = {}) =>
  ({ field, type: "nominal", sort: null, ...extra });

const qty = (extra: object = {}) =>
  ({ field: "y", type: "quantitative", ...extra });

const SERIES_ENC = { field: "series", type: "nominal", title: null };

const BASE = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  width: 720,
  height: 360,
  // THE BINDING. `@rows` is resolved by `chartRenderer` from what
  // `buildChartRows` emitted; nothing in a spec is ever evaluated.
  data: { values: "@rows" },
  config: CONFIG,
};

const BAR = { type: "bar", stroke: INK.frame, strokeWidth: 1 };

/** Every shape the gallery ships with, all drawable from `{x, y, series}`. */
export const STYLES: { _id: string; category: string; name: string; spec: object }[] = [
  {
    _id: "a11ca11c0000000000000001",
    category: "bar chart",
    name: "Grouped bar",
    spec: {
      ...BASE,
      mark: BAR,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        xOffset: cat("series"),
        y: qty(),
        color: SERIES_ENC,
      },
    },
  },
  {
    _id: "a11ca11c0000000000000002",
    category: "bar chart",
    name: "Stacked bar",
    spec: {
      ...BASE,
      mark: BAR,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        // !important `stack` is an encoding property; `transform` is denied by `assertSafeSpec`.
        y: qty({ stack: "zero" }),
        color: SERIES_ENC,
      },
    },
  },
  {
    _id: "a11ca11c0000000000000003",
    category: "bar chart",
    name: "Horizontal bar",
    spec: {
      ...BASE,
      mark: BAR,
      encoding: {
        y: cat("x"),
        yOffset: cat("series"),
        x: { field: "y", type: "quantitative" },
        color: SERIES_ENC,
      },
    },
  },
  {
    _id: "a11ca11c0000000000000004",
    category: "line chart",
    name: "Line with points",
    spec: {
      ...BASE,
      mark: {
        type: "line",
        strokeWidth: 2,
        point: { filled: true, size: 70, stroke: INK.frame, strokeWidth: 1 },
      },
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        y: qty(),
        color: SERIES_ENC,
      },
    },
  },
  {
    _id: "a11ca11c0000000000000006",
    category: "2D chart",
    name: "Scatter",
    spec: {
      ...BASE,
      mark: { type: "point", filled: true, size: 110, stroke: INK.frame, strokeWidth: 1 },
      encoding: {
        // !important the only shape with a quantitative x; bind x to a measure, never a categorical.
        x: { field: "x", type: "quantitative", scale: { zero: false } },
        y: qty({ scale: { zero: false } }),
        color: SERIES_ENC,
      },
    },
  },
  {
    _id: "a11ca11c0000000000000005",
    category: "area chart",
    name: "Stacked area",
    spec: {
      ...BASE,
      mark: { type: "area", line: true, opacity: 0.85 },
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        y: qty({ stack: "zero" }),
        color: SERIES_ENC,
      },
    },
  },
];

/** A scatter's rows: x is a MEASURE, so it arrives as a number. One point per
 *  team per notebook, which is what `priceVsUnits` draws. */
const SCATTER_ROWS = [
  { x: 420, y: 18.5, series: "Studio A" },
  { x: 260, y: 24.0, series: "Studio A" },
  { x: 310, y: 21.0, series: "Studio B" },
  { x: 180, y: 27.5, series: "Studio B" },
];

/** What `buildChartRows` actually emits, including a gap, a team that did not
 *  play a round is null, never zero. */
const SAMPLE_ROWS = [
  { x: "Round 1", y: 4200, series: "Studio A" },
  { x: "Round 1", y: 3100, series: "Studio B" },
  { x: "Round 2", y: 5600, series: "Studio A" },
  { x: "Round 2", y: 4800, series: "Studio B" },
  { x: "Round 3", y: 6100, series: "Studio A" },
  { x: "Round 3", y: null, series: "Studio B" },
];

/** Draw every shape before writing any: an unrenderable row is worse than a missing one. */
export async function verify(): Promise<void> {
  for (const s of STYLES) {
    // A shape's x encoding decides which sample it can draw: labels on a
    // quantitative scale all resolve to NaN and the chart comes out empty.
    const xType = (s.spec as any)?.encoding?.x?.type;
    const rows = xType === "quantitative" ? SCATTER_ROWS : SAMPLE_ROWS;

    const svg = await renderChartToSvg({ spec: s.spec, datasets: { rows } });
    // Furniture alone means the encoding never bound to the rows.
    const marks = svg.match(/<(path|rect|line|circle|symbol)\b/g)?.length ?? 0;
    if (marks <= 6) {
      throw new Error(
        `"${s.category} / ${s.name}" drew ${marks} marks — its encoding does not bind to {x, y, series}.`,
      );
    }
  }
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    // The repo's standing rule: production data is added through the Admin UI,
    // never by a script. The gallery has its own page for exactly that.
    console.log("🚨 Seeding in production mode is not allowed.");
    process.exit(1);
  }

  // BEFORE the connection, so a broken spec costs nothing and touches nothing.
  await verify();
  console.log(`✅ ${STYLES.length} shapes render.`);

  const db = await connectToDatabase();

  try {
    let inserted = 0;
    let updated = 0;

    for (const s of STYLES) {
      const shape = JSON.stringify(s.spec);
      const res = await DebriefChartStyle.updateOne(
        { _id: s._id },
        {
          $set: { name: s.name, category: s.category, shape },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      if (res.upsertedCount) inserted++;
      else if (res.modifiedCount) updated++;
    }

    // The `{category, name}` index only exists in Mongo once something builds it.
    await DebriefChartStyle.syncIndexes();

    const total = await DebriefChartStyle.countDocuments();
    console.log(
      `✅ Chart gallery: ${inserted} added, ${updated} updated, ` +
      `${STYLES.length - inserted - updated} already current. ${total} shapes in all.`,
    );
  } finally {
    await db.close();
  }
}

// Only when RUN, not when imported: `STYLES` and `verify` are worth reading
// from a probe, and a module that connects to Mongo on import cannot be.
if (require.main === module) {
  seed().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}
