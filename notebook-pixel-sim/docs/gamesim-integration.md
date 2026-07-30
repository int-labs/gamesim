# Notebook player ↔ gamesim backend integration

How this game talks to the gamesim API on `main`. **The backend is final and
untouched** — no new server files, no `shared/` package, no `/player/*` routes.
Everything below is frontend work plus operator data setup.

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
| Team login | `POST /users/login-passkey` → `{token, teamId, simulationId}` | `client.ts`, `PasskeyLoginScreen.tsx` |
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

### Blocker for scoring — one line in the backend, Shafnat's call

`server/src/models/decisions.ts:38` declares the per-product field list as an
**array of arrays**:

```ts
fields: [{ type: [DecisionFieldSchema], required: true, default: [] }]
```

Mongoose therefore stores `fields` as `[[{ fieldId, value }]]` — verified: a flat
`[{ fieldId, value }]` body is silently wrapped into an inner array on save. But
both readers expect it flat:

- `sim/calcMarketModel.ts:168` — `decision.productInput.fields.find(f => f.fieldId.equals(pf._id))`
- `sim/calcFinancials.ts:187` (and 276/283/297) — same pattern

so `f.fieldId` is `undefined` and `POST /rounds/:id/calculate` throws. **No client
payload can avoid this** (any shape we POST is persisted nested), so scoring stays
broken until the schema line becomes
`fields: { type: [DecisionFieldSchema], required: true, default: [] }`.
That edit is deliberately NOT made here — the backend is Shafnat's.

Submission, storage, projections and results reads all work today; only the
calculate step is affected.

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
| `projected_market_share` | local share proxy, as a fraction | **proposal — new input; V3 had a fixed `BASE_MARKET_SHARE`** |

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

Create a SimulationType for the notebook game in the admin console:

1. Segment → Product(s) — one Product per notebook line the game should score.
2. ProductFields: `selling_price`, `score`/`quality` **with `coefficients`,
   `direction`, `tightening`**, a cost field with `unitCost`, and
   `projected_market_share`.
3. `BaseData`, both halves — `marketData.segments[].products[].yearlyData[<roundNumber>].marketSize`
   (market size) **and** `marketModel.segments[].products[]` with its `fields[]`,
   which is what `POST /rounds/:id/calculate` iterates. A product missing from
   `marketModel` is never scored.
4. `GlobalInput`s as needed (relative impacts).
5. Team users with passkeys, a simulation of that type, and an **Active** round.

Without step 2's coefficients the plumbing still works end to end — every team
just scores 0.
