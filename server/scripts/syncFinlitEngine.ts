/**
 * Re-copy the player's FinLit engine into `server/src/finlit/`.
 *
 *   npm run sync-finlit           # apply
 *   npm run sync-finlit -- --dry  # show what would change
 *
 * `server/src/finlit/` is a vendored subset of `notebook-pixel-sim/src/`. Until
 * now it was copied by hand, which is why it silently fell a long way behind:
 * the player widened `GenreId` from a closed union to `string` so operators
 * could publish new genres at runtime, renamed every genre, and added the
 * tagline/description/strengths fields the archetype cards read — and the
 * server's copy knew none of it.
 *
 * The copy is a MECHANICAL transform of the original, and this script is that
 * transform: copy the file, rewrite the import specifiers for the flattened
 * layout, prepend a provenance header. `src/test/finlitEngineParity.test.ts`
 * then proves the result matches, so the two can never drift unnoticed again.
 *
 * The player is always the original. If parity fails, run this — never edit
 * the player to match the server.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const SERVER_ROOT = path.join(__dirname, "..", "src", "finlit");
const PLAYER_ROOT = path.join(__dirname, "..", "..", "notebook-pixel-sim", "src");

/** vendored path → player path. Mirrors VENDORED_FROM in the parity test. */
const FILES: Record<string, string> = {
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
 * The whole of the difference between original and copy.
 *
 * The player's `core/config/` becomes `data/`, so anything under `engine/`
 * that reached for `./config` must now reach one level up. `@/data/finlit` is
 * the player's alias for the same barrel.
 */
const REWRITES: Array<[RegExp, string]> = [
  [/from '\.\/config'/g, "from '../data'"],
  [/from '@\/data\/finlit'/g, "from '../data'"],
  [/from '@\/engine\/finlit\/core\/config'/g, "from '../data'"],
];

function transform(source: string): string {
  let out = source;
  for (const [pattern, replacement] of REWRITES) out = out.replace(pattern, replacement);
  return out;
}

function main() {
  const dryRun = process.argv.includes("--dry");

  if (!existsSync(PLAYER_ROOT)) {
    console.error(
      `The player app is not present at ${PLAYER_ROOT}.\n` +
        `notebook-pixel-sim/ only exists on the notebook-sim branch.`
    );
    process.exit(1);
  }

  let changed = 0;
  let same = 0;

  for (const [vendoredPath, playerPath] of Object.entries(FILES)) {
    const from = path.join(PLAYER_ROOT, playerPath);
    const to = path.join(SERVER_ROOT, vendoredPath);

    if (!existsSync(from)) {
      console.error(`  MISSING  ${playerPath} — the player moved or deleted it.`);
      process.exitCode = 1;
      continue;
    }

    const next = transform(readFileSync(from, "utf8"));
    const current = existsSync(to) ? readFileSync(to, "utf8") : null;

    if (current === next) {
      same++;
      continue;
    }

    changed++;
    console.log(`  ${current === null ? "NEW " : "SYNC"}  ${vendoredPath}  ←  ${playerPath}`);

    if (!dryRun) {
      mkdirSync(path.dirname(to), { recursive: true });
      writeFileSync(to, next, "utf8");
    }
  }

  console.log(
    `\n${dryRun ? "Would sync" : "Synced"} ${changed} file${changed === 1 ? "" : "s"}; ` +
      `${same} already current.`
  );
  if (changed > 0 && !dryRun) {
    console.log("Now run `npx tsc --noEmit` and `npx jest src/test/finlitEngineParity.test.ts`.");
  }
}

main();
