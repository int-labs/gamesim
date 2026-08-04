#!/usr/bin/env node
/**
 * Provision the "Notebook" SimulationType in gamesim — over the HTTP API, with
 * an admin token. Deliberately NOT a seed-db run: seed-data/merge-config.json
 * uses "replace" for products/segments/simulationTypes/baseData/globalInputs,
 * so `npm run seed-db` would wipe those collections and take real work with it.
 * This script only ever touches the Notebook documents, and only through the
 * same validated endpoints the admin console uses.
 *
 * Idempotent: every step looks for its document first and PATCHes instead of
 * POSTing. Safe to re-run after editing the config below.
 *
 * Usage:
 *   GAMESIM_API_URL=http://localhost:5000/api \
 *   GAMESIM_ADMIN_TOKEN=<token> \
 *   node scripts/provision-notebook.mjs              # dry run — prints the plan
 *
 *   … --apply                                        # actually write
 *   … --teams 6                                      # size the market-share
 *                                                    # field for 6 teams
 *
 * Get the token by logging in as admin (POST /auth/login) and copying it from
 * the response or from the admin console's storage — this script never asks for
 * a password.
 *
 * NOT created here: teams, team users/passkeys, the Simulation itself and its
 * Rounds. Team users need a password (POST /users takes one), which is not
 * something a script should be inventing or handling — create those in the
 * admin console, where the passkey is generated for you.
 */

const API = (process.env.GAMESIM_API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN = process.env.GAMESIM_ADMIN_TOKEN ?? '';
const APPLY = process.argv.includes('--apply');
const TEAMS = Number(
  (process.argv.find((a) => a.startsWith('--teams='))?.split('=')[1]) ??
    (process.argv[process.argv.indexOf('--teams') + 1] ?? 4),
);

if (!TOKEN) {
  console.error('GAMESIM_ADMIN_TOKEN is required (an admin/operator JWT).');
  process.exit(1);
}
if (!Number.isFinite(TEAMS) || TEAMS < 2) {
  console.error('--teams must be a number >= 2.');
  process.exit(1);
}

// ── Config ──────────────────────────────────────────────────────────────────
const SIM_TYPE_NAME = 'Notebook';
const SEGMENT = { name: 'Notebook Buyers', key: 'notebook_buyers' };

// One Product per notebook in the game's catalogue — the four MARKETS the
// engine models (GENRES in src/engine/finlit/core/config/genres.ts). These used
// to be three V2 "archetypes" (Student / Planner / Daily Journal) that had no
// counterpart in the simulation, so the server was scoring a product set the
// player never actually chose between.
//
// `id` matches the genre id, which is what the player sends, so the pairing is
// by identity rather than by name or list position.
//
// marketSize per round IS that genre's demand for phases 1/2/3, so the server's
// market is exactly the size the game shows locally. Keep these in step with
// `GENRES[].demand` (p1/p2/p3) if the curve is ever retuned.
const PRODUCTS = [
  { id: 'cute',       name: 'Cute Notebook',       order: 1, price: [5, 40], market: { 1: 14507, 2: 17115, 3: 20759 } },
  { id: 'anime',      name: 'Anime Notebook',      order: 2, price: [5, 40], market: { 1: 14093, 2: 17108, 3: 21023 } },
  { id: 'minimalist', name: 'Minimalist Notebook', order: 3, price: [5, 40], market: { 1: 16409, 2: 18552, 3: 21543 } },
  { id: 'indie',      name: 'Indie Notebook',      order: 4, price: [5, 40], market: { 1: 17562, 2: 19527, 3: 22511 } },
];

// `projected_market_share` is read as a FRACTION by calcMarketModel, and it
// SCALES the score-derived share:
//   normalisedPms = pms / (1 / numberOfTeams)      → pms × numberOfTeams
//   actualShare   = min(rawShare × normalisedPms, 1)
// so pms = 1/numberOfTeams is the neutral claim. getInput() also multiplies the
// value by a diminishing-returns factor that is 1.0 at the MIDPOINT of
// [minValue, maxValue] and rises to 2.0 at either bound — so the range is set to
// [0, 2/numberOfTeams], making the midpoint exactly the neutral 1/numberOfTeams.
// The player sends that midpoint by default (see src/gamesim/mapping.ts).
const PMS_MAX = Number((2 / TEAMS).toFixed(4));

/** Coefficients are per ROUND ("1"/"2"/"3"). A field with NO coefficient for a
 *  round is skipped entirely by calcMarketModel — that is what makes a field
 *  actually count in the competition. */
const perRound = (v) => ({ 1: v, 2: v, 3: v });

const FIELDS = [
  {
    key: 'score', label: 'Product quality (VoC fit)', type: 'number',
    order: 1, required: true,
    // The value the player sends is vocFit ∈ [0.6, 1.2]. The RANGE here is
    // deliberately WIDER than that, and this is not cosmetic: getInput() in
    // calcMarketModel multiplies every non-enum value by
    // calcDiminishingReturnsCostFactor(value, minValue, maxValue), which is 1.0
    // at the midpoint and rises to 2.0 at EITHER bound. That curve is meant for
    // cost/quantity fields, but it is applied to quality too — so with a range of
    // [0.6, 1.2] a LOW score sits near the lower bound, gets multiplied by ~1.4,
    // and can outrank a mid score. Verified against the real engine: scores
    // 1.05 / 0.92 / 0.74 came out 45.2% / 24.9% / 29.9% — the weakest product
    // beat the middle one.
    // With [0, 3] the whole [0.6, 1.2] band sits on ONE side of the midpoint,
    // where value × factor is monotonic, and the ordering is restored:
    // 42.7% / 35.4% / 21.9%. Keep maxValue ≥ ~2.5× the top score the player can
    // send. (The alternative is an enum field — those skip the factor entirely —
    // but that would mean bucketing a continuous fit value into grades.)
    minValue: 0, maxValue: 3,
    direction: 1, tightening: 3, coefficients: perRound(0.6), unitCost: null,
  },
  {
    key: 'selling_price', label: 'Selling price', type: 'money',
    order: 2, required: true, minValue: null, maxValue: null, // per-product, filled below
    // NO coefficients on purpose: calcMarketModel.ts:192 explicitly SKIPS
    // selling_price in the scoring loop, so any coefficient here is dead config.
    // Price still matters — calcFinancials uses it for revenue and productScore —
    // it just doesn't compete for market share directly.
    direction: 0, tightening: 3, coefficients: {}, unitCost: null,
  },
  {
    key: 'unit_cost', label: 'Unit cost', type: 'money',
    order: 3, required: true, minValue: 0, maxValue: 100,
    // NOT competed (no coefficients) — this is the COGS basis. unitCost: 1 makes
    // calcFinancials read the submitted value as cost per unit.
    direction: 0, tightening: 3, coefficients: {}, unitCost: 1,
  },
  {
    key: 'projected_market_share', label: 'Projected market share', type: 'number',
    order: 4, required: true, minValue: 0, maxValue: PMS_MAX,
    // calcMarketModel skips this key in the scoring loop and uses it as the
    // share multiplier instead, so it carries no coefficients.
    direction: 1, tightening: 3, coefficients: {}, unitCost: null,
  },
];

/** Which field keys take part in the competitive model, per product. Their calc
 *  config (direction/tightening/coefficients) is read from Product.fields by
 *  key, so this list only names them. */
const MARKET_MODEL_KEYS = [
  { key: 'score', label: 'Product quality (VoC fit)' },
  // Both of these are skipped by the scoring loop (calcMarketModel.ts:192) —
  // selling_price entirely, projected_market_share because it is used as the
  // share multiplier instead. Listed anyway so the market model documents which
  // decision fields the round consumes.
  { key: 'selling_price', label: 'Selling price' },
  { key: 'projected_market_share', label: 'Projected market share' },
];

const GLOBAL_INPUT = {
  category: 'Marketing',
  key: 'notebook_marketing',
  label: 'Marketing push',
  type: 'radio',
  description: 'Company-wide marketing spend for the round.',
  inputs: [
    { key: 'none', label: 'No push', cost: 0, energy: 0, impacts: {}, impactLevel: 'none', options: {} },
    { key: 'light', label: 'Light push', cost: 2000, energy: 5, impacts: { demand: { type: 'relative', value: 0.1 } }, impactLevel: 'low', options: {} },
    { key: 'heavy', label: 'Heavy push', cost: 6000, energy: 12, impacts: { demand: { type: 'relative', value: 0.25 } }, impactLevel: 'high', options: {} },
  ],
};

// ── HTTP helpers ────────────────────────────────────────────────────────────
let writes = 0;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${parsed?.message ?? text}`);
  }
  return parsed;
}

const get = (path) => api('GET', path);

async function write(method, path, body, what) {
  if (!APPLY) {
    console.log(`  would ${method} ${path}  ${what}`);
    return { _id: `<${what}>`, ...body };
  }
  const out = await api(method, path, body);
  writes += 1;
  console.log(`  ${method} ${path}  ${what} ✓`);
  return out;
}

// ── Steps ───────────────────────────────────────────────────────────────────
async function ensureSimulationType() {
  const all = await get('/simulation-types');
  const found = (Array.isArray(all) ? all : []).find((s) => s.name === SIM_TYPE_NAME);
  if (found) {
    console.log(`  simulation type "${SIM_TYPE_NAME}" exists (${found._id})`);
    return found;
  }
  return write('POST', '/simulation-types', {
    name: SIM_TYPE_NAME,
    description: 'Pixel notebook business simulation (player: notebook-pixel-sim).',
    yearRange: { start: 1, end: 3 },
  }, `simulation type ${SIM_TYPE_NAME}`);
}

async function ensureSegment(simulationTypeId) {
  const all = await get(`/segments?simulationTypeId=${simulationTypeId}`);
  const found = (Array.isArray(all) ? all : []).find((s) => s.key === SEGMENT.key);
  if (found) {
    console.log(`  segment "${SEGMENT.key}" exists (${found._id})`);
    return found;
  }
  return write('POST', '/segments', {
    simulationTypeId,
    name: SEGMENT.name,
    key: SEGMENT.key,
    description: 'Buyers of handmade notebooks.',
    order: 1,
  }, `segment ${SEGMENT.key}`);
}

function fieldsFor(product) {
  return FIELDS.map((f) =>
    f.key === 'selling_price'
      ? { ...f, minValue: product.price[0], maxValue: product.price[1] }
      : { ...f },
  );
}

async function ensureProduct(simulationTypeId, segmentId, product) {
  const all = await get(`/products?simulationTypeId=${simulationTypeId}`);
  const found = (Array.isArray(all) ? all : []).find((p) => p.productName === product.name);
  const payload = {
    simulationTypeId,
    segmentId,
    productName: product.name,
    productType: 'notebook',
    active: true,
    order: product.order,
    description: `${product.name} product line.`,
    baseVariables: { availableMarket: product.market[1] },
    fields: fieldsFor(product),
  };

  if (!found) {
    return write('POST', '/products', payload, `product ${product.name} (+${payload.fields.length} fields)`);
  }

  // Keep existing _ids for fields that already exist — the submitted decisions
  // reference them by id, so replacing the array wholesale would orphan them.
  const merged = payload.fields.map((f) => {
    const existing = (found.fields ?? []).find((x) => x.key === f.key);
    return existing ? { ...existing, ...f, _id: existing._id } : f;
  });
  const kept = (found.fields ?? []).filter((x) => !payload.fields.some((f) => f.key === x.key));
  console.log(`  product "${product.name}" exists (${found._id}) — updating ${merged.length} field(s)`);
  return write('PATCH', `/products/${found._id}`, { ...payload, fields: [...merged, ...kept] },
    `product ${product.name} fields`);
}

/**
 * Delete Products for this simulation type that the catalogue no longer lists.
 *
 * Without this, renaming the catalogue leaves the retired rows behind and the
 * round close scores a mix of current and dead products. `ensureBaseData` runs
 * after this and rewrites marketData/marketModel around the survivors only.
 *
 * DESTRUCTIVE: any Decision or Results row referencing a deleted product stops
 * resolving. That is intended when replacing the catalogue outright, which is
 * why it only ever runs under --apply.
 */
async function pruneRetiredProducts(simulationTypeId) {
  const all = await get(`/products?simulationTypeId=${simulationTypeId}`);
  const keep = new Set(PRODUCTS.map((p) => p.name));
  const stale = (Array.isArray(all) ? all : []).filter((p) => !keep.has(p.productName));
  if (stale.length === 0) {
    console.log('  no retired products to prune');
    return;
  }
  for (const p of stale) {
    await write('DELETE', `/products/${p._id}`, undefined, `prune retired product "${p.productName}"`);
  }
}

async function ensureBaseData(simulationTypeId, segmentId, products) {
  const marketData = {
    segments: [{
      segmentId,
      products: products.map((p, i) => ({
        productId: p._id,
        yearlyData: Object.fromEntries(
          Object.entries(PRODUCTS[i].market).map(([year, marketSize]) => [year, { marketSize }]),
        ),
      })),
    }],
  };
  const marketModel = {
    segments: [{
      segmentId,
      products: products.map((p) => ({
        productId: p._id,
        fields: MARKET_MODEL_KEYS.map((f) => ({ ...f, level: 'product' })),
        segmentFields: [],
        globalFields: [],
      })),
    }],
  };

  // GET /base-data 404s when none exists yet for this simulationTypeId (unlike
  // /products or /segments, which return an empty array) — treat that as "no
  // existing base data" instead of letting it abort provisioning.
  let all;
  try {
    all = await get(`/base-data?simulationTypeId=${simulationTypeId}`);
  } catch (err) {
    if (!/404/.test(err.message)) throw err;
    all = null;
  }
  const found = Array.isArray(all) ? all[0] : all;
  if (found?._id) {
    console.log(`  base data exists (${found._id}) — updating marketData + marketModel`);
    return write('PATCH', `/base-data/${found._id}`, { marketData, marketModel }, 'base data');
  }
  return write('POST', '/base-data', { simulationTypeId, marketData, marketModel }, 'base data');
}

async function ensureGlobalInput(simulationTypeId) {
  const all = await get(`/global-inputs?simulationTypeId=${simulationTypeId}`);
  const found = (Array.isArray(all) ? all : []).find((g) => g.key === GLOBAL_INPUT.key);
  if (found) {
    console.log(`  global input "${GLOBAL_INPUT.key}" exists (${found._id})`);
    return found;
  }
  return write('POST', '/global-inputs', { simulationTypeId, ...GLOBAL_INPUT },
    `global input ${GLOBAL_INPUT.key}`);
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(`${APPLY ? 'APPLYING to' : 'DRY RUN against'} ${API}`);
console.log(`teams = ${TEAMS} → projected_market_share range [0, ${PMS_MAX}], neutral ${(1 / TEAMS).toFixed(4)}\n`);

try {
  const simType = await ensureSimulationType();
  const segment = await ensureSegment(simType._id);

  const products = [];
  for (const p of PRODUCTS) products.push(await ensureProduct(simType._id, segment._id, p));

  await pruneRetiredProducts(simType._id);
  await ensureBaseData(simType._id, segment._id, products);
  await ensureGlobalInput(simType._id);

  console.log(`\nDone. ${APPLY ? `${writes} write(s) sent.` : 'Nothing was written — re-run with --apply.'}`);
  if (APPLY) {
    console.log('\nStill to do in the admin console (this script deliberately does not):');
    console.log('  1. Create the teams and their team users (passkeys are generated there).');
    console.log(`  2. Create a Simulation of type "${SIM_TYPE_NAME}" and set config.totalRounds.`);
    console.log('  3. Create Round 1 and set its status to Active.');
    console.log('  4. Point the player at the API: VITE_GAMESIM_API_URL=<api>/api');
  }
} catch (err) {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
}
