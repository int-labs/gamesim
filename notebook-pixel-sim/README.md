# academy-minibusinesssim

A 90-day pixel-art entrepreneurship simulation. You start a notebook business out of a dorm room and run it for 90 in-game days through three 30-day phases. The simulation teaches: market positioning, inventory flow, revenue vs cash flow, P&L diagnosis, and focused scaling.

This repo currently contains **Step 3 — the frontend playable shell with a mock simulation engine.** Step 4 will swap the mock for a final balanced engine.

## Run it

```bash
npm install      # only the first time
npm run dev      # http://127.0.0.1:5173
```

Other scripts:

```bash
npm run build    # type-check + production build to ./dist
npm run preview  # serve ./dist locally
```

Recommended viewport: **1280 × 720+** desktop / laptop. The app gates smaller screens with a soft "best on desktop" notice but stays operable.

## Stack

- **Vite 5 + React 18 + TypeScript**
- **Tailwind v3** with custom pixel design tokens (`tailwind.config.ts`)
- **Zustand + Immer + persist** middleware for state (`src/state/store.ts`)
- **@dnd-kit/core** for visual add-on drag-and-drop
- **Framer Motion** for orchestrated overlays + entrance animations
- **CSS keyframes** (in `src/styles/index.css`) for micro-interactions
- **Hand-built SVG charts** in `src/components/charts/` (no chart library)
- **Pixelify Sans** + **Press Start 2P** via Google Fonts
- `localStorage` persistence (key `intlabs:sim:state:v1`)

## Where things live

```
assets/img/                  unchanged source assets (served as Vite publicDir)
src/
  assets.ts                  typed asset map (URL-encodes special-char paths)
  data/                      tunable game data
    balance.ts               numeric constants
    segments.ts              4 customer segments
    channels.ts              6 sales channels
    addOns.ts                visual add-ons (with canvas placement %)
    upgrades.ts              strategic upgrades
    events.ts                6 events (days 15/30/45/60/75/89)
    insights.ts              insight check questions
  engine/
    mockEngine.ts            mock dispatch / dayTick / scoring
  state/
    store.ts                 Zustand store (game state + actions)
  components/
    primitives/              PixelImage, Button, Panel, Chip, Badge,
                             Modal, Meter, MoneyText, Tooltip
    canvas/                  NotebookCanvas, Notebook, AddOnLayer,
                             EnvironmentBackground
    hud/                     TopHUD, LeftSidebar, BottomActionBar
    panels/                  ProductConfig, Segment, AddOnTray, Pricing,
                             Operations, Inventory, Commercial, Metrics,
                             History
    mascot/                  MascotSprite, MascotBubble, MascotLayer
    charts/                  PixelStepLine, PixelStepBars, PixelSparkline,
                             PixelStackedBar
    Toast.tsx
    SmallScreenGate.tsx
  screens/
    StartScreen, RouteChoiceScreen, PhaseIntroScreen,
    SimulationScreen, EventModal, EvaluationScreen, FinalResultsScreen
  utils/                     format helpers, seeded RNG
  types/                     shared TS types
  styles/index.css           Tailwind + pixel base rules
  App.tsx                    screen state machine + reactive mascot triggers
  main.tsx                   entry point
```

## How the loop works

1. **Start → Route choice → Phase 1 intro → Simulation.**
2. In the **Simulation screen**, the left sidebar swaps the right-side panel (Product / Audience / Add-ons / Operations / Inventory / Commercial / P&L / History).
3. Decisions update the store directly. The **Bottom Action Bar** lets you advance days (1 or 5 at a time).
4. Each day-tick computes demand, produces, sells, applies costs, and writes ledger entries with `cause` tags so the P&L is traceable.
5. Days **15, 30, 45, 60, 75, 89** trigger Event modals (A/B/C/D, costs energy).
6. Days **30, 60, 90** trigger Evaluation screens with charts + an Insight Check question scored against the engine's ground truth.
7. **Day 90** is the Final Results screen with score (Net Profit /50 + Inventory Cleanliness /25 + Insight /25), decision timeline, and JSON export of the run.

## Mascot system

Sage (the mascot) lives bottom-right by default. She uses:

- `assets/img/mascot/01_base/final-approved/` for idle/ambient
- `assets/img/mascot/02_expressions/` for emotion reactions
- `assets/img/mascot/03_poses/` for active explanations

The chat bubble is **code-built** with a typewriter effect, dynamic sizing, and a stepped pixel border. Messages have a priority queue (P0 blocker → P5 ambient) to avoid noise.

## Replacing the mock engine in Step 4

Everything UI-facing imports from `@/engine/mockEngine`. The function signatures (`advanceDay`, `dayTick`, `applyEventChoice`, `placeAddOn`, etc.) are stable. To swap in the real engine in Step 4:

1. Build pure, deterministic engine modules under `src/engine/` (formulas, events, evaluations, scoring).
2. Re-export from `src/engine/index.ts` matching the mock's signatures.
3. Update the `import` paths in panels and the action bar.
4. Keep the ledger + history shape — the P&L UI projects from `state.ledger` and the timeline from `state.history`.
