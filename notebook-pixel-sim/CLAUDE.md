# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 90-day pixel-art entrepreneurship simulation (notebook business). The player runs a portfolio of notebook product lines across three 30-day phases, making decisions about product design, pricing, target segments, channels, inventory, and upgrades. Days 30/60/90 trigger evaluations with charts and an insight-check question; day 90 ends the run with a scored result.

It runs as the **player client of the gamesim backend** (`../server`), which is treated as final: the integration adds no server files, no shared package, and no new routes. `src/gamesim/` is the only seam — login, decision submission, and the official numbers. The local FinLit engine stays authoritative for gameplay feel but **not** for scoring; market share/score come from the server's `calcMarketModel` and financials from `calcFinancials`. See `docs/gamesim-integration.md` (endpoint table, the proposed field mapping still awaiting confirmation, and what `main` does *not* have — notably no round-calculate route and no socket events).

## Commands

```bash
npm install          # first time only
npm run dev          # Vite dev server at http://127.0.0.1:5173
npm run build        # tsc -b (type-check) + vite build → ./dist
npm run preview      # serve the production build (port 4173)
npx tsc -b           # type-check only, no bundle
```

There is **no test runner and no linter configured** — `tsc -b` (via `npm run build`) is the only automated check. Don't suggest `npm test`/`npm run lint`; they don't exist.

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

## Reference docs

- `README.md` — project overview (note: engine section is stale, see above).
- `docs/SPEC.md` — full design spec.
- `docs/amelia-voice-pipeline.md` — TTS swap recipe (Piper/Coqui).
