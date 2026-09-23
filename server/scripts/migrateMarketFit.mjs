/**
 * ONE-OFF: rename the mis-named market share, and backfill the real one.
 *
 *   node scripts/migrateMarketFit.mjs            # dry run, prints what it would do
 *   node scripts/migrateMarketFit.mjs --apply    # writes
 *
 * ── WHAT WENT WRONG ─────────────────────────────────────────────────────────
 * `marketShare` never held a market share. It held the normalised
 * `productScore` — the ALLOCATION, how much of the available market a team's
 * decisions earned it. The real market share is the share of notebooks actually
 * SOLD, which nothing computed. Renamed and added 2026-09-24.
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────
 *   results.marketShares          -> results.marketFit        (rename)
 *   decisions.scored[p].marketShare -> .marketFit             (rename)
 *   decisions.scored[p].marketShare  = customersObtained / Σ customersObtained
 *                                                             (BACKFILL)
 *
 * The backfill is exact, not an estimate: every competitor's
 * `customersObtained` for the round is already stored, which is the whole
 * formula. Teams are summed per (simulationId, roundNumber, productId) — the
 * same grouping roundCalculation competes them in.
 *
 * `customersObtained`, NOT `unitsSold` — owner's call 2026-09-24. Demand WON,
 * before stock limits what can be delivered. Re-running this script after it
 * has already applied is safe and corrects a share written by the earlier
 * unitsSold version.
 *
 * ── WHAT IT CANNOT DO ───────────────────────────────────────────────────────
 * `productScoreBreakdown` (the analysis report's weighted-score rows) is NOT
 * backfillable. It is `resolved × bellFactor × direction` per field, which
 * needs the market model re-run — so rounds migrated by this script still show
 * "-" on those rows until they are RECALCULATED. Recalculating also makes the
 * rest of this script unnecessary for `decisions`, because the round close
 * rewrites `scored` wholesale; `results` still needs the rename either way,
 * since findOneAndUpdate leaves a key the new write no longer mentions.
 *
 * Idempotent: a document already carrying `marketFit` is skipped.
 */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const URI = process.env.MONGO_URI_LOCAL ?? process.env.MONGO_URI;

if (!URI) {
  console.error("No MONGO_URI_LOCAL / MONGO_URI in the environment.");
  process.exit(1);
}

const log = (...a) => console.log(APPLY ? "[apply]" : "[dry] ", ...a);

await mongoose.connect(URI);
const db = mongoose.connection.db;

// ── results: marketShares -> marketFit ──────────────────────────────────────
const results = db.collection("results");
const staleResults = await results.countDocuments({ marketShares: { $exists: true } });
log(`results with a stale marketShares key: ${staleResults}`);

if (APPLY && staleResults > 0) {
  const r = await results.updateMany(
    { marketShares: { $exists: true } },
    { $rename: { marketShares: "marketFit" } },
  );
  log(`renamed ${r.modifiedCount}`);
}

// ── decisions: rename the fit, backfill the share ───────────────────────────
//
// Grouped by (simulationId, roundNumber, productId) because that is the set
// roundCalculation competes: a team's share is of the notebooks sold for THAT
// product in THAT round, not across products or rounds.
const decisions = db.collection("decisions");
const all = await decisions.find({ scored: { $ne: null } }).toArray();

/** (sim|round|product) -> Σ customersObtained across every team that competed. */
const wonTotals = new Map();
for (const d of all) {
  for (const [productId, m] of Object.entries(d.scored ?? {})) {
    const key = `${d.simulationId}|${d.roundNumber}|${productId}`;
    wonTotals.set(key, (wonTotals.get(key) ?? 0) + (Number(m?.customersObtained) || 0));
  }
}

let touched = 0;
for (const d of all) {
  const scored = d.scored ?? {};
  let changed = false;
  const next = {};

  for (const [productId, m] of Object.entries(scored)) {
    const block = { ...m };

    // Already migrated — leave it exactly as it is.
    if (block.marketFit === undefined && block.marketShare !== undefined) {
      block.marketFit = block.marketShare;
      changed = true;
    }

    const total = wonTotals.get(`${d.simulationId}|${d.roundNumber}|${productId}`) ?? 0;
    // Nobody won anyone ⇒ 0 for everyone, NOT 1/n. An empty market was not
    // split between them; no one took any of it.
    const share = total > 0 ? (Number(block.customersObtained) || 0) / total : 0;
    if (block.marketShare !== share) {
      block.marketShare = share;
      changed = true;
    }

    next[productId] = block;
  }

  if (!changed) continue;
  touched += 1;
  if (APPLY) {
    await decisions.updateOne({ _id: d._id }, { $set: { scored: next } });
  }
}

log(`decisions with a scored block to rewrite: ${touched} of ${all.length}`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
} else {
  console.log(
    "\nDone. `productScoreBreakdown` is still absent on these rounds — it cannot " +
    "be backfilled and needs the round RECALCULATED.",
  );
}

await mongoose.disconnect();
