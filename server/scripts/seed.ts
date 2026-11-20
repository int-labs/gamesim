/** Seed the chart gallery: `npm run seed-db`. Idempotent on fixed ids, deletes nothing. */

import connectToDatabase from "../src/db/db";
import DebriefChartStyle from "../src/models/debriefChartStyle";
import { renderChartToSvg } from "../src/services/chartRenderer";

/** Mirrors `notebook-pixel-sim/src/components/charts/chartTheme`. */
const INK = { frame: "#2a2017", grid: "#bfae90", label: "#5a4a37" };

const SERIES = [
  "#2e2d7e", "#f9137d", "#fee606", "#ff7a00",
  "#00d26a", "#9d2bff", "#00c2ff", "#3d5afe",
];

/** The label ink inside each series' bar, index for index with `SERIES`: black on the light fills, white on the dark. */
const LABEL_INK = [
  "#ffffff", "#ffffff", "#000000", "#000000",
  "#000000", "#ffffff", "#000000", "#ffffff",
];

// The admin preview's font, so the slide and the slide creator read the same.
const FONT = "ui-monospace, monospace";

const CONFIG = {
  // Transparent: the panel behind it is the sheet's paper.
  background: null,
  view: { stroke: null },
  axis: {
    labelFont: FONT, titleFont: FONT,
    labelColor: INK.label, titleColor: INK.label,
    labelFontSize: 16, titleFontSize: 16,
    domainColor: INK.frame, tickColor: INK.frame,
    gridColor: INK.grid, gridOpacity: 0.7,
  },
  // Below the plot, entries side by side in one row, never truncated.
  legend: {
    labelFont: FONT, titleFont: FONT,
    labelColor: INK.label, titleColor: INK.label,
    labelFontSize: 16, titleFontSize: 16,
    orient: "bottom", direction: "horizontal", columnPadding: 16, labelLimit: 0,
  },
  title: { font: FONT, color: INK.label, fontSize: 20 },
  range: { category: SERIES },
};

/** !important `sort: null` means data order; without it a nominal domain sorts alphabetically. */
const cat = (field: string, extra: object = {}) =>
  ({ field, type: "nominal", sort: null, ...extra });

const qty = (extra: object = {}) =>
  ({ field: "y", type: "quantitative", ...extra });

/** !important set per encoding: vega-lite derives the symbol from the mark and ignores `config.legend.symbolType`. */
const SQUARE_KEY = { symbolType: "square" };

const SERIES_ENC = { field: "series", type: "nominal", title: null, legend: SQUARE_KEY };

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

const WHITE = "#ffffff";

/** A value label's text: one format for every measure, since a shape cannot know what it plots. */
const VALUE = (field = "y") => ({ field, type: "quantitative", format: ",.2~f" });

/** !important a constant colour overrides the series colour, or each label takes its own bar's colour and vanishes. */
const label = (mark: object, encoding: object = {}) => ({
  mark: { type: "text", font: FONT, fontSize: 16, ...mark },
  encoding: { text: VALUE(), ...encoding },
});

/** White, just inside the top of a vertical bar. */
const INSIDE_TOP = { baseline: "top", dy: 4 };

/** Dark ink, just above a point. */
const ABOVE_POINT = { baseline: "bottom", dy: -8 };

/** !important the bars' own colour FIELD, so labels stack in the bars' order; a separate one-colour scale paints them. */
const STACK_LABEL = (ink: string) => ({
  color: { ...SERIES_ENC, legend: null, scale: { range: [ink] } },
});

/** !important same field and sort as the bars, so each label takes its own bar's `LABEL_INK` entry. */
const INSIDE_LABEL = {
  color: { ...SERIES_ENC, legend: null, scale: { range: LABEL_INK } },
};

/** Keeps a label's own colour scale from merging with the bars' palette. */
const OWN_LABEL_SCALE = { resolve: { scale: { color: "independent" } } };

/** Every shape the gallery ships with; all bind `@rows` (`{x, y, series}`) except the two combos, which bind `@combo`. */
export const STYLES: { _id: string; category: string; name: string; spec: object }[] = [
  {
    _id: "a11ca11c0000000000000001",
    category: "bar chart",
    name: "Grouped bar",
    spec: {
      ...BASE,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        xOffset: cat("series"),
        y: qty(),
        color: SERIES_ENC,
      },
      layer: [
        { mark: BAR },
        label(INSIDE_TOP, INSIDE_LABEL),
      ],
      ...OWN_LABEL_SCALE,
    },
  },
  {
    _id: "a11ca11c0000000000000002",
    category: "bar chart",
    name: "Stacked bar",
    spec: {
      ...BASE,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        // !important `stack` is an encoding property; `transform` is denied by `assertSafeSpec`.
        y: qty({ stack: "zero" }),
        color: SERIES_ENC,
      },
      layer: [
        { mark: BAR },
        label(INSIDE_TOP, INSIDE_LABEL),
      ],
      ...OWN_LABEL_SCALE,
    },
  },
  {
    _id: "a11ca11c0000000000000003",
    category: "bar chart",
    name: "Horizontal bar",
    spec: {
      ...BASE,
      encoding: {
        y: cat("x"),
        yOffset: cat("series"),
        x: { field: "y", type: "quantitative" },
        color: SERIES_ENC,
      },
      layer: [
        { mark: BAR },
        // Inside the bar's right end, the horizontal equivalent of inside-top.
        label({ align: "right", baseline: "middle", dx: -4 }, INSIDE_LABEL),
      ],
      ...OWN_LABEL_SCALE,
    },
  },
  {
    _id: "a11ca11c0000000000000004",
    category: "line chart",
    name: "Line with points",
    spec: {
      ...BASE,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        y: qty(),
        color: SERIES_ENC,
      },
      layer: [
        {
          mark: {
            type: "line",
            strokeWidth: 2,
            point: { filled: true, size: 70, stroke: INK.frame, strokeWidth: 1 },
          },
        },
        label(ABOVE_POINT, { color: { value: INK.frame } }),
      ],
    },
  },
  {
    _id: "a11ca11c0000000000000006",
    category: "2D chart",
    name: "Scatter",
    spec: {
      ...BASE,
      encoding: {
        // !important the only shape with a quantitative x; bind x to a measure, never a categorical.
        x: { field: "x", type: "quantitative", scale: { zero: false } },
        y: qty({ scale: { zero: false } }),
        color: SERIES_ENC,
      },
      layer: [
        {
          mark: { type: "point", filled: true, stroke: INK.frame, strokeWidth: 1 },
          // !important zero kept, so the area is 110 x the row's `size` multiplier.
          encoding: {
            size: { field: "size", type: "quantitative", legend: null,
                    scale: { type: "linear", domain: [0, 1], range: [0, 110] } },
          },
        },
        // No value labels: points that sit close together would overlap theirs.
      ],
    },
  },
  {
    _id: "a11ca11c0000000000000005",
    category: "area chart",
    name: "Stacked area",
    spec: {
      ...BASE,
      encoding: {
        x: cat("x", { axis: { labelAngle: 0 } }),
        y: qty({ stack: "zero" }),
        color: SERIES_ENC,
      },
      layer: [
        { mark: { type: "area", line: true, opacity: 0.85 } },
        // Above each band's top edge, showing that band's own value.
        label(ABOVE_POINT, STACK_LABEL(INK.frame)),
      ],
      ...OWN_LABEL_SCALE,
    },
  },
  {
    _id: "a11ca11c0000000000000007",
    category: "bar chart",
    name: "Stacked bar with total",
    spec: {
      ...BASE,
      encoding: { x: cat("x", { axis: { labelAngle: 0 } }) },
      layer: [
        { mark: BAR, encoding: { y: qty({ stack: "zero" }), color: SERIES_ENC } },
        // !important `bandPosition: 0.5` centres each label in its own segment.
        label(
          { baseline: "middle" },
          { y: qty({ stack: "zero", bandPosition: 0.5 }), ...INSIDE_LABEL },
        ),
        // !important no `color` here, so `sum` runs over the whole column; a negative pixel y puts it above the plot frame.
        label(
          { baseline: "bottom", fontSize: 16, color: INK.label },
          {
            y: { value: -10 },
            text: { aggregate: "sum", field: "y", type: "quantitative", format: ",.2~f" },
          },
        ),
      ],
      ...OWN_LABEL_SCALE,
    },
  },
  {
    _id: "a11ca11c0000000000000008",
    category: "combo chart",
    name: "Bar with target and ratio",
    // One bar, marker and ratio centred on each x; grouping is ignored.
    spec: COMBO_SPEC(false),
  },
  {
    _id: "a11ca11c0000000000000009",
    category: "combo chart",
    name: "Grouped bar with target and ratio",
    // One sub-column per series under each x, e.g. x = round, grouping = team.
    spec: COMBO_SPEC(true),
  },
];

/** The combo's spec; `grouped` gives each series its own sub-column under x. */
function COMBO_SPEC(grouped: boolean): object {
  return {
      ...BASE,
      // !important one row per x and series from `toComboRows`: y = yAxis[0], marker = yAxis[1], ratio = y / marker.
      data: { values: "@combo" },
      // `xOffset` puts each series in its own sub-column, so bar, labels, marker and ratio line up per series.
      encoding: grouped
        ? { x: cat("x", { axis: { labelAngle: 0 } }), xOffset: cat("series") }
        : { x: cat("x", { axis: { labelAngle: 0 } }) },
      layer: [
        // `sort: null` keeps the bar on the first colour and the marker on the second.
        { mark: BAR, encoding: { y: qty(), color: { field: "barName", type: "nominal", title: null, sort: null, legend: SQUARE_KEY } } },
        // !important stacking one value from zero plus bandPosition 0.5 centres the label without `transform`.
        label({ baseline: "middle" }, { y: qty({ stack: "zero", bandPosition: 0.5 }), color: { value: WHITE } }),
        {
          mark: { type: "tick", thickness: 3, stroke: INK.frame },
          encoding: {
            y: { field: "marker", type: "quantitative", title: null },
            color: { field: "markerName", type: "nominal", title: null, sort: null, legend: SQUARE_KEY },
          },
        },
        label(
          { ...ABOVE_POINT, dy: -6, color: INK.frame },
          { y: { field: "marker", type: "quantitative", title: null }, text: VALUE("marker") },
        ),
        // !important a negative pixel y draws the ratio above the plot frame, apart from the marker's own label.
        label(
          { baseline: "bottom", fontSize: 16, color: INK.label },
          {
            y: { value: -10 },
            // A predicate, not an expression: a missing ratio prints nothing instead of "null".
            text: {
              condition: { test: { field: "ratio", valid: true }, field: "ratio", type: "quantitative", format: ".1%" },
              value: "",
            },
            // !important a one-value opacity key, not colour: a colour key would repaint the ratio text in a palette colour.
            opacity: { datum: "ratio", type: "nominal", scale: { range: [1] }, legend: { ...SQUARE_KEY, title: null } },
          },
        ),
      ],
  };
}

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

/** What `toComboRows` emits: one row per x and series; a missing marker leaves no ratio. */
const COMBO_ROWS = [
  { x: "Round 1", series: "Studio A", y: 240, marker: 350, ratio: 240 / 350, barName: "Measure A", markerName: "Measure B" },
  { x: "Round 1", series: "Studio B", y: 230, marker: 340, ratio: 230 / 340, barName: "Measure A", markerName: "Measure B" },
  { x: "Round 2", series: "Studio A", y: 260, marker: 330, ratio: 260 / 330, barName: "Measure A", markerName: "Measure B" },
  { x: "Round 2", series: "Studio B", y: 120, marker: null, ratio: null, barName: "Measure A", markerName: "Measure B" },
];

/** Draw every shape before writing any: an unrenderable row is worse than a missing one. */
export async function verify(): Promise<void> {
  for (const s of STYLES) {
    // A shape's x encoding decides which sample it can draw: labels on a
    // quantitative scale all resolve to NaN and the chart comes out empty.
    const xType = (s.spec as any)?.encoding?.x?.type;
    const rows = xType === "quantitative" ? SCATTER_ROWS : SAMPLE_ROWS;

    const svg = await renderChartToSvg({ spec: s.spec, datasets: { rows, combo: COMBO_ROWS } });
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
