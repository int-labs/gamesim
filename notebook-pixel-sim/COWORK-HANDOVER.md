# IntLabs Notebook Pixel Simulation — Complete Project Handover

> **Read me first.** This is a **single, self-contained** briefing. You do **not**
> need any other file or repo access to use it. It contains the full concept,
> learning design, game mechanics, economy/formulas, the complete **visual art
> bible** (palette, mascot, notebooks, environments, icons), the audio direction,
> and a ready-to-use **asset-generation playbook** with copy-paste prompts for
> images, video, and audio.
>
> **Your job (most common):** generate new **images, video, and audio** that look
> and sound like they shipped with this project — zero style drift. Jump to
> **§7 (Visual System)**, **§9 (Audio)**, and **§10 (Generation Playbook)** for
> that; §1–§6 give you the *why* so your output serves the learning goals.

---

## 0. TL;DR

A browser-based, **pixel-art entrepreneurship & financial-literacy simulation** for **IntLabs Academy**. The player runs a small **notebook business** from a university dorm room for **90 in-game days**, split into **three 30-day phases**. They design notebook products, choose a target audience, set prices, manage production and inventory, pick sales channels, react to events, and get scored **0–100** at the end. A chibi anime mascot named **Amelia** (called **Sage** in some older docs — same character) guides and reacts throughout. A full run is ~25–40 minutes.

**Visual identity:** cozy **"clean pixel-game minimalism"** — a warm dorm-room desk in deep-walnut browns and creams, a friendly chibi mascot, chunky cel-shaded notebooks. Playful but never noisy; every visual represents a decision or an outcome.

**Tech (for context only):** Vite + React + TypeScript, Zustand state, Tailwind, hand-built SVG charts, procedural Web-Audio SFX + one ambient music loop + a Web-Speech mascot voice. Deploys to Vercel.

---

## 1. The Concept & Narrative

You're a university student. Every week you watch friends overpay for boring notebooks, then complain that the journals they actually want — leather-bound, structured, giftable — aren't on campus. You spot a gap.

You start small: a few notebooks at a time, made in your dorm with whatever materials you can afford, sold to your closest friends first. You learn what they like, what they'll pay, where they shop. Then you must **grow**: demand shifts, materials get pricier, a competitor appears, an influencer puts you on the map, suppliers play price games, and **cash gets tight even as revenue climbs.**

Across 90 days the player keeps answering:
- **Who is this for?** Students (cheap & reliable), Creators (premium & beautiful), Professionals (functional & minimalist), Gift Buyers (packaging & decoration).
- **What product?** Cover, binding, size, paper quality, add-ons.
- **At what price? How much to make? How to sell it? When to scale?**

Get it right → finish with cash, profit, and a clear market position. Get it wrong → finish with unsellable stockpiles and less money than you started with.

**Tone:** encouraging, calm, insightful — a serious learning tool dressed as a cozy game. The challenge is the *business itself*; there's deliberately no fake gamification (no cooldown timers, no arcade noise).

**Why notebooks?** Tangible and relatable, with clear variants (cover/paper/binding/add-ons), real cost-of-goods, several plausible audiences, genuine inventory dynamics, and a familiar campus marketing surface. Simple enough that the *business decisions* — not the product — are the focus.

---

## 2. Learning Objectives — the soul of the project

This is **not just a game; it's a decision-making + learning tool**. Five learning points (LPs) anchor every mechanic. New content or assets should serve at least one.

| LP | Teaches | How it shows up in play |
|---|---|---|
| **LP1 — Market Positioning** | There is no neutral product; every choice is a positioning bet. | Picking a segment scores product/price/channel against that segment's preferences. Wrong-segment choices visibly suppress demand (target ×1.4 vs non-target ×0.55). |
| **LP2 — Inventory Flow** | Inventory is cash in physical form. Too much traps cash; too little forfeits sales. | Buy raw → produce (capped by capacity + raw) → sell (capped by finished). Stockout days and overstock days accumulate and cost score. |
| **LP3 — Revenue ≠ Cash Flow** | A profitable run can still run dry. | Channels have credit terms (DSO 0–30 days); raw is paid up-front; daily wages/marketing bleed regardless of sales. |
| **LP4 — P&L as a Diagnostic** | The P&L is a *map back to decisions*, not a report. | An always-available P&L splits cost by line item × phase; every money movement carries a `cause` tag. |
| **LP5 — Focused Scaling** | "Do more of everything" breaks businesses. | Phase 3 amplifies demand (×1.2) and unlocks bigger upgrades; scaling without capacity → stockouts; without cash discipline → crunch. |

The **insight checks** (end-of-phase quiz) are *generated from the player's own ledger*, so they can't be memorized — a player who ignored cause-and-effect will miss them.

---

## 3. Game Structure & Loop

**3 phases × 30 internal days = 90 days.** Days simulate one at a time internally (so events, cash timing, inventory behave realistically), but the player experiences **phases**, not days.

| Phase | Days | Focus | Energy budget | Demand multiplier |
|---|---|---|---|---|
| **Phase 1** | 1–30 | Market positioning · first product · find fit | 30 | ×0.7 (slow start) |
| **Phase 2** | 31–60 | Inventory flow · production growth · operations | 45 | ×1.0 (steady) |
| **Phase 3** | 61–90 | Cash flow · P&L diagnosis · focused scaling | 60 | ×1.2 (scaling window) |

Energy refills **+15** at each phase boundary (capped at the phase max). **Energy** is a *strategic decision budget* — opening channels, buying upgrades, and choosing event options cost energy.

### The crucial UX rule: decisions are free; only "Confirm Phase" advances days
- **Decisions never advance the day.** Picking a segment, configuring the notebook, hiring, buying raw, opening a channel — all free of day-cost (they only spend energy/cash where defined).
- **Confirm Phase** locks decisions and **fast-forwards all remaining days in the phase at once**, pausing only for events and the end-of-phase evaluation.

### Full user flow
```
Start → Funding Route (Self-funded $1,000  |  Investor-backed $2,500 + owes $3,000 by Day 90)
      → Phase 1 Intro → Phase 1 Decisions → Confirm → Days 1–30 (pauses on events)
      → Phase 1 Evaluation (P&L snapshot + cash/profit charts + insight check + Amelia debrief)
      → Phase 2 Intro → … → Days 31–60 → Phase 2 Evaluation
      → Phase 3 Intro → … → Days 61–90 → Final Results (score 0–100, decision timeline, JSON export)
```

### Day-tick order of operations (per simulated day)
1. Phase rollover → 2. Drain pending cash (AR/AP due today) → 3. Expire stale modifiers → 4. Cache segment fits → 5. Roll demand (one seeded RNG for the whole portfolio) → 6. Plan production (shared capacity, proportional across lines) → 7. Apply production (consume raw, add finished, apply defects) → 8. Per-line sales loop (sell `min(demand, finished)`, count lost sales) → 9. Pay daily opex (labor + marketing) → 10. Update brand + retention → 11. Roll up aggregate inventory → 12. Append daily snapshot → 13. Interrupts (events / evaluations / end-of-game).

The sim is **deterministic** (seeded RNG): same seed + same decisions → same run, with light per-day demand jitter (×0.85–1.15) for realism.

---

## 4. Core Systems & Data

### 4.1 Portfolio model (multi-product)
The player runs a **portfolio of product lines** (SKUs), each with its own design, price, target segment, and inventory pool. There is **no hard cap on line count** — a *complexity* system ratchets a capacity/defect penalty as the portfolio grows (soft ceiling 20). One line is "active" (what the canvas/editor reflects).

### 4.2 The four customer segments

| Segment | Base demand | Price sensitivity | Pref. price | Quality | Cover (premium) | Decorative | Functional | Packaging |
|---|---|---|---|---|---|---|---|---|
| **Students** | 18 (top volume) | 1.6 (very sensitive) | $6 | 0.4 | 0.2 | 0.5 | 0.7 | 0.2 |
| **Creators** | 10 | 0.9 | $14 | 0.9 | 0.7 | 0.9 | 0.4 | 0.5 |
| **Professionals** | 8 | 0.6 (tolerant) | $18 | 0.85 | 0.85 | 0.15 | 0.95 | 0.4 |
| **Gift Buyers** | 6 (low volume) | 1.0 | $16 | 0.5 | 0.7 | 0.95 | 0.3 | 0.95 |

(The last five columns are the **preference weights** used in the segment-fit formula — what each audience values.)

### 4.3 The product: three archetypes
- **Student Notebook** — affordable, familiar, fast to make. Lowest cost, fastest production, best student fit. Weak premium/gift appeal. *Pick when lean, targeting volume, or cash-tight.*
- **Planner** — structured, functional, "grown-up" (calendar grid + tab dividers). Mid cost; better professional fit; holds price increases better. *Pick when broadening into professionals.*
- **Daily Journal** — premium, giftable, emotional (leather feel, strap, gold "DAILY" stamp). Highest price ceiling and highest cost; slowest to produce; great with ribbons and name stickers. *Pick for premium positioning, holidays, gift buyers.*

Configured by: **cover** (hardcover / leather), **binding** (ring / staple), **size** (S / M / L), **paper** (cheap / standard / premium), plus up to **3 add-ons** (max one per sub-category).

### 4.4 Add-ons (drag-and-drop onto the notebook canvas)
| Add-on | Category | Boosts |
|---|---|---|
| Bear / Cat / Penguin Charm | charm | gift, students, creators |
| Red / Pink Ribbon Wrap | ribbon (packaging) | gift (strong), creators/pros |
| Name Sticker | sticker-name | gift, creators, students |
| Sticker Pack / Cute Sticker Pack | sticker-pack | creators, students, gift |
| Bookmark Ribbon | functional | professionals, students, creators |
| Elastic Band | functional | professionals |
| Magnetic Closure | functional | professionals, gift |

Each adds unit cost ($0.20–$0.70) + perceived value and shifts segment fit.

### 4.5 The six sales channels (the LP3 engine)

| Channel | Reach | Daily cost | **DSO (cash delay)** | Strong with | Unlock (Energy / $) |
|---|---|---|---|---|---|
| Word of Mouth | 0.4 | $0 | 0 | Students | always on |
| Campus Booth | 1.0 | $8 | 0 | Students | E2 / $60 |
| Campus Store | 1.6 | $14 | **30** | Students, Pros | E4 / $200 |
| Online Shop | 2.0 | $6 | 7 | Creators, Gift | E3 / $120 |
| Influencer | 2.6 | $30 | 7 | Creators, Gift | E5 / $250 |
| Student Clubs | 1.4 | $4 | 14 | Students | E3 / $80 |

**DSO is the LP3 lesson:** a Campus Store sale shows in revenue *today* but lands in cash *30 days later*.

### 4.6 Operations & upgrades
Hire helpers (+capacity, +$12/day wage), buy tools (basic/pro press → +capacity, −defects), QA process (−defects), supplier choices (premium → auto-premium paper, +cost/lead-time; bulk → −10% material), loans, marketing campaigns, loyalty program. Default capacity **5/day**, default defect rate **8%** (max 50%).

---

## 5. Economy & Formulas (with constants)

All currency in USD. Multipliers default to 1.0.

**Unit cost**
```
unit_material_cost = (PAPER + COVER + BINDING + Σ addon.cost) × SIZE_MULT × materialCostMult
total_unit_cost    = unit_material_cost (paid at raw purchase)
                   + $0.15 packaging + $0.05 fulfillment (paid at sale)
                   + daily wages ($12 × hires, per day, not per unit)
```
- PAPER: cheap $0.80 · standard $1.40 · premium $2.40
- COVER: hardcover $1.00 · leather $2.60
- BINDING: ring $0.40 · staple $0.10
- SIZE_MULT (cost): S 0.7 · M 1.0 · L 1.3
- Raw purchase unit-cost floor: $1.40

**Segment fit** (weighted average of 5 product properties vs the segment's weights from §4.2):
```
fit_paper = premium 1.0 / standard 0.6 / cheap 0.25
fit_cover = leather 1.0 / hardcover 0.5
fit_decorative = clamp(#decorative_addons / 3, 0..1)
fit_functional = clamp(#functional_addons / 2, 0..1)
fit_packaging  = has(ribbon) ? 1.0 : 0.2
segmentFit = Σ(weight × fit) / Σ(weight)   → clamped 0..1
```

**Demand** (per segment, summed over all 4):
```
priceFactor   = clamp(2 − (price/refPrice)^sensitivity, 0.05, 2.0)   # at ref price = 1.0
brandFactor   = 1 + (brand/100)×0.5                                  # up to ×1.5 at brand 100
targetBonus   = 1.4 if target segment else 0.55
phaseMult     = 0.7 / 1.0 / 1.2
demand_segment = baseDemand × segmentFit × priceFactor × brandFactor
               × max(0.3, Σ channelReach) × channelAffinity × targetBonus
               × phaseMult × demandMult(events) × jitter(0.85–1.15)
```
Over-pricing is brutal for students (sensitivity 1.6) but tolerable for professionals (0.6).

**Production**
```
unitTime      = SIZE_TIME_MULT[size] × (1 + 0.05 × addonCount)   # S 0.8 / M 1.0 / L 1.2
capacityToday = max(1, floor(capacity × capacityMult))           # base capacity 5
producible    = min(floor(capacityToday/unitTime), rawMaterials)
defects       = round(producible × defectRate)                   # default 8%, max 50%
producedGood  = producible − defects                             # defects still consume raw
```

**Inventory / sales**
```
sold      = min(demand, finished);  lost = max(0, demand − finished)
stockoutDays++ if lost > 0
overstockDays++ if finished_end > 5 × max(4, demand)   # OVERSTOCK_DAYS_COVER = 5
revenue   = sold × (price × priceMult)   # recognised today; cash arrives per channel DSO
```

**Profit & cash**
```
COGS = material + labor + packaging + fulfillment
grossProfit = revenue − COGS
opProfit    = grossProfit − (marketing + tools)
netProfit   = Σ P&L ledger entries (EXCLUDES inventory-purchase / loans — those are balance-sheet)
cash_end    = cash_start + cash_in(DSO arrivals) − cash_out(raw, wages, marketing, pkg, fulfill, upgrades, events)
```
**Why cash < revenue:** DSO delays, raw bought before it sells, daily opex regardless of revenue. Cash can go negative — an explicit failure mode.

**Scoring (0–100)**
```
netProfitScore = clamp(netProfit / $4,500, 0,1) × 50   # $4,500 = "well-played" baseline
inventoryScore = (1 − stockoutRate − overstockRate) × 25
insightScore   = (correct / total) × 25
investor: +5 if debt met, −15 if not
final = round(clamp(sum, 0, 100))
```
**Net Profit, not Revenue**, drives the big bucket — rewarding *sustainable* selling (margin, channel discipline, defect control).

**Key constants:** Starting cash self $1,000 / investor $2,500; investor debt $3,000 (penalty −15 / bonus +5); energy 30/45/60 (+15 per boundary); demand ×0.7/1.0/1.2; packaging $0.15; fulfillment $0.05; base capacity 5; hire wage $12, hire capacity +4; defect 8% default / 50% max; overstock cover 5 days; max-expected net profit $4,500; brand 0–100; raw cost floor $1.40.

---

## 6. Events, Evaluations & Scoring detail

### Six scripted events (forced A/B/C/D, each costs energy ± cash, applies time-windowed modifiers)

| Day | Event | Lesson | Option flavors |
|---|---|---|---|
| 15 | **Supplier Shock** | cost vs price | A absorb cost (×1.2 material 30d) · B pass to customers (price ↑, demand ↓) · C secondary supplier (cost+lead) · D cut quality (permanent defect+, brand hit) |
| 30 | **Campus Demand Surge** | inventory + cash readiness | A rush production (cash −$200, raw +30, demand ×1.45 10d) · B waitlist (brand+, steady) · C raise prices · D decline excess (protect quality) |
| 45 | **Competitor Appears** | differentiation | A differentiate (demand+, cost+) · B discount campaign (demand+, margin−) · C tighten target (niche moat) · D ignore (slow decay) |
| 60 | **Production Defect Wave** | quality vs speed | A recall+apologise (cash−, trust+) · B rework (capacity ×0.7 5d) · C sell discounted · D ship as-is (permanent damage) |
| 75 | **Cash Crunch** | cash under pressure | A short loan (+$500 cash / +$560 debt) · B pause marketing · C emergency liquidation · D renegotiate supplier |
| 89 | **Late Pivot Opportunity** | focus vs spread | A pivot premium · B stay focused (no change) · C hybrid (mediocre everywhere) · D liquidate all |

Modifiers are time-windowed multipliers/additives (materialCostMult, demandMult, priceMult, capacityMult, defectAdd, retentionMult, marketingMult) with start/end days; permanent ones never expire.

### Evaluations (days 30/60/90)
Phase snapshot (revenue, op profit, cash, finished stock, stockout/overstock days) + cash-trend chart + daily-profit chart + cost-mix stacked bar + Amelia debrief + one **state-derived insight check** built from the player's actual ledger (e.g. "Why did cash dip around Day X?" → the engine finds the real cause).

---

## 7. THE VISUAL SYSTEM — Art Bible (read before generating any image)

> Goal: **zero style drift.** A new asset must look like it shipped with the originals.

### 7.1 Direction (one line)
**Cozy "clean pixel-game minimalism."** A warm dorm-room desk world in deep-walnut browns and creams, a friendly chibi anime mascot, chunky cel-shaded notebooks. Calm and focused — *not* a corporate dashboard, *not* a noisy arcade. Playful, but every visual earns its place by representing a decision or an outcome.

### 7.2 Two tiers of "pixel" (match the right one)
1. **Strict pixel sprites / icons** — true pixel-art discipline: **32×32 / 48×48 / 64×64** grid, **1px dark outline, NO anti-aliasing, ~6–10 colors max, ≤3–4 detail layers.** Use for UI icons, status chips, small indicators.
2. **Rendered "chibi game-art" hero assets** — the **mascot, notebooks, environments** are rendered larger with **soft cel-shading (2–3 tone steps), a bold dark outline, and a soft contact drop shadow.** They read as a pixel/painterly hybrid, not strict 1-bit. (Reference sizes: mascot ~400×725 px; notebooks ~404×407 px; backgrounds 1536×1024 px.)

→ **Icons = tier 1. Mascot / notebooks / scenes = tier 2.**

### 7.3 The approved color palette (exact values)

**Walnut / ink (structure & backgrounds)**
- Deep walnut scene background `#3A2818`
- Ink / outline / primary text `#2A1E12`
- Secondary text `#5A4630` · Tertiary/hint `#8A6F50` · Soft border `#9A7B4F`

**Surfaces (panels, HUD)**
- Cream surface `#FBF6E9` · Caramel (HUD bars/headers) `#DEC189` · Mid desk overlay `#D9C193`

**Action & semantic accents**
- Primary / confirm / success **green `#6FBB85`** (soft `#D4ECDB`)
- Secondary / info **blue `#6892C9`** (soft `#D5E2F3`)
- Warning **amber `#DDA655`** (soft `#F3DEB7`)
- Danger / error **coral-red `#CB6356`** (soft `#F1CCC4`)

**Finance semantics (charts & P&L)**
- Revenue `#6FBB85` · Cost `#CB6356` · Profit `#4F9C72` · Cash `#6892C9` · Inventory `#B98B5A` · Demand `#9B6CD9`

**Brand purple** `#9B56C8` (lighter: `#C87BD9`, `#E29BD2`)

**Notebook material tones** — leather `#7A4A2B`, kraft `#CBA87A`, cloth `#CFC4AD`, cream pages `#FBF6E9`.

**Color rules:** ≤ 6–10 colors per asset; strong contrast for readability; gradients only in controlled **2–3 step ramps** (no smooth gradients, no glow/bloom). Everything sits on warm walnut — keep assets warm-biased and high-contrast against dark brown.

### 7.4 Typography
- **Inter** — body/paragraph text.
- **Pixelify Sans** — friendly pixel display headings.
- **Press Start 2P** — HUD numbers, KPI chips, tiny labels (use sparingly; very chunky/wide).

### 7.5 Lighting & shading (consistency anchor)
- **Light source: top-left. Shadows fall bottom-right.**
- Soft pixel shadow, **1–2 tones only.** Subtle highlights — **no over-glow.**
- Hero assets sit on a **soft contact drop shadow.**

### 7.6 The mascot — character bible: **Amelia** (a.k.a. Sage)
**Role:** guide + feedback layer — guides the user, reacts to decisions, surfaces warnings/hints. Must feel **friendly, smart, supportive — never annoying.** Lives in a fixed safe corner, closeable, never off-screen.

**Personality / vibe / tone:** Curious · Supportive · Smart · Reliable / Warm · Friendly · Encouraging · Strategic / Positive · Calm · Clear · Inspiring.

**Exact design (use this verbatim when generating):**
- **Chibi pixel anime girl**, ~2 heads tall, expressive face.
- **Long, straight near-black hair** with subtle **blue-grey** pixel highlights and side-swept bangs; a small **coral/red bow hair-clip** on one side.
- **Large dark eyes, soft pink cheek blush, gentle closed-mouth smile.**
- **Outfit:** a **caramel/tan pinafore apron-dress** with a small **heart-shaped pocket** and a tiny **sprout/plant patch** motif, worn over a **cream short-sleeve blouse**; **brown leggings/tights**; **dark-brown shoes.** Cozy, warm, practical.
- **Build spec:** base design grid 32×32 with **2px dark outline**; final renders are clean cel-shaded **full-body sprites on a transparent background**, front or 3/4 view, top-left light.

**Required states (each a separate transparent PNG; never change outfit/hair between states):**
- **Base views:** front, 3/4, side, back; idle, idle2.
- **Expressions:** neutral, happy, happy-soft, excited, excited-big, thinking, thinking-side, concerned, concerned-soft, confused, confused-tilt, warning, warning-alert.
- **Poses/actions:** idle-stand, idle-soft-wave, pointing-left (+explain), pointing-right (+explain), presenting (+open-hand), holding notebook, typing, writing, analyzing, celebrating.

State must read **without text** (happy = good result, concerned = warning, etc.).

### 7.7 Notebook visual rules (the hero product)
- The notebook is **the main object** — it must communicate **quality, positioning (cheap↔premium), and customization** at a glance.
- **Structure:** cover, binding, visible page block (fore-edge), contact shadow.
- **As-built look:** chunky **3/4 angled view**, bold dark outline, soft 2–3 tone cel-shading, top-left light, saturated cover color, **black spiral-ring or staple binding**, optional **red/coral ribbon bookmark**, cream page edges. (Canonical reference: a bright golden-yellow hardcover spiral notebook with a red ribbon and visible cream pages.)
- **Variants to support:** archetype (student / planner / daily-journal), cover (hardcover / leather), binding (ring / staple), size (S / M / L), paper, plus **angle views** (front, angle, spine, open, shelf). Add-ons composite on top in fixed placement slots.
- Premium signals: leather texture, gold "DAILY" stamp, ribbon wrap, richer cover tones. Budget signals: flat color, staple binding, kraft tones.

### 7.8 Environment rules (context layer)
- Three context types: **desk** (single-notebook view), **shelf** (multi-notebook portfolio view), **studio** (production/operations view). Plus event/round backdrops (launch, ops-pressure, peak-demand, premium-season).
- **Look:** warm wooden desk, **soft isometric/top-down painterly pixel**, cozy dorm vibe, gentle ambient shadows, scattered props (potted plant, pen cup, sticky notes, tape roll, paperclips, box, notebooks, eraser).
- **Rules:** minimal clutter, soft background, **must not compete with the UI** — it's a backdrop. Keep the center open for the hero object. ~1536×1024, warm walnut/amber tones.

### 7.9 Icon & UI rules
- Icons = **simple silhouettes**, readable small, consistent stroke thickness, one concept each; avoid over-detail and inconsistent shapes.
- Every UI element supports states: **default / hover / selected / disabled / active** (+ premium / warning where relevant) — visible **without text.**
- Pixel-UI conventions: hard **step shadows** (2–6px offset, no blur), **2px** corner radius (near-square), 1px ink borders.

### 7.10 The quality gate (apply before accepting any asset)
Approve only if: (1) understandable in **<1 second**; (2) follows the pixel rules; (3) matches the palette; (4) matches scale; (5) supports the system. **Avoid:** mixing pixel styles, too many colors, over-detailing small assets, inconsistent scale, unclear states, decorative-only visuals, breaking UI readability.
**Final test:** every visual must answer *"What decision or outcome does this represent?"* If it can't → it shouldn't exist.

---

## 8. Existing Asset Inventory & Naming

All art lives under `assets/img/...`. Categories that already exist:

- **Master style refs** (`master-style/`): approved palette, master board, and reference sheets for mascot / notebook / environment / icons / lighting / UI / states / pixel-rules / do-and-dont.
- **Mascot** (`mascot/`): base views (idle, idle2, front, 3qtr) + 13 expressions + 8 poses.
- **Notebooks** (`notebook-core/{student,planner,daily}/`): 4 cover×binding combos each + angle views (front, angle, spine, open, shelf).
- **Add-ons** (`add-ons/`): charms, ribbons, stickers, functional utilities, decorative bundles, organization inserts, writing tools.
- **Environments** (`environment/`): desk, shelf/portfolio, studio/operations, round backdrops, shadows.
- **Studio ops** (`studio-operations/`): printer, cutter, binding, qa, packing, delivery, capacity, defect, bottleneck, inventory, workflow — each with **active / upgrade / warning** states.
- **UI icons** (`ui/`): add-on, commercial/marketing, customer-segment, energy, business-metric, sidebar-category, navigation/view-buttons, pnl/finance, product-config, status, studio-ops.
- **Audio** (`assets/music/bg.mp3`): one ambient loop. SFX are procedural (no files).

**Naming convention:** `category_descriptor_state_vNN.png`
e.g. `mascot_concerned_soft_v01.png` · `student_angle_hardcover-ring_v01.png` · `icon_revenue_v01.png` · `qa-warning.png`.
Bump `vNN` for revisions. **Hero art = transparent RGBA PNG; backgrounds = RGB PNG.**

---

## 9. Audio System & Direction

- **SFX:** procedural (Web Audio), short (60–300 ms), pleasant. Kinds: click, click-soft, success (rising perfect-fifth), fail (minor-second drop), coin (bright two-note), warning, confirm, whoosh, pop, select, tick, delete, chime, phase-up.
- **Music:** one warm, low-key ambient loop (`bg.mp3`); **OFF by default** (player opts in; autoplay policy).
- **Mascot voice (Amelia):** currently browser **Web Speech** TTS; designed to be swapped for pre-generated MP3s (Piper/Coqui). Recommended timbre: warm, friendly, clear, mid-to-high female (e.g. Piper `en_US-amy-medium` or `en_GB-jenny_dioco-medium`). Muting SFX also mutes Amelia.

**Direction for new audio:** warm, soft, encouraging, low-fi — matching the cozy visuals. SFX gentle and rewarding, never harsh, <300 ms. Music calm, loopable, unobtrusive (lo-fi / chiptune-adjacent). Voice: warm and clear, never robotic or rushed.

---

## 10. ASSET-GENERATION PLAYBOOK (copy-paste ready)

**Always:** (a) start with the style preamble, (b) anchor on a reference image when you have one, (c) keep one concept per asset, (d) name it `category_descriptor_state_vNN.png`, (e) run the §7.10 quality gate, (f) **never** redesign the mascot, notebook silhouette, or palette — extend within the system.

### 10.1 Universal style preamble (prepend to every IMAGE prompt)
> "Cozy chibi pixel-game art, warm dorm-room aesthetic. Palette: deep walnut-brown `#3A2818` background, cream `#FBF6E9`, caramel `#DEC189`; accents green `#6FBB85`, blue `#6892C9`, amber `#DDA655`, coral `#CB6356`. Bold 1–2px dark outline `#2A1E12`, soft 2–3 tone cel-shading, top-left light source, soft contact shadow at bottom-right, ≤8 colors, crisp edges, no anti-aliasing noise, no smooth gradients, no glow/bloom. Clean, readable, friendly. Transparent background."

### 10.2 Mascot (Amelia)
> [style preamble] + "Full-body chibi pixel anime girl mascot named Amelia: long straight near-black hair with subtle blue-grey highlights and side-swept bangs, small coral bow hair-clip on one side, large dark eyes, soft pink cheek blush, gentle smile. Caramel/tan pinafore apron-dress with a small heart pocket and tiny sprout patch over a cream short-sleeve blouse, brown tights, dark-brown shoes. **[STATE: e.g. 'happy expression, waving' / 'concerned, hand near cheek' / 'pointing left, explaining' / 'celebrating, arms up']**. Front (or 3/4) view, full body, transparent background, consistent design across states."

### 10.3 Notebook
> [style preamble] + "A single chibi cel-shaded notebook, 3/4 angled hero view, bold dark outline, visible cream page block at the fore-edge, soft contact shadow. **[ARCHETYPE: student / planner / daily-journal]**, **[COVER: hardcover / leather]** in **[color]**, **[BINDING: black spiral ring / staple]**, **[SIZE]**. **[optional add-ons: red ribbon bookmark / ribbon wrap / charm / name sticker]**. **[Daily Journal only: leather texture, strap, gold 'DAILY' stamp]**. Transparent background."

### 10.4 Environment / background
> [style preamble] + "Soft isometric top-down painterly-pixel **[desk / shelf / studio]** scene, warm wooden surface, cozy dorm vibe, gentle ambient shadows, scattered props (potted plant, pen cup, sticky notes, tape, paperclips, box, notebooks, eraser) arranged around the edges with an **open center** for a hero object. Muted enough that UI reads on top. ~1536×1024, warm walnut/amber tones. No text."

### 10.5 Icon (strict pixel)
> "Strict pixel-art icon, **[32 or 64]**px grid, single clear silhouette of **[concept, e.g. 'gross revenue / inventory shelf / influencer megaphone']**, 1px dark outline `#2A1E12`, ≤6 colors from the project palette, no anti-aliasing, flat with one shadow tone, top-left light. Provide states: default, hover, selected, disabled. Transparent background."

### 10.6 Video (keep it gentle & looping)
> "Short seamless loop, cozy pixel-game style matching [reference]. Gentle, slow motion only — no fast cuts, no flashy effects. **[e.g. 'mascot Amelia idle breathing + occasional blink and soft wave' / 'phase-up celebration: confetti, mascot cheers' / 'ambient desk: steam from a mug, leaves sway']**. Same walnut/cream palette, top-left light, transparent or desk background, 2–4s loop."
Good video targets: looped mascot reactions (idle/wave/celebrate/concerned), a phase-transition flourish, an animated event-intro card, a title-screen key-art loop.

### 10.7 Audio
- **Music:** "Warm, calm, loopable lo-fi / soft chiptune background track, cozy study-room mood, unobtrusive, ~60–90s seamless loop. Gentle." (Consider per-phase moods: hopeful start → busier middle → triumphant scaling.)
- **SFX:** "Short (<300ms) soft UI sound for **[click / success / coin / warning / phase-up]**, pleasant and rewarding, retro-game timbre, not harsh."
- **Amelia voice:** "Warm, friendly, clear mid-to-high female narration voice, calm and encouraging, natural pacing — never robotic or rushed."

---

## 11. Gaps & High-Value Opportunities

- **Mascot animation:** short looping clips (idle, wave, celebrate, concerned) would lift the visual-novel feel the most.
- **Amelia voice pack:** replacing browser TTS with a consistent pre-generated voice is the single biggest audio upgrade.
- **Notebook premium variants:** richer leather/kraft materials, the gold "DAILY" stamp + strap, per-add-on composited previews.
- **Environments:** animated/parallax desk life; distinct per-event backdrops.
- **Music:** more than one track (per-phase moods).
- **Marketing/onboarding:** a title-card / key-art piece and a short trailer-style loop using the mascot + desk world.

---

## 12. Quick Glossary

- **Phase** — one 30-day chapter (3 total). **Day** — internal sim step (1–90).
- **Energy** — strategic decision budget (not time). **DSO** — days until a channel's sale becomes cash.
- **Segment** — target audience (Students / Creators / Professionals / Gift Buyers).
- **Archetype** — notebook type (Student / Planner / Daily Journal).
- **Fit** — 0–1 match between product and a segment's preferences.
- **Modifier** — time-windowed effect from an event/upgrade. **Brand** — awareness 0–100, lifts demand.
- **Net Profit** — P&L total excluding balance-sheet moves; drives 50 of the 100 score points.
- **Amelia / Sage** — the mascot (same character; prefer "Amelia").

---

*End of handover. This file is the complete briefing — concept, mechanics, economy, art bible, audio, and generation playbook — and is sufficient on its own to understand the project and produce on-style images, video, and audio.*
