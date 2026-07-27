# academy-minibusinesssim — Specification & Team Context

> A 90-day pixel-art notebook micro-business simulation for Int Labs Academy.
> This document is the single source of truth for the team — designers, developers, facilitators, and stakeholders.

---

## 1. Executive Summary

**academy-minibusinesssim** is a web-based, pixel-art entrepreneurship and financial-literacy simulation. The player runs a small notebook business out of a university dorm room over 90 internal days, structured as **three playable phases**.

| Aspect | Detail |
|---|---|
| **Audience** | University students, early-career professionals, business-school participants in Int Labs Academy programs |
| **Format** | Browser-based single-player simulation, pixel-art aesthetic |
| **Duration** | ~25–40 minutes for a full 3-phase run |
| **Teaches** | Market positioning, inventory flow, cash vs. revenue, P&L diagnosis, focused scaling |
| **Outcome** | Final score 0–100, plus phase-level debriefs and a decision history they can rationalize |

**Why a notebook business?** Notebooks are tangible, relatable, and have all the right tensions for entrepreneurship learning: clear product variants (cover, paper, binding), cost-of-goods that matters, several plausible audiences, real inventory dynamics, and a marketing surface that students recognize from their own campus. The product is simple enough that the *business decisions* — not the product itself — are the focus.

**How it works at a high level.** The player picks a funding route, then for each phase configures a product, picks an audience, sets pricing, manages production and inventory, and chooses sales channels. Once decisions are locked, they confirm the phase and the engine fast-forwards through the days, processing demand, production, sales, costs, cash flow, events, and modifiers. After each phase the player sees a debrief, answers a state-based **insight check**, and proceeds. After Phase 3 they see their final score and full P&L.

---

## 2. Simulation Narrative

You're a university student. You've noticed something: every week, you watch friends pay too much for boring notebooks, then complain that the journals they actually want — leather-bound, structured, giftable — aren't easy to find on campus.

You spot a gap.

You start small. A few notebooks at a time, made in your dorm room with whatever materials you can afford. You sell to your closest friends first. You learn what they like, what they'll pay, and where they look when they shop.

Then you have to grow. Demand changes. Materials get more expensive. A competitor shows up. A student influencer puts you on the map. Your suppliers play games with prices. Cash gets tight even as revenue climbs.

Across 90 days, you have to decide:

- **Who is this for?** Students who want cheap and reliable, creators who want premium and beautiful, professionals who want functional and minimalist, or gift buyers who care about packaging and decoration?
- **What product do I sell them?** Cover, binding, size, paper quality, add-ons.
- **At what price?**
- **How much do I make?**
- **How do I sell it?**
- **When do I scale?**

Get it right and you finish the term with cash, profit, and a clear position. Get it wrong and you finish with stockpiles you can't sell and a bank account that's tighter than when you started.

---

## 3. Learning Objectives

Five learning points anchor every mechanic in this simulation.

| Learning Point | What It Teaches | How It Appears in the Simulation | Key Metrics |
|---|---|---|---|
| **LP1 — Market Positioning** | Choosing a target audience shapes product, price, channel, and demand. There is no neutral product — every choice is a positioning bet. | Player picks a segment (Students, Creators, Professionals, Gift). Product config, price, and channels are scored against that segment's preferences. Wrong-segment choices visibly suppress demand. | `targetSegment`, `segmentFit`, `priceSensitivity`, `baseDemand`, `demandToday` |
| **LP2 — Inventory Flow** | Inventory is cash in physical form. Too much traps cash; too little forfeits sales. | Player buys raw materials, produces finished goods (capped by capacity and raw), sells (capped by finished). Stockout days and overstock days accumulate. | `rawMaterials`, `finishedGoods`, `unitsSold`, `lostSales`, `stockoutDays`, `overstockDays` |
| **LP3 — Revenue vs Cash Flow** | Revenue ≠ cash. Channels have credit terms (DSO); raw material is paid up-front; some channels collect 7–30 days late. A profitable run can run dry. | Channel sales accrue revenue today but cash arrives DSO days later. Buying raw drains cash now; COGS recognises the cost only at sale. | `cash`, `cashSchedule`, `receivables`, `revenue`, `grossProfit` |
| **LP4 — P&L as Diagnostic Tool** | The P&L isn't a report — it's a map back to the decisions that caused each line. | An always-visible bottom P&L splits costs by line item and shows Phase 1 / Phase 2 / Phase 3 / Total columns. Each line links to a cause string. | `pnl.byLineItem`, `pnl.byPhase`, `ledger.cause` |
| **LP5 — Focused Scaling** | "Do more of everything" breaks businesses. Scaling needs focused growth, capacity that keeps up, and cash discipline. | Phase 3 amplifies demand (×1.2 multiplier) and unlocks bigger upgrades. Players who scale without capacity hit stockouts; players who scale without cash awareness hit cash crunches. | `productionCapacity`, `cash`, `defectRate`, `retention`, `finalScore` |

---

## 4. Simulation Structure

The simulation is **3 phases × 30 internal days each = 90 days total**. Internally, days are still simulated one at a time so the engine can model events, cash timing, and inventory dynamics. Externally, the player only sees phases.

| Phase | Internal Days | Main Focus | Player Decisions | Main Outputs |
|---|---|---|---|---|
| **Phase 1** | 1–30 | Market positioning. First product. Find product-market fit. | Funding route (start of run), target audience, notebook archetype + materials, price, first channel | Phase 1 P&L, segment fit, first units sold, brand awareness baseline |
| **Phase 2** | 31–60 | Inventory flow. Production growth. Operations. | Raw material buys, hires, tools, process upgrades, supplier choices, expanded channels | Production output, stockout/overstock days, gross profit dynamics |
| **Phase 3** | 61–90 | Cash flow, P&L diagnosis, focused scaling. | Marketing campaigns, scaling decisions, late-stage pivots, debt repayment (investor route) | Cash trend, phase-level P&L, final score |

### Phase mechanics

- **Energy budget** rises per phase: Phase 1 = 30, Phase 2 = 45, Phase 3 = 60. At each transition, energy is replenished by +15 (capped at the phase's max).
- **Demand multiplier** rises per phase: Phase 1 = ×0.7 (slow start), Phase 2 = ×1.0 (steady), Phase 3 = ×1.2 (scaling window).
- **Phase confirm** locks decisions and runs all remaining days in that phase in one fast-forward, pausing only for events and the end-of-phase evaluation.
- **Phase debrief** shows the phase's P&L, key metrics, and an insight check whose options are derived from the player's actual state and ledger.

---

## 5. User Flow

```
Start Screen
  │
  ▼
Funding Route (Self-funded $1,000  |  Investor-backed $2,500 + $3,000 debt)
  │
  ▼
Phase 1 Intro  ──►  Phase 1 Decisions (Product · Audience · Price · Channels · Inventory · Ops)
                          │
                          ▼
                 Confirm Phase 1  ──►  Simulation runs Days 1–30
                                            │ pauses on events
                                            ▼
                                 Phase 1 Evaluation
                                  · phase P&L snapshot
                                  · charts (cash, profit)
                                  · insight check (4-option Q)
                                  · Sage debrief
                          │
                          ▼
                 Phase 2 Intro  ──►  Phase 2 Decisions
                                            │
                                            ▼
                                 Confirm Phase 2  ──►  Days 31–60  ──►  Phase 2 Evaluation
                          │
                          ▼
                 Phase 3 Intro  ──►  Phase 3 Decisions
                                            │
                                            ▼
                                 Confirm Phase 3  ──►  Days 61–90  ──►  Final Results
                                                                          · Final score (0–100)
                                                                          · Score breakdown
                                                                          · 90-day cash trend
                                                                          · Decision timeline
                                                                          · Restart / Export run
```

### Interrupt rules during phase confirmation

- **Event lands** → simulation pauses, EventModal opens, player picks A/B/C/D (each option costs energy and may cost cash).
- **Phase boundary day** (30, 60, 90) → simulation pauses, evaluation screen opens, player answers insight check.
- After any interrupt is resolved, the player clicks **Confirm Phase** again to resume from where it stopped.

### Decisions vs. day-ticks

- **Decisions never advance the internal day.** Picking a segment, configuring the notebook, hiring help, buying raw materials, opening a channel — all of these are free of day-cost. They only consume energy or cash where defined.
- **Only the Confirm Phase action advances days.** This is what makes the UX phase-based instead of day-by-day.

---

## 6. UI / Page Structure

| Page / Section | Purpose | Key Components | User Actions | Outputs Shown |
|---|---|---|---|---|
| **Top Status Bar** | Always-visible run state | Logo, Phase chip, Energy bar, KPI chips (Cash, Op Profit, Revenue, Stock, Demand, Fit), P&L anchor, Help, Mascot toggle | Toggle help / mascot, jump to P&L | All KPIs computed from the live engine |
| **Product Page** | Configure the notebook itself | Left: configuration panel (notebook type, cover, binding, size, paper, add-ons). Center: notebook canvas (visual hero). Right: compact sticky Effect Preview (fit, price, demand, unit cost, addon count, stock, warning). | Pick archetype, set materials, drop add-ons onto notebook canvas | Unit cost, unit time, defect rate, audience-fit % |
| **Business Page** | Everything other than the notebook | Sub-tab nav: Audience, Operations, Inventory, Sales & Mktg | Pick target segment, hire helpers, buy tools, switch suppliers, buy raw materials, set price, toggle channels, run campaigns | Per-decision impact previews, channel reach, daily cost, capacity gain |
| **P&L Section** | In-flow scroll section below main page | Phase × Line Item table (Phase 1, Phase 2, Phase 3, Total). Anchor button in top bar scrolls to it. | Hover row for cause text | Live P&L: Revenue, all COGS, OpEx, Gross Profit, Op Profit, Cash Balance |
| **Phase Action Bar** | Confirm phase | "Day X of 90 · N days left in Phase Y" + big primary button | Click Confirm Phase | Opens ConfirmPhaseModal with preview estimates |
| **ConfirmPhaseModal** | Preview before locking | Mascot, day count, cash/energy stats, expected sold/revenue/expenses preview | Cancel or Confirm · Simulate | Estimated phase impact (advisory) |
| **EventModal** | Interactive event resolution | Mascot, body text, 4 options A/B/C/D each with cost badges | Pick option, confirm | Modifiers applied to active state |
| **Evaluation Screen** | End-of-phase debrief | Phase snapshot, cash/profit charts, cost mix, mascot debrief, insight check (4-option) | Submit answer, continue | Phase metrics + insight scoring |
| **Final Results Screen** | Run summary | Score breakdown (50/25/25), 90-day charts, "did well / hurt" lists, decision timeline | Export JSON, restart | Final score 0–100, full ledger summary |

---

## 7. Core Decision Categories

| Decision Category | Example Choices | Affects | Learning Point |
|---|---|---|---|
| **Funding route** | Self-funded ($1,000, no debt) · Investor-backed ($2,500, owes $3,000 by Day 90) | Starting cash, ending obligation, score modifiers | LP3 |
| **Target audience** | Students · Creators · Professionals · Gift Buyers | Demand multiplier, price sensitivity, channel affinity, segment fit | LP1 |
| **Notebook archetype** | Student Notebook · Planner · Daily Journal | Unit cost baseline, segment fit weights, production time | LP1 |
| **Materials** | Cover (hardcover/leather), Binding (ring/staple), Size (S/M/L), Paper (cheap/standard/premium) | Unit material cost, perceived value, segment fit | LP1, LP4 |
| **Add-ons** | Charm, ribbon, sticker, bookmark, band, closure, etc. (max 3, one per sub-category per archetype) | +Unit cost, +Perceived value, +Segment fit components | LP1 |
| **Pricing** | $1–$30 per notebook | Demand (price factor), gross margin per unit | LP1, LP3 |
| **Operations** | Hire helpers, buy tools (basic / pro press), QA process, premium / bulk supplier | Production capacity, defect rate, daily wages, lead time | LP2, LP5 |
| **Inventory** | Buy raw materials in batches of 5–100 units | Raw stock, cash drain | LP2, LP3 |
| **Sales & Marketing** | Toggle channels (Word of Mouth, Campus Booth, Campus Store, Online, Influencer, Student Club), run campaigns, loyalty program | Channel reach, segment affinity, daily marketing cost, DSO timing | LP1, LP3, LP5 |
| **Events** | One A/B/C/D choice per event, 6 events total | Modifiers (cost/demand/capacity/retention/etc.) over a window of days | LP4 |
| **Phase confirmation** | Confirm + simulate | Advances days, runs the full engine loop | All |

---

## 8. Variables and Data Model

This is the core reference for developers and stakeholders. All currency is in dollars. All multipliers default to 1.0 (no effect).

### 8.1 Player / Meta Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `currentPhase` | Active phase 1, 2, or 3 | enum {1, 2, 3} | Phase confirm, evaluation continue | Phase demand multiplier, max energy, available upgrades |
| `internalDay` | Day in the 90-day window | int 1–90 | Confirm Phase advance | Event triggers, evaluation triggers, end-of-game |
| `route` | Funding model | enum {self, investor} | Route Choice screen | Starting cash, debt, score modifiers |
| `energy` | Strategic decision budget | int 0–maxEnergy | Channel toggle, upgrade purchase, event option | Whether decisions are affordable |
| `maxEnergy` | Phase ceiling | 30 / 45 / 60 | Phase | Energy cap |
| `cash` | Liquid bank balance | float, can go negative | All cash-affecting events | Whether actions are affordable, cash score warnings |
| `debt` | Obligation owed | float | Investor route start, finance loans, event responses | Investor obligation check at end of run |
| `brand` | Brand awareness 0–100 | float | Sales (+), lost sales (−), daily decay (−), event modifiers | Demand multiplier (`brandFactor`) |
| `gameStatus` | Run lifecycle flag | started / ended | Start screen, day 90 | Routing |

### 8.2 Product Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `archetype` | Notebook type | enum {student, planner, daily} | Player choice | Visual canvas, segment fit weights |
| `cover` | Cover material | enum {hardcover, leather} | Player choice | Unit cost (+$1.0 / +$2.6), segment fit (premium) |
| `binding` | Binding type | enum {ring, staple} | Player choice | Unit cost (+$0.4 / +$0.1) |
| `size` | Notebook size | enum {s, m, l} | Player choice | Unit cost multiplier (×0.7 / ×1.0 / ×1.3), unit time (×0.8 / ×1.0 / ×1.2) |
| `paperQuality` | Paper grade | enum {cheap, standard, premium} | Player choice, supplier upgrade | Unit cost (+$0.8 / $1.4 / $2.4), segment fit (quality) |
| `addOnsByArchetype` | Up to 3 add-ons per archetype | list, max 3, one per sub-category | Drag-and-drop | +Unit cost, +Perceived value, +Decorative/functional/packaging fit |
| `price` | Sale price | int 1–30 | Player choice, event modifiers | Demand (price factor), gross margin per unit |
| `unitMaterialCost` | Computed COGS per unit | derived | Material choices, addons, modifiers | COGS, gross profit, raw-material purchase cost |
| `unitTime` | Days-of-capacity used per unit | derived | Size mult × (1 + 0.05 × addons) | Production output |
| `perceivedValue` | Implicit price ceiling 0–1 | derived | Materials + addons | (informational) |

### 8.3 Audience / Market Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `targetSegment` | Active audience | enum {students, creators, professionals, gift} or null | Audience panel | Demand bonus (×1.4), retention scope, evaluation framing |
| `fitBySegment` | Per-segment fit 0–1 | derived per segment | Product config | Demand component for each segment |
| `baseDemand` | Per-segment daily demand baseline | constant per segment | Static config | Daily demand |
| `priceSensitivity` | Price exponent | constant per segment (0.6–1.6) | Static config | Price factor |
| `preferredPriceRef` | Anchor price for the segment | constant per segment ($6–$18) | Static config | Price factor |
| `retention[segment]` | Repeat-buy probability 0–1 | float | Daily sales ramp, event modifiers | (long-tail demand stability) |
| `customerSatisfaction` | Implicit score | derived from defect rate + lost sales | Defects, stockouts | Brand decay, retention movement |

#### Segment baseline data

| Segment | `baseDemand` | `priceSensitivity` | `preferredPriceRef` | Quality | Cover | Decorative | Functional | Packaging |
|---|---|---|---|---|---|---|---|---|
| **Students** | 18 | 1.6 | $6 | 0.4 | 0.2 | 0.5 | 0.7 | 0.2 |
| **Creators** | 10 | 0.9 | $14 | 0.9 | 0.7 | 0.9 | 0.4 | 0.5 |
| **Professionals** | 8 | 0.6 | $18 | 0.85 | 0.85 | 0.15 | 0.95 | 0.4 |
| **Gift Buyers** | 6 | 1.0 | $16 | 0.5 | 0.7 | 0.95 | 0.3 | 0.95 |

### 8.4 Operations Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `productionCapacity` | Capacity-units per day | int (default 5) | Hires (+4 to +5), Tools (+6 to +12), modifiers | Daily production cap |
| `hires` | Helpers employed | int 0–2 | Hire upgrades | Daily wage cost ($12/helper/day), capacity |
| `tools` | Tools owned | list | Tool upgrades | Capacity, defect reduction |
| `process` | Process improvements | list | Process upgrades (QA) | Defect reduction (−5%) |
| `defectRate` | Fraction wasted | float 0–0.5 | Default 8%, supplier/event modifiers, QA, tools | Good units produced |
| `productionTimePerUnit` | `unitTime` | derived | Size + addons | Daily output |
| `unitsProducedToday` | Snapshot | int | Daily tick | Inventory movement |

### 8.5 Inventory Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `rawMaterials` | Raw stock | int ≥ 0 | Buy raw, produce | Production cap |
| `finishedGoods` | Sellable stock | int ≥ 0 | Production +, sales − | Sales realised |
| `unitsSold` (daily) | Sold units | int | Daily tick | Revenue, COGS, brand, retention |
| `lostSales` (daily) | Demand left unmet | int | Daily tick | Stockout day counter, brand penalty |
| `stockoutDays` | Cumulative days w/ lost sales | int | Daily tick | Inventory cleanliness score |
| `overstockDays` | Days w/ >5 days of cover | int | Daily tick (`finished > 5 × max(4, demand)`) | Inventory cleanliness score |
| `inventoryTurnover` | (sold over period) / avg(finished) | derived | Sales / production | (informational) |
| `inventoryCleanlinessRate` | 1 − stockout − overstock rates | derived | Daily tick | Final score (×25 pts) |

### 8.6 Sales / Marketing Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `activeChannels` | Open channels | list of 1–6 | Toggle channels | Reach, segment affinity, DSO, daily cost |
| `marketingPerDay` | Daily channel cost run-rate | float | Channel toggles + campaigns | Daily marketing OpEx |
| `channelReach[id]` | Per-channel reach multiplier | constant 0.4–2.6 | Static config | Demand component |
| `channelDSO[id]` | Days-Sales-Outstanding | constant 0–30 | Static config | When channel revenue lands in cash |
| `campaignBoost` | Active campaign uplift | derived from upgrades + events | Marketing upgrades, events | Demand, brand |

#### Channel data

| Channel | Reach | Daily Cost | DSO | Strong Affinity | Unlock Cost (E / $) |
|---|---|---|---|---|---|
| Word of Mouth | 0.4 | $0 | 0 | Students 0.7 | always on |
| Campus Booth | 1.0 | $8 | 0 | Students 1.4 | E2 / $60 |
| Campus Store | 1.6 | $14 | **30** | Students 1.2, Pros 0.9 | E4 / $200 |
| Online Shop | 2.0 | $6 | 7 | Creators 1.3, Gift 1.2 | E3 / $120 |
| Influencer | 2.6 | $30 | 7 | Creators 1.6, Gift 1.3 | E5 / $250 |
| Student Clubs | 1.4 | $4 | 14 | Students 1.3 | E3 / $80 |

DSO matters: a sale on Campus Store today doesn't show up in cash for 30 days — but it shows in revenue immediately. **This is the LP3 lesson.**

### 8.7 Finance Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `grossRevenue` | Sum of revenue ledger | float | Sales | P&L, score |
| `materialCost` | Σ COGS material | float | Sales (recognise per unit sold) | Gross profit |
| `laborCost` | Σ COGS labor | float | Daily wages | Gross profit |
| `packagingCost` | Σ COGS packaging | float | Per unit sold ($0.15) | Gross profit, cash |
| `fulfillmentCost` | Σ COGS fulfillment | float | Per unit sold ($0.05) | Gross profit, cash |
| `marketingCost` | Σ OpEx marketing | float | Daily channel + campaign | Op profit, cash |
| `toolsCost` | Σ OpEx tools/upgrades | float | Upgrade purchases | Op profit, cash |
| `grossProfit` | Revenue − all COGS | derived | All COGS lines | Op profit |
| `operatingProfit` | Gross profit − OpEx | derived | OpEx lines | Net profit |
| `netProfit` | Σ P&L ledger entries (excludes balance-sheet) | derived | All P&L | Final score (50 pts) |
| `cashBalance` | Liquid cash now | float | All cash events | Solvency, score warnings |
| `receivables` | AR not yet collected | float | DSO-delayed sales | Liquidity, investor obligation |
| `payables` | AP not yet sent | float | Negotiated supplier terms | Liquidity |
| `cashSchedule` | Pending cash events | array | Sales DSO, supplier DPO | Daily drain |

### 8.8 Event / Modifier Variables

| Variable | Meaning | Type / Range | Affected By | Affects |
|---|---|---|---|---|
| `activeModifiers` | Time-windowed effects | list | Event responses, upgrades | Demand, cost, capacity, defect, retention, marketing |
| `materialCostMult` | Aggregate material multiplier | float (default 1.0) | Supplier shock, secondary supplier | Unit cost |
| `demandMult` | Aggregate demand multiplier | float (default 1.0) | Demand surge, competitor, marketing pause | Demand today |
| `priceMult` | Effective price multiplier | float (default 1.0) | Pass-to-customer, temp price hike, discount | Effective price |
| `capacityMult` | Capacity multiplier | float (default 1.0) | Defect rework, secondary supplier | Production cap |
| `defectAdd` | Additive defect rate | float (default 0) | Quality cuts | Defect rate |
| `retentionMult` | Retention multiplier | float (default 1.0) | Recall, ship-as-is, loyalty | Retention |
| `marketingMult` | Marketing run-rate multiplier | float (default 1.0) | Pause marketing event | Daily marketing cost |
| `eventEnergyCost` | Cost of event option | int 0–6 | Per option | Player energy |

---

## 9. Core Business Logic Overview

The engine processes each internal day in this order:

```
                         ┌─────────────────────────────┐
                         │  Player Phase Decisions     │
                         │  (segment, product, ops,    │
                         │   inventory, channels)      │
                         └────────────┬────────────────┘
                                      │  Confirm Phase
                                      ▼
        ┌───────────────────────  Day Tick  ───────────────────────┐
        │                                                          │
        │  1. Drain cash schedule (AR/AP due today land in cash)   │
        │  2. Expire modifiers whose endDay has passed             │
        │  3. Cache segment fits                                   │
        │  4. Compute demand for today (segment × price × brand    │
        │     × channel × phase × event modifiers × jitter)        │
        │  5. Produce: min(capacity/unitTime, raw); apply defects  │
        │  6. Sell: min(demand, finished); compute lost sales      │
        │  7. Update inventory cleanliness counters                │
        │  8. Recognise revenue (P&L) and schedule cash by DSO     │
        │  9. Recognise COGS (material on sale; pkg/fulfill drain  │
        │     cash now; labor + marketing drain cash now)          │
        │ 10. Update brand and retention                           │
        │ 11. Snapshot daily series (cash, profit, sold, finished, │
        │     raw, demand, stockout, overstock)                    │
        │ 12. Phase change → energy refill                         │
        │ 13. Interrupts: event today? evaluation day? end?        │
        │                                                          │
        └──────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────┐
                  │  Phase Evaluation           │
                  │  P&L summary + insight Q    │
                  └────────────┬────────────────┘
                               │
                               ▼  (after Phase 3)
                  ┌─────────────────────────────┐
                  │  Final Score (0–100)        │
                  │  Net Profit · Inventory     │
                  │  Cleanliness · Insight      │
                  └─────────────────────────────┘
```

The simulation uses a **seeded RNG** (mulberry32) so a given seed + decision set produces a deterministic run, with light per-day jitter for demand realism (0.85–1.15 multiplier).

---

## 10. Formula Section

All formulas below match the live engine (`src/engine/`). Every constant lives in `src/engine/config.ts` so balance can be tuned without touching logic.

### 10.1 Product Unit Cost

```
unit_material_cost =
    ( PAPER_COST[paperQuality]
    + COVER_COST[cover]
    + BINDING_COST[binding]
    + Σ addon.costPerUnit )
    × SIZE_COST_MULT[size]
    × materialCostMult       ← from active modifiers (e.g. supplier shock)

total_unit_cost =
    unit_material_cost                  (paid when raw is bought)
  + PACKAGING_PER_UNIT                  (paid when sold, drains cash + P&L)
  + FULFILLMENT_PER_UNIT                (paid when sold, drains cash + P&L)
  + (laborCost is per-day, not per-unit; modeled as daily wage × hires)
```

**Constants:**
- `PAPER_COST` = {cheap $0.80, standard $1.40, premium $2.40}
- `COVER_COST` = {hardcover $1.00, leather $2.60}
- `BINDING_COST` = {ring $0.40, staple $0.10}
- `SIZE_COST_MULT` = {S 0.7, M 1.0, L 1.3}
- `PACKAGING_PER_UNIT` = $0.15
- `FULFILLMENT_PER_UNIT` = $0.05

### 10.2 Perceived Value

Perceived value is a 0–1 score that informs how much of the price the customer accepts. It rises with:

- premium paper (+0.4)
- leather cover (+0.5)
- decorative add-ons (charms, ribbons, sticker packs) (+0.15 each)
- packaging-style add-ons (ribbons / wraps) (+0.15)
- functional add-ons (bookmarks, bands, closures) (+0.10)

Perceived value isn't applied as its own multiplier — it manifests through `segmentFit`, since each segment weights these properties differently.

### 10.3 Segment Fit

Segment fit is a weighted average across five product properties:

```
fit_paper      = paperQuality == premium ? 1.0
               : paperQuality == standard ? 0.6
               : 0.25

fit_cover      = cover == leather ? 1.0 : 0.5

fit_decorative = clamp( count(decorative addons) / 3, 0, 1 )
fit_functional = clamp( count(functional addons)  / 2, 0, 1 )
fit_packaging  = has(integrated_ribbon) ? 1.0 : 0.2

W = segment.preferences   ← weights from segment definition

segmentFit  =  ( W.paperQuality   × fit_paper
              +  W.coverPremium   × fit_cover
              +  W.decorative     × fit_decorative
              +  W.functional     × fit_functional
              +  W.packaging      × fit_packaging )
              / Σ W
```

Result is clamped to 0..1. Each segment has different weights (see segment table in §8.3).

### 10.4 Demand Formula

```
priceFactor   = clamp( 2 − (effective_price / preferredPriceRef) ^ priceSensitivity ,
                       PRICE_FACTOR_MIN, PRICE_FACTOR_MAX )
brandFactor   = 1 + (brand / 100) × (DEMAND_BRAND_MAX_BOOST − 1)            # up to ×1.5 at brand 100
targetBonus   = (segment == targetSegment) ? DEMAND_TARGET_BONUS : DEMAND_NONTARGET   # 1.4 vs 0.55
phaseMult     = PHASE_DEMAND_MULT[currentPhase]                             # 0.7 / 1.0 / 1.2
channelReach  = Σ activeChannels.reach
channelAffinity = avg( channels.segmentAffinity[segment] )
jitter        = 0.85 + rand() × 0.30                                        # seeded RNG

demand_segment = segment.baseDemand
               × segmentFit
               × priceFactor
               × brandFactor
               × max(0.3, channelReach)
               × channelAffinity
               × targetBonus
               × phaseMult
               × demandMult           # event modifiers
               × jitter

demand_today = Σ demand_segment over all 4 segments
```

`PRICE_FACTOR_MIN` = 0.05, `PRICE_FACTOR_MAX` = 2.0. Demand is clamped at 0.

### 10.5 Price Factor

```
priceFactor = clamp( 2 − (price / refPrice) ^ sensitivity, 0.05, 2.0 )
```

- At price == ref price: factor = 2 − 1 = **1.0** (neutral).
- Below ref: factor > 1 (demand uplift), bounded at 2.0.
- Above ref: factor < 1, falls faster for high-sensitivity segments.

| Scenario | Students (sens 1.6) | Professionals (sens 0.6) |
|---|---|---|
| Price = 50% of ref | factor ≈ 1.67 | factor ≈ 1.34 |
| Price = ref | 1.00 | 1.00 |
| Price = 150% of ref | factor ≈ 0.07 | factor ≈ 0.71 |

This is why over-pricing is brutal for students but tolerable for professionals.

### 10.6 Production Formula

```
unitTime         = SIZE_TIME_MULT[size] × ( 1 + ADDON_COMPLEXITY × addonCount )
                   # SIZE_TIME_MULT: S 0.8, M 1.0, L 1.2; ADDON_COMPLEXITY = 0.05
capacityToday    = max( 1, floor( productionCapacity × capacityMult ) )
producible       = min( floor(capacityToday / unitTime), rawMaterials )
defects          = round( producible × defectRate )
producedGood     = producible − defects

rawMaterials    -= producible      # raw consumed (defects also consume raw)
finishedGoods   += producedGood
```

`defectRate` is bounded at MAX_DEFECT_RATE (0.50) regardless of additive modifiers.

### 10.7 Inventory Formula

```
units_sold       = min( demand_today, finishedGoods )
lost_sales       = max( 0, demand_today − finishedGoods )

finishedGoods_end = finishedGoods − units_sold

# day counters
if lost_sales > 0:           stockoutDays  += 1
if finishedGoods_end >
   OVERSTOCK_DAYS_COVER × max(4, demand_today):    overstockDays += 1
```

`OVERSTOCK_DAYS_COVER` = 5. So overstock is "more than 5 days of cover at current demand."

### 10.8 Sales Formula

```
effective_price = product.price × priceMult                # event modifiers
revenue_today   = units_sold × effective_price

# revenue is recognised today (P&L immediately)
# cash arrival is split by channel reach share, scheduled by DSO[channel]
for channel in activeChannels:
    share        = reach[channel] / Σ reach
    slice        = revenue_today × share
    if DSO[channel] == 0:    cash += slice                  # immediate
    else:                    cashSchedule.push({day: today + DSO, amount: slice})
```

### 10.9 Cost Formula

| Cost line | Per-unit / per-day | Cash impact | P&L impact |
|---|---|---|---|
| Raw material purchase | `units × unit_material_cost` (floor: $1.40) | **Now** (when buying) | None directly — recognised as `cogs-material` at sale |
| COGS material | `units_sold × unit_material_cost` | None — already paid at purchase | At sale time |
| Packaging | `units_sold × $0.15` | At sale | At sale |
| Fulfillment | `units_sold × $0.05` | At sale | At sale |
| Labor (daily) | `hires × $12/day` | At end of day | At end of day |
| Marketing (daily) | `Σ channel.dailyCost × marketingMult` | At end of day | At end of day |
| Tools / upgrades | one-off cash cost | At purchase | At purchase |
| Event option costs | per-option energy & cash | At choice | At choice |

This separation is the LP3 mechanic: **buying raw drains cash now but only hits P&L when you sell.** A player who over-buys raw material will see profit look fine but cash collapse.

### 10.10 Profit Formula

```
COGS              = materialCost + laborCost + packagingCost + fulfillmentCost
grossProfit       = grossRevenue − COGS

OpEx              = marketingCost + toolsCost
operatingProfit   = grossProfit − OpEx

netProfit         = Σ (P&L ledger entries)
                  = grossRevenue
                  − materialCost − laborCost − packagingCost − fulfillmentCost
                  − marketingCost − toolsCost
                  + revenue from event-driven liquidations
```

> **Important:** `netProfit` deliberately **excludes** `inventory-purchase`, `cash-in`, and `cash-out` ledger kinds. Those are balance-sheet/liquidity events, not P&L. Including `inventory-purchase` would double-count material cost (paid via raw purchase, recognised again via COGS at sale).

### 10.11 Cash Flow Formula

```
cash_end = cash_start
         + cash_in (DSO-delayed sales arriving today)
         − cash_out (raw purchases, wages, marketing, packaging, fulfillment,
                     upgrade purchases, event costs, supplier payments)
```

**Why revenue can be high while cash is low:**

1. **DSO**: Influencer (DSO 7), Student Club (DSO 14), Campus Store (DSO 30). Sales today ≠ cash today.
2. **Inventory build-up**: Buying raw drains cash *before* sales convert it back.
3. **Ongoing OpEx**: Wages and marketing run every day regardless of revenue.

Cash can go negative; the score penalty is that the player struggles to pay for new raw material or to cover the investor obligation.

### 10.12 Inventory Cleanliness Formula

```
active_days            = min(90, internalDay)              # avoid div/0 early
stockoutRate           = clamp( stockoutDays  / active_days, 0, 1 )
overstockRate          = clamp( overstockDays / active_days, 0, 1 )
inventoryCleanlinessRate = clamp( 1 − (stockoutRate + overstockRate), 0, 1 )
```

A clean run has zero stockout days and zero overstock days → cleanliness = 1.0 → 25 score points. A stockout-heavy or overstock-heavy run gets penalized linearly.

### 10.13 Final Scoring Formula

```
netProfitScore     = clamp( netProfit / MAX_EXPECTED_NET_PROFIT, 0, 1 ) × 50
inventoryScore     = inventoryCleanlinessRate × 25
insightScore       = (correctInsights / totalInsights) × 25                    # 0 if no checks answered

investorPenalty    = (route == investor && obligation_not_met) ? 15 : 0
investorBonus      = (route == investor && obligation_met)     ? 5  : 0

finalScore = round( clamp(
                netProfitScore + inventoryScore + insightScore
                + investorBonus − investorPenalty,
                0, 100 ) )
```

`MAX_EXPECTED_NET_PROFIT` = $4,500 (tunable; represents a "well-played" run baseline).

**Why Net Profit, not Revenue?** Revenue rewards selling at any cost. Net Profit rewards *the right* selling — pricing that beats the unit cost, choosing channels that don't bleed daily fees, controlling defect rate. It directly reinforces LP3 and LP4: *the goal is sustainability, not just top-line numbers.*

---

## 11. What Affects What — Impact Matrix

`↑` = increases · `↓` = decreases · `—` = no direct effect · `⚠` = conditional / depends on context

| Decision / Variable | Demand | Cost | Production Time | Inventory | Cash | Profit | Customer Fit |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Pick target segment | ↑ (target ×1.4) | — | — | — | — | ↑ | ↑ |
| Wrong segment | ↓ (×0.55) | — | — | — | — | ↓ | ↓ |
| Choose Daily Journal | ⚠ (creators/gift ↑, students ↓) | ↑ (premium materials) | ↑ | — | ⚠ | ⚠ | ⚠ |
| Leather cover | ↑ (creators/gift) | ↑ (+$1.6/u) | — | — | ↓ (more raw $) | ⚠ | ↑ (premium) |
| Premium paper | ↑ (creators/pros) | ↑ (+$1.0 vs std) | — | — | ↓ | ⚠ | ↑ |
| Larger size (L) | — | ↑ (×1.3) | ↑ (×1.2) | ↓ (slower output) | ↓ | ⚠ | — |
| More add-ons | ↑ (decorative/functional fit) | ↑ | ↑ (+5%/addon) | ↓ output | ↓ | ⚠ | ↑ |
| Lower price | ↑ (priceFactor) | — | — | ⚠ (faster sell) | ⚠ | ↓ (per unit) | ⚠ |
| Higher price | ↓ | — | — | ⚠ (slower sell) | ⚠ | ↑ per unit | ⚠ |
| Hire helper | — | ↑ (wages) | — | ↑ (capacity) | ↓ | ⚠ | — |
| Buy basic press tool | — | ↑ (one-off $220) | — | ↑ (capacity +6) | ↓ | ⚠ | — |
| QA process | — | ↑ ($150 once) | — | ↑ (less defect) | ↓ | ↑ | ↑ (retention) |
| Premium supplier | — | ↑ (+12% material) | ↑ (+1d) | — | ↓ | ⚠ | ↑ (auto-premium paper) |
| Bulk supplier | — | ↓ (−10% material) | — | — | ↑ over time | ↑ | — |
| Buy raw materials | — | — | — | ↑ | ↓ now | ⚠ (later) | — |
| Marketing campaign | ↑ (14d demand uplift) | ↑ ($60 + daily) | — | — | ↓ | ⚠ | — |
| Open Influencer | ↑ (×2.6 reach) | ↑ ($30/d) | — | — | ↓ daily, ↑ delayed (DSO 7) | ⚠ | — |
| Open Campus Store | ↑ (×1.6 reach) | ↑ ($14/d) | — | — | ↓ daily, ↑ delayed (DSO 30) | ⚠ | — |
| Take loan ($500) | — | ↑ ($60 interest) | — | — | ↑ now, ↓ later | ↓ | — |
| Event: Absorb supplier shock | — | ↑ (×1.2 mat for 30d) | — | — | ↓ | ↓ | — |
| Event: Pass-through pricing | ↓ (14d −10%) | — | — | — | ⚠ | ↑ margin | — |
| Event: Rush demand surge | ↑ (10d ×1.45) | ↑ ($200 raw) | — | ↑ raw +30 | ↓ now | ↑ if stock holds | — |
| Event: Discount campaign | ↑ (10d ×1.18) | ↑ ($80 + lower price) | — | — | ↓ | ⚠ | — |
| Event: Defect rework | — | — | ↑ effective | ↓ output (5d ×0.7) | — | ↓ short-term | ↑ retention |
| Event: Pause marketing | ↓ (10d ×0.88) | ↓ (mkt ×0) | — | — | ↑ | ↑ short-term | — |
| Event: Liquidate stock | — | — | — | ↓ finished | ↑ | ⚠ | ↓ |

---

## 12. Event System

Events are **scripted interrupts** that land on specific days during the 90-day run. Each event is a forced choice: the player picks one of four options, each pays an energy/cash cost and applies a set of modifiers (immediate or windowed).

| Day | Event | Trigger Phase | Lesson |
|---|---|---|---|
| 15 | Supplier Shock | Phase 1 | Cost vs price tradeoff (LP1, LP4) |
| 30 | Campus Demand Surge | Phase 1→2 | Inventory + cash readiness (LP2, LP3) |
| 45 | Competitor Appears | Phase 2 | Differentiation (LP1, LP5) |
| 60 | Production Defect Wave | Phase 2→3 | Quality vs speed (LP4) |
| 75 | Cash Crunch | Phase 3 | Cash flow under pressure (LP3) |
| 89 | Late Pivot Opportunity | Phase 3 (final stretch) | Focus vs spread (LP5) |

### Event option matrix

| Event | Option | Effect | Affected Variables | Learning Point |
|---|---|---|---|---|
| **Supplier Shock** | A. Absorb cost | `materialCostMult ×1.20` for 30d | Margin shrinks, demand stable | LP4: cost ≠ price |
| | B. Pass to customers | `priceMult ×1.15` (30d) + `demandMult ×0.9` (14d) | Demand dips, margin protected | LP1: price elasticity |
| | C. Secondary supplier | `materialCostMult ×1.08` + `capacityMult ×0.9` (20d) | Lead time + cost drift | LP2: lead time vs cost |
| | D. Cut quality | `defectRate +6%` permanently, `retentionMult ×0.9` | Brand bruised | LP1: long-tail damage |
| **Demand Surge** | A. Rush production | Cash −$200, raw +30, `demandMult ×1.45` (10d) | Captures spike if stock holds | LP2 + LP3 |
| | B. Waitlist | brand +6, `demandMult ×1.15` + `retentionMult ×1.05` (10d) | Steady, no cash hit | LP5 |
| | C. Raise prices | `priceMult ×1.20` + `demandMult ×0.92` (7d) | Margin up, growth capped | LP1 |
| | D. Decline excess | `defectAdd −0.02`, `demandMult ×1.05` (10d) | Quality protected | LP5 |
| **Competitor** | A. Differentiate | `demandMult ×1.10` + `materialCostMult ×1.05` (25d), cash −$30 | Add-on push | LP1 |
| | B. Discount campaign | `demandMult ×1.18` + `priceMult ×0.92` (10d), cash −$80 | Brand +4, margin pressed | LP4 |
| | C. Tighten target | `demandMult ×0.92` + `retentionMult ×1.12` (20d) | Niche moat | LP5 |
| | D. Ignore | `demandMult ×0.94` (30d), brand −5 | Slow decay | — |
| **Defect Wave** | A. Recall + apologise | Cash −$120, `retentionMult ×1.12` (20d) | Trust restored | LP4 |
| | B. Rework batch | `capacityMult ×0.7` (5d) | Capacity hit | LP2 |
| | C. Sell discounted | `priceMult ×0.80` (4d) | Move stock fast | LP4 |
| | D. Ship as-is | `retentionMult ×0.85` + `demandMult ×0.95` permanent, brand −10 | Long-term damage | LP5 |
| **Cash Crunch** | A. Short loan | Cash +$500, debt +$560 | Quick fix | LP3 |
| | B. Pause marketing | `marketingMult ×0` + `demandMult ×0.88` (10d) | Cash protected | LP3 |
| | C. Emergency liquidation | Sell up to 30 units at 70% price | Immediate cash | LP3 |
| | D. Renegotiate supplier | `capacityMult ×0.92` (30d) | Stretches AP | LP3 |
| **Late Pivot** | A. Pivot premium | `retentionMult ×1.15` permanent, cash −$60 | Final-stretch quality | LP5 |
| | B. Stay focused | No change | Discipline | LP5 |
| | C. Hybrid | `demandMult ×0.95` + `materialCostMult ×1.05` permanent | Mediocre on every axis | LP5 |
| | D. Liquidate | Sell all finished at 65% | Cash grab | — |

### Modifier engine

Modifiers are **time-windowed multipliers/additives** with `startDay` and `endDay`. They are aggregated each tick into a single struct (`materialCostMult`, `demandMult`, etc.) and decay at `endDay + 1`. Permanent modifiers use `endDay = null`.

---

## 13. Phase Evaluation and Insight Checks

After each phase (days 30, 60, 90), the simulation pauses and the **Evaluation Screen** appears.

### What the player sees

1. **Phase Snapshot** — Gross Revenue, Operating Profit, Cash, Finished stock, Stockout days, Overstock days for the phase window.
2. **Cash Trend** chart — daily cash for the run so far.
3. **Daily Profit** chart — daily profit for the run so far.
4. **Cost Mix** stacked bar — Material, Labor, Marketing, Tools, Pkg/Fulfill.
5. **Sage's Debrief** — short narrative line based on profit sign, stockouts, and overstock.
6. **Insight Check** — one 4-option multiple-choice question.

### Insight check generation

The insight check is **state-derived**, not pre-written. The engine looks at the actual ledger and history for that phase window and selects the option whose `correct: true` flag matches the dominant pattern.

**Phase 1 — "Which lever drove your demand the most?"**
- Engine checks `targetSegment` set + `fitBySegment[target] >= 0.55`.
- Correct answer: "Picking and matching a target audience" (if both true).
- Otherwise: "I didn't pick an audience — demand stayed weak."

**Phase 2 — "Why did cash dip around Day X?"**
- Engine finds the day with the largest negative cash delta in the phase window.
- Looks at top cost cause in the surrounding 3-day window.
- Correct answer maps to that cause: raw purchase, COGS material, wages, or marketing.

**Phase 3 — "Why didn't profit scale with revenue?"**
- Engine compares ratios: matCost / revenue, opex / revenue, price level.
- Correct answer is whichever ratio crosses the threshold first.

### Scoring

- Each correct answer: +1 to `insights.correct`.
- Total checks: typically 3 (one per phase).
- Insight points: `(correct / total) × 25`.

### Why this matters

Insight checks force the player to **explain their own run**. They can't memorize a generic answer — the question is built from their actual ledger. A player who didn't pay attention to cause-and-effect during the phase will miss the question.

---

## 14. P&L Table Design

The P&L table lives **below the main page content** as an in-flow scroll section. A small "P&L ↓" anchor button in the top bar smooth-scrolls the player to it.

### Layout

| Line Item | Phase 1 | Phase 2 | Phase 3 | Total |
|---|--:|--:|--:|--:|
| Gross Revenue | … | … | … | … |
| Less: Material Cost | … | … | … | … |
| Less: Labor Cost | … | … | … | … |
| Less: Marketing Spend | … | … | … | … |
| Less: Packaging / Fulfillment | … | … | … | … |
| Less: Tools / Upgrades | … | … | … | … |
| **Gross Profit** | **…** | **…** | **…** | **…** |
| **Operating Profit** | **…** | **…** | **…** | **…** |
| Cash Balance | — | — | — | **…** |

Subtotal rows have visible dividers; emphasised rows (Gross Profit, Op Profit, Cash) use a tinted background.

### Why scroll-based instead of drawer

- **Reinforces LP4** — players read the P&L deliberately, not glance at it as a strip.
- **Frees vertical space** for the canvas and decision panels.
- **Simpler model** — no drawer state, no hide/show button, just standard scrolling.
- **Anchor button** in the top bar is the always-visible cue that P&L exists.

### Reading guide for facilitators

- **Revenue rising but Gross Profit flat** → material cost is climbing (premium materials, supplier shock, big orders without raw price discipline).
- **Gross Profit positive but Op Profit negative** → marketing or upgrade spend has outrun the contribution margin.
- **Op Profit positive but Cash negative** → DSO is biting; receivables haven't landed yet, but bills did. This is the LP3 lesson.
- **Phase 3 column zero everywhere** → the player hasn't simulated Phase 3 yet (column shows live state once the phase runs).

---

## 15. Example Scenario Walkthrough

A self-funded player picks Students. Configures a Student Notebook with Hardcover, Ring, Medium, Standard paper. Adds a sticker pack. Sets price at $7. Opens Campus Booth. Buys 50 raw. Confirms Phase 1.

| Step | Decision | Immediate Effect | Financial / Operational Impact |
|---|---|---|---|
| 1 | Pick Students | `targetSegment = students` | Demand multiplier ×1.4 for student segment, baseDemand 18 |
| 2 | Student Notebook (default) | archetype = student | Lower unit cost, faster production |
| 3 | Hardcover + Standard + Ring + M | unit_material_cost = (1.4 + 1.0 + 0.4) × 1.0 = $2.80 | Cash drains by $2.80 per raw unit bought |
| 4 | Sticker pack (cost $0.30) | unit_material_cost +$0.30 → $3.10 | Decorative fit ↑, also nudges retention |
| 5 | Set price $7 | priceFactor ≈ 2 − (7/6)^1.6 ≈ 0.71 | Slight demand penalty (above ref $6) |
| 6 | Open Campus Booth (E2 / $60) | reach +1.0, daily cost +$8, DSO 0 | Cash $1000 − $60 = $940 |
| 7 | Buy 50 raw | rawMaterials +50 (cost 50 × $3.10 = $155) | Cash $940 − $155 = $785 |
| 8 | Confirm Phase 1 | Days 1–30 simulate | See projection below |

### Daily mid-phase snapshot (illustrative, ~Day 15)

```
Daily demand_today      ≈ 8 units
Capacity                = 5
unit_time               = 1.0  (M, +1 add-on → ×1.05)
Producible              = floor(5 / 1.05) = 4
Defects (8%)            = 0–1
Good produced           = 4
Sold                    = min(8, finishedGoods≈3)  = 3
Lost sales              = 5    (stockout day++)
Revenue today           = 3 × $7 = $21
COGS material           = 3 × $3.10 = $9.30
Packaging               = 3 × $0.15 = $0.45
Fulfillment             = 3 × $0.05 = $0.15
Marketing (booth)       = $8
Daily cash change       ≈ $21 − $0.60 − $8 = +$12.40   (no labor, no DSO delay)
```

### Phase 1 illustrative P&L (numbers approximate)

| Line | Phase 1 |
|---|--:|
| Gross Revenue | $315 (≈ 45 units sold × $7) |
| Material | -$140 (45 × $3.10) |
| Packaging | -$7 |
| Fulfillment | -$2 |
| Labor | $0 (no hires yet) |
| Marketing | -$240 (30d × $8) |
| Tools / Upgrades | -$60 (booth unlock) |
| **Gross Profit** | **$166** |
| **Operating Profit** | **-$134** |
| Cash Balance | ≈ $651 (started $1000, paid raw + booth + marketing, banked sales) |

What the player should notice:
- **Gross profit positive** — pricing covers material.
- **Operating profit negative** — booth daily cost outran sales volume.
- **Stockout days high** — Capacity 5 can't keep up with student demand at ref price; needs hires or fewer add-ons.
- **Cash dropped** despite revenue — raw material upfront + ongoing marketing.

This is exactly the LP3 / LP4 moment to surface in the Phase 1 debrief.

---

## 16. Design / UX Principles

The simulation is engaging because the *visual* is playful (pixel art, dorm-room vibes, the mascot Sage), but **every screen serves the learning**.

**Direction: clean pixel-game minimalism.** Not a corporate dashboard, not a noisy arcade. Calm and focused, but unmistakably a pixel game.

1. **Pixel UI, not pixel-thinking.** The visual metaphor (notebook on a desk, drag-and-drop add-ons) makes decisions tangible. The math behind them is deliberately serious.
2. **Product page = hero notebook.** Configuration on the left, notebook canvas in the centre, compact sticky Effect Preview on the right.
3. **Business page = control room.** Audience, Operations, Inventory, Sales — each gets dedicated space, no clutter.
4. **P&L scroll-flows below the main view.** A subtle "P&L ↓" anchor in the top bar is always available.
5. **Phase-based flow.** No micromanaging individual days. The player thinks in phases of strategy, not day-by-day actions.
6. **Cause-effect feedback.** Every ledger entry has a `cause` string. Every modifier has a name. Every decision is in `state.history`. Nothing is opaque.
7. **Mascot Sage stays out of the way.** Fixed safe corner, closeable, larger and readable, never goes off-screen on zoom or resize. A small help/mascot button reopens it.
8. **Reduced noise.** No cooldown timers, no fake gamification. The challenge is the business itself. Animations are tasteful and controlled (medium budget).
9. **Input ↔ Output separation.** Input lives in panels (left/right). Output (KPIs, P&L) lives in HUD strips and the P&L scroll section.
10. **Phase debrief slows the player down.** Forcing them to read a chart and answer one question turns each phase from "play time" to "reflect time."

---

## 17. Assumptions and Open Questions

### Assumptions

- All currency is in single-currency dollars; no localization yet.
- Unit costs are per-finished-notebook approximations; raw material is treated as homogenous "potential notebooks."
- Demand jitter (0.85–1.15) is intentional, light realism without making outcomes unfair.
- `MAX_EXPECTED_NET_PROFIT = $4,500` is an estimate of a "well-played, self-funded" run. Will be calibrated against playtests.
- Net Profit (not Revenue) drives the 50-point score. Revenue would reward over-spending; Net Profit forces focus on margin.
- Inventory cleanliness uses a simple linear penalty (1 − stockout rate − overstock rate). Could be made non-linear if playtesting shows it's too soft or too punitive.
- Events are scripted on fixed days. Modifier-based effects make them feel dynamic, but timing is deterministic.
- Single seed per run. Same decisions on the same seed = same outcome.
- The investor obligation check uses cash + receivables ≥ debt as a proxy.
- Tools / upgrades are one-shot purchases with permanent effects (no maintenance cost).

### Open Questions for the Team

| Question | Why it matters |
|---|---|
| Should the **investor route bonus/penalty** scale (×0.9 to ×1.1) instead of flat ±15? | More nuanced reward for successful debt management |
| Should **inventory cleanliness scoring** weight stockouts and overstock differently? | Stockouts cost real revenue; overstock costs cash. Currently weighted equally |
| Should there be **more than one insight check per phase**? | More questions = more learning; risk: longer evals |
| Should **cash be allowed to go negative**? | Currently yes — it's an explicit failure mode. Could clamp at 0 with a "cash crisis" interrupt instead |
| Should players be able to **revise phase decisions** before confirming? | Currently yes (decisions are free until confirm). Should the previous phase be revisitable? |
| Should **event choices be optional** (e.g., a "do nothing" default)? | Currently mandatory — every event has 4 forced options |
| Should we add a **tutorial overlay** that calls out specific UI elements during Phase 1? | Onboarding clarity vs. discovery |
| Should we track **per-segment retention separately** in the UI? | Currently engine-only; could surface as a "loyal customers" panel |
| Should **labor cost be variable** (more units → more labor) instead of a flat daily wage? | More realistic, but adds a planning dimension |
| Should we add a **savings goal** mid-run (e.g., "Save $X by Day 60 to unlock Y")? | Ties the abstract score to a concrete target |
| Should facilitators have a **debug / replay mode** to step through a student's run? | Big classroom value, but extra build cost |

---

## 18. Appendix: Quick Reference

### Engine modules

| File | Responsibility |
|---|---|
| `src/engine/mockEngine.ts` | Day-tick orchestrator, decision mutators |
| `src/engine/config.ts` | All tunable constants |
| `src/engine/cashflow.ts` | DSO/DPO scheduling |
| `src/engine/modifiers.ts` | Modifier aggregation + expiry |
| `src/engine/eventEffects.ts` | Per-event option resolution |
| `src/engine/scoring.ts` | Final score computation |
| `src/engine/insightGenerator.ts` | State-aware insight Q generation |
| `src/engine/selectors.ts` | UI-facing projections (KPIs, P&L by phase, cash trend) |

### Selector inventory

- `selectKpis(s)` — Cash, receivables, payables, revenue, opProfit, finished, raw, demand estimate, fit %, brand, unit cost, effective price, unit time
- `selectPnL(s)` — Live P&L row data
- `selectPhasePnL(s)` — Phase-windowed P&L (Phase 1, 2, 3, Total)
- `selectEvaluationSummary(s, phase)` — Phase debrief snapshot
- `selectCashTrend(s, days?)` — Cash, profit, revenue series
- `selectInventoryTrend(s, days?)` — Finished, raw, demand, sold, stockout series
- `selectFinalScore(s)` — Total, breakdown, route flags
- `selectCurrentPhase(s)` — Phase, day, days remaining, energy
- `selectProductSummary(s)` — Archetype, unit cost, unit time, fit, top fit, target fit
- `selectWarnings(s)` — Active warnings (cash low, no segment, demand outpacing stock, etc.)

### Constants (single source of truth: `src/engine/config.ts`)

| Constant | Value |
|---|---|
| `STARTING_CAPITAL` | self $1,000 / investor $2,500 |
| `INVESTOR_DEBT` | $3,000 |
| `INVESTOR_PENALTY / BONUS` | -15 / +5 |
| `PHASE_MAX_ENERGY` | 30 / 45 / 60 |
| `ENERGY_REPLENISH` | +15 per phase boundary |
| `PHASE_DEMAND_MULT` | 0.7 / 1.0 / 1.2 |
| `PACKAGING_PER_UNIT / FULFILLMENT_PER_UNIT` | $0.15 / $0.05 |
| `BASE_PRODUCTION_CAPACITY` | 5 |
| `HIRE_DAILY_WAGE / HIRE_CAPACITY_GAIN` | $12 / +4 |
| `DEFAULT_DEFECT_RATE / MAX_DEFECT_RATE` | 8% / 50% |
| `OVERSTOCK_DAYS_COVER` | 5 |
| `MAX_EXPECTED_NET_PROFIT` | $4,500 |
| `BRAND_MIN / MAX` | 0 / 100 |
| `RAW_UNIT_COST_FLOOR` | $1.40 |

---

*End of specification. Questions, calibration suggestions, and balance feedback welcome — ping the engineering channel before tuning constants in `config.ts`.*
