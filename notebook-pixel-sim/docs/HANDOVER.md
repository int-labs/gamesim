# Project Handover — Notebook Pixel Simulation (IntLabs Academy)

> **Purpose of this document.** A complete, self-contained handover so a fresh
> collaborator (human or AI, e.g. Claude Cowork) can understand the *entire*
> project — concept, learning design, game mechanics, code architecture, and the
> full **visual + audio art system** — well enough to extend it **and to generate
> new images, video, and audio that match the existing style.**
>
> This is the orientation layer. Three deeper sources of truth sit beneath it:
> - **`docs/SPEC.md`** — the full design + economy spec (formulas, every constant, every event option). The authoritative gameplay reference.
> - **`CLAUDE.md`** — the code architecture cheat-sheet (engine facade, store, day-tick).
> - **`assets/img/master-style/master-style-notes_v01.md`** — the original art bible.
>
> If anything here conflicts with those, those win — but this doc is curated to be accurate as of the current build.

---

## 0. TL;DR

**What it is:** A browser-based, pixel-art **entrepreneurship & financial-literacy simulation**. The player runs a small **notebook business** out of a university dorm room for **90 in-game days**, split into **three 30-day phases**. They design notebook products, pick a target audience, set prices, manage production and inventory, choose sales channels, react to events, and get scored 0–100 at the end. A chibi mascot named **Amelia** (a.k.a. **Sage** in older docs) guides and reacts throughout.

**Who it's for:** University students, early-career professionals, and business-school participants in **IntLabs Academy** programs. A full run is ~25–40 minutes.

**Why a notebook business:** It's tangible and relatable, with clear product variants (cover, paper, binding, add-ons), real cost-of-goods, several plausible audiences, genuine inventory dynamics, and a familiar campus marketing surface. The product is simple so the *business decisions* are the focus — not the product.

**Visual identity:** Cozy, warm **"clean pixel-game minimalism"** — a dorm-room desk in deep-walnut browns and creams, a chibi anime-style mascot, chunky cel-shaded notebooks. Playful but never noisy; every visual represents a decision or an outcome.

**Tech:** Vite + React 18 + TypeScript, Zustand (Immer + persist) state, Tailwind v3, hand-built SVG charts, procedural Web Audio SFX + one ambient music track + Web-Speech mascot voice. Deploys to Vercel.

---

## 1. The Concept & Narrative

You're a university student. Every week you watch friends overpay for boring notebooks, then complain that the journals they actually want — leather-bound, structured, giftable — aren't on campus. You spot a gap.

You start small: a few notebooks at a time, made in your dorm with whatever materials you can afford, sold to your closest friends first. You learn what they like, what they'll pay, where they shop. Then you have to **grow**: demand shifts, materials get pricier, a competitor appears, an influencer puts you on the map, suppliers play price games, and cash gets tight *even as revenue climbs*.

Across 90 days the player keeps answering:
- **Who is this for?** Students (cheap & reliable), Creators (premium & beautiful), Professionals (functional & minimalist), or Gift Buyers (packaging & decoration).
- **What product?** Cover, binding, size, paper quality, add-ons.
- **At what price? How much to make? How to sell it? When to scale?**

Get it right → finish with cash, profit, and a clear market position. Get it wrong → finish with unsellable stockpiles and a tighter bank account than you started with.

**Tone:** encouraging, calm, and insightful — a learning tool dressed as a cozy game. The challenge is the *business itself*; there's no fake gamification (no cooldown timers, no arcade noise).

---

## 2. Learning Objectives — the soul of the project

This is **not just a game; it's a decision-making + learning tool**. Five learning points (LPs) anchor every mechanic. Any new content or asset should serve at least one.

| LP | Teaches | How it shows up |
|---|---|---|
| **LP1 — Market Positioning** | There is no neutral product; every choice is a positioning bet. | Picking a segment scores product/price/channel against that segment's preferences. Wrong-segment choices visibly suppress demand (×0.55 vs ×1.4). |
| **LP2 — Inventory Flow** | Inventory is cash in physical form. Too much traps cash; too little forfeits sales. | Buy raw → produce (capped by capacity + raw) → sell (capped by finished). Stockout days and overstock days accumulate and cost score. |
| **LP3 — Revenue ≠ Cash Flow** | A profitable run can still run dry. | Channels have credit terms (DSO 0–30 days); raw is paid up-front; daily wages/marketing bleed regardless of sales. |
| **LP4 — P&L as a Diagnostic** | The P&L is a *map back to decisions*, not a report. | Always-available P&L splits costs by line item × phase; every ledger entry carries a `cause` tag. |
| **LP5 — Focused Scaling** | "Do more of everything" breaks businesses. | Phase 3 amplifies demand (×1.2) and unlocks bigger upgrades; scaling without capacity → stockouts; without cash discipline → crunch. |

The **insight checks** (end-of-phase quiz questions) are *generated from the player's own ledger*, so they can't be memorized — a player who ignored cause-and-effect will miss them.

---

## 3. Game Structure & Loop

**3 phases × 30 internal days = 90 days.** Days are simulated one at a time internally (so events, cash timing, and inventory behave realistically), but the player experiences **phases**, not days.

| Phase | Days | Focus | Energy | Demand × |
|---|---|---|---|---|
| **Phase 1** | 1–30 | Market positioning, first product, find fit | 30 | ×0.7 (slow start) |
| **Phase 2** | 31–60 | Inventory flow, production growth, operations | 45 | ×1.0 (steady) |
| **Phase 3** | 61–90 | Cash flow, P&L diagnosis, focused scaling | 60 | ×1.2 (scaling window) |

Energy refills **+15** at each phase boundary (capped at the phase max). **Energy** is a *strategic decision budget* — opening channels, buying upgrades, and choosing event options cost energy.

### The crucial UX rule: decisions are free; only "Confirm Phase" advances days

- **Decisions never advance the day.** Picking a segment, configuring the notebook, hiring, buying raw, opening a channel — all free of day-cost (they only spend energy/cash where defined).
- **Confirm Phase** locks decisions and **fast-forwards all remaining days in the phase at once**, pausing only for events and the end-of-phase evaluation.

### Full user flow

```
Start → Funding Route (Self $1,000  |  Investor $2,500 + $3,000 debt)
      → Phase 1 Intro → Phase 1 Decisions → Confirm → Days 1–30 (pauses on events)
      → Phase 1 Evaluation (P&L snapshot + charts + insight check + Amelia debrief)
      → Phase 2 Intro → … → Days 31–60 → Phase 2 Evaluation
      → Phase 3 Intro → … → Days 61–90 → Final Results (score 0–100, timeline, JSON export)
```

### Day-tick order of operations (per simulated day)

1. Phase rollover (so phase multiplier is correct) → 2. Drain pending cash (AR/AP due today) → 3. Expire stale modifiers → 4. Cache segment fits → 5. Roll demand (one seeded RNG for the whole portfolio) → 6. Plan production (shared capacity, proportional across lines) → 7. Apply production (consume raw, add finished, apply defects) → 8. Per-line sales loop (sell `min(demand, finished)`, count lost sales) → 9. Pay daily opex (labor + marketing) → 10. Update brand + retention → 11. Roll up aggregate inventory → 12. Append daily series snapshot → 13. Fire interrupts (events / evaluations / end-of-game).

The sim is **deterministic**: a seed + decision set always reproduces the same run, with light per-day demand jitter (×0.85–1.15) for realism.

---

## 4. Core Systems (summary — full detail in `docs/SPEC.md` §8–§11)

### 4.1 Portfolio model (multi-product)
The player runs a **portfolio of product lines** (SKUs), each with its own design, price, target segment, and inventory pool. There is **no hard cap on line count** — a *complexity* system ratchets a capacity/defect penalty as the portfolio grows (soft ceiling 20). One line is "active" (what the canvas/editor reflects).

### 4.2 The four customer segments

| Segment | Base demand | Price sensitivity | Pref. price | Wants (high weights) |
|---|---|---|---|---|
| **Students** | 18 (highest volume) | 1.6 (very price-sensitive) | $6 | Functional, decorative; cheap |
| **Creators** | 10 | 0.9 | $14 | Quality, decorative, premium cover |
| **Professionals** | 8 | 0.6 (price-tolerant) | $18 | Functional, premium cover, quality |
| **Gift Buyers** | 6 (lowest volume) | 1.0 | $16 | Packaging, decorative, premium cover |

### 4.3 The product: three archetypes
- **Student Notebook** — affordable, familiar, fast to make. Lowest cost, fastest production, best student fit. Weak premium/gift appeal.
- **Planner** — structured, functional, "grown-up." Mid cost; better professional fit; holds price increases better.
- **Daily Journal** — premium, giftable, emotional (leather feel, strap, gold "DAILY" stamp). Highest price ceiling and highest cost; slowest to produce; great with ribbons and name stickers.

Each is configured by **cover** (hardcover/leather), **binding** (ring/staple), **size** (S/M/L), **paper** (cheap/standard/premium), plus up to **3 add-ons** (max one per sub-category).

### 4.4 Add-ons (drag-and-drop onto the notebook canvas)
Charms (bear/cat/penguin), ribbon wraps (red/pink), name sticker, sticker packs (basic/cute), bookmark ribbon, elastic band, magnetic closure. Each adds unit cost + perceived value and shifts segment fit (e.g. ribbons → gift buyers, closures → professionals).

### 4.5 The six sales channels (LP3 engine)

| Channel | Reach | Daily cost | **DSO** (cash delay) | Strong with |
|---|---|---|---|---|
| Word of Mouth | 0.4 | $0 | 0 | Students (always on) |
| Campus Booth | 1.0 | $8 | 0 | Students |
| Campus Store | 1.6 | $14 | **30** | Students, Pros |
| Online Shop | 2.0 | $6 | 7 | Creators, Gift |
| Influencer | 2.6 | $30 | 7 | Creators, Gift |
| Student Clubs | 1.4 | $4 | 14 | Students |

**DSO is the LP3 lesson:** a Campus Store sale shows in revenue *today* but in cash *30 days later*.

### 4.6 Operations & upgrades
Hire helpers (+capacity, +$12/day wage), buy tools (basic/pro press → +capacity, −defects), QA process (−defects), supplier choices (premium → auto-premium paper; bulk → −10% material), loans, marketing campaigns, loyalty program. Default capacity 5/day, default defect rate 8% (max 50%).

### 4.7 Economy in one breath
`unit_cost = (paper + cover + binding + Σ add-ons) × size_mult × materialCostMult`, plus $0.15 packaging + $0.05 fulfillment per sold unit, plus daily wages/marketing. **Demand** multiplies segment base × fit × price-factor × brand × channel reach/affinity × target bonus × phase × event modifiers × jitter. Full formulas + constants live in `docs/SPEC.md` §10 and `src/engine/config.ts`.

---

## 5. Events, Evaluations & Scoring

### Events (scripted interrupts)
Six events land on fixed days; each is a forced **A/B/C/D** choice costing energy (and sometimes cash), applying time-windowed modifiers.

| Day | Event | Lesson |
|---|---|---|
| 15 | Supplier Shock | Cost vs price tradeoff |
| 30 | Campus Demand Surge | Inventory + cash readiness |
| 45 | Competitor Appears | Differentiation |
| 60 | Production Defect Wave | Quality vs speed |
| 75 | Cash Crunch | Cash flow under pressure |
| 89 | Late Pivot Opportunity | Focus vs spread |

### Evaluations (days 30/60/90)
Phase snapshot + cash/profit charts + cost-mix stacked bar + Amelia debrief + one **state-derived insight check** (generated from the player's actual ledger).

### Final score (0–100)
```
Net Profit      → up to 50 pts  (netProfit / $4,500 baseline, clamped)
Inventory clean → up to 25 pts  (1 − stockout_rate − overstock_rate)
Insight checks  → up to 25 pts  (correct / total)
Investor route  → +5 if debt obligation met, −15 if not
```
**Net Profit, not Revenue**, drives the big bucket — rewarding *sustainable* selling (margin, channel discipline, defect control), reinforcing LP3/LP4.

---

## 6. Technical Architecture (condensed — full version in `CLAUDE.md`)

- **Stack:** Vite 5 + React 18 + TypeScript; Tailwind v3 (custom pixel tokens); Zustand + Immer + persist; `@dnd-kit` for add-on drag/drop; Framer Motion for overlays; hand-built SVG charts (no chart lib).
- **Engine facade:** `src/engine/mockEngine.ts` is the **single import surface** for all game logic. *Despite the name it is NOT a mock* — it re-exports the real modular engine (`simulationEngine.ts`, `demand.ts`, `cost.ts`, `production.ts`, `cashflow.ts`, `modifiers.ts`, `scoring.ts`, …). UI always imports from `@/engine/mockEngine`.
- **State:** one Zustand store (`src/state/store.ts`, `useGame`). Universal mutation path is `apply((s) => engineMutator(s, ...))` — engine functions are pure mutators over the Immer draft. Persist key `intlabs:sim:state:v1`, version 8 with a migration chain.
- **Screens:** `App.tsx` is a state machine on `meta.screen` (`start → route → phase_intro → simulation → evaluation → final`); `meta.sidebar` swaps panels. A unified `PhaseSequenceModal` renders event+evaluation+result inline (gated by `meta.sequenceActive`).
- **Determinism + safety:** seeded RNG (`mulberry32`/`seedFrom`); all numeric paths pass through `clamp`/`finite` (no NaN ever reaches state).
- **Commands:** `npm run dev` (port 5173) · `npm run build` (= `tsc -b` + vite build) · `npm run preview` (4173). **No test runner, no linter** — `tsc -b` is the only automated check.

---

## 7. THE VISUAL SYSTEM — Art Bible for asset generation

> This is the section to internalize before generating any image or video. The
> goal is **zero style drift**: a new asset must look like it shipped with the
> originals.

### 7.1 Art direction in one line
**Cozy "clean pixel-game minimalism."** Warm dorm-room desk world in deep-walnut browns and creams, a friendly chibi anime mascot, chunky cel-shaded notebooks. Calm and focused — *not* a corporate dashboard and *not* a noisy arcade. Playful, but every visual earns its place by representing a decision or an outcome.

### 7.2 Two tiers of "pixel" (important nuance)
The codebase blends two related but distinct looks — match the right one to the asset:

1. **Strict pixel sprites/icons** — true pixel-art discipline: designed on a **32×32 / 48×48 / 64×64** grid, **1px dark outline, no anti-aliasing, ~6–10 colors max, max 3–4 detail layers.** Used for UI icons, status chips, small indicators.
2. **Rendered "chibi game-art" hero assets** — the mascot, the notebooks, and the environments are rendered at higher resolution with **soft cel-shading (2–3 tone steps), a bold dark outline, and a soft drop shadow.** They *read* as pixel/painterly-pixel hybrid, not strict 1-bit. (E.g. mascot idle is ~400×725 px; notebooks ~404×407 px; backgrounds 1536×1024 px.)

When generating: **icons → tier 1 (crisp pixel). Mascot / notebooks / scenes → tier 2 (chibi cel-shaded with chunky outline).**

### 7.3 The approved color palette (exact values)

These come from `assets/img/master-style/palette-approved_v01.png` and the live CSS variables in `src/styles/index.css`.

**Walnut / ink (structure & backgrounds)**
- Deep walnut scene bg `#3A2818`
- Ink / outline / primary text `#2A1E12`
- Secondary text `#5A4630` · Tertiary/hint `#8A6F50` · Soft border `#9A7B4F`

**Surfaces (panels, HUD)**
- Cream surface `#FBF6E9` · Caramel (HUD bars/headers) `#DEC189` · Mid desk overlay `#D9C193`

**Action & semantic accents**
- Primary / confirm / success green `#6FBB85` (soft `#D4ECDB`)
- Secondary / info blue `#6892C9` (soft `#D5E2F3`)
- Warning amber `#DDA655` (soft `#F3DEB7`)
- Danger / error coral-red `#CB6356` (soft `#F1CCC4`)

**Finance semantics (charts & P&L)**
- Revenue `#6FBB85` · Cost `#CB6356` · Profit `#4F9C72` · Cash `#6892C9` · Inventory `#B98B5A` · Demand `#9B6CD9`

**Brand purple** `#9B56C8` (+ `#C87BD9`, `#E29BD2`)

**Notebook material tones** — leather `#7A4A2B`, kraft `#CBA87A`, cloth `#CFC4AD`, cream pages `#FBF6E9`.

**Rules:** ≤ 6–10 colors per asset; strong contrast for readability; gradients only in controlled 2–3 step ramps (no smooth gradients). Everything sits on warm walnut, so keep assets warm-biased and high-contrast against dark brown.

### 7.4 Typography
- **Inter** — body / paragraph text.
- **Pixelify Sans** (`font-pixel`) — display / friendly pixel headings.
- **Press Start 2P** (`font-hud`) — HUD numbers, KPI chips, tiny labels (use sparingly; it's wide and chunky).

### 7.5 Lighting & shading (consistency anchor)
- **Light source: top-left.** Shadows fall **bottom-right.**
- Soft pixel shadow, **1–2 tones** only. Subtle highlights — **no over-glow, no bloom.**
- Hero assets sit on a **soft contact drop shadow** (see notebook + mascot).

### 7.6 The mascot — character bible: **Amelia** (a.k.a. **Sage**)

> Naming note: code + audio call her **Amelia** (`ameliaVoice.ts`); the SPEC and older art docs call her **Sage**. Same character. Prefer **Amelia** for new work.

**Role:** Guide + feedback layer — guides the user, reacts to decisions, surfaces warnings/hints. Must feel **friendly, smart, supportive — never annoying.** She stays in a fixed safe corner, is closeable, and never goes off-screen.

**Personality / vibe / tone (from the style sheet):** Curious · Supportive · Smart · Reliable / Warm · Friendly · Encouraging · Strategic / Positive · Calm · Clear · Inspiring.

**Design — describe her exactly like this when generating:**
- **Chibi pixel anime girl**, ~2 heads tall, expressive face.
- **Long, straight near-black hair** with subtle blue-grey pixel highlights and side-swept bangs; a small **coral/red bow hair-clip** on one side.
- **Large dark eyes, soft pink cheek blush, gentle closed-mouth smile.**
- **Outfit:** a **caramel/tan pinafore apron-dress** with a small heart-shaped pocket and a tiny **sprout/plant patch** motif, worn over a **cream short-sleeve blouse**; **brown leggings/tights**; **dark-brown shoes**. Cozy, warm, practical.
- **Build spec:** base design grid 32×32, **2px dark outline**; final renders are clean cel-shaded sprites on transparent background, full-body, front or 3/4 view, top-left light.

**Required states (each is a separate sprite, transparent PNG):**
- **Base views:** front, 3/4, side, back; idle, idle2.
- **Expressions:** neutral, happy, happy-soft, excited, excited-big, thinking, thinking-side, concerned, concerned-soft, confused, confused-tilt, warning, warning-alert.
- **Poses/actions:** idle-stand, idle-soft-wave, pointing-left(+explain), pointing-right(+explain), presenting(+open-hand), holding notebook, typing, writing, analyzing, celebrating.

State must read **without text** (happy = good result, concerned = warning, etc.). Keep accessories simple and meaningful; never redesign the outfit or hair between states.

### 7.7 Notebook visual rules (the hero product)
- The notebook is **the main object** — it must communicate **quality, positioning (cheap↔premium), and customization** at a glance.
- **Structure:** cover, binding, visible page block (fore-edge), contact shadow.
- **Look (as built):** chunky 3/4 angled view, **bold dark outline**, soft 2–3 tone cel-shading, top-left light, saturated cover color, **black spiral ring** or staple binding, optional **red/coral ribbon bookmark**, cream page edges.
- **Variants to support:** archetype (student / planner / daily-journal), cover (hardcover / leather), binding (ring / staple), size (S / M / L), paper, plus **angle views** (front, angle, spine, open, shelf). Add-ons composite on top via named placement slots (`src/data/addOnSlots.ts`).
- Premium signals: leather texture, gold "DAILY" stamp, ribbon wrap, richer cover tones. Budget signals: flat color, staple binding, kraft tones.

### 7.8 Environment rules (context layer)
- Three context types: **desk** (single-notebook view), **shelf** (multi-notebook portfolio view), **studio** (production/operations view). Plus event/round backgrounds (launch, ops-pressure, peak-demand, premium-season).
- **Look:** warm wooden desk, **soft isometric/top-down painterly pixel**, cozy dorm vibe, gentle ambient shadows, scattered props (potted plant, pen cup, sticky notes, tape roll, paperclips, box, notebooks, eraser).
- **Rules:** minimal clutter, soft background, **must not compete with the UI** (it's a backdrop). Keep the center relatively open for the hero object. 1536×1024 base, warm walnut/amber tones.

### 7.9 Icon & UI rules
- Icons = simple silhouettes, readable at small size, consistent stroke thickness; avoid over-detail and inconsistent shapes. One concept per icon.
- Every UI element supports states: **default / hover / selected / disabled / active** (+ premium / warning where relevant) — and states must be visible **without text**.
- Pixel UI conventions: hard step shadows (`2–6px` offset, no blur), `2px` corner radius (near-square), 1px ink borders. Open-source **Kenney pixel UI pack** + **input-prompt** glyphs are bundled in `assets/open-source/` for 9-slice panels and button frames.

### 7.10 The 13-point quality gate (apply before shipping any asset)
From the art bible — an asset is approved only if: (1) understandable in <1s; (2) follows the pixel rules; (3) matches the palette; (4) matches scale; (5) supports the system. And avoid the DO-NOTs: mixing pixel styles, too many colors, over-detailing small assets, inconsistent scale, unclear states, decorative-only visuals, breaking UI readability.

**Final principle:** every visual must answer *"What decision or outcome does this represent?"* If it doesn't → it shouldn't exist.

---

## 8. Asset Inventory — what already exists

All art lives under **`assets/`** (Vite's `publicDir` → served at URL root). Reference images in code only through the typed, URL-encoding map in **`src/assets.ts`** (folder names contain spaces, `&`, `:`, and em-dashes — a raw path will 404).

| Group | Path | Contents |
|---|---|---|
| **Master style refs** | `img/master-style/` | palette-approved, master-style-board, mascot/notebook/environment/icon/lighting/UI/states/pixel-rules references, do-and-dont, `master-style-notes_v01.md` |
| **Mascot** | `img/mascot/` | `01_base` (idle, idle2, front, 3qtr + alt versions), `02_expressions` (13), `03_poses` (8) |
| **Notebooks** | `img/notebook-core/{student,planner,daily}/` | 4 material/binding combos each + `angle-view/` (front, angle, spine, open, shelf) |
| **Add-ons** | `img/add-ons/` | integrated (charms, ribbons, stickers), functional-utilities, decorative-bundles, organization-inserts, writing-tools, "logic only — backend impact" |
| **Environments** | `img/environment/` | desk (clean v02), shelf/portfolio, studio/operations, round backgrounds (launch, ops-pressure, peak-demand, premium-season), shadows |
| **Studio ops** | `img/studio-operations/` | binding, cutter, printer, qa, packing, delivery, capacity, defect, bottleneck, inventory, workflow — each with active / upgrade / warning states |
| **UI icons** | `img/ui/` | Add-on, Commercial/Marketing, Customer Segment, Energy, Main Business Metric, Sidebar Category, Navigation/View Buttons, PnL/Finance, Product Configuration, Status, Studio Operations icons |
| **Audio** | `assets/music/bg.mp3` | one ambient background loop (~650 KB). SFX are procedural (no files). |
| **3rd-party** | `assets/open-source/` | Kenney pixel UI pack + input-prompt 1-bit (license-clean building blocks) |

**Naming convention:** `category_descriptor_state_vNN.png` (e.g. `mascot_concerned_soft_v01.png`, `student_angle_hardcover-ring_v01.png`, `icon_revenue_v01.png`, `qa-warning.png`). Keep new assets on this scheme and bump `vNN` for revisions. Hero art is transparent RGBA PNG; backgrounds are RGB.

---

## 9. Audio System & Direction

- **`src/audio/audioManager.ts`** — procedural SFX + ambient music via the Web Audio API. SFX kinds: click, click-soft, success, fail, coin, warning, confirm, whoosh, pop, select, tick, delete, chime, phase-up. Timbres are short (60–300 ms) and pleasant (success = rising perfect-fifth arpeggio; fail = minor-second drop; coin = bright two-note ping). **Music is OFF by default**; AudioContext is created lazily on first user gesture (autoplay policy). The one music file is `assets/music/bg.mp3` (warm, low-key loop).
- **`src/audio/ameliaVoice.ts`** — Amelia's TTS narration behind an `AmeliaVoiceEngine` interface. Current engine = browser **Web Speech**; swappable to **pre-generated MP3s** (Piper / Coqui) per `docs/amelia-voice-pipeline.md`. **Muting SFX also mutes Amelia** (shared channel).

**Audio direction for new work:** warm, soft, encouraging, low-fi — matching the cozy visual tone. SFX should be gentle and rewarding, never harsh. Music should be calm, loopable, unobtrusive lo-fi/chiptune-adjacent. For Amelia's voice: warm, friendly, clear, mid-to-high female timbre (the pipeline doc recommends Piper voices like `en_US-amy-medium` or `en_GB-jenny_dioco-medium`).

---

## 10. Asset-Generation Playbook (for Claude Cowork)

When generating **images, video, or audio**, bake the style in explicitly. Start every visual prompt with the **style preamble**, then the subject, then the constraints.

**Style preamble (paste into every image prompt):**
> "Cozy chibi pixel-game art, warm dorm-room aesthetic. Deep walnut-brown and cream palette (#3A2818 background, #FBF6E9 cream, accents: green #6FBB85, blue #6892C9, amber #DDA655, coral #CB6356). Bold 1px–2px dark outline (#2A1E12), soft 2–3 tone cel-shading, top-left light source, soft contact shadow bottom-right, ≤8 colors, no anti-aliasing noise, no gradients, no glow. Clean, readable, friendly. Transparent background."

**Then specialize:**
- **Mascot (Amelia):** add the full character description from §7.6 + the exact state ("...gentle smile, neutral pose, front view" / "...concerned expression, hand near cheek"). Always full-body, transparent PNG, consistent outfit/hair across states.
- **Notebook:** add archetype + cover + binding + size + any add-ons, 3/4 angled view, spiral/staple binding, page block visible, optional ribbon bookmark. Match the chunky cel-shaded look of `notebook-core/student/student_angle_hardcover-ring_v01.png`.
- **Environment:** soft isometric/top-down painterly pixel desk, warm wood, cozy props, open center, muted so UI reads on top; 1536×1024-ish.
- **Icons:** strict pixel, 32–64px grid, single silhouette, 1px outline, one concept, supply the needed states (default/hover/selected/disabled).

**Video:** keep motion gentle and looping (idle breathing/wave for the mascot; subtle ambient desk life; phase-transition flourishes). Match the calm tone — no fast cuts, no flashy effects. Reuse the palette and lighting. Good fits: short looped mascot reactions, a phase-up celebration, an animated event intro card.

**Audio:** warm lo-fi loops for music; soft, rewarding UI blips for SFX; clear friendly female voice for Amelia. Keep SFX < 300 ms.

**Workflow tips:**
- **Always anchor on an existing reference image** — pass the matching `master-style/*-reference_v01.png` or a shipped asset (e.g. `mascot_base_idle_v01.png`) as a style reference so output stays on-model.
- **Keep one concept per asset**, name it on the `category_descriptor_state_vNN.png` scheme, drop it in the right `assets/img/...` folder, and (if code-referenced) add it to `src/assets.ts`.
- **Run the §7.10 quality gate** before accepting anything.
- **Don't redesign** the mascot, notebook silhouette, or palette — extend within the system.

---

## 11. Gaps & Opportunities (where new assets help)

- **Mascot:** more action poses (typing/writing/analyzing/celebrating exist as named states but verify renders); short **looping animations** (idle, wave, celebrate, concerned) would lift the visual-novel feel.
- **Notebooks:** the daily-journal premium signals (gold "DAILY" stamp, strap) and richer leather/kraft material variants; per-add-on composited previews.
- **Environments:** animated/parallax desk life; distinct event backdrops beyond the current round set.
- **Audio:** more than one music track (per-phase moods), and the pre-generated **Amelia voice pack** (currently Web-Speech only) — the highest-impact audio upgrade.
- **Marketing/onboarding:** a title-card / key-art piece and a short trailer-style loop using the existing mascot + desk world.

---

## 12. Document & File Map

| Need | Go to |
|---|---|
| Full gameplay spec, formulas, every constant & event option | `docs/SPEC.md` |
| Code architecture, engine facade, store, day-tick | `CLAUDE.md` |
| Original art rules (source of §7) | `assets/img/master-style/master-style-notes_v01.md` |
| Visual style boards (palette, mascot, notebook, environment, icons, states, do/don't) | `assets/img/master-style/*-reference_v01.png` |
| TTS swap recipe (Piper/Coqui) | `docs/amelia-voice-pipeline.md` |
| Project overview (note: engine section is stale) | `README.md` |
| Tunable game data | `src/data/` (balance, segments, channels, addOns, upgrades, events, archetypes) |
| Copy / mascot scripts / dynamic feedback | `src/content/` |
| Typed asset map (URL-encoded paths) | `src/assets.ts` |
| Color tokens (live values) | `src/styles/index.css` (`:root --c-*`) + `tailwind.config.ts` |

---

*This handover is a curated snapshot. For exact numbers always defer to `docs/SPEC.md` and `src/engine/config.ts`; for exact code shape, to `CLAUDE.md`; for exact visual rules, to the master-style references.*
