/**
 * Build a realistic, fully-played cohort so the console has something true to
 * show — and so a facilitator can be walked through it without a live class.
 *
 * Everything goes over the HTTP API, which means the seed exercises the same
 * routes an operator does: nothing is written that the app itself couldn't
 * write. It creates twelve teams (the number the design spreadsheet is
 * calibrated for — "IF MARKET SHARE = 8.125%, divided by 12 teams"), gives
 * each a roster with generated avatars, then plays three rounds: rounds 1 and
 * 2 are submitted and scored for real through /rounds/:id/calculate, and
 * round 3 is left Active so the operator console has live work to do.
 *
 *   node scripts/seedDemoCohort.mjs --email you@intlabs.io --password '…'
 *   node scripts/seedDemoCohort.mjs --email … --password … --reset
 *
 * `--reset` deletes and rebuilds the cohort; without it the script stops if
 * the simulation already exists, so it can't silently double-seed.
 */
const API = (process.env.GAMESIM_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const EMAIL = opt("email", process.env.ADMIN_EMAIL);
const PASSWORD = opt("password", process.env.ADMIN_PASSWORD);
const SIM_NAME = opt("name", "Notebook Business Sim · Cohort A");
const RESET = flag("reset");

if (!EMAIL || !PASSWORD) {
  console.error("usage: node scripts/seedDemoCohort.mjs --email <admin> --password <pw> [--reset]");
  process.exit(2);
}

let TOKEN = null;

/**
 * `token` overrides the admin token for calls that must be made AS a team —
 * the progress heartbeat takes its identity from the caller's own JWT, so
 * posting one on a team's behalf with the admin token is refused (correctly).
 */
async function call(method, path, body, { raw = false, token } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...((token ?? TOKEN) ? { Authorization: `Bearer ${token ?? TOKEN}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    // A bare "fetch failed" says nothing about which of ~80 calls died.
    throw new Error(
      `${method} ${path} — network error: ${err?.cause?.code ?? err?.cause?.message ?? err.message}`
    );
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok && !raw) {
    throw new Error(`${method} ${path} → ${res.status} ${data?.message ?? text.slice(0, 160)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

/** Several list endpoints answer {data:[…]} and others a bare array. */
const list = (d) => (Array.isArray(d) ? d : (d?.data ?? []));

/**
 * …and the create endpoints are equally inconsistent: POST /teams answers
 * `{data:{…}}` while POST /simulations answers the document itself. Unwrap one
 * level when the envelope is clearly an envelope.
 */
const one = (d) => (d && typeof d === "object" && !("_id" in d) && d.data ? d.data : d);

// ── The cohort ──────────────────────────────────────────────────────────
/**
 * Twelve teams, each with a deliberate strategy so the scoreboard tells a
 * story rather than showing twelve near-identical rows. `price` is a multiplier
 * on each product's allowed range and `score` is design quality (0–3) — the two
 * levers calcMarketModel actually competes teams on.
 */
const TEAMS = [
  { name: "Paper Trail Co.",  lead: "Amara Osei",       strategy: "premium",  price: 0.90, score: 2.8 },
  { name: "Inkwell Studio",   lead: "Bhavin Rao",       strategy: "balanced", price: 0.55, score: 2.2 },
  { name: "Margin Notes",     lead: "Chen Wei",         strategy: "budget",   price: 0.18, score: 1.4 },
  { name: "The Binding",      lead: "Dara Fitzgerald",  strategy: "premium",  price: 0.95, score: 2.6 },
  { name: "Foxed Corner",     lead: "Elif Demir",       strategy: "design",   price: 0.70, score: 3.0 },
  { name: "Gridline",         lead: "Farid Haddad",     strategy: "budget",   price: 0.22, score: 1.1 },
  { name: "Ampersand Press",  lead: "Grace Mwangi",     strategy: "balanced", price: 0.50, score: 2.0 },
  { name: "Dot & Rule",       lead: "Hana Sato",        strategy: "volume",   price: 0.30, score: 1.7 },
  { name: "Signature Fold",   lead: "Ivan Petrov",      strategy: "premium",  price: 0.88, score: 2.5 },
  { name: "Deckle Edge",      lead: "Júlia Marques",    strategy: "design",   price: 0.75, score: 2.9 },
  { name: "Quire",            lead: "Kwame Boateng",    strategy: "balanced", price: 0.48, score: 1.9 },
  { name: "Colophon",         lead: "Lina Fernández",   strategy: "budget",   price: 0.25, score: 1.2 },
];

const MEMBER_POOL = [
  ["Noor Haddad", "Operations"], ["Theo Lindqvist", "Finance"], ["Mei Tanaka", "Design"],
  ["Samir Patel", "Marketing"], ["Rosa Iglesias", "Supply"], ["Yusuf Aydın", "Analytics"],
  ["Adaeze Nwosu", "Design"], ["Lukas Meyer", "Finance"], ["Priya Nair", "Operations"],
  ["Tomás Silva", "Marketing"], ["Ingrid Berg", "Supply"], ["Omar Khalil", "Analytics"],
];

// Everyone gets the platform default. `initials` is deliberately absent: it
// renders the person's letters ("DM", "TM") rather than a character, which is
// exactly what a missing avatar looks like.
const AVATAR_STYLES = ["critters"];

/** Deterministic per-round drift so rounds differ without being random. */
const drift = (round, i) => 1 + ((round * 7 + i * 13) % 11 - 5) / 100; // ±5 %

async function main() {
  // ── Sign in ───────────────────────────────────────────────────────────
  const login = await call("POST", "/users/login", { email: EMAIL, password: PASSWORD }, { raw: true });
  if (!login.ok) throw new Error(`Sign-in failed: ${login.data?.message ?? login.status}`);
  TOKEN = login.data.token;
  console.log(`signed in as ${login.data.user.email} (${login.data.user.role})\n`);

  // ── Simulation type + its products ────────────────────────────────────
  const types = list((await call("GET", "/simulation-types")).data);
  const type = types.find((t) => /notebook/i.test(t.name)) ?? types[0];
  if (!type) throw new Error("No simulation type exists. Run the Notebook provisioning script first.");

  const products = list((await call("GET", `/products?simulationTypeId=${type._id}`)).data);
  if (products.length === 0) throw new Error(`Simulation type "${type.name}" has no products.`);

  const segments = list((await call("GET", `/segments?simulationTypeId=${type._id}`)).data);
  const segment = segments[0];
  if (!segment) throw new Error(`Simulation type "${type.name}" has no segments.`);
  console.log(`type "${type.name}" · ${products.length} products · segment "${segment.name}"`);

  // ── Simulation ────────────────────────────────────────────────────────
  let sims = list((await call("GET", "/simulations")).data);
  let sim = sims.find((s) => s.simulationName === SIM_NAME);

  if (sim && !RESET) {
    console.error(`\n"${SIM_NAME}" already exists (${sim._id}). Re-run with --reset to rebuild it.`);
    process.exit(1);
  }
  if (sim && RESET) {
    console.log(`resetting "${SIM_NAME}" …`);
    // Results and decisions are keyed by round, so clear them before the rounds go.
    const rounds = list((await call("GET", `/rounds?simulationId=${sim._id}`)).data);
    for (const r of rounds) {
      await call("DELETE", `/decisions?simulationId=${sim._id}&roundNumber=${r.roundNumber}`, undefined, { raw: true });
      await call("DELETE", `/rounds?simulationId=${sim._id}&roundNumber=${r.roundNumber}`, undefined, { raw: true });
      await call("DELETE", `/rounds/${r._id}`, undefined, { raw: true });
    }
    for (const t of list((await call("GET", `/teams?simulationId=${sim._id}`)).data)) {
      await call("DELETE", `/teams/${t._id}`, undefined, { raw: true });
    }
    await call("DELETE", `/simulations/${sim._id}`, undefined, { raw: true });
    sim = null;
  }

  if (!sim) {
    sim = one((await call("POST", "/simulations", {
      simulationName: SIM_NAME,
      simulationTypeId: type._id,
      status: "Active",
      // currRounds starts at 1 and is advanced by /rounds/:id/end. The Round
      // model enforces consistency against it — a past round MUST be Completed
      // and the current one must not be — so seeding it at 3 up front makes
      // round 1 unconstructible.
      config: { totalRounds: 3, currRounds: 1 },
    })).data);
    console.log(`created simulation ${sim._id}`);
  }

  // ── Teams, logins, rosters ────────────────────────────────────────────
  console.log(`\nseeding ${TEAMS.length} teams …`);
  const teams = [];
  for (const [i, spec] of TEAMS.entries()) {
    const team = one((await call("POST", "/teams", {
      simulationId: sim._id,
      teamName: spec.name,
      teamLeader: spec.lead,
    })).data);

    // A team is a Team document plus a role:"team" User carrying the passkey.
    const user = one((await call("POST", "/users", {
      role: "team",
      teamId: team._id,
      simulationId: sim._id,
      email: `team-${team._id}@seed.intlabs.internal`,
    })).data);

    // Roster: the lead plus two others, avatars generated server-side.
    const roster = [{ name: spec.lead, role: "Team lead" }];
    for (let k = 0; k < 2; k++) {
      const [name, role] = MEMBER_POOL[(i * 2 + k) % MEMBER_POOL.length];
      roster.push({ name, role });
    }
    const members = roster.map((m, order) => ({
      ...m,
      order,
      avatar: {
        kind: "dicebear",
        style: AVATAR_STYLES[(i + order) % AVATAR_STYLES.length],
        seed: `${spec.name}-${m.name}`,
        // No `url`: the server renders the SVG from (style, seed). It used to
        // be required here, and sending a placeholder stored the placeholder.
      },
    }));
    const rosterRes = await call("PUT", `/teams/${team._id}/members`, members, { raw: true });

    teams.push({ ...team, spec, passkey: user?.passkey, rosterOk: rosterRes.ok });
    process.stdout.write(`  ${String(i + 1).padStart(2)}. ${spec.name.padEnd(18)} passkey=${user?.passkey ?? "—"}\n`);
  }

  // ── Rounds ────────────────────────────────────────────────────────────
  console.log("\nplaying rounds …");
  for (let round = 1; round <= 3; round++) {
    const r = one((await call("POST", "/rounds", {
      simulationId: sim._id,
      roundNumber: round,
      status: "Pending",
    })).data);

    // Activating starts the round timer, so a duration is mandatory — and it
    // lives under `timer`, not at the top level.
    await call("PATCH", `/rounds/${r._id}/status`, {
      status: "Active",
      timer: { durationMinutes: 25 },
    });

    // Every team submits.
    for (const [i, team] of teams.entries()) {
      const inputs = products.map((p) => {
        const fields = [];

        /**
         * Price relative to the reference the engine will derive, not to the
         * field's slider range.
         *
         * `calcFinancials` builds `dynamicPrice` from the product's money
         * fields (here, `unit_cost`) scaled by a diminishing-returns factor,
         * then scores the selling price against THAT. Seeding prices off
         * min/max instead put every team 1.7-2.4x above the reference, which
         * the model correctly reads as gross overpricing — so the whole demo
         * cohort converted almost nobody and posted a pure loss. The charts
         * were right; the seed was not.
         *
         * Mirrors calcFinancials' own bell factor so the seeded markup lands
         * where it is meant to: a spread around the reference, with some teams
         * under-pricing for volume and some over-pricing for margin. That
         * spread IS the debrief.
         */
        const unitCostField = (p.fields ?? []).find((f) => f.key === "unit_cost");
        const unitCostValue = Math.round((3 + team.spec.score * 2.2) * 100) / 100;
        const bellFactor = (() => {
          const min = unitCostField?.minValue;
          const max = unitCostField?.maxValue;
          if (min == null || max == null || max <= min) return 1;
          const mean = (min + max) / 2;
          const sd = (max - min) / 4;
          const z = (unitCostValue - mean) / sd;
          return 2 - Math.exp(-(z * z) / 2);
        })();
        const reference = unitCostValue * bellFactor;

        for (const f of p.fields ?? []) {
          const lo = f.minValue ?? 0;
          const hi = f.maxValue ?? 100;
          let value;
          if (f.key === "selling_price") {
            // 0.85x-1.45x of the reference across the cohort.
            const markup = 0.85 + team.spec.price * 0.6;
            const raw = reference * markup * drift(round, i);
            value = Math.round(Math.min(hi, Math.max(lo, raw)) * 100) / 100;
          } else if (f.key === "score") {
            value = Math.min(hi, Math.max(lo, Math.round(team.spec.score * drift(round, i) * 10) / 10));
          } else if (f.key === "unit_cost") {
            // Better design costs more to make — that trade-off is the lesson.
            value = unitCostValue;
          } else if (f.key === "projected_market_share") {
            value = 1 / TEAMS.length;
          } else if (f.key === "channel_offline") {
            // Each team picks a primary channel mix based on their index.
            // Patterns: offline-heavy, online-heavy, retail-heavy, omni.
            value = [1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0][i % 12] ?? 1;
          } else if (f.key === "channel_online") {
            value = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1][i % 12] ?? 1;
          } else if (f.key === "channel_retail") {
            value = [0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1][i % 12] ?? 1;
          } else {
            value = lo;
          }
          fields.push({ fieldId: f._id, value });
        }
        // The Decision model requires the denormalised name and the segment
        // alongside the id — see models/decisions.ts.
        return { productId: p._id, productName: p.productName, segmentId: segment._id, fields };
      });

      await call("POST", "/decisions", {
        simulationId: sim._id,
        teamId: team._id,
        roundNumber: round,
        inputs,
      });
    }

    if (round < 3) {
      // The operator's own path: score every team, mark the round Completed and
      // advance currRounds, all in one transaction.
      const ended = await call("POST", `/rounds/${r._id}/end`, {}, { raw: true });
      if (!ended.ok) throw new Error(`ending round ${round}: ${ended.data?.message ?? ended.status}`);
      console.log(
        `  round ${round}: ${teams.length} decisions · ended · ` +
          `${ended.data?.results ?? ended.data?.resultsWritten ?? "?"} results`
      );
    } else {
      console.log(`  round ${round}: ${teams.length} decisions · left Active for the console`);
    }
  }

  // ── Live progress for the open round ──────────────────────────────────
  //
  // The console's "In the room" band reads this. Without it a freshly seeded
  // cohort shows twelve teams that have supposedly never opened the app, which
  // makes the one panel a facilitator uses during a session look broken.
  //
  // The spread is deliberate: a couple racing ahead, a couple mid-run, one
  // barely started and nearly out of energy, one finished, and the rest left
  // absent — because "not started" is a real state and the panel exists to
  // make it visible.
  const PROGRESS = [
    { day: 82, phase: 3, cash: 5210, energy: 46, lines: 3 },
    { day: 74, phase: 3, cash: 3860, energy: 38, lines: 3 },
    { day: 63, phase: 3, cash: 2480, energy: 27, lines: 2 },
    { day: 55, phase: 2, cash: 1740, energy: 22, lines: 2 },
    { day: 41, phase: 2, cash: 980, energy: 14, lines: 2 },
    { day: 34, phase: 2, cash: 720, energy: 11, lines: 1 },
    { day: 11, phase: 1, cash: 210, energy: 5, lines: 0 },
    { day: 90, phase: 3, cash: 6390, energy: 52, lines: 4, ended: true },
  ];

  let beats = 0;
  for (let i = 0; i < PROGRESS.length && i < teams.length; i++) {
    const t = teams[i];
    if (!t.passkey) continue;

    // The heartbeat route takes the team's identity from its own token, so we
    // have to sign in as each team rather than posting on their behalf.
    const login = await call(
      "POST",
      "/users/login-passkey",
      { passkey: t.passkey },
      { raw: true }
    );
    const teamToken = login.data?.token;
    if (!teamToken) continue;

    const beat = await call(
      "PUT",
      "/team-progress",
      { roundNumber: 3, shopName: t.spec.name, ...PROGRESS[i] },
      { raw: true, token: teamToken }
    );
    if (beat.ok) beats++;
  }
  console.log(`  live progress: ${beats} of ${teams.length} teams reporting`);

  // ── Facilitator content ───────────────────────────────────────────────
  const notes = [
    { roundNumber: 1, title: "Round 1 briefing", pinned: true,
      body: "Pick one audience and design for it.\n\nA notebook that tries to please everyone competes with everyone. Your score field is design quality — it costs unit margin, so decide what that quality is buying you." },
    { roundNumber: 2, title: "Watch your inventory", pinned: false,
      body: "Inventory is capital you already spent.\n\nOverstock traps cash and understock hands demand to the team beside you. Cleanliness is 25 points of the final score." },
    { roundNumber: 3, title: "Last round — margin over volume", pinned: true,
      body: "Revenue is not cash and cash is not profit.\n\nThis is the round where a thin margin at high volume usually loses to a healthy margin at moderate volume." },
  ];
  for (const n of notes) {
    await call("POST", "/round-notes", { simulationId: sim._id, ...n }, { raw: true });
  }

  // simulationId is a QUERY param on this route, not a body field.
  const debrief = await call("PUT", `/debriefs?simulationId=${sim._id}`, {
    title: "Cohort A · Debrief",
    intro:
      "Across three rounds the market rewarded focus over breadth. The teams that named an audience and priced for it held share even when a cheaper competitor appeared; the teams that chased volume on thin margin ran the same revenue with far less left over.",
    sections: [
      { order: 1, title: "What the market rewarded",
        body: "Design quality only paid where price matched the audience it was aimed at. A high score with a premium price held share; the same score at a budget price bought volume the margin could not carry." },
      { order: 2, title: "Where cash went missing",
        body: "Revenue and cash parted company wherever production ran ahead of demand. Stock is spent money sitting still — the cleanliness rate is what turns that from an opinion into a number." },
      { order: 3, title: "Reading your own P&L",
        body: "Trace one number back to one decision. Marketing is an expense that buys visibility; the question is never what it cost, but what it returned in the round after." },
    ],
  }, { raw: true });
  if (debrief.ok) await call("POST", `/debriefs/publish?simulationId=${sim._id}`, {}, { raw: true });

  // ── Report ────────────────────────────────────────────────────────────
  const results = list((await call("GET", `/results?simulationId=${sim._id}`)).data);
  console.log(`\ndone.`);
  console.log(`  simulation  ${sim._id}  "${SIM_NAME}"`);
  console.log(`  teams       ${teams.length} (rosters: ${teams.filter((t) => t.rosterOk).length} seeded)`);
  console.log(`  results     ${results.length} documents`);
  console.log(`  notes       ${notes.length} · debrief ${debrief.ok ? "published" : "skipped"}`);
  console.log(`\n  a team can sign in to the player with any passkey above.`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
