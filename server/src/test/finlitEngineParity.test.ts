/**
 * Parity between the server's vendored FinLit engine and the player's original.
 *
 * `server/src/finlit/` is a HAND-COPIED subset of `notebook-pixel-sim/src/`,
 * differing only in that `@/`-aliased imports were rewritten as relative ones.
 * Nothing outside itself imports it yet, so nothing would notice if the player
 * changed a number and the copy did not — and the whole point of the copy is
 * that the server can one day reproduce what the player computed.
 *
 * Several files in the vendored tree carry a header saying this test exists and
 * will fail if they drift. Until now it did not exist, so those headers were
 * promissory notes nobody had written.
 *
 * Two checks, in order of what actually costs you:
 *
 *   1. VALUES — every exported constant is deep-compared. The game's numbers
 *      were verified field by field against the design spreadsheets (288 of 288
 *      matched); a silent divergence here means the server's future replay of a
 *      round disagrees with what the room actually played.
 *
 *   2. SOURCE — each vendored file is compared with its origin after
 *      normalising the one documented difference (the import rewrite). This
 *      catches drift in logic and in the comments that explain it, which the
 *      value check cannot see.
 *
 * When this fails, the fix is to re-copy the named file from the player and
 * redo the import rewrite. Do not "fix" it by editing the player to match the
 * server: the player is the original.
 */
import { readFileSync } from "fs";
import path from "path";

const SERVER_ROOT = path.join(__dirname, "..", "finlit");
const PLAYER_ROOT = path.join(__dirname, "..", "..", "..", "notebook-pixel-sim", "src");

/**
 * Where each vendored file came from.
 *
 * The layout was flattened on the way over — the player's
 * `engine/finlit/core/config/` became `finlit/data/`, and `core/` became
 * `finlit/engine/` — so the mapping cannot be derived from the paths.
 */
const VENDORED_FROM: Record<string, string> = {
  "data/channels.ts": "engine/finlit/core/config/channels.ts",
  "data/constants.ts": "engine/finlit/core/config/constants.ts",
  "data/genres.ts": "engine/finlit/core/config/genres.ts",
  "data/hiring.ts": "engine/finlit/core/config/hiring.ts",
  "data/marketing.ts": "engine/finlit/core/config/marketing.ts",
  "data/model.ts": "engine/finlit/core/config/model.ts",
  "data/production.ts": "engine/finlit/core/config/production.ts",
  "data/scenarios.ts": "engine/finlit/core/config/scenarios.ts",
  "data/vendors.ts": "engine/finlit/core/config/vendors.ts",
  "engine/fit.ts": "engine/finlit/core/fit.ts",
  "engine/run.ts": "engine/finlit/core/run.ts",
  "engine/simulate.ts": "engine/finlit/core/simulate.ts",
  "engine/types.ts": "engine/finlit/core/types.ts",
  "engine/adapter.ts": "engine/finlit/adapter.ts",
};

/**
 * Files with no single origin, excluded deliberately rather than forgotten.
 *
 *   data/index.ts, index.ts   — barrels rewritten for the flattened layout.
 *   engine/route.ts           — one type lifted out of the player's global
 *                               barrel; checked by value below instead.
 */
const NO_SINGLE_ORIGIN = ["data/index.ts", "index.ts", "engine/route.ts"];

const read = (p: string) => readFileSync(p, "utf8");

/**
 * Strip the differences the copy is ALLOWED to have.
 *
 * Only the import specifier is rewritten, so normalising means reducing every
 * import path to its final segment: `@/engine/finlit/core/config` and
 * `../data` both reduce to the same name, and a genuine change to WHAT is
 * imported still shows up. The one directory rename the copy performed
 * (`core/config` → `data`) is mapped explicitly rather than ignored wholesale.
 */
/**
 * Specifiers that name the SAME module on either side.
 *
 * The player reaches the config barrel three different ways depending on where
 * the importing file sits (`./config` from core, `@/data/finlit` from the
 * adapter); the vendored tree always says `../data` because the directory was
 * flattened and renamed. Collapsing all of them to one token is what lets the
 * rest of the file be compared verbatim.
 */
const CONFIG_BARREL = new Set([
  "./config",
  "../data",
  "@/data/finlit",
  "@/engine/finlit/core/config",
]);

/**
 * Strip the differences the copy is ALLOWED to have.
 *
 * Only import specifiers are rewritten by the sync, so normalising means
 * reducing each one to a canonical token: the config barrel to `CONFIG`, and
 * everything else to its final path segment. A genuine change to WHAT is
 * imported — a new symbol, a different module — still shows up.
 */
function normalise(source: string): string {
  return source
    .replace(/from\s+['"]([^'"]+)['"]/g, (_m, spec: string) => {
      if (CONFIG_BARREL.has(spec)) return "from 'CONFIG'";
      const leaf = String(spec).split("/").filter(Boolean).pop() ?? spec;
      return `from '${leaf}'`;
    })
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

describe("FinLit engine parity", () => {
  describe("values", () => {
    // Required lazily so a broken import fails inside the test, with the
    // module path in the message, rather than at collection time.
    const vendored = () => require("../finlit/data");
    const original = () =>
      require("../../../notebook-pixel-sim/src/engine/finlit/core/config");

    it("exports the same set of names", () => {
      const mine = Object.keys(vendored()).sort();
      const theirs = Object.keys(original()).sort();

      // The vendored copy is a SUBSET by design — it skips what the server has
      // no use for. What it must never do is export a name the player doesn't.
      const extra = mine.filter((k) => !theirs.includes(k));
      if (extra.length > 0) {
        throw new Error(
          `server/src/finlit/data exports names the player does not: ${extra.join(", ")}. ` +
            `The copy may only ever be a subset.`
        );
      }
    });

    it("gives every shared constant the same value", () => {
      const mine: Record<string, unknown> = vendored();
      const theirs: Record<string, unknown> = original();

      const drifted: string[] = [];
      for (const key of Object.keys(mine)) {
        if (!(key in theirs)) continue;
        if (typeof mine[key] === "function") continue; // compared as source below
        if (JSON.stringify(mine[key]) !== JSON.stringify(theirs[key])) drifted.push(key);
      }

      if (drifted.length > 0) {
        throw new Error(
          `These constants differ between server/src/finlit/data and the player's ` +
            `engine/finlit/core/config:\n  ${drifted.join("\n  ")}\n\n` +
            `Re-copy them from the player — it is the original.`
        );
      }
    });

    it("keeps the calibration constants the design sheets pin down", () => {
      const { BASERATE, BASE_MARKET_SHARE } = vendored();
      const theirs = original();

      // Called out because they are the two the spreadsheets fix explicitly —
      // BASE_MARKET_SHARE is 1/12, noted in the sheet as "divided by 12 teams".
      expect(BASERATE).toBe(theirs.BASERATE);
      expect(BASE_MARKET_SHARE).toBe(theirs.BASE_MARKET_SHARE);
    });

    it("re-exports Route rather than declaring a second copy of it", () => {
      // `engine/route.ts` exists only because other vendored files import the
      // type from that path. It must NOT declare the union itself: upstream
      // puts it in core/types.ts, and a second declaration is a second thing
      // to keep in sync — precisely what this test exists to prevent.
      const routeSource = read(path.join(SERVER_ROOT, "engine", "route.ts"));
      expect(routeSource).not.toMatch(/export type Route\s*=\s*'/);
      expect(routeSource).toMatch(/export type \{\s*Route\s*\}\s*from ["']\.\/types["']/);
    });
  });

  describe("source", () => {
    it.each(Object.entries(VENDORED_FROM))(
      "%s matches the player's %s",
      (vendoredPath, playerPath) => {
        const mine = normalise(read(path.join(SERVER_ROOT, vendoredPath)));
        const theirs = normalise(read(path.join(PLAYER_ROOT, playerPath)));

        // Jest's diff on a long string is unreadable, so report the first
        // differing line — that is what someone re-copying actually needs.
        if (mine !== theirs) {
          const a = mine.split("\n");
          const b = theirs.split("\n");
          const at = a.findIndex((line, i) => line !== b[i]);
          throw new Error(
            `server/src/finlit/${vendoredPath} has drifted from ` +
              `notebook-pixel-sim/src/${playerPath}.\n\n` +
              `First difference at line ${at + 1}:\n` +
              `  server: ${a[at] ?? "(end of file)"}\n` +
              `  player: ${b[at] ?? "(end of file)"}\n\n` +
              `Re-copy the player's file and rewrite its @/ imports as relative ones. ` +
              `The player is the original — do not edit it to match the server.`
          );
        }

        expect(mine).toBe(theirs);
      }
    );

    it("accounts for every vendored file", () => {
      // A new file added to the vendored tree without a mapping would otherwise
      // sit unchecked forever, which is exactly how the copy drifted before.
      const { readdirSync, statSync } = require("fs");
      const walk = (dir: string, prefix = ""): string[] =>
        readdirSync(dir).flatMap((entry: string) => {
          const full = path.join(dir, entry);
          const rel = prefix ? `${prefix}/${entry}` : entry;
          return statSync(full).isDirectory() ? walk(full, rel) : rel.endsWith(".ts") ? [rel] : [];
        });

      const present = walk(SERVER_ROOT).sort();
      const accounted = [...Object.keys(VENDORED_FROM), ...NO_SINGLE_ORIGIN].sort();

      const unchecked = present.filter((f) => !accounted.includes(f));
      if (unchecked.length > 0) {
        throw new Error(
          `These vendored files are checked by nothing: ${unchecked.join(", ")}.\n` +
            `Add each to VENDORED_FROM, or to NO_SINGLE_ORIGIN with a reason.`
        );
      }
    });
  });
});
