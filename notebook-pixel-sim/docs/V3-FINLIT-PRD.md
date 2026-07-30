# V3 — FinLit Spec Integration (analysis + plan)

Source material (provided 2026-07, `~/Downloads`):
- **`FinLit (2).pdf`** (20pp) — design doc: Learning Points, Storyline, Narrative,
  Simulation Design, Key Choices/Decisions, Key Scenarios, Winning Metrics, To-Do,
  whiteboard photos. **Pink/magenta text in the PDF = the intended changes/new
  requirements**; green text = formulas.
- **`FinLit Calc.xlsx`** (Sheet1, 87×22) — the authoritative **numeric engine**:
  market-demand curves, channel splits, the multiplicative production model,
  hiring/marketing/vendor tables.

This branch (**V3**, cut from V2 `27c18b5`) implements those changes. V2 stays the
stable checkpoint; `main`/Vercel keep serving V2 until V3 is ready.

---

## 1. The learning spine (unchanged intent — the app already targets these)

| LP | Title | Teaches |
|----|-------|---------|
| LP1 | Targeted Design | Identify a target market; align design/price/channel/size/paper to it — product-market fit. |
| LP2 | Inventory Flow | Inventory = tied-up capital; balance production vs demand; avoid stockout **and** overstock. |
| LP3 | Revenue vs Cash Flow | Profit ≠ cash; timing of in/out-flows drives survival. |
| LP4 | Understanding P&L Signals | Read the P&L as a diagnostic; trace outcomes back to decisions; marketing = expense that buys visibility. |

The current game is already structured around these four (see start-screen "What
you'll learn" chips). **The scoring rubric already matches the spec exactly** —
see §4.6.

---

## 2. The calc model (from `FinLit Calc.xlsx`) — this is the new numeric core

### 2.1 Markets = notebook genres, with per-phase demand growth
Four markets, each a **notebook genre** with its own demand curve across phases
(rows 2–9). Phases labelled Phase −1 … Phase 3:

| Genre | P−1 | P0 | P1 | P2 | P3 | ~growth/phase |
|-------|----:|---:|---:|---:|---:|---|
| Cute       | 10 115 | 12 212 | 14 507 | 17 115 | 20 759 | +11–18% |
| Anime      |  9 752 | 11 506 | 14 093 | 17 108 | 21 023 | +15–19% |
| Minimalist | 12 503 | 14 022 | 16 409 | 18 552 | 21 543 | +11–15% |
| Indie      | 11 594 | 14 233 | 17 562 | 19 527 | 22 511 | +10–19% |

- **Base market share = 8.125 %** (`I8`: "divided by 12 teams"). A single player
  captures a slice of a genre's demand; higher share = "stealing customers."
- Demand **shifts each phase**, so over-relying on one genre stalls (PDF LP1
  Company-B lesson: one segment peaks then gets overtaken).

### 2.2 Channels — Offline / Online / Retail (rows 12–24, per genre)
Each genre sells through 3 channels, each with a **split %**, **maintenance/day**,
**consignment**, **inventory cost**, and a **base sell-rate**:

| Channel | Split (varies by genre) | Maint. | Consign. | Inv.cost | Sell-rate |
|---------|------------------------|-------:|---------:|---------:|----------:|
| Offline | .30–.40 | 10.0  | 0     | 0     | .027–.04 |
| Online  | .30–.40 | 11.5  | 8.0   | 0     | .022–.04 |
| Retail  | .30–.40 | 15.0  | 11.8  | 11.8  | .02–.04  |

**Customers/30d (per genre×channel)** =
`demand × (channelSellRate + hiringSellBonus) × 30 × 0.08125(share) × split`
→ per-day = /30; **earn/day = custPerDay × $16** (unit contribution).

### 2.3 Production — multiplicative rate model (rows 27–52)
`prodPerDay = Type × PaperMaterial × Size × PageDesign × Addon × CoverPage × BASERATE(100000) + hiringProdBonus`
(`G28` = 0.1×0.025×0.3×0.45×0.33×0.35×100000 + 3.92 ≈ **7.8 units/day** — production
is deliberately slow). Each config option carries a **rate multiplier** and a
**per-unit cost**:

- **Type** (Cute/Anime/Minimalist/Indie): rate .1, cost $5
- **Paper Material**: Cream .025/$1.25 · Fountain-Pen .015/$1.50 · Recycled .027/$0.75 · Black .03/$1.35
- **Size**: A5 .4/$0.25 · B4 .3/$0.30 · B5 .45/$0.20
- **Page Design**: Lined .6/$0.10 · Grid .52/$0.15 · Storyboarding .45/$0.25 · Blank .8/$0.05 · Numbered .68/$0.115
- **Addons**: Spiral .32/$2.00 · Sewn .30/$2.15 · Pen-Holder .33/$1.85 · Bookmark .31/$1.50 · Corner .27/$2.25 · Charms .29/$2.30
- **Cover Page**: Hard .2/$2.55 · Plastic .35/$1.50 · Holographic .125/$2.95
- **Unit prod cost** = Σ chosen component costs (`I28` example = $12.30); **InvenCost** = prodCost × prod30day.

### 2.4 Hiring — 4 named candidates × 4 levels (rows 30–46)
Candidates **Ains / Beta / Chewie / Danoct**. Level 1→4 **doubles** production-rate
and sell-rate each step; cost $5→$10→$20→$40; energy 2→4→6→8. Each candidate has a
different prod-vs-sell balance (e.g. Ains higher prod, Chewie higher sell). Level
gated by phase (L4 "only if @ P1").

### 2.5 Marketing — pick 1 of 4 (rows 48–52)
Social-Media $13/+.047/4e · Offline-Ad $10/+.041/3e · Web $20/+.092/7e · SEO $17/+.075/5e.
Note: "sell-rate is perpendicular to cost; cost is a slider, sell-rate +0.01 per $0.30."

### 2.6 Vendors (shipping/stockists) — 5 stores × 4 genres (rows 55–87)
Al's / Emil's / Phoebe's / Nine's stores, each with per-genre **quality**
(Perfect/Good/Average/–), **sell-rate**, **production-rate**, **energy cost**. Some
genres unavailable per store (0). **Phase 1 = level 1; Phase 2 = level 2** (×2–3
scaling). Choosing a vendor that doesn't cover your genre wastes the pick.

---

## 3. New/changed simulation systems (from the PDF)

1. **Start routes**: self-funded **$1000**, or investor **$5000 but begin at −$4000
   profit** (the obligation). Route affects gameplay + final score. *(current app:
   self $1000/$0 debt, investor $2500/$3000 debt — numbers differ)*
2. **Energy** — ⚠️ **the PDF states two different models** (see §5 forks).
3. **Key Decisions** — per-phase cards with **energy + money cost + prerequisites**,
   carry across phases, some are prereqs for later ones:
   - **Phase 0**: Marketing (6e/$60/+15% demand) · Hiring (6e/$50/+15% sell) · Add Notebook Type (12e/$30)
   - **Phase 1**: Marketing (14e/$120/+25%) · Hiring (14e/$100/+25%) · Shipping (12e/$450, prereq: enough market share) · Change Notebook Type (12e/$30, prereq: >1 type)
   - **Phase 2**: Marketing (18e/$240/+45%) · Hiring (18e/$200/+45%) · Shipping (18e/$900, prereq: unlocked at P1)
4. **Case Studies** — each customer segment, hire candidate, vendor, and marketing
   team has a case study the player **must read before choosing** at phase end.
   Wrong pick hurts output. (Candidates ×4, Vendors ×3, Marketing ×3.)
5. **Key Scenarios / Events** — trigger **every 15 days**, force an **A/B/C/D**
   choice, consume energy, permanent effect. Counts: **P1 = 1, P2 = 2, P3 = 2**.
   Primarily affect **production amount** & **pricing**. Can be skipped if a
   condition holds (e.g. *Flash Sale*: needs online storefront; skip if
   `inventory ≤ sales × 1.45`). *(current app already has A/B/C/D events on fixed
   days — needs cadence + skip-condition + prereq rework)*
6. **Sell where + delivery service** — player chooses which channels to stock and
   which shipping vendor covers which areas.
7. **P&L always revisitable** after finishing Phase 0.
8. **Market share engine** — per-genre, capped, explicit "steal from competitors."

---

## 4. Gap analysis — current V2 engine vs the spec

| Area | Current V2 | Spec (FinLit) | Effort |
|------|-----------|---------------|--------|
| 4 markets | audience segments: Students/Creators/Pros/Gift + fit model | notebook genres: Cute/Anime/Minimalist/Indie + demand curves | **FORK A** |
| Product config | archetype·cover(2)·binding(2)·size(3:s/m/l)·paper(3)·addons | Paper(4)·Size(3:A5/B4/B5)·PageDesign(5)·Cover(3)·Addons(6), each rate+cost | Large — new dims/values |
| Production math | shared-capacity + complexity penalty | multiplicative rate × BASERATE + hiring | **FORK B** — replace engine |
| Channels | 6 named (reach/affinity) | Offline/Online/Retail (split/maint/consign/invcost/sellrate) | Replace channel model |
| Hiring | upgrades (capacity) | 4 named candidates × 4 levels (prod+sell) | New subsystem + UI |
| Marketing | channels + campaign upgrades | pick 1 of 4 teams (cost/sellrate/energy) | New subsystem + UI |
| Vendors/shipping | none | 3–5 stores × genre (quality/sellrate/prodrate), phase-gated | New subsystem + UI |
| Case studies | none | read-before-choose gate for segment/candidate/vendor/team | New content + gating |
| Key decisions | upgrades (unlockDay/requires) | per-phase cards w/ energy+money+prereq | Rework decision cards |
| Energy | 30/45/60 per phase | 100/30 **or** 50/20 (conflict) | **FORK C** |
| Events | A/B/C/D on fixed days | every 15d, P1:1/P2:2/P3:2, skip-conditions | Cadence + skip logic |
| Routes | self $1000/$0 · investor $2500/$3000 debt | self $1000 · investor $5000 w/ −$4000 profit | **FORK D** |
| Market share | cannibalization inside fit model | explicit per-genre capped "steal" | Extend model |
| **Scoring** | **Net 50 / Inventory 25 / Insight 25** | **identical formulas** | ✅ **already matches** |
| P&L revisit | bottom stats + Stats drawer | always available post-Phase-0 | ✅ minor |
| Multi-SKU | `portfolio.productLines[]` | add/sell multiple notebook types | ✅ mostly exists |

### 4.6 Scoring already matches
Spec: Net Profit 50 (`obtained ÷ max × 50`) · Inventory Cleanliness 25
(`1 − (stockout + overstock) × 25`) · Insight 25 (`correct ÷ total × 25`).
`src/engine/scoring.ts` implements exactly this. Only tunables (MAX_EXPECTED,
investor bonus/penalty) may shift with FORK D.

---

## 5. Decisions (locked 2026-07 — owner deferred all four to recommendation)

- **DEC A — Markets → notebook genres.** Replace the four audience segments with
  **Cute / Anime / Minimalist / Indie**, using the Excel demand curves. Preserve
  the existing **fit mechanic**: each genre carries a preference/VoC vector over
  (design·price·channel·size·paper) — the PDF's "VoC Alignment" chart — so config
  alignment still drives demand. This honors both the Excel (genre markets) *and*
  LP1 (targeted design). *Rationale: the entire calc is genre-based; anything else
  fights the source of truth.*
- **DEC B — Faithful math port.** Reproduce the Excel's production/demand/channel
  formulas and tables 1:1, **verified against the sheet** (spot-checks: prod/day
  `G28≈7.8`, cust/30d, earn/day = cust×$16), then parameterize them into the live
  per-day sim. *Rationale: a precise calc was authored on purpose; approximating it
  would waste that work.*
- **DEC C — Energy: start 50 · +30 per phase · hard-cap 100.** A reconciliation of
  the two PDF statements (cap 100 + recover 30 from Structure; start 50 from
  Key-Choices). Over a run: 50 → 80 → 100(cap). **Tunable** — P1 (engine) will
  balance-test it against the decision costs (6/12/14/18) so a player can afford a
  sensible number of decisions/phase. Replaces the current 30/45/60.
- **DEC D — Routes: self $1000 · investor $5000 @ −$4000 profit.** Adopt the PDF
  numbers; investor's P&L opens at −$4000 (the obligation). Rework
  `scoring.ts` investor bonus/penalty + `MAX_EXPECTED_NET_PROFIT` around this.
- **DEC E — Scenario count: P1:1 / P2:2 / P3:2 (=5).** Use the explicit Progression
  list; place triggers on 15-day marks that avoid phase-end evaluation days
  (≈ day 15 · 45/55 · 75/85). "Every 15 days" is the cadence guide, 5 the count.
  **Tunable.**

---

## 6. Proposed phase plan (V3) — pending fork answers

> Ordering: land the **numeric core** first (it's the source of truth), then the
> **decision subsystems**, then **content/case-studies**, then **polish**. Each
> phase ends green on `tsc` + prod build + a scripted Playwright run, committed to
> V3. Nothing touches `main` until you approve a V3→main promotion.

- **P0 — Foundations & data model.** New `data/` tables transcribed 1:1 from the
  Excel (genres+demand curves, channel splits, production rate/cost tables,
  hiring/marketing/vendor tables). Types + a persist migration (store version bump).
  Resolve FORKS A/C/D as constants. *No behavior change yet — data only.*
- **P1 — Production & demand engine.** Swap `production.ts`/`demand.ts`/`cost.ts`
  to the multiplicative model + per-genre capped market-share demand with per-phase
  shift. Verify unit economics reproduce the Excel (spot-check `G28≈7.8`,
  cust/30d, earn/day) via a numeric test harness.
- **P2 — Channels + inventory flow.** Offline/Online/Retail with
  split/maintenance/consignment/inventory-cost; stocking decisions; stockout/
  overstock tracking feeding cleanliness.
- **P3 — Key-Decision cards.** Per-phase Marketing/Hiring/AddType/Shipping/ChangeType
  cards with energy+money cost + prerequisites + carry-over; retire/convert the old
  upgrades UI.
- **P4 — Hiring / Marketing / Vendor pickers + Case Studies.** 4-candidate,
  4-marketing, 3-vendor selection UIs each gated behind a readable case study;
  wrong-pick penalties.
- **P5 — Key Scenarios.** 15-day cadence, P1:1/P2:2/P3:2, A/B/C/D, skip-conditions
  (Flash Sale etc.), production/pricing effects, energy cost.
- **P6 — P&L, market-share viz & scoring tune.** Always-on P&L; market-capture &
  demand-shift charts (mirror the PDF charts); confirm 50/25/25 with new tunables.
- **P7 — Content, copy, mascot, juice, full E2E.** Case-study copy, Amelia lines
  for the new systems, art requests list, reduced-motion pass, full 90-day E2E,
  V3→main promotion when you say go.

---

## 6b. Engine build log + a real balance finding (P0–P2 done)

**P0 (committed 4a9cb4e)** — `src/data/finlit` transcribed 1:1; fidelity harness
14/14 vs the sheet's cached values.

**P1 (committed fc617b0)** — `src/engine/finlit` pure deterministic phase
simulator (multiplicative production, per-genre customersPer30d demand, VoC-fit,
hiring/marketing/vendor bonuses, channel costs, P&L + market-share rollup).
Behavioral harness 9→10/10 (both stockout AND overstock reachable).

**P2 flow** — `run.ts` chains 3 phases (inventory/cash/energy carry) → final
50/25/25 score. Harness 6/6: an optimised config nets **+$3716 / score 31**, a
bad config scores 0, investor opens exactly **−$4000** below self.

**FINDING — demand vs production scale mismatch (needs P6 balance).** The sheet
sizes the market for ~12 competing teams (~60 buyers/day/player) while
production is dorm-scale (~8–23 units/day). Raw, demand permanently outstrips
supply — the sheet's own example config **runs at a loss (−$1437/phase)** and
the LP2 inventory mechanic can't function. Two engine additions reconcile it,
both tunable in P6:
- **`DEMAND_SCALE` (constants.ts, =0.28)** — scales a single player's per-day
  demand into the production range so over- AND under-production are reachable.
- **`FinlitLine.targetPerDay`** — the PDF's "decide how much to produce" lever;
  output = min(target, capacity). Producing to demand is how you stay clean.
The exact value that makes a *well-played* run both profitable AND clean (not
just one) is a **P6 playtest/tuning task**; the engine already supports it.

## 6c. P2 integration complete — the app now PLAYS as V3

The FinLit engine is wired into the live game (commits ab81cd7 → 7ff1de3):
- **Store** carries V3 line fields (genre/spec/channels/vendor/target) + a
  `finlit` decisions slice; `runFinlitPhase`/`advanceFinlitPhase` simulate a
  whole phase and write the P&L into the existing ledger/series/inventory/cash.
- **PhaseSequenceModal** now runs `advanceFinlitPhase` — the whole phase resolves
  at once on the FinLit engine, then queues the same evaluation flow.
- **FinlitDesignControls** (Design drawer) is the native V3 editor: genre picker,
  6 spec dropdowns, channel toggles, price + produce/day, live Capacity/Unit-cost/
  Margin. Choosing a genre bridges to the legacy target so the phase-gate clears.

**Verified end-to-end:** a scripted 90-day run configures a genre + spec, runs all
3 phases on FinLit, steps through events + insight checks, and reaches the final
results (score renders, decision timeline shows the real FinLit choices, cost-mix
pulls V3 COGS) — **zero console errors**. tsc + prod build green.

### Known V2 remnants to migrate (tracked for P3–P7)
- `AudiencePickerModal` still lists the old segments (students/creators/…) — should
  become a genre picker, or be retired (the Design editor sets genre per line).
- The top-bar "Fit" pill + the phase-confirm "estimate" panel still compute V2
  numbers; re-point them at the FinLit model.
- Legacy `DesignControls`, add-on system, and the old channels/segments data become
  dead once P3–P4 land; remove in the P7 cleanup.

## 6d. V3 BUILD COMPLETE — all 8 phases landed (P0–P7)

The FinLit remodel is fully integrated and the game plays end-to-end on the new
engine. Commit trail (branch V3): P0 4a9cb4e · P1 fc617b0 · P2 260cab1→7ff1de3 ·
P3 1185cea · P4 9096f34 · P5 415aea3 · P6 22e2569 · P7 f65878d.

What a player does now:
- **Design drawer** — pick 1 of 4 genres (markets w/ demand curves), tune the 6
  production axes + channels + price + produce/day, with live Capacity / Demand
  estimate / Unit-cost / Margin.
- **Studio drawer** — hire candidates (4×4 levels), engage marketing teams, pick
  shipping vendors; each opens a **case study** to read before committing and
  spends energy.
- **Run a phase** — 1–2 **key scenarios** (A/B/C/D, energy-costed) fire first,
  then all 30 days resolve on the FinLit engine → real P&L in the stats UI →
  insight check → phase evaluation → final 50/25/25 score with a FinLit decision
  timeline.

Verified: full 90-day E2E completes with 1/2/2 scenarios per phase, zero console
errors; tsc + prod build green on every commit. Balance: produce-to-demand earns
cleanliness (0.67) at lower profit; over-produce is dirtier (0.14) at higher
profit — a genuine tradeoff (harness-verified).

### Polish pass (done 2026-07 — commits 2f15a4f · 1515c75 · + cost-mix)
- **Energy** now uses the V3 model (start 50 / +30 per phase / cap 100),
  replenished in `advanceFinlitPhase` — it never replenished before (V3 bypasses
  the V2 day-tick), which starved the Studio/scenario economy.
- **Defaults**: new + starter notebook lines carry a valid genre + lean cheap
  spec + a channel + a mapped target; a fresh game is profitable and doesn't nag
  "pick a market". (Set global `market.targetSegment` in startingState too.)
- **Phase preview** shows real FinLit numbers (`previewFinlitPhase`, pure/no
  mutation) instead of V2 math.
- **Top-bar pills** → market (genre) · VoC Fit% · FinLit Demand/day · Channels.
- **Shelf captions** → genre + spec summary + VoC fit% + channels.
- **Amelia reactions** → VoC-fit-crosses-110%, negative-margin warning, fit-drift
  nudge (the old segment/add-on reactions are gone).
- **Results cost-mix** → Material (COGS) · Channels · Marketing/Ops (was V2's
  Labor/Pkg/Tools, all ~0 in V3, and it hid channel costs).

### Business page — rebuilt for V3 (owner: "let the decisions stay here")
Kept the archive folder-tab **design**; swapped the tabs to a V3 operations hub:
- **Operations** → `<StudioPanel />` (hire / market / ship, with case-study gates
  + energy). The Studio dock tile was REMOVED from the Product page — those
  decisions now live only on the Business page.
- **Inventory** → `<InventoryPanel />` (V3 finished/demand/production + trends).
- **Performance** → exported `FinanceTable` + `PortfolioMetrics` (the P&L +
  per-notebook numbers).
Split: **Product page = design the notebook** (genre + spec + channels + price +
produce/day, Design drawer); **Business page = run the business**. Verified: tabs
render, full 90-day E2E completes, zero console errors.

### Backlog pass (done — commit after this)
- **Custom dropdown**: new `PixelSelect` primitive (body-portaled, flip-aware,
  cost hints, keyboard) replaces the native `<select>`s in the Design drawer's
  Production Spec. (The Amelia-voice picker in StatsDrawer stays native — settings
  detail.)
- **Hiring visual hook**: Studio hiring cards now carry a distinct card-height
  candidate portrait each (printing / staff / packaging / binding), the intent
  behind the OperationsPanel icon request applied to the live V3 panel.
- **Dead V2 code removed**: deleted `LeftControlPanel`, `BusinessPanel`,
  `OperationsPanel`, `SegmentPanel`, `CommercialPanel` (the whole dead
  business-panel chain — this is what was showing a stale OperationsPanel via a
  branch-switch-confused dev server).
- **P&L completeness**: `FinanceTable` adds a **Channel Costs** line (`opex-rent`)
  and folds it into Operating Profit; V2 rows that are $0 across the run
  (Labor/Packaging/Tools) are now hidden; dividers are group-based.

### Still remaining (minor / optional)
- Market-capture / demand-shift charts from the PDF not yet drawn.
- Legacy `DesignControls` still lives inside `ProductPanel.tsx` (co-located with
  the live `AddOnGallery`); unused `archLabel`/`coverBind`/`segName` helpers in
  `NotebookGallery`. Low-risk to strip later.

### Promotion
V3 is committed on its branch; **V2/main stay deployed and untouched**. Promoting
V3 → main (which auto-deploys to Vercel) is a deliberate, owner-approved step —
not done automatically.

## 7. To-Do items from the PDF (their build checklist — for reference)
UI/wireframe · character spritemap · modularize UI entities · code components ·
alpha for core-function + intuitiveness testing · **git version control after alpha
v0.1** (done — we're past this) · black-box test plan (vague, open interpretation) ·
**30-day mini-sim to verify the in-game day tracker** (maps to our scripted E2E).
