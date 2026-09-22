import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * How the competitor report's leaderboard is scored.
 *
 * ── WHY THIS IS A COLLECTION AND NOT A CONSTANT ─────────────────────────────
 * The weighting is the operator's, and it changes per cohort and per teaching
 * goal. It lived as a hand-edited block at the top of
 * `scripts/exportRoundData.mjs`, which meant changing it needed a developer and
 * a redeploy of nothing in particular.
 *
 * Keyed by `simulationTypeId`, the same way PlayerConfig, Product and
 * GlobalInput are, so a weighting belongs to a KIND of simulation rather than
 * to one run of it.
 *
 * ── THE SCORE ───────────────────────────────────────────────────────────────
 * Per metric, per round:
 *
 *     rank   — teams ordered by the metric's own `direction`; rank 1 is best,
 *              and TIES SHARE the better rank (1, 1, 3)
 *     points = weight × (N − rank + 1)
 *
 * `N` is the number of teams that have a figure for that metric — a team with
 * none is not ranked and scores nothing, which is different from scoring zero.
 *
 * `weight` values MUST SUM TO 100. The schema enforces it rather than letting a
 * report render points nobody can reconcile.
 */

/**
 * WHERE A METRIC'S VALUE COMES FROM.
 *
 * Both halves are configured HERE — the server owns the key set either way,
 * which is the whole point. What differs is who computes the number:
 *
 *   server — `calcFinancials` computes it and `roundCalculation` saves it on
 *            `Decision.scored`. `source` must be one of SERVER_SOURCES.
 *   client — the value only exists in the browser (the insight questions are
 *            answered there and nowhere else, so no server-side calculation
 *            could produce them). The client READS this config, sees which
 *            keys it owns, and reports RAW values for exactly those into
 *            `TeamRunReport.metrics`. `source` is a free key, declared here.
 *
 * The consequence to keep in view: a client metric is SELF-REPORTED. The server
 * stores what it is told. That is acceptable for insight answers, which have no
 * other origin, and is not acceptable for anything `calcFinancials` can compute
 * — configure those as `server` so they cannot be forged.
 */
export const METRIC_ORIGINS = ["server", "client"] as const;
export type MetricOrigin = (typeof METRIC_ORIGINS)[number];

/**
 * The `ProjectionMetrics` fields a `server` metric may rank on. These are
 * exactly the figures `roundCalculation` saves on `Decision.scored`.
 *
 * Enumerated rather than free-form: an operator typing a field name that no
 * longer exists would otherwise produce a silently empty column that looks like
 * a team scoring nothing.
 *
 * EVERY ONE IS ADDITIVE, and that is the entry requirement. A leaderboard
 * column is a TEAM, so a server metric is summed across that team's products
 * for the round — meaningful for money, customers and units, and meaningless
 * for anything else.
 *
 * `marketShare` is NOT here, by the owner's ruling 2026-09-22: *"this is why
 * marketShare will never be a winning metric"*. It is a ratio, per notebook,
 * per round — it cannot be summed across products, cannot be summed across
 * rounds, and every attempt to collapse it (sum, average, per-notebook blocks)
 * produced a figure the model does not contain. It stays in the report as a
 * read-only per-notebook row and is not rankable.
 */
export const SERVER_SOURCES = [
  "revenue",
  "COGS",
  "grossProfit",
  "operatingExpenses",
  "operatingProfit",
  "customersObtained",
  "unitsSold",
  "produced",
  "closingStock",
] as const;

export type ServerSource = (typeof SERVER_SOURCES)[number];

/** A client `source` is a free key, but it still has to be a KEY — no spaces,
 *  no dots, so it can be stored as a map field and read back by name. */
export const CLIENT_SOURCE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

export interface LeaderboardMetric {
  /** Stable id, so a rename of `label` does not orphan anything. */
  key:       string;
  /** What the report prints as the section name. The operator's to change. */
  label:     string;
  origin:    MetricOrigin;
  /** A SERVER_SOURCES field when `origin` is "server"; a declared key the
   *  client populates when it is "client". */
  source:    string;
  /** Sums to 100 across the document's metrics. */
  weight:    number;
  /** How the actual renders. `money` → $1,234.56, `number` → 1,234.56,
   *  `percent` → 59.1%. */
  format:    "money" | "number" | "percent";
  /** `desc` = highest value takes rank 1. `asc` for a metric where less is
   *  better, e.g. ranking on COGS or closing stock. */
  direction: "desc" | "asc";
}

export interface LeaderboardConfigInterface extends Document {
  simulationTypeId: Types.ObjectId;
  metrics:          LeaderboardMetric[];
  createdAt:        Date;
  updatedAt:        Date;
}

const leaderboardMetricSchema = new Schema<LeaderboardMetric>(
  {
    key:       { type: String, required: true },
    label:     { type: String, required: true },
    origin:    { type: String, required: true, enum: METRIC_ORIGINS, default: "server" },
    source:    { type: String, required: true },
    weight:    { type: Number, required: true, min: 0 },
    format:    { type: String, required: true, enum: ["money", "number", "percent"], default: "number" },
    direction: { type: String, required: true, enum: ["desc", "asc"], default: "desc" },
  },
  { _id: false }
);

// `source` is validated AGAINST `origin`, which a per-path enum cannot express:
// a server metric must name a real scored field, a client metric may declare
// any key but must still be a key.
leaderboardMetricSchema.path("source").validate(function (v: string) {
  const origin = (this as unknown as LeaderboardMetric).origin;
  return origin === "client"
    ? CLIENT_SOURCE_PATTERN.test(v)
    : (SERVER_SOURCES as readonly string[]).includes(v);
}, "source is not valid for this metric's origin");

const leaderboardConfigSchema = new Schema<LeaderboardConfigInterface>(
  {
    simulationTypeId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "SimulationType",
      unique:   true,
      index:    true,
    },
    metrics: {
      type:    [leaderboardMetricSchema],
      default: [],
      validate: [
        {
          // 100, or nothing at all. A half-filled document that still scores is
          // worse than one that refuses to save: the report would render points
          // that look authoritative and reconcile against nothing.
          validator: (m: LeaderboardMetric[]) =>
            m.length === 0 || Math.abs(m.reduce((a, x) => a + (x.weight ?? 0), 0) - 100) < 1e-9,
          message: "metric weights must sum to exactly 100",
        },
        {
          validator: (m: LeaderboardMetric[]) =>
            new Set(m.map((x) => x.key)).size === m.length,
          message: "metrics[] contains duplicate keys — each metric key must be unique",
        },
      ],
    },
  },
  { timestamps: true }
);

const LeaderboardConfig = mongoose.model<LeaderboardConfigInterface>(
  "LeaderboardConfig",
  leaderboardConfigSchema,
  "leaderboardConfigs"
);

export default LeaderboardConfig;
