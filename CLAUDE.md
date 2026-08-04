# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`gamesim` is the game-simulations module of the Int Labs / Stratagem platform: a **generic, data-driven business-simulation engine**. Teams submit decisions per round, an operator closes the round, and the server scores every team competitively and writes each team's financials.

Nothing about a specific game is hard-coded. A "game" is data — a `SimulationType` row plus its `Product`s (whose `fields[]` *are* the decision form schema), `Segment`s, `GlobalInput`s and a `BaseData` document. That is why the admin client is mostly CRUD screens over each collection.

Three nested npm projects (no workspace tool — separate `node_modules` and lockfiles; the root `package.json` only shells out with `cd <dir> && npm run …`):

| Piece | Path | Stack | Dev URL |
|---|---|---|---|
| Backend API | `server/` | Express + TypeScript + Mongoose (MongoDB) | http://localhost:5000 |
| Admin/operator dashboard | `client/` | Vite + React 18 + MUI | http://localhost:3001 |
| Notebook pixel sim (player) | `notebook-pixel-sim/` | Vite + React 18 + Zustand + Tailwind | http://localhost:5173 |

**Branch note:** `notebook-pixel-sim/` and `server/src/finlit/` exist only on the `notebook-sim` branch, not on `main`. The root `README.md` describes an older backend-only state and is stale — prefer this file.

## Commands

```bash
npm run install:all   # root + server + client + notebook-pixel-sim
npm run dev           # API (5000) + admin client (3001)
npm run dev:sim       # API (5000) + notebook player (5173)
npm run build         # server tsc → server/dist; client tsc + vite → client/build
```

Per package:

```bash
cd server            && npm run dev      # nodemon + ts-node
cd server            && npm test         # jest
cd server            && npm run build    # tsc → dist/ ; npm start runs dist/index.js
cd client            && npm start        # vite --port 3001
cd notebook-pixel-sim && npm run dev     # vite (5173); npm run typecheck = tsc -b
```

Single server test: `cd server && npx jest src/test/calculateScoresForAllTeams.test.ts -t "<test name>"`.

### Testing and linting

```bash
npm run lint        # server + client (ESLint 9, flat config)
npm run typecheck   # server + client + player
npm test            # server jest, then the console's Playwright suite
```

**Type-checking is still the primary gate** — `cd server && npx tsc --noEmit`, `cd client && npx tsc --noEmit`, `cd notebook-pixel-sim && npx tsc -b`, all clean.

**ESLint had never run.** Both configs lived in `eslintrc.js` — no leading dot — so nothing discovered them, and they listed `import`/`simple-import-sort` plugins that were never installed. They are now `eslint.config.js` (server) and `eslint.config.mjs` (client), and both trees are clean. Two rules worth knowing: `src/finlit/**` is exempt from unused-import checks (it is a vendored copy that must stay byte-comparable — tidying it is drift, and the parity test will say so), and `react-hooks/exhaustive-deps` is on, which is what surfaced the dashboard's `?? []` fallbacks silently defeating every `useMemo` below them.

**The server suite tested nothing.** `calculateScoresForAllTeams.test.ts` was the entire suite: eight cases that built elaborate fixtures, never imported any production code, and asserted `expect(expectedScores[0].totalScore).toBe(100)` against a literal three lines above. The function it named does not exist anywhere in the repo. It passed on every run and would have kept passing if `src/sim/` were deleted. It has been replaced by 63 real tests across three files — `calcMarketModel.test.ts` (the competitive scorer, including the market-share quirk), `playerConfig.test.ts` (the config validators) and `finlitEngineParity.test.ts` (below).

**The console has a Playwright suite** in `client/tests/`, which `playwright.config.ts` had pointed at for a long time without it existing. Login, a full CRUD round-trip, a walk of all eighteen collection pages checking for uncaught errors, and a check that malformed JSON never reaches the API. Credentials come from `E2E_EMAIL` / `E2E_PASSWORD` and the suite skips itself with an explanation when they are absent — **never inline an account, the repo is public**:

```bash
cd client && E2E_EMAIL=you@intlabs.io E2E_PASSWORD='…' npm run test:e2e
```

Cypress has support files but zero specs; it is configured and unused.

### The vendored FinLit engine

`server/src/finlit/` is a hand-copied subset of `notebook-pixel-sim/src/`, differing only in that `@/`-aliased imports are rewritten relative. Nothing outside itself imports it yet, so nothing noticed when it fell behind — and it had: the player widened `GenreId` from a closed union to `string` so operators can publish new genres at runtime, renamed every genre, and added the tagline/description/strengths fields the archetype cards read. The copy knew none of it.

Both halves of the fix now exist:

```bash
cd server && npm run sync-finlit -- --dry   # what would change
cd server && npm run sync-finlit            # re-copy + rewrite imports
```

and `src/test/finlitEngineParity.test.ts` proves the result matches — deep-comparing every exported constant AND comparing each file's source after normalising the import rewrite. Change one demand number in the copy and two tests fail. **The player is always the original**; if parity fails, run the sync, never edit the player to match the server.

### The design source of truth

Two spreadsheets define the game's numbers — `FinLit Calc` (market demand per genre per phase, channel economics, production option rates/costs, hiring, marketing, vendor coverage) and `I_O & Proxy Data` (input ranges and baselines, which outputs are visible during play vs debrief-only, the key-decision energy/money table, the key-event catalogue). A `FinLit` PDF carries the pedagogy: four learning points, the 3-phase / 90-day structure, and the scoring rubric (Net Profit 50 · Inventory Cleanliness 25 · Insight 25).

**The player's bundled data was verified against them field by field: 288 of 288 values match** — genre demand curves, all twelve channel rows, every production option's rate and cost, all sixteen hiring levels, the four marketing teams, all thirty-two vendor coverage cells, `BASERATE` and `BASE_MARKET_SHARE`. The bundle is a faithful implementation; treat the spreadsheets as the place to change a number, then re-seed and republish.

Two calibration facts worth knowing: the model assumes **12 teams** (`BASE_MARKET_SHARE = 8.125%`, noted in the sheet as "divided by 12 teams"), and the V2 `STARTING_CASH`/`STARTING_DEBT` constants are legacy — the live route economics are V3's `ROUTE_START` ($1000 self-funded, $5000 investor opening at −$4000), which matches the spec exactly.

### A product with no price reference earns nothing

`calcFinancials` derives a reference price (`dynamicPrice`) by summing the product's **money** fields with `direction > 0`, *excluding* `selling_price` ([calcFinancials.ts:280](server/src/sim/calcFinancials.ts:280)). That reference is what a team's selling price is judged against.

The Notebook product ships four fields — `score`, `selling_price` (direction 0), `unit_cost` (direction 0) and `projected_market_share` — so **no field feeds `dynamicPrice`**. It is therefore 0, `calcPricingScore` returns 0 on its `dynamicPrice <= 0` guard, no customers convert, and revenue is 0 while COGS is still charged. Every team in a scored round posts a pure loss of roughly $40,000 regardless of what they decided.

Standings are unaffected — `calcMarketModel` doesn't use `dynamicPrice` — which is exactly why this went unnoticed: the console's rankings look completely healthy while every financial figure underneath them is meaningless.

This is a **provisioning** problem, not an engine bug: `provision-notebook.mjs` creates a field set the financial model can't price. Fixing it means giving the product a money field that represents per-unit investment (or a competitive weight above zero on an existing one) and recalculating. That is a game-design decision, so it has deliberately not been made here — the console now **detects and explains it** on the Debrief instead of letting a facilitator read a misconfiguration as twelve bad teams.

### The debrief shows the data, not just the write-up

`client/src/features/debrief/` computes its figures live from scored rounds rather than storing them, so the prose can go stale but the numbers can't. `cohort-data.ts` is pure and holds the derivations; `cohort-charts.tsx` draws them as hand-built SVG, matching the rest of the console.

Two things worth knowing before extending it:

- **The money is per-product.** `Projection.pnl` / `.bizperf` / `.cashflow` / `.balanceSheet` are all null in practice — the round close writes into `projections.<productId>` — so revenue and COGS have to be aggregated across a team's products. A chart built against `pnl` renders nothing and looks like a data problem.
- **Standings are drawn as RANK, not share.** Plotting the share values invites "we had 18% of the market", which they are not (see below).

### Market share does not sum to 100%

`calcMarketModel` computes a proper competed share (`weightedScore / totalScore`, which does sum to 1) and then multiplies it by each team's **own declared `projected_market_share`**, itself scaled by a diminishing-returns factor inside `getInput` ([calcMarketModel.ts:174](server/src/sim/calcMarketModel.ts:174)). A twelve-team round with everyone declaring 1/12 comes out summing to ~175%.

The values rank teams correctly, so they are fine for standings — but they are **not** a partition of the market and must never be labelled "x% of the market" anywhere an operator might repeat it to a room. The console's standings table calls the column "Strength" and says so in a footnote.

### Live progress: what the operator can finally see

The console could see submitted `Decision`s and nothing else — which answers "who is finished" and not the question a facilitator actually has mid-round: **who is stuck**. A team on day 12 with no product lines and $180 left looked, from the console, exactly like a team that never opened the app.

`TeamProgress` (`server/src/models/TeamProgress.ts`) is a small per-`simulation × team × round` upsert carrying day, phase, cash, energy, line count, shop name and `lastSeenAt`. The player heartbeats it from `GamesimProvider` on every day change and on the poll interval; the dashboard's **In the room** band renders four states — *Playing*, *Idle*, *Finished*, and *Not started* for a team with no row at all, which is the most actionable of the four.

Three things it is deliberately not:

- **Not authoritative.** Nothing scores from it and nothing is restored from it. The player's Zustand store remains the single source of truth for a run; making this authoritative would put a network call inside the day-tick, which is the last place that should be able to fail. The heartbeat is fire-and-forget and its promise never rejects.
- **Not a time series.** One row per team per round, overwritten in place. The history a debrief needs already lives in `Results` / `Projections`.
- **Not readable by teams.** `GET` is staff-only — a team asking for it is asking for every rival's cash position mid-round. The `PUT` is team-only and takes `teamId`/`simulationId` **from the token**, never the body, so one team cannot write or fake another's row. All four cases are covered by the e2e suite.

"Idle" is derived from staleness (two minutes), and the band re-renders on its own timer so a team that closed their laptop decays from green on screen without waiting for a refetch.

### The console shows the player's art

Notebook covers are resolved by **filename convention inside the player** — `genreArt()` returns `/img/notebooks/<genreId>.png` — so dropping a PNG in publishes a new notebook with no code change, and the seeded genres correctly carry `imagePath: null`.

That convention is relative to the *player's* origin, so the console could never follow it: every product row rendered a generic icon while the art sat one origin away. `client/src/lib/player-assets.ts` is the join. It resolves in the player's own order (`imageAssetId` → `imagePath` → the convention) against `VITE_PLAYER_URL`, which also replaces the `http://localhost:5173` that `sim-preview` used to hardcode — that link was dead in every deployment.

`Product` gained generic `imageAssetId` / `imagePath` fields rather than a notebook-specific `genreId`: a product belongs to the engine, genres belong to one game, and joining them in the schema would leak the notebook sim into every future simulation type. The genre is guessed from the product name, which returns *nothing* rather than a wrong picture when it doesn't match.

### Every avatar is generated, and every surface shows it

`Avatar` has always accepted a `src` — and **not one call site passed it**, so the whole console rendered initials over data that already existed. Fixed at every site; the three remaining `name`-only calls in `roster.tsx` are the fallback arms of an existing `avatar ? <img> : <Avatar>` and are correct.

Two backend gaps fed it: `POST /teams` never generated an avatar (only the later roster/picker routes did, so a team created and left alone stayed faceless), and `User` had no avatar field at all. Both fixed, plus `npm run backfill-avatars` (`-- --dry` to preview, `--restyle` to re-render non-default styles) for records written before any of it.

Two things found on the way: `POST /users` never read `email` out of the body, so every staff account created over the API was unable to sign in — which is why bootstrapping an admin needed its own script. And `POST /users/login` returned a narrower user than `GET /users/me`, so the avatar appeared only after a reload; the two shapes now match.

A simulation is not a person — the dashboard's simulation list uses an icon tile, because initials in an avatar circle beside real generated faces read as a broken image.

### Avatars, and the Critters trap

`server/src/services/avatars.ts` renders team/member avatars from DiceBear and inlines the SVG as a data URI, so a face never 404s and needs no storage.

**The default style, `critters`, cannot be imported.** DiceBear 10 ships it, but `@dicebear/collection` stops at **9.4.3** — v10 restructured the JS monorepo (`src/js/{cli,converter,core}`) and no longer publishes a bundled collection. The hosted API *does* serve it, but only on the v10 path:

```
api.dicebear.com/9.x/critters/svg   → 404
api.dicebear.com/10.x/critters/svg  → 200
```

The `9.x` 404 makes this very easy to mis-diagnose as "Critters doesn't exist" — it does. `REMOTE_ONLY` in that file lists styles fetched over HTTP **once, at creation time**, then inlined; the classroom still never touches the network to *display* an avatar. A fetch failure falls back to `bottts` rather than leaving a member faceless.

Two other things that bite:

- **`PUT /teams/:id/members` generates the avatar itself** and ignores any `url` the caller sends. It used to store whatever it was given, so a client sending a placeholder got that placeholder saved and every avatar rendered broken. `kind` + `style` + `seed` is a complete description; the URL is derived, never supplied.
- **Backdrops.** Several styles render on transparent, which lands as white on the console's cards and looks like a missing image. `withBackdrop()` injects a full-bleed rect unless the art already carries one — Critters does, with its own palette, so it is left alone.

### MongoDB collection validators are stale

Several collections carry a server-side `$jsonSchema` written for an older shape, and **MongoDB enforces it independently of Mongoose**. A write that is perfectly valid to the application gets rejected by the database with "Document failed validation" — no field name, no reason. One command reconciles every collection with its model:

```bash
cd server && npm run repair-validators        # add -- --dry to report only
```

It fixed eleven of the twenty-one validators. Two classes of problem:

**Numeric encoding.** BSON stores a whole number that fits in 32 bits as `int` and everything else as `double` — which one you get is a property of the *value*, not the field. A validator pinning a field to `double` alone therefore rejects every round number. `initiatives.costConsumption` was declared `double`, so **an initiative could never be created from the console at all**: `250` encoded as an int and bounced, while nothing in the server log said which field was at fault. Every numeric field is now `["int","long","double"]`.

**Shape drift.** `products.active` was declared `string` against a `Boolean` model; `simulations` required a `status` it never declared; `decisions` required top-level `productId`/`segmentId` that the model nests inside `inputs[]`, and typed `inputs` as an object when it is an array; `drivers` carried a `segmentId` the model has no path for. Several of these survived unnoticed only because their collection is on `validationAction: "warn"` — the repair deliberately **does not** change enforcement level, since tightening a `warn` collection to `error` in the same pass turns a silent log line into a live outage.

`npm run repair-images` remains as the narrower, older fix for `imageAssets` (which required `mimeType` and `data` — fields from a design that stored image bytes in the database — so every upload was rejected regardless of the storage backend). The general script covers it now.

If a write starts failing with "Document failed validation", run the repair with `--dry` first: it names the collection and says what disagrees.

### Controllers can demand fields their model doesn't have

`POST /drivers` required a `segmentId` in the body, then passed it to `Driver.create()` — where Mongoose stripped it, because the schema has no such path. The check's only effect was to make a driver impossible to create without sending a value that was immediately discarded, and the 409 message spoke of "this product and team" when the unique index is on `productId` alone. Fixed in [driversControllers.ts](server/src/controllers/driversControllers.ts).

Worth remembering as a shape: a required-field check that references something absent from the model is always dead weight at best and a hard block at worst. Grep a controller's destructured body against its schema before trusting it.

### Data / ops scripts

- `cd server`: `npm run seed-db`, `npm run cleanup-db`, `npm run tsgen` (mongoose-tsgen), `sync-sim-type`, `update-sim-type`, `randomize-market-size`.
- `cd server && npm run create-admin -- --email … --password …` — bootstrap a staff login (see **Auth is real** below).
- `cd server && npm run repair-validators` — reconcile every collection's `$jsonSchema` with its model (`-- --dry` to preview). `npm run repair-images` is the older, `imageAssets`-only version.
- `cd server && npm run backfill-avatars` — give a face to every team, member and staff account written before avatars existed (`-- --dry` to preview; `--restyle` also re-renders non-default styles).
- `cd server && npm run sync-finlit` — re-copy the player's FinLit engine into `src/finlit/` (`-- --dry` to preview).
- `cd server && npm run seed-demo -- --email … --password … [--reset]` — build a complete, believable cohort over the HTTP API: 12 teams with rosters and generated avatars, three rounds (two scored for real through `/rounds/:id/end`, the third left Active), facilitator notes and a published debrief. This is what makes the console demonstrable without a live class; every console page has real data behind it afterwards.

**Storage is pluggable** (`server/src/services/storage.ts`). With `SUPABASE_URL` + `SUPABASE_KEY` set, uploads go to Supabase; otherwise they are written to `server/uploads/`, which `index.ts` already serves at `/uploads`. The old code threw at import time when those vars were absent, so a dead Supabase project took the whole API down over a feature one route uses.

**Configuration is not capability.** The driver used to be chosen purely on the two env vars being present, with no evidence the project existed — and credentials for a *deleted* Supabase project look exactly like credentials for a live one, because the subdomain simply stops resolving. The console cheerfully reported `durable: true` while every upload failed with `fetch failed`, which is strictly worse than the local fallback. `resolveStorage()` now asks Supabase a question once, caches the answer for a minute, and demotes to local disk with the reason attached. `GET /image-assets/storage` returns that verified result, and the console banner shows it.

Two traps when configuring it: the dashboard's API URL ends in `/rest/v1/` and `createClient` wants the **project base** (normalised in `storage.ts` rather than left to bite again), and the bucket must be named `imageAsset`.
- `node notebook-pixel-sim/scripts/provision-notebook.mjs` — idempotent provisioning of the Notebook simulation type, products/fields and teams, entirely over the HTTP API.

## Environment

`server/.env` (git-ignored — **the repo is public**). `db.ts` also loads `.env.local` with `override: true`.

`SUPABASE_URL` + `SUPABASE_KEY` (the server throws on boot without them — image-asset storage), `MONGO_URI_LOCAL` / `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `PORT`, `CLIENT_ORIGIN`, `ALLOWED_ORIGINS`.

- **Mongo URI precedence** (`server/src/db/db.ts`): under `NODE_ENV=production`, `MONGO_URI` wins; otherwise `MONGO_URI_LOCAL` → `MONGO_URI` → a `127.0.0.1:27017/dev_local` fallback.
- **nodemon watches `ts,json` only** — editing `.env` needs a restart.
- **CORS** always allows `localhost:3000/3005/5173` (hardcoded in `server/src/index.ts`) plus `CLIENT_ORIGIN` and comma-separated `ALLOWED_ORIGINS`. Port **3001 only works via `ALLOWED_ORIGINS`**.
- Both frontends read `VITE_GAMESIM_API_URL`, defaulting to `http://localhost:5000/api`, so **the API must really be on 5000**. `dotenv` does not override an already-set `PORT`, so a harness that injects `PORT` silently moves the server off 5000 with no `EADDRINUSE` to warn you.

## Backend architecture

### Domain chain

*Template side* (per `SimulationType`): `BaseData` holds `marketData` (market size per segment × product × year), `marketModel` (the competing fields with `direction` / `tightening` / `coefficients`) and `csatMarketModel`. `Product.fields[]` defines each decision input (`type`, `minValue`/`maxValue`, `options` for enums, `unitCost`, `coefficients`); each field keeps its own `_id` so `/products/:id/fields/:fieldId` can address it.

*Run side*: `Simulation` (an instance of a type, `config.totalRounds`/`currRounds`) → `Round` (`Pending | Active | Completed`, with a timer) and `Team` + `User` (`role: "team"`, `passkey` unique per simulation).

*Per round*: `Decision` — one document per `simulationId × teamId × roundNumber` (unique index, insert-only; resubmission is a 409). Outputs are `Results` (one per product × segment × round: `weightedScores` and `marketShares` maps keyed by teamId) and `Projections` (one per team × round: `pnl` / `bizperf` / `balanceSheet` / `cashflow` plus per-product `projections`).

### The two calculators (`server/src/sim/`)

- **`calcMarketModel.ts`** — competitive. Scores every team's field values against the others (z-score → normal CDF) and returns `weightedScores` + `sharesNormalCDF`. Note it deliberately **skips `selling_price` and `projected_market_share`** in the scoring loop.
- **`calcFinancials.ts`** — per team. Resolves each field value (enum → `options` map; numeric → clamp to min/max), applies global-input impacts, and produces price, customers, revenue, COGS, gross profit and cost breakdowns.

Both are reached two ways:

1. `POST /projections/recalc` — a single team's what-if while deciding; `calcFinancials` only, using the team's *self-declared* `projected_market_share` (default 20%) rather than a competed share.
2. `POST /rounds/:id/calculate` — the authoritative round close (admin/operator, round must be `Active`). Loops `baseData.marketModel.segments × products`, runs `calcMarketModel` across all teams, then re-runs `calcFinancials` per team with the real shares, upserting `Results` and `Projections`. See `roundControllers.ts:109`.

**Both write the same document.** Despite the "recalc" name, `/projections/recalc` is *not* read-only: it upserts `Projections` on the identical key `{simulationId, teamId, roundNumber}` and the identical `projections.<productId>` sub-path ([projectionControllers.ts:200](server/src/controllers/projectionControllers.ts:200)). Because it `$set`s the whole sub-object and its payload has no `marketShare` field, **a recalc after a round has been calculated silently strips the competed `marketShare` written by the round close** and replaces the official financials with self-declared what-if numbers. Treat a calculated round as read-only: don't let the player run recalc against it.

**Trap:** `Decision.inputs[].fields` must stay a **flat** array. An extra `[]` in the schema once nested every entry (`[[{…}]]`), which made both calculators' `fields.find(f => f.fieldId.equals(…))` throw — see the long comment in `server/src/models/decisions.ts:41`. Decisions written before that fix are permanently unreadable: delete them (`DELETE /decisions?simulationId=&roundNumber=`) and have teams resubmit.

### Conventions and gaps

- Controllers are `(req, res) => Promise<void>` with a local `try/catch` returning `res.status(n).json({ message })`. There is no error middleware and no request-validation layer (`zod` is a server dependency but is **not** used anywhere in `server/src`).
- Routes mount `authenticate` at the router level and add `authorize([ROLES.…])` per write route. `authenticate` only verifies the JWT signature — it does no DB lookup, so a validly signed token works against an empty `users` collection.
- Socket.io is initialised (`server/src/utils/socket.ts`) and tracks sessions, but **no domain events are emitted** — clients poll.

## Frontends

### `client/` — admin/operator dashboard

Deliberately thin: `src/api.ts` is a flat list of axios calls (roughly one per route) and every file in `src/pages/` is CRUD over a single collection. `MainSimPage.tsx` is the operator console (activate a round, calculate it). Shared state is one `context/AppContext.tsx`.

**Navigation is grouped by when you use it**, not by which table a page maps to — `src/lib/nav.ts`. Five groups: *Session* (what is happening in the room right now; the only one open by default), *Game design* (the copy and structure a facilitator rewrites per client), *Market model* (the numbers the engine scores with), *Reference*, and *Platform*. **Editable and read-only never share a group**, so nobody hunts for an edit button that was never going to exist: Param List is the sole genuinely read-only collection — it has no route file and therefore no write API — and Archetypes is derived from genres, which is where you change one.

**One form for every collection** — `src/components/app/resource-form.tsx`. A page declares its fields (`text` · `textarea` · `number` · `money` · `switch` · `select` · `json`) and gets the create dialog, the edit dialog, validation and the delete confirmation from `ResourceFormDialog` / `useResourceCrud` / `DeleteResourceDialog`, with the mutations coming from the `crud()` factory in `src/lib/api-hooks.ts`. Three things worth knowing:

- **The dialog owns its own close.** `onSubmit` returns the mutation promise; the dialog closes when it resolves and stays open with the operator's values intact when it rejects. Closing from a mutation's `onSuccess` per page is what used to leave dialogs open on top of successful writes.
- **`kind: "json"` is for free-form maps** — a decision field's `options`/`coefficients`, a driver's `years`. It stringifies on open, parses on submit, and refuses to submit anything that isn't a JSON *object*, because Mongoose would otherwise accept the string and the engine would later read a map that isn't one.
- **`immutable: true` locks a field after creation** — a decision field's `key` (decisions already submitted point at it) and its product (a field is stored inside its product's document; no route moves one).

**Verifying a dialog in a hidden browser pane:** a closed Radix dialog stays mounted, because its exit animation never runs (see the frozen-`document.timeline` note below). `document.querySelector('[role="dialog"]')` will happily return a stale, closed dialog and let you drive it — which silently submits the wrong form. Always select on state:

```js
[...document.querySelectorAll('[role="dialog"]')].find(d => d.getAttribute('data-state') === 'open')
```

**Brand assets are generated, not committed by hand.** `/assets/` holds the print-scale originals (a 16 MB 3599×3843 photo, 8245×1672 logo PNGs). `client/scripts/build-brand-assets.mjs` resizes and re-encodes them into `client/public/brand/` — the hero as AVIF + WebP at four widths plus an inlined blur placeholder, the wordmark as WebP at three widths. Re-run it after replacing anything in `/assets/`:

```bash
cd client && node scripts/build-brand-assets.mjs
```

It borrows `sharp` from `notebook-pixel-sim/node_modules` rather than adding a dependency for a step that runs by hand. A browser fetches **one** hero variant — ~103 KB on a standard desktop, ~154 KB on retina, against 16.8 MB of source.

**Debugging animations in a headless/hidden browser:** a hidden browser pane freezes `document.timeline` and `requestAnimationFrame` entirely — `document.timeline.currentTime` stops advancing while wall-clock time runs on. Every animation, Motion *and* CSS, then stalls at whatever value it held, and a screenshot shows elements at partial or zero opacity. This looks exactly like a broken entrance animation and is not one. Before diagnosing, check:

```js
document.visibilityState        // "hidden" ⇒ animations are frozen, not broken
document.timeline.currentTime   // sample twice; if it doesn't advance, that's why
```

To get a truthful screenshot out of a hidden pane, force every animation to its end state first — entrance animations then show what the user would actually see:

```js
document.getAnimations().forEach(a => { try { a.finish() } catch { a.cancel() } })
```

The sign-in screen still uses plain CSS keyframes (`.auth-rise`, `.auth-shake`, `.auth-kenburns`), not because Motion misbehaves but because a stalled animation there would lock a user out.

**Auth is real.** The console signs in at `POST /users/login` (email + password → 12 h JWT); `src/lib/auth.ts` owns the `gamesim:console:token` key, `features/auth/auth-gate.tsx` blocks the app until `GET /users/me` confirms the session, and an axios interceptor ends it on a 401 (or a bare `Forbidden.` 403 — an *authorization* 403 carries its own message and is left alone so the page can surface it).

The first admin can't be made over the API (`POST /users` needs an admin token), so bootstrap one:

```bash
cd server && npm run create-admin -- --email you@intlabs.io --password 'your-password'
```

`--role operator|client` for non-admins; omit `--password` to have one generated and printed once. It also re-passwords an existing account. Teams are unaffected — they still sign in by passkey, and `/users/login` refuses `role: "team"` even with the right password.

*(Historical: `client/src/api.ts` used to hard-code an admin JWT so the dashboard worked with no login. Since the Dockerfile builds the client into `server/public`, that shipped a full-admin credential to every browser. It is gone — grep for `DEV_ADMIN_TOKEN` should return nothing.)*

### `notebook-pixel-sim/` — the player

**`notebook-pixel-sim/CLAUDE.md` is the authoritative doc for that app** (engine facade, Zustand `apply()` mutation path, day-tick order, asset encoding) and is accurate — read it before touching anything under that directory. Cross-cutting facts that matter from the root:

- `src/gamesim/` is the **only** seam to the backend: `client.ts` (base URL, `gamesim:*` localStorage session, routes), `mapping.ts` (notebook design → ProductField values), `sync.ts` (submit + poll), `configHydrator.ts` (operator content overlay), `GamesimProvider.tsx`. There is no `/player/*` namespace — the player composes the generic routes.
- **Operator content overlay:** `configHydrator.ts` fetches the published `PlayerConfig` once at boot (inside the bootstrap, while the app is still blocked on `status === 'loading'`) and edits the bundled tables *in place* — `GENRES`, `ADDONS`, `CHANNELS_BY_GENRE` and friends are `const` arrays imported directly by ~25 modules, so mutating the shared object is the only way to reach every importer. It refuses far more than it accepts, because the engine's accessors (`genreById`, `configOption`, `channelRow`, `vendorById`) **throw** on an unknown id: an id present in the bundle may never disappear, the five structurally-coupled sections (`genres`, `productionOptions`, `channelMeta`, `channelsByGenre`, `vendors`) are validated as one graph and applied together or not at all, and any failure leaves the bundle untouched. `scripts/test-config-hydrator.mjs` asserts exactly that. **Scalar balance constants now hydrate too.** They were `export const` numbers, and a module's own `const` binding cannot be rebound from outside it, so the console offered ~17 of them and editing any did nothing until the next build. They are `export let` behind `applyConstantOverrides` (`engine/finlit/core/config/constants.ts`) and `applyBalanceOverrides` (`data/balance.ts`), which works on **ES module live bindings**: an importer reads the binding, not a copy, so one reassignment inside the owning module reaches all ~25 importers without touching any of them. Two rules keep it safe — those setters are the only permitted writers, and nothing may derive a value from a scalar at *module* scope, which would snapshot the bundled number before hydration runs. Non-numeric values are refused rather than allowed to put NaN through the engine, and a key this build doesn't recognise is named in the `skipped` report.
- **Authority split:** the browser FinLit engine drives gameplay feel; the server is authoritative for money (`GET /projections`) and for share/rank (`GET /results`). The two models genuinely differ, the numbers will not match, and the UI says so. Details and the verified quirks of the scoring math are in `notebook-pixel-sim/docs/gamesim-integration.md`.
- Team login is `POST /users/login-passkey` → 12 h team JWT + `teamId` + `simulationId`.
- `server/src/finlit/` is a **hand-vendored copy** of the player's pure engine subset (relative imports instead of the `@/` alias). It is still imported by nothing outside itself, but re-syncing is now `npm run sync-finlit` and `server/src/test/finlitEngineParity.test.ts` fails the build if the two drift. See **The vendored FinLit engine** above.

## Deployment

`Dockerfile` builds the client, then the server, copies `client/build` into `server/public`, and serves both from one Node process (SPA fallback for non-`/api` paths, health check at `/api/health`). `start.sh` is the Render preview entrypoint: it derives a per-PR Atlas database name, seeds it, and starts the server. `.github/workflows/` contains a preview-approval gate and a `master → staging` sync job (the branch names predate `main`/`notebook-sim`).
