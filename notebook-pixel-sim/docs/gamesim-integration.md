# Notebook player ↔ gamesim backend integration

How this game talks to the gamesim API on `main`. The backend stays generic and
essentially untouched: no new server files, no `shared/` package, no `/player/*`
routes — the only server edit is a one-line schema fix (see below) without which
no round can be calculated at all. Everything else is frontend work plus operator
data setup.

## Authority split

| | Source | Status |
|---|---|---|
| Gameplay, animation, day-by-day simulation | browser FinLit engine (`src/engine/finlit/`) | indicative UX — **not** the score |
| Own financials (revenue / COGS / gross profit / customers) | server `calcFinancials` via `/projections` | **official** |
| Market share, weighted score, ranking | server `calcMarketModel` via `/results` | **official** |

The two models are genuinely different. Numbers will not match, and the UI says
so wherever both appear (`PhaseSequenceModal`, `FinalResultsScreen`).

## Endpoints used (all already on `main`, all callable with a team token)

| Purpose | Call | Where |
|---|---|---|
| Team login | `POST /users/login-passkey` → `{token, teamId, simulationId}` | `client.ts`, `src/access/passkey.ts` |
| Simulation context | `GET /simulations/:id`, `GET /rounds?simulationId=` | `GamesimProvider.tsx` |
| Decision form schema | `GET /products?simulationTypeId=`, `GET /base-data?…`, `GET /global-inputs?…` | `GamesimProvider.tsx` |
| Server projection | `POST /projections/recalc` | `sync.ts` → `fetchServerProjection` |
| Submit decision (1×/round) | `POST /decisions` (409 = already submitted) | `sync.ts` → `submitRoundDecision` |
| Own financials | `GET /projections?simulationId=&teamId=&roundNumber=` | `sync.ts` → `fetchOfficialFinancials` |
| Cross-team shares | `GET /results?simulationId=&roundNumber=` | `sync.ts` → `fetchOfficialResults` |

The competitive run itself is the operator's: `POST /rounds/:id/calculate` (admin/
operator, round must be `Active`) runs `calcMarketModel` for every product and
then `calcFinancials` per team, writing `Results` + `Projections`. The player
never calls it — it just polls until the documents appear.

Session ids (`token`, `teamId`, `simulationId`) live in `localStorage` under
`gamesim:*`; `simulationTypeId` comes from the simulation document.

Base URL: `VITE_GAMESIM_API_URL` (default `http://localhost:5000/api`).

### Where the mapping lives — frontend only

There is **nothing to add on the backend**. The server stays generic: it reads
`Decision.inputs[].fields[]` and scores whatever numbers it finds. The
translation "notebook design → numbers" is [`src/gamesim/mapping.ts`](../src/gamesim/mapping.ts),
in the browser. What the backend needs is **data**, not code: ProductFields with
coefficients, which [`scripts/provision-notebook.mjs`](../scripts/provision-notebook.mjs)
writes over the HTTP API.

`score` is computed client-side and trusted by the server. For a classroom
workshop that is fine; if anti-cheat matters later, the alternative is sending the
raw design choices as separate ProductFields and letting `calcMarketModel` compete
each one — more operator config, no frontend rewrite of the seam itself.

### Verified against the real engine — two things that shape the data

Both found by running `calcMarketModel` directly with three teams:

1. **`selling_price` never competes.** `calcMarketModel.ts:192` skips it (and
   `projected_market_share`) in the scoring loop. Price still drives revenue and
   `productScore` in `calcFinancials`, but coefficients on it are dead config. So
   **`score` is today the only field teams actually compete on.**
2. **The diminishing-returns factor distorts a narrow range.** `getInput()`
   multiplies every non-enum value by a factor that is 1.0 at the midpoint of
   `[minValue, maxValue]` and 2.0 at either bound — intended for cost/quantity
   fields, but applied to all. With `score` ranged `[0.6, 1.2]` (the exact vocFit
   band), scores 1.05 / 0.92 / 0.74 produced shares **45.2% / 24.9% / 29.9%** —
   the weakest product beat the middle one. Widening the field to `[0, 3]` puts
   the whole band on one side of the midpoint, where the curve is monotonic, and
   restores order: **42.7% / 35.4% / 21.9%**. Enum fields skip the factor entirely
   and are the other option, at the cost of bucketing a continuous value.

`projected_market_share` is also load-bearing: the official share is
`min(scoreShare × pms × numberOfTeams, 1)`, so `pms = 1/numberOfTeams` is neutral.
The provisioning script ranges the field `[0, 2/teams]` so its **midpoint** is that
neutral value, and the player sends the midpoint by default
(`defaultProjectedShareFor`) — the one value the diminishing-returns factor leaves
undistorted.

### Fixed: the Decision schema blocker

`server/src/models/decisions.ts` declared the per-product field list as an array
of arrays, so Mongoose stored `fields` as `[[{fieldId, value}]]` while
`calcMarketModel.ts:168` and `calcFinancials.ts:187/276/283/297` read it flat —
`POST /rounds/:id/calculate` threw a TypeError as soon as any field had
coefficients. Fixed by dropping the outer array (one line, no other server file
touched), verified against the real model.

**Decisions submitted before that fix are still stored nested and stay
unreadable** — clear them with `DELETE /decisions?simulationId=&roundNumber=`
(admin) and have teams resubmit. No data migration.

### Also not on `main`

- **No round/result socket events.** `main`'s Socket.IO server only logs
  connections, so the player polls (`POLL_MS = 20s` in `GamesimProvider.tsx`).
- **`POST /projections/recalc` is not a pure preview** — it upserts the team's
  projection document. It is therefore called when the confirm modal opens, not
  on every keystroke.
- **No draft/save endpoint.** `POST /decisions` is insert-only and unique per
  (simulation, team, round), so there is nothing to hydrate a half-finished
  decision from; local state is the draft.

## Running it locally

```bash
npm run dev:server        # from the repo root — API on :5000
npm run dev:player        # from the repo root — player on :5173
```

Open **http://localhost:5173**, not `http://127.0.0.1:5173`: the server's CORS
allowlist includes `localhost:5173` but not the numeric host. Deployed, the
player's origin has to be in `CLIENT_ORIGIN` or `ALLOWED_ORIGINS`.

Login is the V3 Academy gate itself — `PassKeyPanel` → `verifyPassKey()`
(`src/access/passkey.ts`), whose body now signs in against the API and stores the
session. There is no second, plainer login screen; `GamesimProvider` renders the
same gate when no session is held, and `AccessMenu`'s log-out goes through the
provider so the next login can't inherit the previous team's context.

## Glue mapping (`src/gamesim/mapping.ts`)

`toDecisionInputs()` turns game state into `inputs[].fields[{fieldId, value}]`.
Field ids come from `GET /products`; a key the product doesn't define is skipped.
Notebook is **multi-product**: each local product line becomes one Product
decision. Lines pair with Products by name, then positionally; a line with no
Product left over is dropped (the server has nowhere to put it).

| Product field key | Filled from | Status |
|---|---|---|
| `selling_price` / `price` | `ProductLine.price` | reasonable |
| `score` / `quality` | `vocFit(spec, price, channels, genre)` ∈ [0.6, 1.2] | **proposal** |
| `unit_cost` / `cost` | `unitCost(spec)` | reasonable |
| `projected_market_share` | midpoint of the field's configured range (the neutral claim) | **proposal — new input; V3 had a fixed `BASE_MARKET_SHARE`** |

### Open questions for Shafnat (not decided here)

1. Is the notebook contract really the generic `POST /decisions` + ProductField
   route, or is there another intended path?
2. Confirm notebook = multi-product (one Product decision per line)?
3. `score`/`quality` is computed in the browser and trusted by the server. Good
   enough, or should the server derive it from raw fields (anti-cheat)?
4. Granularity: is one `score` field enough, or should several fields compete?

### Server quirks the mapping respects

- A `ProductField` with **no `coefficients`** is skipped by `calcMarketModel`.
  Without them, competition contributes **zero** — this is a data-setup
  requirement, not a code one.
- `direction` is `{0, 1}` (0 = lower is better).
- `projected_market_share` is read as a **fraction** (clamped to `[0,1]`) by
  `recalcProjections`, whose default when the entry is missing is `20` → clamps
  to `1.0` (100%). The mapping always sends an explicit fraction so that default
  is never hit.

## Operator prerequisites (data, not code)

Steps 1–4 are scripted; 5 is manual on purpose.

```bash
GAMESIM_API_URL=http://localhost:5000/api \
GAMESIM_ADMIN_TOKEN=<admin jwt> \
node scripts/provision-notebook.mjs --teams 4        # dry run — prints the plan
                                              --apply  # writes
```

[`scripts/provision-notebook.mjs`](../scripts/provision-notebook.mjs) creates, over
the same HTTP endpoints the admin console uses:

1. SimulationType **Notebook** + one Segment (`notebook_buyers`).
2. Three Products — *Student Notebook*, *Planner*, *Daily Journal*, matching the
   game's archetypes — each with the four ProductFields, `coefficients` included.
3. `BaseData`, **both halves**: `marketData…yearlyData[<round>].marketSize` (market
   sizes taken from the game's own genre demand per phase) **and**
   `marketModel.segments[].products[].fields[]`, which is what
   `POST /rounds/:id/calculate` iterates — a product missing from `marketModel` is
   never scored.
4. One `GlobalInput` (marketing push, relative impacts).

It is **idempotent**: each step looks the document up first and PATCHes instead of
POSTing, and existing ProductField `_id`s are preserved so already-submitted
decisions keep resolving. Re-run it after editing the config block at the top.

It deliberately does **not** use `npm run seed-db`: `seed-data/merge-config.json`
sets `"strategy": "replace"` for `products`/`segments`/`simulationTypes`/`baseData`/
`globalInputs`, so a seed run would overwrite those collections and take real work
with it. (Note `start.sh` runs `seed-db` automatically in Render preview
environments — fine there, since each preview has its own database.)

**Step 5, manual in the admin console:** teams and their team users (`POST /users`
takes a password, which a script should not be inventing — the passkey is generated
for you there), a Simulation of type Notebook with `config.totalRounds`, and Round 1
set to **Active**. Then point the player at the API with
`VITE_GAMESIM_API_URL=<api>/api`.

Without step 2's coefficients the plumbing still works end to end — every team
just scores 0.
