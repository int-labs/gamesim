# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 90-day pixel-art entrepreneurship simulation (notebook business). The player runs a portfolio of notebook product lines across three 30-day phases, making decisions about product design, pricing, target segments, channels, inventory, and upgrades. Days 30/60/90 trigger evaluations with charts and an insight-check question; day 90 ends the run with a scored result.

It runs as the **player client of the gamesim backend** (`../server`). `src/gamesim/` is the only seam — login, decision submission, the official numbers, and the operator's content overlay (`configHydrator.ts`, see **Tunable game data** below). See `docs/gamesim-integration.md` for the endpoint table.

### The backend is the sole authority for money — read this before touching any figure

The server's `calcFinancials` owns every monetary number; `calcMarketModel` owns
market share and score. **The local FinLit engine (`src/engine/finlit/`) is slated
for removal.** Two calculation implementations authored by two parties is the
defect that produced months of numbers that did not add up — do not extend the
local engine, do not add a second formula for anything the server computes, and
prefer reading a server field over deriving an equivalent locally.

The authoritative P&L, computed server-side and to be displayed verbatim:

```
  Revenue           unitsSold × sellingPrice
− COGS              unitsSold × dynamicCost + globalInput costs declared 'cogs'
= Gross Profit
− OpEx              unsold-inventory holding + globalInput costs declared 'opex'
= Operating Profit
```

Notes that will bite otherwise:

- **`inventoryQty` is the player's capacity**, derived server-side from the
  product's own field values. `prodPerDay` / `targetPerDay` / the produce
  slider do **not** feed it. Read `ProductProjectionDto.inventoryQty`.
- **COGS is on units SOLD**, never on the whole build. Unsold stock is a holding
  cost in OpEx, charged at the operator's per-unit `inventory_cost` (configured
  on the *channel* globalInput's impacts).
- **`readCostTreatment()` and `toProjectionMetrics()` in `sim/calcFinancials.ts`
  are single-reader / single-shape functions on purpose.** Both money paths
  (`/projections/recalc` and round close) must call them, or the live projection
  and the official score will interpret the same decision differently.
- **`POST /projections/recalc` UPSERTS** the team's projection document — it is
  not a read-only what-if. `useLiveProjection` currently calls it on a 200 ms
  debounce for every decision edit, which contradicts the warning in
  `sync.ts`. Known; not yet resolved.
- The per-product seeds (`customersObtainedBase` ?? 0.3, `dynamicPriceBase` ??
  0.55) live in `Product.baseVariables`. `INVENTORY_BASE = 1000` is still a
  module constant awaiting the same treatment.

**`FinanceTable` in `MetricsTable.tsx` currently renders opex rows above a Gross
Profit subtotal that excludes them** — the sheet reads one way and computes
another. Unfixed; it is the first item of the frontend display work.

See the `project_projection_divergence` memory for the full diagnosis and the
decision log.

## Commands

```bash
npm install          # first time only
npm run dev          # Vite dev server at http://127.0.0.1:5173
npm run build        # tsc -b (type-check) + vite build → ./dist
npm run preview      # serve the production build (port 4173)
npx tsc -b           # type-check only, no bundle
npm run lint         # eslint src
```

There is **no test runner** — don't suggest `npm test`; it doesn't exist. The two
automated checks are `tsc -b` (via `npm run build`) and `npm run lint`.

ESLint uses a flat config (`eslint.config.js`). Neither check is wired to CI, so
neither gates a deploy. The lint baseline is **0 errors**; keep it there.
`react-hooks/rules-of-hooks` and `exhaustive-deps` are **errors** on purpose —
a broken hook index risks memory leaks. `react-hooks/set-state-in-effect` and
`react-hooks/purity` are deliberately downgraded to **warnings**: the `fx/`,
mascot and modal components need those extra render cycles for animation.
Unused vars are warnings. See the `project_eslint_governance` memory.

Deploys to **Vercel** (project linked in `.vercel/`).

## Architecture

### The engine facade — read this first

`src/engine/mockEngine.ts` is the **single import surface** for all game logic. Despite the name, it is **not a mock** — it re-exports the real, modular engine and owns the decision mutators directly. The name is kept only so the ~25 UI files importing `@/engine/mockEngine` never had to change. **The README's "Step 3 / mock engine" framing is stale** — the real engine (`simulationEngine.ts` + supporting modules) is live.

UI code should keep importing from `@/engine/mockEngine`, never from the individual modules behind it. Those modules:

| Module | Responsibility |
|---|---|
| `simulationEngine.ts` | `dayTick` / `advanceDay` orchestrator (per-line loop) |
| `demand.ts` | per-line × per-segment demand, fit, cannibalization |
| `cost.ts` | per-line cost/time/price; portfolio aggregates; line lookup helpers |
| `production.ts` | shared-capacity allocation across lines; defect rate |
| `complexity.ts` | complexity score → capacity/defect penalty (replaces hard line caps) |
| `cashflow.ts` | DSO/DPO scheduling of pending cash (AR/AP) |
| `modifiers.ts` | global event-modifier aggregation + expiry |
| `eventEffects.ts` | event:option → modifiers + immediate effects |
| `scoring.ts` | final score rubric |
| `insightGenerator.ts` | phase-end insight question |
| `selectors.ts` | pure UI projections from state (use these in components) |
| `validation.ts` | `clamp` / `finite` / `safeDiv` — NaN guards on every numeric path |
| `config.ts`, `../data/balance.ts` | tunable constants |

### State: one Zustand store, mutated through `apply()`

`src/state/store.ts` is the single source of truth (`useGame`). It uses **Zustand + Immer + persist**.

- The universal mutation path is `apply((s) => engineMutator(s, ...))`. Engine functions are **pure mutators over the Immer draft** — they take `GameState` first and mutate it in place. UI calls them wrapped in `apply()`. Example: `apply((s) => setPrice(s, val))`.
- Don't add ad-hoc `set()` calls in components for game logic; route it through an engine mutator + `apply()` so history/ledger stay consistent.
- **Persistence:** key `intlabs:sim:state:v1`, `version: 8` with a `migrate` chain — bump the version and add a migration step when you change persisted shape. `partialize` deliberately drops transient UI/mascot state, and `screen` is forced back to `'start'` on reload (Continue/New Game re-enter the run).

### Day-tick order of operations (`simulationEngine.ts`)

Per advanced day: phase rollover → drain pending cash → expire modifiers → cache fits → roll demand (one seeded RNG for the whole portfolio) → plan production (shared capacity, proportional) → apply production → per-line sales loop → pay opex → update brand/retention → roll up inventory → append daily series → fire interrupts (events/evaluations/end-of-game).

### Portfolio model (not single-product)

State holds `portfolio.productLines[]` (multiple SKUs), each with its own design, price, target segment, and inventory pool; `activeLineId` is what the canvas/editor reflects. There is **no hard cap on line count per phase** anymore — `complexity.ts` ratchets a capacity/defect penalty as the portfolio grows (soft sanity ceiling `MAX_LINES_HARD_CAP = 20`). `MAX_LINES_BY_PHASE` is kept only for backward compat and returns 20 for every phase.

### Ledger & history are the projection source

Every money movement appends a `LedgerEntry` with a `cause` tag; every decision appends a `history` entry. The P&L UI and the decision timeline are **projections over `state.ledger` / `state.history`** — preserve their shape and always tag new entries with a meaningful `cause`.

### Screen flow

`App.tsx` is a screen state machine keyed on `meta.screen` (`start → route → phase_intro → simulation → evaluation → final`). Within the simulation, `meta.sidebar` swaps the active panel. Two flows can drive events/evaluations:

- The **unified `PhaseSequenceModal`** renders event + evaluation + result inline. While `meta.sequenceActive` is true, the standalone `EventModal` / `EvaluationScreen` are suppressed and `App.tsx`'s auto-promotion effects bow out. Check `sequenceActive` before touching screen-promotion logic.

`EventModal`, `EvaluationScreen`, and `FinalResultsScreen` are `React.lazy` code-split (wrapped in `<Suspense fallback={null}>`).

### Assets — served at URL root, special chars must be encoded

`assets/` is Vite's `publicDir`, so files there serve from the URL root (`assets/img/logo.png` → `/img/logo.png`). The repo's image folders contain **spaces, `&`, `:`, and em-dashes** in their names. Always reference images through the typed map in `src/assets.ts`, which URL-encodes each path segment. Hand-writing a raw path with a special char will 404.

### Audio

- `audio/audioManager.ts` — procedural SFX + ambient music via the Web Audio API (zero asset weight). Music is **off by default**; AudioContext is created lazily on first user gesture (autoplay policy).
- `audio/ameliaVoice.ts` — the mascot's TTS narration, behind an `AmeliaVoiceEngine` interface (currently Web Speech; swappable to pre-generated files — see `docs/amelia-voice-pipeline.md`). **Muting SFX also mutes Amelia** — they share one channel.

### Mascot

"Amelia/Sage" drives onboarding and feedback. Scripts live in `src/content/mascotScripts.ts` (pushed via `pushMascotSequence` for Prev/Next). `src/content/dynamicFeedback.ts` reads live state and surfaces the most relevant warning/hint instead of fixed day-N hints.

## Conventions

- **Path alias:** `@/` → `src/` (configured in both `tsconfig.json` and `vite.config.ts`).
- **Determinism:** the simulation uses a seeded RNG (`utils/rng.ts` — `mulberry32` / `seedFrom`, seed in `meta.seed`). `Math.random()` appears only for non-simulation IDs (line/ledger/instance ids) — keep it out of any code path that affects sim outcomes.
- **Numeric safety:** pass values through `clamp` / `finite` (`engine/validation.ts`) at engine boundaries; the codebase treats "no NaN ever reaches state" as an invariant.
- **Styling:** Tailwind v3 with custom pixel tokens in `tailwind.config.ts` — fonts `font-pixel` (Pixelify Sans) and `font-hud` (Press Start 2P), and `ink` / `brand` / paper color scales. Charts are hand-built SVG in `src/components/charts/` (no chart library).
- **Tunable game data** lives in `src/data/` (balance, segments, channels, addOns, upgrades, events, archetypes); copy/text lives in `src/content/`.
- **These tables are edited in place at boot** by `src/gamesim/configHydrator.ts`, which overlays the operator's published `PlayerConfig` from the backend. The bundled values are the permanent fallback: with no config, an unreachable server, or a payload the guard rejects, the game runs exactly as it shipped. Two consequences when you touch `src/data/` or `engine/finlit/core/config/`:
  - **Keep the containers mutable and keep reads lazy.** Hydration works by emptying and refilling the exported array/object, so every importer sees the change. Building a lookup `Map` or a derived constant at *module scope* would silently freeze the bundled values — today every read is a `.find()`/index at call time, and that must stay true.
  - **The scalar constants are `export let` on purpose.** An exported `const` cannot be rebound from outside its module, so those ~17 numbers were editable in the console and had no effect until a rebuild. They now go through `applyConstantOverrides` (`engine/finlit/core/config/constants.ts`) and `applyBalanceOverrides` (`data/balance.ts`), relying on ES module **live bindings** — importers read the binding, not a copy. Assign to them only through those setters, and never derive from one at module scope.
  - **Adding a table means teaching the hydrator about it**, otherwise the console can edit it and nothing happens. Run `node scripts/test-config-hydrator.mjs --token <jwt> --type <simulationTypeId>` after any change to the config shape; it proves rejected configs leave the bundle untouched.

## Reference docs

- `README.md` — project overview (note: engine section is stale, see above).
- `docs/SPEC.md` — full design spec.
- `docs/amelia-voice-pipeline.md` — TTS swap recipe (Piper/Coqui).
