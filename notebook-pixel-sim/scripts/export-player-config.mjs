#!/usr/bin/env node
/**
 * export-player-config — lift the player's bundled catalogs into a PlayerConfig
 * document, and (optionally) publish it to the gamesim API.
 *
 * WHY THIS IMPORTS RATHER THAN COPIES
 * The seeded config must start byte-identical to what the client approved. If a
 * human transcribed these tables into JSON they would drift the first time
 * someone tuned a number in the frontend. So this script imports the ACTUAL
 * modules the game runs on (through esbuild, to resolve the `@/` alias and TS
 * syntax) and serialises what it finds. Drift becomes structurally impossible:
 * re-run it and the output tracks the source.
 *
 * It doubles as the drift DETECTOR — `--check` compares what's published in the
 * database against the live frontend tables and exits non-zero on any
 * difference.
 *
 * Usage
 *   node scripts/export-player-config.mjs --out player-config.seed.json
 *   node scripts/export-player-config.mjs --push --type <simulationTypeId> --token <jwt>
 *   node scripts/export-player-config.mjs --check --type <simulationTypeId> --token <jwt>
 *
 * Env fallbacks: GAMESIM_API_URL (default http://localhost:5000/api),
 *                GAMESIM_TOKEN, GAMESIM_TYPE_ID
 */

import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const API = (process.env.GAMESIM_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");
const TOKEN = opt("token", process.env.GAMESIM_TOKEN);
const TYPE_ID = opt("type", process.env.GAMESIM_TYPE_ID);

/**
 * Bundle the frontend's config modules into one ESM file we can import.
 * `@/` → src/, and assets.ts is stubbed because it reaches for image files we
 * don't need here — we only want the PATH strings it produces, and those come
 * through as plain values via the stub's Proxy.
 */
async function loadFrontendTables() {
  const dir = await mkdtemp(path.join(tmpdir(), "player-config-"));
  const entry = path.join(dir, "entry.ts");
  const outfile = path.join(dir, "bundle.mjs");

  await writeFile(
    entry,
    `
    export * as finlit from '@/engine/finlit/core/config';
    export { ADDONS } from '@/data/addOns';
    export { SEGMENTS } from '@/data/segments';
    export { CHANNELS } from '@/data/channels';
    export { ARCHETYPE_INFO } from '@/data/notebookArchetypes';
    export { EVENTS } from '@/data/events';
    export { UPGRADES } from '@/data/upgrades';
    export { INSIGHTS } from '@/data/insights';
    export * as balance from '@/data/balance';
    `,
    "utf8"
  );

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    alias: { "@": SRC },
    // The asset map resolves real files and pulls in image bindings we don't
    // need; a Proxy stub yields the same dotted path strings.
    plugins: [
      {
        name: "stub-assets",
        setup(b) {
          b.onResolve({ filter: /^@\/assets$/ }, () => ({
            path: "virtual:assets",
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: `
              const mk = (p) => new Proxy(function(){}, {
                get: (_t, k) => (k === Symbol.toPrimitive || k === 'toString' || k === 'valueOf')
                  ? () => p
                  : mk(p ? p + '.' + String(k) : String(k)),
                apply: () => p,
              });
              export const A = mk('');
              export default A;
            `,
            loader: "js",
          }));
        },
      },
    ],
  });

  const mod = await import(pathToFileURL(outfile).href);
  await rm(dir, { recursive: true, force: true });
  return mod;
}

/**
 * Asset references come out as the DOTTED KEY into the frontend's asset map
 * (`addons.integrated.charm_bear`), not a resolved URL — deliberately.
 *
 * `src/assets.ts` URL-encodes each path segment because the sprite folders
 * contain spaces, `&` and em-dashes; a raw path stored here would have to
 * re-implement that encoding and would rot the moment a folder is renamed.
 * Storing the key keeps the frontend the single owner of URL resolution:
 * hydration does `get(A, imagePath)`, and an uploaded `imageAssetId` (an
 * absolute Supabase URL) takes precedence when the operator sets one.
 */
const assetPath = (v) => {
  if (v == null) return null;
  const s = String(v);
  return s && s !== "undefined" && s !== "[object Object]" ? s : null;
};

function buildConfig(m) {
  const f = m.finlit;

  const genres = f.GENRES.map((g) => ({
    id: g.id,
    name: g.name,
    blurb: g.blurb,
    demand: { ...g.demand },
    voc: { ...g.voc },
    imageAssetId: null,
    imagePath: null,
  }));

  const axis = (rows) =>
    rows.map((o) => ({ id: o.id, name: o.name, rate: o.rate, cost: o.cost }));

  const productionOptions = {
    type: axis(f.TYPE_OPTIONS),
    paper: axis(f.PAPER_OPTIONS),
    size: axis(f.SIZE_OPTIONS),
    pageDesign: axis(f.PAGE_DESIGN_OPTIONS),
    addon: axis(f.ADDON_OPTIONS),
    cover: axis(f.COVER_OPTIONS),
  };

  const channelMeta = Object.entries(f.CHANNEL_META).map(([id, v]) => ({
    id,
    name: v.name,
    blurb: v.blurb,
  }));

  const channelsByGenre = Object.entries(f.CHANNELS_BY_GENRE).map(([genreId, rows]) => ({
    genreId,
    rows: rows.map((r) => ({
      channel: r.channel,
      split: r.split,
      maintenance: r.maintenance,
      consignment: r.consignment,
      inventoryCost: r.inventoryCost,
      sellRate: r.sellRate,
    })),
  }));

  // The frontend nests coverage as coverage[level][genre]; the config flattens
  // it to rows so it can be edited in a table. `quality: "none"` entries are
  // kept — they mean "this vendor deliberately doesn't stock that genre".
  const vendors = f.VENDORS.map((v) => {
    const coverage = [];
    for (const level of [1, 2]) {
      for (const [genreId, c] of Object.entries(v.coverage[level])) {
        coverage.push({
          level,
          genreId,
          cost: c.cost,
          quality: c.quality,
          sellBonus: c.sellBonus,
          prodBonus: c.prodBonus,
        });
      }
    }
    return {
      id: v.id,
      name: v.name,
      blurb: null,
      energyByLevel: { l1: v.energyByLevel[1], l2: v.energyByLevel[2] },
      coverage,
      imageAssetId: null,
      imagePath: null,
    };
  });

  const hiringCandidates = f.CANDIDATES.map((c) => ({
    id: c.id,
    name: c.name,
    blurb: c.blurb,
    levels: c.levels.map((l) => ({
      level: l.level,
      prodBonus: l.prodBonus,
      sellBonus: l.sellBonus,
      cost: l.cost,
      energy: l.energy,
    })),
    imageAssetId: null,
    imagePath: null,
  }));

  const marketingTeams = f.MARKETING_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    blurb: t.blurb,
    cost: t.cost,
    sellBonus: t.sellBonus,
    energy: t.energy,
  }));

  const scenarios = f.SCENARIOS.map((s) => ({
    id: s.id,
    phase: s.phase,
    title: s.title,
    body: s.body,
    options: s.options.map((o) => ({
      id: o.id,
      label: o.label,
      detail: o.detail,
      energy: o.energy,
      demandMult: o.demandMult ?? null,
      sellMult: o.sellMult ?? null,
      cashNow: o.cashNow ?? null,
    })),
    imageAssetId: null,
    imagePath: null,
  }));

  const b = m.balance;
  const constants = {
    // V3 engine constants
    BASERATE: f.BASERATE,
    BASE_MARKET_SHARE: f.BASE_MARKET_SHARE,
    UNIT_CONTRIBUTION: f.UNIT_CONTRIBUTION,
    DEMAND_SCALE: f.DEMAND_SCALE,
    HOLDING_RATE_PER_DAY: f.HOLDING_RATE_PER_DAY,
    BUDGET_MAX: f.BUDGET_MAX,
    BUDGET_LEVER_ENERGY: f.BUDGET_LEVER_ENERGY,
    MARKETING_DEMAND_RATE: f.MARKETING_DEMAND_RATE,
    SALES_SELL_RATE: f.SALES_SELL_RATE,
    PHASE_LENGTH_DAYS: f.PHASE_LENGTH_DAYS,
    ENERGY_START: f.ENERGY_START,
    ENERGY_PER_PHASE: f.ENERGY_PER_PHASE,
    ENERGY_CAP: f.ENERGY_CAP,
    SCENARIO_DAYS: [...f.SCENARIO_DAYS],
    SCENARIOS_PER_PHASE: { ...f.SCENARIOS_PER_PHASE },
    ROUTE_START_SELF_CASH: f.ROUTE_START.self.cash,
    ROUTE_START_SELF_OPENING_PROFIT: f.ROUTE_START.self.openingProfit,
    ROUTE_START_INVESTOR_CASH: f.ROUTE_START.investor.cash,
    ROUTE_START_INVESTOR_OPENING_PROFIT: f.ROUTE_START.investor.openingProfit,
    // V2 balance constants
    PHASE_MAX_ENERGY: { ...b.PHASE_MAX_ENERGY },
    PAPER_COST: { ...b.PAPER_COST },
    COVER_COST: { ...b.COVER_COST },
    BINDING_COST: { ...b.BINDING_COST },
    SIZE_COST_MULT: { ...b.SIZE_COST_MULT },
    SIZE_TIME_MULT: { ...b.SIZE_TIME_MULT },
    PRICE_REFERENCE: { ...b.PRICE_REFERENCE },
    PHASE_DEMAND_MULT: { ...b.PHASE_DEMAND_MULT },
    STARTING_CASH: { ...b.STARTING_CASH },
    STARTING_DEBT: { ...b.STARTING_DEBT },
    ENERGY_COSTS: { ...b.ENERGY_COSTS },
    BASE_PRODUCTION: b.BASE_PRODUCTION,
    HIRE_CAPACITY: b.HIRE_CAPACITY,
    HIRE_DAILY_WAGE: b.HIRE_DAILY_WAGE,
    DEFAULT_DEFECT: b.DEFAULT_DEFECT,
    SEED_DEFAULT: b.SEED_DEFAULT,
  };

  const addOns = m.ADDONS.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    costPerUnit: a.costPerUnit,
    perceivedValue: a.perceivedValue,
    segmentBoost: { ...(a.segmentBoost ?? {}) },
    slot: a.slot,
    description: a.description,
    active: true,
    imageAssetId: null,
    imagePath: assetPath(a.imgPath),
    thumbAssetId: null,
    thumbPath: assetPath(a.thumbPath),
  }));

  // All 12 categories the player's AddOnCategory type defines — not just the 7
  // currently in use, so the console offers every slot an operator can build
  // into without having to invent a category first.
  const groupOf = (id) =>
    id.startsWith("integrated") ? "integrated"
      : id.startsWith("decorative") ? "decorative"
      : id.startsWith("functional") ? "functional"
      : "writing";
  const ALL_ADDON_CATEGORIES = [
    "integrated_charm",
    "integrated_ribbon",
    "integrated_sticker_name",
    "integrated_sticker_pack",
    "decorative_washi",
    "decorative_pattern",
    "decorative_bundle",
    "functional_bookmark",
    "functional_band",
    "functional_closure",
    "functional_clip",
    "writing_tool",
  ];
  const used = new Set(m.ADDONS.map((a) => a.category));
  for (const c of used) {
    if (!ALL_ADDON_CATEGORIES.includes(c)) ALL_ADDON_CATEGORIES.push(c);
  }
  const addOnCategories = ALL_ADDON_CATEGORIES.map((id) => ({
    id,
    name: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    group: groupOf(id),
  }));

  const segments = m.SEGMENTS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    baseDemand: s.baseDemand,
    priceSensitivity: s.priceSensitivity,
    preferredPriceRef: s.preferredPriceRef,
    preference: { ...s.preference },
    imageAssetId: null,
    imagePath: assetPath(s.imgPath),
  }));

  const channelsV2 = m.CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    reach: c.reach,
    dailyCost: c.dailyCost,
    unlockEnergy: c.unlockEnergy,
    unlockCash: c.unlockCash,
    segmentAffinity: { ...(c.segmentAffinity ?? {}) },
    imageAssetId: null,
    imagePath: assetPath(c.imgPath),
  }));

  const archetypes = Object.values(m.ARCHETYPE_INFO).map((a) => ({
    id: a.id,
    title: a.title,
    tagline: a.tagline,
    description: a.description,
    bestFor: [...a.bestFor],
    strengths: [...a.strengths],
    tradeoffs: [...a.tradeoffs],
    costNote: a.costNote,
    productionNote: a.productionNote,
    whyChoose: a.whyChoose,
    imageAssetId: null,
    imagePath: null,
  }));

  const events = m.EVENTS.map((e) => ({
    id: e.id,
    day: e.day,
    title: e.title,
    body: e.body,
    mascotMood: e.mascotMood,
    options: e.options.map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description,
      cost: { energy: o.cost.energy, cash: o.cost.cash ?? null },
      effects: [...(o.effects ?? [])],
      modifierIds: [...(o.modifierIds ?? [])],
    })),
    imageAssetId: null,
    imagePath: null,
  }));

  const upgrades = m.UPGRADES.map((u) => ({
    id: u.id,
    name: u.name,
    category: u.category,
    description: u.description,
    costs: { ...u.costs },
    unlockDay: u.unlockDay ?? null,
    requires: [...(u.requires ?? [])],
    effects: [...(u.effects ?? [])],
    imageAssetId: null,
    imagePath: null,
  }));

  const insights = m.INSIGHTS.map((i) => ({
    id: i.id,
    phase: i.phase,
    question: i.question,
    options: i.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
  }));

  return {
    genres,
    productionOptions,
    channelMeta,
    channelsByGenre,
    vendors,
    hiringCandidates,
    marketingTeams,
    scenarios,
    constants,
    addOns,
    addOnCategories,
    segments,
    channelsV2,
    archetypes,
    events,
    upgrades,
    insights,
    copy: {},
    images: {},
  };
}

async function api(method, path, body) {
  if (!TOKEN) throw new Error("Missing --token (or GAMESIM_TOKEN).");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body: json ?? text };
}

/**
 * "Absent" and "empty string" mean the same thing for the optional text fields,
 * and the server normalises one into the other: a frontend `undefined` comes
 * back from zod as `""`. Treating them as different made the checker report a
 * difference on every run forever, which is the fastest way to make a drift
 * check stop being read.
 */
const blank = (v) => v === undefined || v === null || v === "";

/** Order-insensitive-free deep compare that reports the first N differing paths. */
function diff(a, b, at = "", out = []) {
  if (out.length >= 12) return out;
  if (a === b) return out;
  if (blank(a) && blank(b)) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) { out.push(`${at || "(root)"}: ${ta} vs ${tb}`); return out; }
  if (ta === "array") {
    if (a.length !== b.length) out.push(`${at}: length ${a.length} vs ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${at}[${i}]`, out);
    return out;
  }
  if (ta === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diff(a[k], b[k], at ? `${at}.${k}` : k, out);
    }
    return out;
  }
  out.push(`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}

const counts = (c) => ({
  genres: c.genres.length,
  productionAxes: Object.keys(c.productionOptions).length,
  productionOptions: Object.values(c.productionOptions).reduce((n, a) => n + a.length, 0),
  channelsByGenre: c.channelsByGenre.length,
  vendors: c.vendors.length,
  vendorCoverageRows: c.vendors.reduce((n, v) => n + v.coverage.length, 0),
  hiringCandidates: c.hiringCandidates.length,
  marketingTeams: c.marketingTeams.length,
  scenarios: c.scenarios.length,
  constants: Object.keys(c.constants).length,
  addOns: c.addOns.length,
  addOnCategories: c.addOnCategories.length,
  segments: c.segments.length,
  channelsV2: c.channelsV2.length,
  archetypes: c.archetypes.length,
  events: c.events.length,
  upgrades: c.upgrades.length,
  insights: c.insights.length,
});

async function main() {
  const mod = await loadFrontendTables();
  const config = buildConfig(mod);

  console.log("Lifted from the player's own modules:");
  for (const [k, v] of Object.entries(counts(config))) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  const out = opt("out");
  if (out) {
    const dest = path.resolve(ROOT, out);
    await writeFile(dest, JSON.stringify(config, null, 2), "utf8");
    console.log(`\nWrote ${dest}`);
  }

  if (flag("push")) {
    if (!TYPE_ID) throw new Error("Missing --type <simulationTypeId>.");
    const put = await api("PUT", `/player-config/${TYPE_ID}`, config);
    if (put.status !== 200) {
      console.error(`\nPUT failed (${put.status}):`, JSON.stringify(put.body, null, 2));
      process.exit(1);
    }
    console.log(`\nDraft saved: ${put.body.sectionsUpdated.length} sections.`);
    if (put.body.warnings?.length) {
      console.log("Warnings:");
      for (const w of put.body.warnings) console.log(`  ${w.path}: ${w.message}`);
    }
    const pub = await api("POST", `/player-config/${TYPE_ID}/publish`, {
      note: "Seeded from the player's bundled defaults.",
    });
    if (pub.status !== 200) {
      console.error(`Publish failed (${pub.status}):`, JSON.stringify(pub.body, null, 2));
      process.exit(1);
    }
    console.log(
      pub.body.changed
        ? `Published version ${pub.body.version}.`
        : `Already published and identical (version ${pub.body.version}) — nothing to do.`
    );
  }

  if (flag("check")) {
    if (!TYPE_ID) throw new Error("Missing --type <simulationTypeId>.");
    const got = await api("GET", `/player-config/${TYPE_ID}`);
    if (got.status !== 200) {
      console.error(`\nDRIFT: no published config (${got.status}).`);
      process.exit(1);
    }
    const differences = diff(config, got.body.config);
    if (differences.length) {
      console.error(`\nDRIFT — published v${got.body.version} differs from the frontend:`);
      for (const d of differences) console.error(`  ${d}`);
      process.exit(1);
    }
    console.log(`\nIn sync: published v${got.body.version} deep-equals the frontend tables.`);
  }
}

main().catch((e) => {
  console.error(e?.stack ?? String(e));
  process.exit(1);
});
