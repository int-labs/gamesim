/**
 * ONE-TIME: turn the hardcoded debrief slide into `DebriefChart` rows.
 *
 *   npm run import-debrief-charts -- <simulationTypeId>
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The slide was fifteen hardcoded slots in `constants/debriefCharts.ts`, drawn
 * by hardcoded JSX in both clients. Those charts WORK and are the current sim's
 * source of truth for what a debrief says — but nothing can edit, reorder or
 * remove them, because they are code. This writes them into the database once
 * so they become ordinary configured charts.
 *
 * IDEMPOTENT by `{simulationTypeId, name}`: run it twice and the second run
 * updates in place rather than duplicating the slide. It never deletes, so a
 * chart the operator has since edited is overwritten only in the fields below —
 * which is why it prints what it changed.
 *
 * ── WHAT IT CANNOT CARRY ACROSS ─────────────────────────────────────────────
 * Three of the fifteen are not expressible as one `{x, y, series}` binding and
 * are SKIPPED rather than approximated:
 *
 *   unitsVsDemand  two measures on one chart (customers obtained AND units
 *                  sold). A chart has one `yAxis`.
 *   priceVsUnits   a scatter: both axes quantitative. `x` is a label.
 *   voc            needs the 0..1 weight normalisation that lives in the player
 *                  client as the single definition shared with its market tab.
 *
 * They stay unconfigured, and the debrief is poorer by exactly those three
 * until the row builder can express them.
 */

import connectToDatabase from "../src/db/db";
import DebriefChart from "../src/models/debriefChart";
import DebriefChartStyle from "../src/models/debriefChartStyle";

/** The gallery ids `scripts/seed.ts` installs. Looked up by `{category, name}`
 *  rather than hardcoded here, so a hand-authored gallery still resolves. */
const SHAPES = {
  groupedBar:  { category: "bar chart",  name: "Grouped bar" },
  stackedBar:  { category: "bar chart",  name: "Stacked bar" },
  line:        { category: "line chart", name: "Line with points" },
} as const;

interface LegacyChart {
  order:    number;
  category: string;
  /** The old catalogue's stable key — kept as the chart's name so a RoundNote
   *  written before the move can still be recognised by a human reading it. */
  name:     string;
  scope:    "overall" | "each";
  shape:    keyof typeof SHAPES;
  xAxis:    string | null;
  yAxis:    string;
  grouping: string | null;
}

/**
 * The twelve that survive, with the bindings that reproduce what the hardcoded
 * JSX drew. `order` and `category` are the old catalogue's, so the slide comes
 * out in the sequence the operator's story was written in.
 */
const LEGACY: LegacyChart[] = [
  { order:  10, category: "effort", name: "Total energy consumption",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "energy", grouping: "team" },

  { order:  20, category: "revenue", name: "Total revenue",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "revenue", grouping: "team" },
  { order:  30, category: "revenue", name: "Revenue by notebook",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "byProduct.revenue", grouping: "product" },
  // ⚠ `dynamicPrice`, not `productScore`. The player showed dynamicPrice under
  // the words "product score"; the 0..1 `productScore` is a different number.
  { order:  40, category: "revenue", name: "Product score by notebook",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "byProduct.dynamicPrice", grouping: "product" },

  { order:  50, category: "profit", name: "Total profit",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "grossProfit", grouping: "team" },
  { order:  60, category: "profit", name: "Gross profit by notebook",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "byProduct.grossProfit", grouping: "product" },
  { order:  70, category: "profit", name: "Total net profit",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "netProfit", grouping: "team" },
  { order:  80, category: "profit", name: "Net profit by notebook",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "byProduct.netProfit", grouping: "product" },

  // The old chart was COGS + operating expenses added together. A chart has one
  // measure, so this is COGS and the opex half is its own row below — which is
  // arguably the better reading anyway, since the two sit on opposite sides of
  // the gross profit line.
  { order:  90, category: "cost", name: "Cost of goods sold",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "cogs", grouping: "team" },
  { order:  95, category: "cost", name: "Operating expenses",
    scope: "overall", shape: "groupedBar", xAxis: "team", yAxis: "operatingExpenses", grouping: "team" },

  // ⚠ THE SUFFIX IS A PLACEHOLDER. `lever` on an axis pivots the measure, so
  // the key after the dot is only what the field would mean with nothing
  // pivoting on it. See `measure()` in services/debriefChartData.ts.
  { order: 120, category: "tno", name: "Money allocation",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "costByCategory.*", grouping: "lever" },
  { order: 130, category: "tno", name: "Energy allocation",
    scope: "overall", shape: "stackedBar", xAxis: "team", yAxis: "energyByLever.*", grouping: "lever" },

  { order: 150, category: "trend", name: "Revenue across rounds",
    scope: "overall", shape: "line", xAxis: "round", yAxis: "revenue", grouping: "team" },
  { order: 160, category: "trend", name: "Gross profit across rounds",
    scope: "overall", shape: "line", xAxis: "round", yAxis: "grossProfit", grouping: "team" },
  { order: 170, category: "trend", name: "Net profit across rounds",
    scope: "overall", shape: "line", xAxis: "round", yAxis: "netProfit", grouping: "team" },
];

async function run(): Promise<void> {
  const simulationTypeId = process.argv[2];
  if (!simulationTypeId || !/^[0-9a-f]{24}$/i.test(simulationTypeId)) {
    console.error("Usage: npm run import-debrief-charts -- <simulationTypeId>");
    process.exit(1);
  }

  const db = await connectToDatabase();

  try {
    // Resolved by {category, name} so the import works against a gallery
    // somebody authored by hand, not only the seeded one.
    const styles = await DebriefChartStyle.find({}).lean();
    const shapeId = (k: keyof typeof SHAPES): string | null => {
      const want = SHAPES[k];
      const hit = styles.find(
        (s) => s.category === want.category && s.name === want.name,
      );
      return hit ? String(hit._id) : null;
    };

    const missing = (Object.keys(SHAPES) as (keyof typeof SHAPES)[])
      .filter((k) => !shapeId(k));
    if (missing.length) {
      // Refuses rather than writing charts with no shape: a chart with a null
      // chartStyle renders nothing, and a slide full of those looks like the
      // import worked.
      console.error(
        `❌ The gallery is missing ${missing.map((k) => `"${SHAPES[k].category} / ${SHAPES[k].name}"`).join(", ")}.\n` +
        "   Run `npm run seed-db` first.",
      );
      process.exit(1);
    }

    let added = 0;
    let changed = 0;

    for (const c of LEGACY) {
      const res = await DebriefChart.updateOne(
        { simulationTypeId, name: c.name },
        {
          $set: {
            category:   c.category,
            order:      c.order,
            scope:      c.scope,
            chartStyle: shapeId(c.shape),
            xAxis:      c.xAxis,
            yAxis:      c.yAxis,
            grouping:   c.grouping,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) { added++; console.log(`  + ${c.name}`); }
      else if (res.modifiedCount) { changed++; console.log(`  ~ ${c.name}`); }
    }

    console.log(
      `\n✅ ${added} added, ${changed} updated, ` +
      `${LEGACY.length - added - changed} already current.`,
    );
    console.log(
      "⚠ Not imported — not expressible as one {x, y, series} binding:\n" +
      "   unitsVsDemand (two measures), priceVsUnits (scatter), voc (needs the\n" +
      "   player's weight normalisation).",
    );
    console.log(
      "\nEvery chart is HIDDEN from players until a description is written for\n" +
      "it, per round, on the Round Debrief page.",
    );
  } finally {
    await db.close();
  }
}

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
