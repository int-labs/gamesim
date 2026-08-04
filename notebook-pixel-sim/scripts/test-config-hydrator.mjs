/**
 * Guard test for src/gamesim/configHydrator.ts.
 *
 * The player frontend is client-approved: hydration may change what the game
 * SHOWS, never whether it RUNS. The engine's accessors (`genreById`,
 * `configOption`, `channelRow`, `vendorById`) throw on an unknown id, so a
 * config that drops or unbalances an entry is a crash, not a cosmetic bug.
 *
 * This bundles the REAL hydrator against the REAL bundled tables (the same
 * esbuild trick export-player-config.mjs uses), feeds it the published config
 * plus deliberately broken variants, and asserts the tables afterwards. The
 * property under test: a config the guard rejects leaves the bundled data
 * exactly as it shipped.
 *
 * Run it against a server that has a published config:
 *   node scripts/test-config-hydrator.mjs --token <admin jwt> --type <simulationTypeId>
 */
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const API = (process.env.GAMESIM_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");
const TOKEN = opt("token", process.env.GAMESIM_TOKEN);
const TYPE_ID = opt("type", process.env.GAMESIM_TYPE_ID);

if (!TOKEN || !TYPE_ID) {
  console.error(
    "usage: node scripts/test-config-hydrator.mjs --token <admin jwt> --type <simulationTypeId>\n" +
      "       (or set GAMESIM_TOKEN / GAMESIM_TYPE_ID)"
  );
  process.exit(2);
}

const dir = await mkdtemp(path.join(tmpdir(), "hydrator-test-"));
const entry = path.join(dir, "entry.ts");
const outfile = path.join(dir, "bundle.mjs");

await writeFile(
  entry,
  `
  export { hydratePlayerConfig } from '@/gamesim/configHydrator';
  export { GENRES, VENDORS, CANDIDATES, MARKETING_TEAMS, SCENARIOS,
           CHANNEL_META, CHANNELS_BY_GENRE, TYPE_OPTIONS, PAPER_OPTIONS,
           SCENARIOS_PER_PHASE, SCENARIO_DAYS, ROUTE_START } from '@/data/finlit';
  export { ADDONS } from '@/data/addOns';
  export { SEGMENTS } from '@/data/segments';
  export { CHANNELS } from '@/data/channels';
  export { EVENTS } from '@/data/events';
  export { UPGRADES } from '@/data/upgrades';
  export { INSIGHTS } from '@/data/insights';
  export { ARCHETYPE_INFO, notebookCatalogue } from '@/data/notebookArchetypes';
  export * as balance from '@/data/balance';
  // Namespace import so the ES module LIVE BINDINGS are observable: the
  // scalars are reassigned inside their own module at hydration time, and a
  // namespace reflects that where a destructured copy would not.
  export * as finlitConstants from '@/engine/finlit/core/config/constants';
  export * as copy from '@/content/copy';
  export * as assets from '@/assets';
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
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /configHydrator$|\.\/client$/ }, (a) =>
          a.path.endsWith("./client") ? { path: "v:client", namespace: "stub" } : undefined
        );
        b.onLoad({ filter: /^v:client$/, namespace: "stub" }, () => ({
          contents: `export const getGamesimBaseUrl = () => '${API}';
                     export const getGamesimToken = () => ${JSON.stringify(TOKEN ?? null)};`,
          loader: "js",
        }));
      },
    },
  ],
});

// The real published config is the baseline every mutation starts from.
const res = await fetch(`${API}/player-config/${TYPE_ID}`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (!res.ok) {
  console.error(`could not read published config: ${res.status}`);
  process.exit(1);
}
const PUBLISHED = await res.json();
const clone = () => JSON.parse(JSON.stringify(PUBLISHED));

// Pristine snapshot of the bundled tables — every "must stay bundled"
// assertion compares against this rather than a hand-written guess.
const BASE = await import(`${pathToFileURL(outfile).href}?c=base`);
const BUNDLED = {
  genreCount: BASE.GENRES.length,
  firstGenreName: BASE.GENRES[0].name,
  addOnCount: BASE.ADDONS.length,
  paperCount: BASE.PAPER_OPTIONS.length,
  rowsPerGenre: BASE.CHANNELS_BY_GENRE[Object.keys(BASE.CHANNELS_BY_GENRE)[0]].length,
  // Read from the bundle rather than hardcoded, so re-balancing the game
  // doesn't turn these guards into false failures.
  baserate: BASE.finlitConstants.BASERATE,
  energyCap: BASE.finlitConstants.ENERGY_CAP,
};
console.log(
  `bundled baseline: ${BUNDLED.genreCount} genres (first "${BUNDLED.firstGenreName}"), ` +
    `${BUNDLED.addOnCount} add-ons, ${BUNDLED.rowsPerGenre} channel rows/genre`
);

let caseNo = 0;
let pass = 0;
let fail = 0;

/** Fresh module instance per case so mutations never leak between tests. */
async function run(name, { payload, status = 200, assert }) {
  caseNo += 1;
  const mod = await import(`${pathToFileURL(outfile).href}?c=${caseNo}`);

  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });

  const report = await mod.hydratePlayerConfig(TYPE_ID);
  try {
    assert(report, mod);
    console.log(`  PASS  ${name}`);
    pass += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}\n        ${err.message}`);
    fail += 1;
  }
}

const eq = (a, b, what) => {
  if (a !== b) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const has = (arr, v, what) => {
  if (!arr.includes(v)) throw new Error(`${what}: ${JSON.stringify(arr)} missing "${v}"`);
};
const hasNot = (arr, v, what) => {
  if (arr.includes(v)) throw new Error(`${what}: ${JSON.stringify(arr)} should not include "${v}"`);
};

console.log("\nHYDRATOR GUARD\n");

// ── 1. Happy path ───────────────────────────────────────────────────────
await run("real published config applies", {
  payload: PUBLISHED,
  assert: (r, m) => {
    eq(r.applied, true, "applied");
    has(r.sections, "genres", "sections");
    has(r.sections, "addOns", "sections");
    eq(m.GENRES.length >= 1, true, "genres present");
    // vendor coverage must come back as coverage[level][genre]
    const v = m.VENDORS[0];
    eq(typeof v.coverage[1], "object", "vendor coverage[1]");
    eq(typeof v.energyByLevel[1], "number", "vendor energyByLevel[1]");
  },
});

// ── 2. Edits actually land ──────────────────────────────────────────────
await run("an edited name + cost is visible on the table", {
  payload: (() => {
    const p = clone();
    p.config.genres[0].name = "RENAMED GENRE";
    p.config.addOns[0].costPerUnit = 99.5;
    return p;
  })(),
  assert: (r, m) => {
    eq(m.GENRES[0].name, "RENAMED GENRE", "genre name");
    eq(m.ADDONS[0].costPerUnit, 99.5, "addon cost");
  },
});

// ── 3. Removals are refused ─────────────────────────────────────────────
await run("dropping a genre refuses the whole coupled core", {
  payload: (() => {
    const p = clone();
    p.config.genres.splice(0, 1);
    p.config.genres[0].name = "SHOULD NOT APPLY";
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "genres", "sections");
    hasNot(r.sections, "vendors", "sections");
    eq(m.GENRES.length, BUNDLED.genreCount, "GENRES kept bundled length");
    eq(
      m.GENRES.some((g) => g.name === "SHOULD NOT APPLY"),
      false,
      "no partial genre edit leaked"
    );
    eq(r.skipped.some((s) => s.section === "genres"), true, "reported as skipped");
  },
});

await run("dropping an add-on skips only that section", {
  payload: (() => {
    const p = clone();
    p.config.addOns.splice(0, 1);
    p.config.genres[0].name = "GENRE STILL APPLIES";
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "addOns", "sections");
    has(r.sections, "genres", "sections");
    eq(m.GENRES[0].name, "GENRE STILL APPLIES", "unrelated section applied");
    eq(m.ADDONS.length > 0, true, "ADDONS kept bundled");
  },
});

// ── 4. Cross-reference breakage ─────────────────────────────────────────
await run("vendor missing coverage for a genre is refused", {
  payload: (() => {
    const p = clone();
    p.config.vendors[0].coverage = p.config.vendors[0].coverage.filter((c) => c.level !== 2);
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "vendors", "sections");
    eq(typeof m.VENDORS[0].coverage[2], "object", "bundled coverage[2] intact");
  },
});

await run("genre missing a channel row is refused", {
  payload: (() => {
    const p = clone();
    p.config.channelsByGenre[0].rows = p.config.channelsByGenre[0].rows.slice(0, 1);
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "channelsByGenre", "sections");
    const g = Object.keys(m.CHANNELS_BY_GENRE)[0];
    eq(m.CHANNELS_BY_GENRE[g].length, BUNDLED.rowsPerGenre, "bundled rows intact");
  },
});

await run("a new genre with no channel rows is refused", {
  payload: (() => {
    const p = clone();
    p.config.genres.push({ ...p.config.genres[0], id: "brandnew", name: "Brand New" });
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "genres", "sections");
    eq(m.GENRES.length, BUNDLED.genreCount, "GENRES unchanged");
  },
});

await run("a new genre WITH channel rows + vendor coverage is accepted", {
  payload: (() => {
    const p = clone();
    const g0 = p.config.genres[0];
    p.config.genres.push({ ...g0, id: "brandnew", name: "Brand New" });
    const rows0 = p.config.channelsByGenre[0].rows;
    p.config.channelsByGenre.push({ genreId: "brandnew", rows: JSON.parse(JSON.stringify(rows0)) });
    for (const v of p.config.vendors) {
      for (const level of [1, 2]) {
        const src = v.coverage.find((c) => c.level === level);
        v.coverage.push({ ...src, genreId: "brandnew" });
      }
    }
    return p;
  })(),
  assert: (r, m) => {
    has(r.sections, "genres", "sections");
    eq(m.GENRES.length, BUNDLED.genreCount + 1, "genre appended");
    eq(typeof m.CHANNELS_BY_GENRE.brandnew, "object", "channel rows appended");
    eq(typeof m.VENDORS[0].coverage[1].brandnew, "object", "vendor coverage appended");
  },
});

await run("dropping a production option is refused", {
  payload: (() => {
    const p = clone();
    p.config.productionOptions.paper.splice(0, 1);
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "productionOptions", "sections");
    eq(m.PAPER_OPTIONS.length, BUNDLED.paperCount, "PAPER_OPTIONS intact");
  },
});

// ── 5. Garbage in ───────────────────────────────────────────────────────
await run("404 leaves everything bundled", {
  status: 404,
  payload: { message: "nope" },
  assert: (r, m) => {
    eq(r.applied, false, "applied");
    eq(m.GENRES[0].name, BUNDLED.firstGenreName, "bundled genre name");
  },
});

await run("non-object payload leaves everything bundled", {
  payload: { config: "not an object" },
  assert: (r, m) => {
    eq(r.applied, false, "applied");
    eq(m.ADDONS.length > 0, true, "ADDONS intact");
  },
});

await run("a section with a non-numeric rate is refused", {
  payload: (() => {
    const p = clone();
    p.config.productionOptions.paper[0].rate = "fast";
    return p;
  })(),
  assert: (r, m) => {
    hasNot(r.sections, "productionOptions", "sections");
    eq(typeof m.PAPER_OPTIONS[0].rate, "number", "rate still numeric");
  },
});

// ── 6. Constants ────────────────────────────────────────────────────────
await run("object AND scalar constants both apply", {
  payload: (() => {
    const p = clone();
    p.config.constants.PAPER_COST = { ...p.config.constants.PAPER_COST, premium: 9.9 };
    // Scalars used to be impossible — `const` exports cannot be rebound from
    // outside their module, so the console offered them and nothing happened.
    p.config.constants.BASERATE = 12345;
    p.config.constants.ENERGY_CAP = 7;
    p.config.constants.HIRE_DAILY_WAGE = 99;
    return p;
  })(),
  assert: (r, m) => {
    eq(m.balance.PAPER_COST.premium, 9.9, "PAPER_COST applied");
    eq(m.finlitConstants.BASERATE, 12345, "BASERATE applied (live binding)");
    eq(m.finlitConstants.ENERGY_CAP, 7, "ENERGY_CAP applied (live binding)");
    eq(m.balance.HIRE_DAILY_WAGE, 99, "HIRE_DAILY_WAGE applied (live binding)");
    eq(r.sections.includes("constants"), true, "constants reported as applied");

    const note = r.skipped.find((s) => s.section === "constants");
    eq(/BASERATE|ENERGY_CAP|HIRE_DAILY_WAGE/.test(note?.why ?? ""), false,
       `applied scalars must not be listed as skipped: ${note?.why}`);
  },
});

await run("a scalar this build doesn't know is reported, not swallowed", {
  payload: (() => {
    const p = clone();
    p.config.constants.SOME_FUTURE_CONSTANT = 42;
    return p;
  })(),
  assert: (r) => {
    const note = r.skipped.find((s) => s.section === "constants");
    eq(!!note, true, "unknown constant reported");
    eq(/SOME_FUTURE_CONSTANT/.test(note.why), true, `named in report: ${note?.why}`);
  },
});

await run("a non-numeric scalar is refused rather than poisoning the engine", {
  payload: (() => {
    const p = clone();
    // A half-filled console form; letting this through would put NaN through
    // every downstream calculation, and the engine's invariant is that no NaN
    // ever reaches state.
    p.config.constants.BASERATE = "not a number";
    p.config.constants.ENERGY_CAP = null;
    return p;
  })(),
  assert: (r, m) => {
    eq(m.finlitConstants.BASERATE, BUNDLED.baserate, "BASERATE kept its bundled value");
    eq(m.finlitConstants.ENERGY_CAP, BUNDLED.energyCap, "ENERGY_CAP kept its bundled value");
  },
});

await run("object-shaped constants the export flattens still hydrate", {
  payload: (() => {
    const p = clone();
    p.config.constants.SCENARIOS_PER_PHASE = { 1: 3, 2: 3, 3: 3 };
    p.config.constants.SCENARIO_DAYS = [5, 25, 45, 65, 85];
    p.config.constants.ROUTE_START_SELF_CASH = 4321;
    p.config.constants.ROUTE_START_INVESTOR_OPENING_PROFIT = 777;
    return p;
  })(),
  assert: (r, m) => {
    eq(m.SCENARIOS_PER_PHASE[1], 3, "SCENARIOS_PER_PHASE");
    eq(m.SCENARIO_DAYS.join(","), "5,25,45,65,85", "SCENARIO_DAYS");
    eq(m.ROUTE_START.self.cash, 4321, "ROUTE_START.self.cash");
    eq(m.ROUTE_START.investor.openingProfit, 777, "ROUTE_START.investor.openingProfit");
    // ...and they must no longer be reported as needing a build
    const note = r.skipped.find((s) => s.section === "constants");
    eq(/SCENARIO_DAYS|ROUTE_START/.test(note?.why ?? ""), false, `not listed as skipped: ${note?.why}`);
  },
});

// ── 7. Images ───────────────────────────────────────────────────────────
await run("an asset key resolves through the encoded asset map", {
  payload: (() => {
    const p = clone();
    p.config.addOns[0].imagePath = "addons.integrated.charm_bear";
    p.config.addOns[0].imageAssetId = null;
    return p;
  })(),
  assert: (r, m) => {
    eq(typeof m.ADDONS[0].imgPath, "string", "imgPath resolved to a string");
    eq(m.ADDONS[0].imgPath.startsWith("/img/"), true, `imgPath looks like an asset URL: ${m.ADDONS[0].imgPath}`);
  },
});

await run("an uploaded asset URL beats the bundled sprite key", {
  payload: (() => {
    const p = clone();
    p.config.addOns[0].imagePath = "addons.integrated.charm_bear";
    p.config.addOns[0].imageAssetId = "https://cdn.example.com/custom.png";
    return p;
  })(),
  assert: (r, m) => {
    eq(m.ADDONS[0].imgPath, "https://cdn.example.com/custom.png", "upload wins");
  },
});

// ── 7b. Copy + image overrides land in place ────────────────────────────
await run("a copy override replaces the string the player renders", {
  payload: (() => {
    const p = clone();
    p.config.copy = {
      "HOME.title": "Notebook Tycoon",
      "FINAL.title": "How you did",
      "NOPE.does.not.exist": "ignored",     // unknown path
      "HOME.cta.continue": "not a string",  // real path, but a FUNCTION
      "HOME.learningPoints": "not a string" // real path, but an ARRAY
    };
    return p;
  })(),
  assert: (r, m) => {
    eq(m.copy.HOME.title, "Notebook Tycoon", "HOME.title");
    eq(m.copy.FINAL.title, "How you did", "FINAL.title");
    // The two type-mismatched paths must be untouched, or the app crashes on render.
    eq(typeof m.copy.HOME.cta.continue, "function", "cta.continue stayed a function");
    eq(Array.isArray(m.copy.HOME.learningPoints), true, "learningPoints stayed an array");
    const note = r.skipped.find((s) => s.section === "copy");
    eq(!!note, true, `mismatched keys reported: ${note?.why}`);
  },
});

await run("an image override replaces a path in the asset map", {
  payload: (() => {
    const p = clone();
    p.config.images = {
      "addons.integrated.charm_bear": { imageAssetId: "https://cdn.example.com/new.png" },
      "not.a.real.path": { imageAssetId: "https://cdn.example.com/x.png" },
    };
    return p;
  })(),
  assert: (r, m) => {
    eq(m.assets.A.addons.integrated.charm_bear, "https://cdn.example.com/new.png", "asset replaced");
    const note = r.skipped.find((s) => s.section === "images");
    eq(!!note, true, `unknown image path reported: ${note?.why}`);
  },
});

// ── 8. Retiring an add-on ───────────────────────────────────────────────
await run("active:false removes an add-on from the shop list", {
  payload: (() => {
    const p = clone();
    p.config.addOns[0].active = false;
    return p;
  })(),
  assert: (r, m) => {
    has(r.sections, "addOns", "sections");
    eq(
      m.ADDONS.some((a) => a.id === PUBLISHED.config.addOns[0].id),
      false,
      "retired add-on gone from list"
    );
  },
});

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
