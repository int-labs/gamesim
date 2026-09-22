/**
 * Download a round's reports as PDFs, from the command line.
 *
 *   node scripts/exportRoundData.mjs --email <staff> --password <pw> --sim <simulationId>
 *   node scripts/exportRoundData.mjs --token <jwt> --sim <id> --round 0 --out ./exports
 *
 * Options:
 *   --email / --password   Staff credentials (alternative to --token)
 *   --token                Pre-issued JWT (skips login)
 *   --sim                  simulationId (required)
 *   --round                One round number, 0-BASED (default: every round)
 *   --kind                 decisions | competitor | both   (default: both)
 *   --out                  Output directory (default: ./exports)
 *
 * Env: GAMESIM_API_URL (default http://localhost:5000/api)
 *
 * ── THIS SCRIPT BUILDS NOTHING ──────────────────────────────────────────────
 * It used to: ~600 lines that fetched every collection over HTTP, assembled the
 * matrices and rendered the PDF itself. That was a SECOND IMPLEMENTATION of the
 * report, and it drifted — the hardcoded leaderboard weights here could not see
 * the operator's `LeaderboardConfig`, the market share it derived contradicted
 * the stored one, and a fix to either had to be made twice.
 *
 * The reports now live in `src/services/` and are served by
 * `GET /reports/:kind`, which the admin console's own button calls. This file
 * asks for exactly the same bytes and writes them to disk — so the CLI and the
 * console cannot disagree about what a report says, because there is only one
 * of them.
 *
 * What that means in practice: the API must be RUNNING and reachable, and the
 * token must belong to an admin or operator. There is no offline mode.
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const API = (process.env.GAMESIM_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (n, d = undefined) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const EMAIL     = opt("email",    process.env.ADMIN_EMAIL);
const PASSWORD  = opt("password", process.env.ADMIN_PASSWORD);
const TOKEN_ARG = opt("token",    process.env.GAMESIM_TOKEN);
const SIM_ID    = opt("sim");
const ROUND     = opt("round");
const KIND      = opt("kind", "both");
const OUT_DIR   = resolve(opt("out", "./exports"));

const KINDS = KIND === "both" ? ["competitor", "decisions"] : [KIND];

if (!SIM_ID) {
  console.error("usage: node scripts/exportRoundData.mjs --sim <simulationId> [--round N] [--kind decisions|competitor|both] [--email E --password P | --token T] [--out ./dir]");
  process.exit(2);
}
if (!TOKEN_ARG && (!EMAIL || !PASSWORD)) {
  console.error("error: supply --token OR both --email and --password");
  process.exit(2);
}
if (!KINDS.every((k) => ["decisions", "competitor"].includes(k))) {
  console.error(`error: --kind must be decisions, competitor or both (got "${KIND}")`);
  process.exit(2);
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
let token = TOKEN_ARG ?? null;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const list = (res) => (Array.isArray(res) ? res : (res?.data ?? []));

async function login() {
  const data = await api("POST", "/users/login", { email: EMAIL, password: PASSWORD });
  token = data.token;
  console.error(`[auth] signed in as ${EMAIL}`);
}

/**
 * Fetch one report and write it.
 *
 * The error path reads the body: a failure replies JSON ("No decisions
 * submitted for round 2"), and printing a status code alone would send the
 * operator looking for a bug that is really an empty round.
 */
async function fetchReport(kind, roundNumber) {
  const qs = new URLSearchParams({ simulationId: SIM_ID, roundNumber: String(roundNumber) });
  const res = await fetch(`${API}/reports/${kind}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) detail = `${res.status}: ${body.message}`;
    } catch { /* not JSON — the status alone is all there is */ }
    throw new Error(detail);
  }

  // The server's own name for the file, so disk matches what the console saves.
  const disposition = res.headers.get("x-report-filename")
    ?? `${kind}_${SIM_ID}_round${roundNumber}.pdf`;
  const bytes = Buffer.from(await res.arrayBuffer());
  const path = join(OUT_DIR, disposition);
  writeFileSync(path, bytes);
  console.error(`[write] ${path}  (${bytes.length.toLocaleString()} bytes)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!token) await login();

  // WHICH rounds. Derived from the rounds the operator configured rather than
  // from decisions, so a round nobody submitted to reports a readable error
  // instead of being silently skipped.
  let rounds;
  if (ROUND != null) {
    rounds = [Number(ROUND)];
  } else {
    rounds = list(await api("GET", `/rounds?simulationId=${SIM_ID}`))
      .map((r) => Number(r.roundNumber))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    console.error(`[rounds] ${rounds.length}`);
  }

  if (rounds.length === 0) {
    console.error("[warn] no rounds on this simulation");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const r of rounds) {
    for (const kind of KINDS) {
      try {
        await fetchReport(kind, r);
        written++;
      } catch (err) {
        // One empty round must not abort the others.
        console.error(`[skip] ${kind} round ${r} — ${err.message}`);
      }
    }
  }

  console.error(`[done] ${written} file(s)`);
}

main().catch((err) => { console.error("[error]", err.message); process.exit(1); });
