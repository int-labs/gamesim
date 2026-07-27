# PRD — "Wide Canvas" Game-Feel Overhaul (V2)

> Goal: turn the simulation from a **dashboard with two sidebars** into a **wide, playful game canvas** where the notebook is the hero, inputs and outputs live in slide-in drawers behind clear icon docks, notebooks can be browsed like a shelf, and the big moments (business planning, final results) feel like a game — not a spreadsheet. Nothing is removed; everything is relocated into a more game-like shell with rich motion.

Status: **Planning / approved-for-phasing**. Branch: `V2` (Vercel deploys from `main`; V2 → main later).
Owner: Rido. Last updated: 2026-07-02.

---

## 1. Design principles

1. **Canvas is the star.** The notebook (and the shelf of notebooks) gets the center of the screen at all times. Chrome shrinks; art grows.
2. **Inputs left, outputs right, both on demand.** A thin **icon dock** hugs each edge. Left dock = what you *change* (items, design, add-ons). Right dock = what you *read* (metrics, P&L). Clicking an icon slides a drawer over the canvas; the canvas never reflows.
3. **One consistent visual language.** Drawers, the metrics table, the P&L, the business "file pile," and the results screen all share the same pixel-frame, warm-walnut tone, dividers, and tone colors (success/warn/danger/info) already in the codebase.
4. **Everything is alive.** Icon docks breathe/pulse, drawers slide+fade, numbers count-up, rows stagger-in, the shelf books hover, tips reveal and dismiss, the results screen celebrates. Motion respects `prefers-reduced-motion` everywhere.
5. **Responsive by construction.** Docks collapse to a bottom tab-bar on small screens; drawers go full-width; the gallery reflows. Target: great at 1280×800 down to ~380px.
6. **No sim-logic changes.** This is a pure FE/UX/visual overhaul. Every existing engine mutator and selector is reused as-is. No scoring, demand, or balance changes.

---

## 2. Target architecture (the new shell)

```
┌───────────────────────────────────────────────────────────────────────┐
│  TOPBAR (slim):  [logo] [Phase] [Cash] [Energy]   «Notebook name ✎»    │  ← simplified
│                                                   [help][audio][menu]   │
├──┬─────────────────────────────────────────────────────────────────┬──┤
│  │  MAIN NAV tabs:   ▸ Product     ▸ Business      (Results hidden)  │  │
│L │                                                                   │R │
│E │                                                                   │I │
│F │                    ★  WIDE  CANVAS  ★                             │G │
│T │        ‹  [ hero notebook OR shelf gallery ]  ›                   │H │
│  │                                                                   │T │
│D │              [ Focus ⇄ Shelf view toggle ]                        │  │
│O │                                                                   │D │
│C │                                                                   │O │
│K │                                                                   │C │
│  │                                                                   │K │
├──┴─────────────────────────────────────────────────────────────────┴──┤
│  PHASE ACTION BAR (sticky):   status chips  ····   [ Confirm Phase ▶ ]  │
└───────────────────────────────────────────────────────────────────────┘

LEFT DOCK icons (open drawers over canvas):     RIGHT DOCK icons:
  📓 Notebook Items   (ProductLineList)            📊 Metrics   (unified table, tabbed)
  🎨 Design           (type/cover/binding/size/…)  🧾 P&L       (finance table)
  ✨ Add-ons          (drag-drop gallery)          (📈 optional: trends)
  ℹ️ Details          (spec drawer, single view)
```

- **Drawers** are overlays (fixed, high z, backdrop-dim, slide from their edge). Opening one does **not** resize the canvas — the canvas stays full-bleed underneath. Only one drawer per side open at a time; opening another swaps content.
- **DnD** (add-on placement) stays a single page-root `DndContext` wrapping both the canvas and the drawers, so you can drag an add-on out of the left "Add-ons" drawer onto the canvas. dnd-kit's `DragOverlay` is portaled, so the drawer's `overflow` won't clip the drag ghost.
- On **< lg**, the two docks merge into a **bottom tab-bar** (thumb-reachable); drawers become full-width bottom sheets.

---

## 3. Asset inventory (what we already have vs. need)

**Already in repo & wired in `src/assets.ts` — usable now:**
- Notebook **angle views** per type (`student|planner|daily`): `front`, `angle`, `spine`, `open`, `shelf` → focus + gallery.
- **Bookshelf background**: `A.env.shelf` (`shelf_bg_portfolio_isometric_v01.png`).
- **Chevrons**: `A.ui.nav.previous_notebook`, `A.ui.nav.next_notebook`.
- **View toggles**: `A.ui.nav.desk_view`, `A.ui.nav.shelf_view`.
- **Close/help/info**: `A.ui.nav.close|help|info`.
- **Left-dock category icons**: `A.ui.sidebar.product|cover_style|material|addons|studio|commercial|metrics|results`.
- **Config icons**: `A.ui.config.*` (type, size, page_count, paper, cover_material, binding, packaging, bundle).
- **Metric icons**: `A.ui.metrics.*` (revenue, profit, inventory, demand, capacity, quality, defect_rate, on_time_delivery).
- **P&L finance icons**: `A.ui.pnl.*` (gross/net revenue, op profit, material/labor/marketing/packaging/fulfillment).
- **Segment / commercial / studio-ops / add-on thumb icons**: all wired.

**Not yet wired but on disk (add to `assets.ts` as needed):**
- `ui/Main Business Metric Icons/`: `icon_cost`, `icon_brand_popularity`, `icon_customer_satisfaction`, `icon_waste`, `icon_on_time_delivery` (some wired, some not) — needed for extra metric rows.
- `ui/Energy/*`, `ui/Status Icons/*` — status/energy glyphs for the metrics table & tips.

**Likely to request as NEW art later (use CSS/placeholder first, list at the end):**
- Sticky-note / manila **file-folder tab** texture for the Business "document pile" (Phase 5) — CSS-drawn first.
- **Trophy / rank medal / celebration ribbon** for the Results screen (Phase 6) — CSS/emoji-pixel first.
- Optional: a nicer **shelf/wood** backdrop tuned for the gallery if `shelf_bg_portfolio_isometric` reads too busy behind cards.
- Confetti = generated in-code (no asset).

---

## 4. Phased plan

Each phase is independently shippable, type-checks clean (`npx tsc -b`), and is verified in the preview before moving on. Ordering respects dependencies (drawers → metrics → gallery → topbar → business → results).

### Phase 1 — Full-canvas shell + Left dock & drawer system  *(foundation)*
**Goal:** Kill the left/right grid rails on the Product page; introduce the edge **icon dock + slide-in drawer** pattern; move the left-rail panels into drawers; give the canvas the full width. Hide the Results tab.

**Scope**
- New shared primitives:
  - `components/hud/EdgeDock.tsx` — a vertical strip of large, tactile **icon buttons** (44–56px), each with idle "breathing" loop + hover pop + active state; pinned to a screen edge; `role="toolbar"`. Props: `side: 'left'|'right'`, `items: DockItem[]`, `activeId`, `onSelect`.
  - `components/hud/Drawer.tsx` — accessible slide-in overlay panel (focus-trap, `Esc` to close, backdrop dim, slide+fade via Framer, respects reduced-motion). Props: `side`, `open`, `title`, `icon`, `width`, `onClose`, children. On `< lg` renders as a bottom sheet (full width, slides up).
  - `state`: add **transient** UI state to the store (NOT persisted — extend `partialize` drop-list): `ui.leftDrawer: DockId | null`, `ui.rightDrawer: DockId | null`, `ui.viewMode: 'focus' | 'gallery'` (used in Phase 3). Add small actions `openDrawer(side, id)`, `closeDrawer(side)`, `toggleDrawer(side, id)`.
- Rework `pages/ProductPage.tsx`:
  - Replace `grid lg:grid-cols-[…]` with a single full-bleed canvas region + `EdgeDock` (left) + `Drawer` host.
  - Left dock items → drawers:
    - **Notebook Items** → `ProductLineList` (unchanged component, re-housed).
    - **Design** → `ProductConfigPanel` (unchanged).
    - **Add-ons** → new `AddOnGalleryDrawer` (the draggable add-on catalog; today the gallery lives inside the config/rail — extract it).
    - **Details** → `ArchetypeDetailModal` content re-housed as a drawer, **single flat view** (drop the "different angle" modal framing).
  - Keep the page-root `DndContext` wrapping canvas + drawers.
- `components/hud/MainNav.tsx`: filter out the `results` page (Product + Business only). Guard `SimulationScreen` so `page==='results'` can't be reached.
- Copy: update any mascot/help text that says "right rail" → "the Metrics button" (finalize in Phase 4).

> **Phasing note (to avoid a functionality gap):** Phase 1 converts only the **LEFT** rail into the icon dock + drawers and widens the canvas. The **right rail** (`EffectPreviewPanel` + `PnLMiniChart`) and the scroll-down `BottomPnL` are **retained as-is through Phase 1** so no numbers disappear mid-rollout. Phase 2 replaces the right rail with the mirrored right dock + tabbed metrics table and retires the scroll-down P&L.

**Status: ✅ DONE & preview-verified.** Left dock (Items·Design·Add-ons·Details, Items shows a live count badge) opens/​swaps/​closes drawers over a full-bleed canvas; Details drawer shows a single view; add-on gallery stays draggable inside one page-root DndContext; Results tab hidden; `tsc -b` clean. New: `store.ui` slice (`leftDrawer`/`rightDrawer`/`viewMode`/`dismissedTips`, transient), `components/hud/EdgeDock.tsx`, `components/hud/Drawer.tsx`; `ProductPanel` split into `DesignControls` + `AddOnGallery`.

**Motion/interaction**
- Dock icons: 3–5s idle breathing (scale 1→1.04), hover scale+shadow, press bounce, active = filled plate + inner glow.
- Drawer: slide from edge (x/y), backdrop fade, content stagger. `Esc`/backdrop/close-button all dismiss. Reduced-motion → instant.

**Responsive**
- `lg+`: left dock as a vertical rail; drawers ~360–420px wide, overlaying canvas.
- `< lg`: dock icons move into the **bottom tab-bar**; drawers become bottom sheets.

**Acceptance**
- Product page shows a wide canvas with a left icon dock; each icon opens the correct drawer; add-on drag-drop still works from the drawer onto the canvas; Results tab gone; `tsc -b` clean; works 1280→380px.

**Risks:** dnd across an overlay (mitigated by portaled DragOverlay + one DndContext); focus-trap correctness; making sure the canvas keeps its height math (was `h-full` wrapper — must preserve so the notebook isn't cropped).

---

### Phase 2 — Right dock + unified Metrics table (right rail → table)
**Goal:** Remove the right rail; consolidate **every number** into a single, beautiful **table styled exactly like the P&L**, with a **unique icon per parent metric**, indented child rows (no icon, just a left gap), dividers, tone colors, and micro-animations. Use **tabs** to keep it digestible.

**Scope**
- New `components/hud/MetricsTable.tsx` + `MetricsDrawer.tsx` on a **right EdgeDock** (mirror of Phase 1's left dock). Icons: `metrics` (dashboard) + `pnl` finance.
- Tabs (recommended split — finalize during build):
  1. **Live** — active-notebook impact + portfolio (everything from `EffectPreviewPanel` + `PortfolioSummary`): audience fit, price/margin, demand est., unit cost, stock coverage, add-ons, capacity load, complexity, cannibalization, avg unit cost.
  2. **Finance / P&L** — the existing `BottomPnL` rows (gross revenue → costs → gross profit → op profit → cash), same phase columns.
  3. **Operations** (optional, if tab 1 is too dense) — stock (finished/raw), production/day, defect rate, on-time %, capacity, waste.
- Row model: `MetricRow` = `{ icon?, label, value, tone, delta?, children?: MetricRow[] }`. **Parent rows** carry the unique icon; **child rows** render with `pl-6` (gap) and no icon; group **dividers** between themes; right-aligned tabular-nums values; +/- tone coloring identical to `BottomPnL`.
- Merge/relocate: delete `EffectPreviewPanel` + `PnLMiniChart` from the product page (their data now lives in the table). Keep `BottomPnL` content but surface it through the Finance tab (and optionally keep the scroll-down P&L too, or retire it — decision below).

**Motion/interaction**
- Value **count-up** (reuse `CountUp`), row **stagger-in** on tab switch, subtle **flash** on change (reuse `.anim-flash`), tone chips animate. Tab switch = crossfade/slide.
- Parent rows expand/collapse their children (chevron) with height animation.

**Responsive**
- `lg+`: right dock + ~380px drawer. `< lg`: metrics live in the bottom-sheet + the existing `StatsDrawer` stays as the quick-KPI fallback.

**Acceptance**
- One cohesive metrics surface, visually matching P&L, every prior number present, unique parent icons, indented children, dividers, animated; `tsc -b` clean; responsive.

**Risks:** density — solved with tabs + collapsible groups; keeping op-profit math identical to `selectPnL`/TopHUD (reuse selectors, don't recompute).

**Status: ✅ DONE & preview-verified.** Right dock (**Metrics · P&L**) mirrors the left; new `components/hud/MetricsTable.tsx` renders a tabbed, P&L-styled table — **Notebook** (fit/demand/target · price/unit-cost/margin · stock/target/add-ons), **Finance** (Revenue · Costs · Profit · Cash, with group totals + emphasised Op-Profit/Cash), **Portfolio** (lines · capacity/complexity/cannibalization · inventory). Parent rows carry unique icons; children are indented with a left gap and no icon; dividers between groups; +/- tone colours mirror the P&L (`fin-revenue/cost/profit/cash`); values count-up and rows stagger-in. Reuses the exact `EffectPreviewPanel`/`BottomPnL` computations (no recompute drift). The old right rail (`EffectPreviewPanel` + `PnLMiniChart`) and the scroll-down `BottomPnL` are removed from the shell → **truly wide canvas** (`[left dock][hero][right dock]`). `tsc -b` clean. Those three component files are now unimported (dead) — deletable on request.

---

### Phase 3 — Canvas focus navigation + Gallery/Shelf view
**Goal:** Make the canvas a proper "showroom": **chevrons** to step between notebooks in focus view, and a new **Gallery (shelf) view** to browse the whole portfolio at a glance with insights, on a **bookshelf backdrop**, using the different **angle/shelf** art.

**Scope**
- **Focus view** (`NotebookCanvas`): add left/right **chevron buttons** (`A.ui.nav.previous/next_notebook`) that cycle `activeLineId` through `portfolio.productLines` (wrap-around). Show a small "2 / 4" position pill + the notebook name. Slide/whoosh transition between books.
- **View toggle**: a segmented control using `A.ui.nav.desk_view` / `A.ui.nav.shelf_view`, bound to `ui.viewMode` (`focus` ↔ `gallery`).
- **Gallery view** — new `components/canvas/NotebookGallery.tsx`:
  - Background: `A.env.shelf` styled to read like a **wooden bookshelf** (layered shelf planks, soft shadow, vignette) — not plain.
  - Each notebook = a **book card** rendered with its type's `spine`/`shelf`/`angle` image (different perspective than focus), sitting on a shelf, with a hover **lift/tilt** and gentle idle sway.
  - **Insight overlay per book**: name, type (student/planner/daily), cover+binding, price, target segment, add-on count (mini thumbnails), stock/finished, fit%. Reveal on hover / always-show compact caption.
  - Click a book → set active + switch to focus (or open Details drawer). "+ Add notebook" appears as an empty slot on the shelf.
- Reuse the `Notebook` renderer where possible; add an `angle` prop to pick which view image.

**Motion/interaction**
- Chevron press → notebook slides out/in (directional). Gallery entrance = books "pop onto the shelf" staggered. Hover = lift + shadow + slight rotate. Reduced-motion → fades only.

**Responsive**
- Gallery = responsive grid/rows of shelves (1–2 per row on mobile, 3–4 on desktop). Chevrons become edge-tap zones on mobile.

**Acceptance**
- Focus view cycles notebooks via chevrons; view toggle flips to a bookshelf gallery showing all notebooks with insights and distinct angle art; clicking focuses one; `tsc -b` clean; responsive.

**Risks:** art fit (angle images may need consistent framing/scale); performance with many books (cap render, virtualize if needed — portfolio is small, so fine).

**Status: ✅ DONE & preview-verified.** Focus view now shows the **active notebook name** in the header, a **Focus/Shelf `ViewToggle`** (`components/canvas/ViewToggle.tsx`, bound to `ui.viewMode`), prev/next **chevron buttons** flanking the notebook (lucide `ChevronLeft/Right` in pixel buttons — the shipped `btn_*_notebook` art turned out to be wide labelled buttons, unfit for edge nav) and a **"n / N" position pill**. New **`components/canvas/NotebookGallery.tsx`** renders the SHELF view: a warm wood-grain backdrop, each notebook as a **front-facing book** (`view.front` per type — a distinct perspective) resting on a wooden ledge with a gentle idle sway, an **insight caption** (name · price · type/cover/binding/size · segment-fit · add-ons · stock), an ACTIVE pin, and an **"Add notebook"** slot. Clicking a book focuses it. `ProductPage` swaps `NotebookCanvas` ⇄ `NotebookGallery` on `viewMode`. `tsc -b` clean.

_Art note:_ gallery books use the per-**type** `view.front` image, so cover/binding aren't visually reflected there (only 3 front images exist) — the caption states them textually. Distinct per-cover shelf art would be a future asset ask.

---

### Phase 4 — Topbar simplification + editable notebook name + closeable tips
**Goal:** Slim the topbar (metrics now live in the table), put the **active notebook name front-and-center and rename-able**, and make **all tips closeable** with reveal/dismiss motion.

**Scope**
- `TopHUD`: reduce to essentials — `logo · Phase · Cash · Energy` on the left; **center: editable notebook name**; right: `help · audio · history · menu`. Move Stock/Demand/Fit/Revenue/Op-Profit out (they live in the Metrics table / StatsDrawer now). Keep it single-row and calm.
- **Editable name**: click the name (or a pencil) → inline text input → commit calls `renameProductLine(activeLineId, name)` (sets `isCustomName`). Shows the active line; updates with chevrons/gallery selection. Small "type" glyph next to it.
- **Closeable tips**: audit every tip surface — the canvas "pick an audience" tip, `CanvasStatusStrip` hints, mascot nudges, any inline callouts — give each a **dismiss (×)** and a **reveal animation** (slide/scale/fade in on show, collapse out on dismiss). Track dismissed tips in transient `ui.dismissedTips: string[]` so they don't nag again this session; a small "tips" toggle can re-show them.

**Motion/interaction**
- Name edit: pencil hover, input focus ring, save = check pulse. Tips: spring reveal, dismiss = collapse + fade. Reduced-motion → instant.

**Responsive**
- Name truncates with ellipsis + tooltip on small screens; on mobile the editable name sits in the MainNav row if the topbar is tight.

**Acceptance**
- Topbar is visibly simpler; notebook name shows and is editable inline from the top; every tip has a working close with animation; `tsc -b` clean.

**Risks:** don't lose important at-a-glance signals — keep Cash/Energy/Phase in the bar; everything else is one tap away in Metrics.

**Status: ✅ DONE & preview-verified.** `TopHUD` trimmed to **logo · Phase · Energy · Cash** + utilities; the Op-Profit/Revenue/Stock/Demand/Fit chips (and their now-dead computations) are removed — they live in the Metrics drawer. New **`components/hud/TopNotebookName.tsx`** centres the **active notebook's name, editable in place** (click → input → Enter/blur commits `renameProductLine`, Esc cancels); verified a live rename propagating to the canvas header. New reusable **`components/hud/DismissibleTip.tsx`** — a hint that springs in and has a ✕ that remembers dismissal for the session (`ui.dismissedTips`); applied to the canvas "pick an audience" tip. `tsc -b` clean.

---

### Phase 5 — Business page "document pile" navigation
**Goal:** Replace the Business page's plain vertical sidebar with a playful **stack of files / sticky-note tabs** — like a pile of manila documents where each section is a tab of **decreasing width**, layered, so it reads as a physical archive.

**Scope**
- `pages/BusinessPage.tsx`: keep the 4 sections (Audience / Operations / Inventory / Commercial) and the local `useState`/`intlabs:goto` logic; **replace the sidebar visual** with `components/business/FileTabsNav.tsx`:
  - Each tab = a **file folder / sticky-note** with a label; tabs stack vertically (or as layered cards), the top one longest, each lower one slightly narrower/offset → "pile of documents."
  - Active tab pulls forward (raises, un-dims, casts shadow), inactive tabs sit behind with a peeking sticky-note label + section icon (`A.ui.sidebar.*`).
- Content panels unchanged; only the nav chrome changes.

**Motion/interaction**
- Selecting a tab: it slides/lifts to the front, others settle back (spring). Sticky-note corner curl on hover. Reduced-motion → simple active highlight.

**Responsive**
- `< md`: pile becomes a horizontal row of file tabs above the content (still layered look, tuned for width).

**Acceptance**
- Business nav looks like a layered document/file pile with decreasing widths + sticky-note labels; all four sections still switch correctly; `tsc -b` clean; responsive.

**Risks:** legibility of layered labels on small screens (mitigated by the horizontal variant); keep decent hit targets.

**Status: ✅ DONE & preview-verified.** `BusinessPage`'s plain sidebar list is replaced by an inline **`FileTabsNav`** — the 4 sections (Audience/Operations/Inventory/Sales) render as a **pile of manila files**: each with a rotated **colored sticky-note tab** (green/amber/rose/lavender) bearing the section icon, **decreasing in width** top→bottom, slightly tilted, and the **active file springs forward** (raised, un-rotated, stronger shadow) while switching the content panel. Section state + `intlabs:goto` deep-links preserved. `tsc -b` clean. (Active file keeps its position-based width; could pull to full width if preferred — easy tweak.)

---

### Phase 6 — Celebration Final Results
**Goal:** Transform the end screen from a report into a **celebration** — confetti, a **talking-head mascot** host reacting to the score, animated score count-up and staggered reveals, a trophy/rank flourish — while keeping **all** the data (score breakdown, trends, cost mix, did-well/hurt, decision timeline, export/home CTAs).

**Scope**
- Rework `screens/FinalResultsScreen.tsx`:
  - **Hero celebration band**: `MascotAvatar` (talking head) as the host, score **count-up to /100**, a **rank/tier badge** (e.g. S/A/B/C or "Standout / Solid / Rocky") derived from `score.total` tiers, confetti burst on mount (tier-scaled; muted/none for low scores + reduced-motion).
  - **Data, re-choreographed**: the three `ScoreCell`s (Net Profit / Inventory / Insight) animate in with fill bars; charts (`PixelStepLine` cash & profit, `PixelStackedBar` cost mix) **draw-in**; "What you did well / what hurt" reveal as stamped list items; decision timeline slides in; CTAs (Export JSON, Back to Home) restyled as game buttons.
  - Tie the mascot's line + expression + confetti intensity to the score tier (reuse existing tiered copy; upgrade visuals).
- New `components/fx/Confetti.tsx` (CSS/SVG pixel confetti, reduced-motion aware) + `components/results/RankBadge.tsx`.

**Motion/interaction**
- Sequenced timeline: mascot greets → score counts up → tier badge stamps in → confetti → breakdown cells fill → charts draw → lists stamp → timeline slides. All skippable/instant under reduced-motion. Serious/low-score runs get a calmer, respectful variant (no big confetti).

**Responsive**
- Hero stacks above the data on mobile; charts full-width; timeline scrolls.

**Acceptance**
- Final screen feels celebratory and animated, mascot reacts to the tier, all existing data present and correct, calm variant for low scores + reduced-motion; `tsc -b` clean.

**Risks:** don't bury the numbers under fx; keep it fast; low-score empathy (no over-celebration on a bad run).

**Status: ✅ DONE & preview-verified.** `FinalResultsScreen` reworked as a sequenced celebration: hero band (talking-head `MascotAvatar` host + tier-matched takeaway) → **score counts up** to /100 (local `useCountUp`; the shared `CountUp` primitive is silent-on-mount by design) → **`RankBadge` stamps in** (S ≥85 "Standout" · A ≥65 "Solid Run" · B ≥45 "Getting There" · C "Rocky Start") with a `pop` sfx → **pixel `Confetti`** scaled to the tier (full/calm/**none** for rocky runs) → data staggers in (score cells with **animated fill bars**, trends/cost-mix slide in, did-well/hurt **stamp item-by-item**, timeline slides from the right, CTAs restyled with Back-to-Home primary). ALL report data retained. Reduced-motion collapses everything to instant. New: `components/fx/Confetti.tsx`, `components/results/RankBadge.tsx`. Verified live with an injected ended-run save (72/100 → A badge). `tsc -b` clean.

---

## 5. Cross-cutting concerns
- **Persistence:** new UI state (`ui.leftDrawer/rightDrawer/viewMode/dismissedTips`) is **transient** — extend `partialize`'s drop-list; **no persist version bump** expected unless we touch persisted shape.
- **Deep-links:** preserve `intlabs:goto`; extend it so a nudge can open a specific drawer/tab (e.g. "Pick an audience" → Business + Audience file tab).
- **DnD:** one page-root `DndContext`; portaled `DragOverlay`; drawers must not clip the ghost.
- **Reduced motion:** every animation gates on `useReducedMotion()` (already the codebase norm).
- **Sound:** reuse `playSfx` cues (open/close/tick/select) for dock/drawer/tab/chevron.
- **Determinism/engine:** untouched. Only selectors/mutators are consumed; no new sim math.
- **A11y:** docks/drawers/tabs get roles, labels, focus-trap, Esc; editable name is a real input; chevrons are buttons.

## 6. Decisions (confirmed 2026-07-02)
1. **Symmetric docks** (inputs left / outputs right), drawers overlay the canvas. ✅ **Confirmed.**
2. **Metrics = tabbed table in a right drawer, and RETIRE the scroll-down `BottomPnL`** (one home for numbers). ✅ **Confirmed by user** — remove the scroll-down P&L in Phase 2; Finance becomes a tab.
3. **Notebook Details = drawer, single flat view** (drop multi-angle modal). ✅ Proceeding.
4. **Results tab hidden** (phase debriefs still fire inline via `PhaseSequenceModal`). ✅ Proceeding.
5. **Rank tiers** for the results screen: 85+ = "Standout", 65–84 = "Solid", 45–64 = "Getting There", <45 = "Rocky" (calm variant). Tunable.

## 7. Post-build hardening (adversarial review — 2026-07-02)

A 56-agent review workflow (5 dimension reviewers × 3 refuters per finding) swept the full uncommitted V2 diff: **17 deduped findings → 16 confirmed**, all fixed, plus 4 extra crash sites found during Playwright verification. Headless-browser smoke test: **6/6 checks green, zero page errors.**

**Crashes fixed (empty portfolio is a supported state — deleting the last notebook is permitted):**
- `ArchetypeDetailModal` (Details drawer) — unguarded `product.archetype` in a `useState` initializer → white screen. Now: safe initializer + friendly empty state.
- `MetricsTable` — unguarded `calcUnitCost` selector (throws via `getLineOrThrow('')`) → white screen. Now: length-guarded selectors + existing EmptyMetrics renders.
- `CanvasStatusStrip`, `PhaseSequenceModal`, `ConfirmPhaseModal`, `ConfirmDayModal` — unguarded `product.price`/derefs on components that stay mounted (found via Playwright, not the reviewers) → all guarded with graceful degradation.

**Interaction/UX fixes:** drawers are now **mutually exclusive** (both-open backdrop deadlock + double-Esc), Drawer Esc **yields to stacked PixelModals** (`data-pixel-modal`), dragging a tile **closes the Add-ons drawer** so drops land visibly, Shelf-view drags get a **toast** ("switch to Focus"), chevrons dropped to `z-[2]` (below add-ons) + position pill is `pointer-events-none`, focus-strip Stock pill is now **per-line** (matches the gallery caption).

**Responsive/a11y fixes:** Drawer width is **container-relative** (`min(384px,100%)` — was `86vw`, clipped ~90px off phones; verified right-edge 310px at 380w with the ✕ hittable), Stats/KPI button **visible at all widths** (was `xl:hidden` while the chips it replaced are gone — desktop Business page had no KPI access), TopNotebookName hidden below `sm` (overlapped the utility toolbar; rename stays in Items drawer), Drawer got `aria-modal` + focus-on-open + Tab trap + focus-return, EdgeDock `role="toolbar"`→`role="group"`, "Notebook Studio" stamp hidden below `sm` (collided with the position pill), Confetti fill-mode `forwards`→`both` (pieces no longer sit in a static strip during their start delay).

## 8. Refinement round (user feedback — 2026-07-02)

Feedback: canvas not full enough · P&L/Metrics should be a REAL table like the old version (icons, tabs ok) · top section eats too much space.

- **Full-bleed canvas:** `NotebookCanvas` is now the stage itself — desk art edge-to-edge, no frame/padding. All chrome floats over it: renameable **title card** + status pills (top-left), **Focus/Shelf + Details** (top-right), chevrons offset inward, position pill (bottom-center), studio stamp (bottom-right). `EdgeDock` reworked into **floating tiles** (absolute, vertically centered, 84px, solid `bg-surface` — note: `/alpha` on semantic var colors silently generates nothing) rendered INSIDE the canvas region. Gallery view full-bleed too with lateral padding clearing the docks.
- **One slim bar:** the MainNav row is gone (~65px reclaimed) — compact **Product/Business tabs live in the TopHUD center** (`TopHUD` takes `page`/`onPageChange`). Logo hidden below `sm` so tabs fit at 380px. The notebook rename moved onto the canvas title card. `MainNav.tsx` now supplies only the `MainPage` type; `TopNotebookName.tsx` is dead code.
- **Real tables in the drawer:** `MetricsTable` Finance tab is the classic **phase-columned P&L table** (Line item · P1 · P2 · P3 · Total) with a unique icon per line item, current-phase column highlight, cost/profit/cash tones, emphasis rows — the old `BottomPnL` math verbatim. Notebook/Portfolio tabs render as icon'd key-value **tables** (`KVTable`). Right drawer widened to `min(560px, 100%)`.

Verified via Playwright screenshots at 1440×900 (focus + P&L + Metrics) and 380×812. `tsc -b` clean.

## 9. Refinement round 2 (user feedback — 2026-07-02)

Feedback: the two Metrics/P&L tiles were redundant ("should be a table at bottom right") · switching notebooks/sections/views felt glitchy (top card resized, hero popped, toggle jumped) · phone layout collided.

- **One Stats button, bottom-right:** the right dock is a single tile (`anchor="bottom"`) opening the tabbed table drawer (Notebook · P&L · Portfolio) — the separate Metrics/P&L tiles opened the same drawer, so they're merged.
- **Smooth everything:** the hero **slides in the chevron's direction** when switching notebooks (scale-fade only for config changes); the title card has a **fixed min-width** so it never resizes as names cycle; **drawer section swaps** (Items→Design→…) get a keyed fade; the gallery header was rebuilt as **the same floating cards in the same positions** as focus view (title card top-left, toggle+Details top-right) so Focus ⇄ Shelf keeps every control in place; chevrons + position pill merged into a **bottom-center carousel cluster** (also removes hero/add-on overlap for good); studio stamp moved bottom-left.
- **Phone layout:** below `sm` both docks become a **bottom control bar** (Items·Design·Add-ons·Details left, Stats right), status pills hide (numbers live in Stats), and the tip/cluster offsets clear the bar. Verified at 380×812 — zero overlaps.

Verified via Playwright screenshots (1440 focus + shelf, 380 mobile). `tsc -b` clean.

## 10. Refinement round 3 (user feedback — 2026-07-02)

- **Items drawer:** notebook cards are **white** (`bg-white`) so they pop from the cream drawer; **"+ Add Notebook" is a sticky footer** pinned to the drawer's bottom edge (list scrolls under it); the archetype dropdown **flips upward** when there's no room below (it portals `position:fixed`, so with the trigger pinned at the bottom, up is the norm) — no more clipped menu with many notebooks.
- **View controls:** Focus/Shelf toggle icons replaced with lucide `Book`/`LayoutGrid` (the shipped `btn_desk/shelf_view` art is a wide labelled button that muddied at 16px); the Details ⓘ button height now matches the toggle's outer height (32px) in both focus and gallery headers.

Verified via Playwright (8-notebook list: sticky footer + upward menu + white cards). `tsc -b` clean.

## 11. Refinement round 4 (user feedback — 2026-07-02)

- **Stats is not a drawer:** the tables now live **in the page scroll below the canvas** (`BottomStats`, `#stats-section` — Active Notebook + Portfolio side-by-side, phase P&L full-width). No clicks needed; a "Stats & P&L ↓" chip (canvas bottom-right) smooth-scrolls there. The right dock/drawer is removed (`ui.rightDrawer` now unused; tabbed `MetricsTable` kept exported but unmounted).
- **Topbar per the reference:** the per-line KPI pills (Target · Fit · Price · Demand · Stock · Add-ons) moved INTO the top bar as one bordered group (lg+, hidden with an empty portfolio) — visible on the Business page too, which also restores desktop KPI access there. The **Product/Business tabs float on the canvas top-center** (`FloatingPageTabs` in SimulationScreen, over both pages; BusinessPage gained `pt-14` clearance).
- **Real shelf cards:** gallery `BookCard` renders the actual `Notebook` component (cover/binding/**size** true-to-config) plus the line's **placed add-on sprites** at their real normalized positions, in a taller rectangular stage — the card now mirrors the focus canvas.
- **Details drawer:** the archetype switcher is stacked icon-over-label tiles (labels no longer overflow the 380px drawer). The Details dock tile icon swapped from the smudgy `btn_info` art to `icon_page_count`.

Verified via Playwright (topbar group + floating tabs, stats scroll, real-config shelf, business clearance). `tsc -b` clean.

## 12. Refinement round 5 (user feedback — 2026-07-02)

- **Mascot dialogue title contrast:** the "Amelia · Heads up" header no longer uses tone colours (amber-on-caramel was unreadable) — the title is always dark ink; the tone still shows via the icon chip + accent border.
- **Business page = archive folder tabs (per reference):** the vertical file pile is replaced by **horizontal FILE-FOLDER tabs across the top of one document sheet** (`FolderTabs`): the active tab is taller, cream, `border-b-0` and overlaps the sheet's top border by 2px → reads as one connected folder; inactive tabs are shorter, manila, tucked behind with descending z + slight overlap, each carrying its tilted pastel sticky-note icon. Row scrolls horizontally on phones (subs hide below md). The Control Room note moved into the sheet header (right side). Section swaps get a keyed fade. `intlabs:goto` deep-links unchanged.

Verified via Playwright (Audience + Inventory active states — the folder merge follows the active tab). `tsc -b` clean.

## 13. Refinement round 6 (user feedback — 2026-07-02)

- **Aligned top band:** the three floating canvas cards — title (now a SINGLE 48px row: name ✎ | config), the Product/Business tabs, and Focus/Shelf/Details — all sit at `top-3 h-[48px]`, one clean horizontal band. Gallery header matches.
- **Stats = documents on a desk:** `BottomStats` reworked — each table is a **PaperSheet**: taped at the corners, resting at a scattered tilt, that **lifts into reading position** (`whileInView` spring rise + straighten, framer v11) as you scroll down; heavy paper shadows + faint blank sheets dress the desk. Tables lost their double frame (paper owns the frame; thin inner borders), rows realigned (consistent `py-2`, fixed 112px value column).
- **Single scroll on Business:** the page wrapper is `h-full` only for Product (canvas lock); Business flows at natural height with its inner `overflow-y-auto` removed — **measured: 0 inner scrollables**, the one `#sim-scroll` bar carries folder content straight down into the stats paperwork.

Verified via Playwright (band alignment, lifted papers, scrolled business + scroll metrics). `tsc -b` clean.

## 14. Refinement round 7 (user feedback — 2026-07-02)

- **Title plates:** the floating name card looked like plain text (thin VT323 `panel-title`). Rebuilt as a proper game TITLE plate — primary **accent icon chip** + tiny **eyebrow** ("NOTEBOOK" / "PORTFOLIO") + the name in the chunky arcade font (`font-hud` 13px uppercase), divider, config line. Same anatomy in focus ("STUDENT") and shelf ("YOUR SHELF"); rename input restyled to match. Still a single 48px row on the shared top band.

Verified via Playwright close-ups (focus + shelf). `tsc -b` clean.

## 15. Closeout (2026-07-02)

**Finishers applied:** dead code deleted (`EffectPreviewPanel`, `PnLMiniChart`, `BottomPnL`, `RightPerformancePanel`, `TopNotebookName`; `MainNav.tsx` reduced to the `MainPage` type; the unmounted tabbed `MetricsTable` component removed — its tables + `BottomStats` live on). Start-screen title fixed (`academy-minibusinesssim` → "Mini Business Sim"). **Drawer-switching UX fixed:** the left dock is now z-50 (above open drawers) and panels slide in BESIDE it (`panelOffsetClassName`), so Items→Design→Add-ons→Details hop without closing — the dock is a live tab rail (mobile: bottom-bar stays tappable over the drawer; body pads for it). Full production build (`npm run build`) green; instrumented end-to-end smoke (start → route → phase → all four drawers → shelf ⇄ focus → business → stats scroll): **10/10 steps, zero page errors.**

## 16. Juice pass (2026-07-02)

Open polish brief ("make it much more fun"). All reduced-motion-gated, decoration-only randomness:

- **New FX systems:** `components/fx/PixelBurst.tsx` — a `window` event-driven pixel-particle layer (`intlabs:burst` with normalized {x,y}); `components/fx/DustMotes.tsx` — ambient drifting/twinkling specks in the studio light (pure CSS, no rAF).
- **The hero notebook is ALIVE:** idle bob (5.2s) with a breathing ground shadow in step, **leans toward the cursor** (spring motion-values, fine pointers only), and **click it for a squash-and-stretch "pat"** + pop sfx + burst.
- **Juiced moments:** add-on **drops burst at the landing point** (+pop; fail plays fail); **adding a notebook** bursts centre-canvas; **drawer open/close** whooshes; KPI pill values **tick-pop** on change (keyed spring); the position counter **rolls like an odometer** in the chevron direction; the title plate name **slides in** when switching notebooks.
- **Micro-delights:** dock tiles **wiggle** on hover; folder tabs press-squish and their sticky notes tilt further on hover; stats paper sheets **lift + straighten under the cursor**; shelf books **brighten** on hover; toggles/page tabs got tactile press states.
- **Bug found & fixed by the drag test:** closing the drawer on dragStart (round 9) unmounted the drag source → **dnd-kit silently cancelled every drag-out** since. Now the drawer goes **stealth** (mounted, faded, pointer-events-none — new `Drawer.stealth` prop) during the drag, restores on cancel, and closes for real on a successful drop. Verified: 12-particle burst at the drop point, add-on placed (1/3), zero page errors.

Production build green.

## 17. Juice round 2 (2026-07-02)

- **First impressions:** StartScreen — slow Ken-Burns drift on the desk backdrop, arcade-overshoot title slam, LP chips lift on hover, primary CTA breathes ("come press me"). RouteChoiceScreen — the two funding cards deal onto the table staggered, then lift + tilt toward you on hover.
- **Easter egg:** pat the notebook 3 times → Amelia reacts ("the notebook officially likes you…", once per session via pushMascot id-dedupe). Verified live.
- **Micro:** Items drawer cards fade-stagger in (opacity-only — transforms would override the CSS hover-lift); the shelf's ACTIVE book gets a breathing primary ring; chevron cycling whooshes (movement, not a click); the redundant Details dock tile removed earlier this round (top-right button remains the single entry).

All reduced-motion-gated. Production build green, zero page errors in the live run.

## 18. Juice round 3 (2026-07-02)

- **The phase-run payoff:** the sequence modal's flat 0.7s "Simulating…" spinner became a 1.6s SHOW (`SimulatingShow` + new `components/fx/CoinRain.tsx`): the **day counter races like an odometer** (eased, with soft day-tick sounds), **gold pixel coins rain** through the panel, and the whole rig **rumbles like a machine at work** — then the engine applies in one go, exactly as before (presentation-only; `advanceDay` untouched).
- **Amelia reacts live** (`components/mascot/AmeliaReactions.tsx`, mounted by SimulationScreen — a render-null watcher): fit crossing **70%** → she celebrates the match; add-ons hitting **3/3** → "fully decked out" cost/charm coaching; price passing **1.7× the segment anchor** → a bold-pricing tease. One-shot per notebook per session (ids embed the line id; pushMascot de-dupes), silent while the phase sequence is active.

Verified E2E via Playwright: maxing add-ons fired the reaction; confirming the phase showed 26 coins mid-rain with the odometer at Day 23/30; zero page errors. Production build green.

## 19. Product tweaks + final closeout (2026-07-02)

- **"Buy Raw Materials" hidden** (user direction) behind `SHOW_BUY_RAW = false` in `InventoryPanel` — slider + confirm flow + `buyRawMaterials` stay fully wired; flip the flag to restore. ⚠️ Gameplay note: this was the only manual raw-material purchase; production stalls once starting raw (4u) runs out until it returns or an auto-buy mechanic replaces it.
- **Crash guard**: `InventoryPanel`'s `calcUnitCost` selector guarded for the empty portfolio (same class as the earlier white-screen fixes).
- **Till chord**: the simulate odometer now rings a `coin` chord the moment the day count lands — completing the tick-tick-tick → *cha-ching* arc.
- Redundant **Details dock tile removed** (top-right Details button is the single entry).
- Session committed on branch **V2** (local only — pushing/merging to `main` stays with Rido; Vercel deploys from `main`).

## 20. New-art wishlist (placeholders first; request after each phase)
- ~~Business file-folder / sticky-note tab texture (Phase 5).~~ SKIPPED — the CSS pastel folder tabs were approved as-is in round §12/§13.
- ~~Trophy / rank medal / celebration ribbon set (Phase 6).~~ DONE — see §21.
- ~~Optional refined wood-shelf backdrop for the gallery (Phase 3).~~ SKIPPED — CSS wood grain approved as-is.
- Everything else uses existing art.

## 21. House-style pixel icons (executed 2026-07-02, zero credits)

Instead of generating new art, the needed glyphs were **cropped straight out of
`assets/img/master-style/icon-style-reference_v01.png`** with PIL (corner
flood-fill → transparent bg, so enclosed whites like the info "i" survive),
saved to `assets/img/ui/pixel-icons/` and registered as **`A.ui.pixel`** in
`src/assets.ts`. Render with `style={{ imageRendering: 'pixelated' }}`.

| Asset | Wired into |
|---|---|
| `arrow_left` / `arrow_right` | NotebookCanvas bottom-center chevron cluster (replaced lucide ChevronLeft/Right; nudge ±2px on hover) |
| `notebook_focus` / `grid_shelf` | ViewToggle Focus/Shelf (replaced lucide Book/LayoutGrid; inactive = 60% opacity + slight grayscale) |
| `info` | Details buttons in NotebookCanvas + NotebookGallery view-control cards (replaced PixelIcon "info") |
| `trophy` | FinalResultsScreen — sits beside the "Final score" eyebrow |
| `star` | RankBadge — pops onto the stamp corner for **S** rank (spring, +0.32s after slam) |
| `sparkles` | RankBadge — same slot for **A** rank |
| `gift` | registered, unwired (reward/celebration spare) |

Bug found & fixed while E2E-ing this round (first scripted run to reach day 90):
`FinalResultsScreen` / `EvaluationScreen` roots were `z-30`, **below** the V2
floating chrome (EdgeDock z-50, page tabs z-40) — the dock and Product/Business
pill bled over the results screen. Both raised to `z-[60]` (still under
ScreenTransition z-100, Toast z-120, VN overlay z-9999).

## 22. Juice round 4 — "money talks" (reward feedback, 2026-07-02)

Theme: resource changes were silent/directionless; now every delta answers
"did that help me?" at a glance. All UI-only; engine untouched.

- **Delta ghosts** (`.stat-ghost` in index.css + `Chip` in TopHUD): any Cash or
  Energy change spawns a floating "+$120" (green, drifts up) or "−$45"
  (red, sinks below). Energy spends sink in **amber** (`ghostDownClass`) — an
  expected cost, not a failure; gains (+15 refill at phase rollover) are green.
  Capped at 3 concurrent; removal timers deliberately live OUTSIDE the change
  effect's cleanup (re-renders re-arm the effect and would cancel them —
  first E2E run leaked invisible ghosts until this was restructured).
- **Cash tone bug fixed**: the desktop Cash chip hardcoded `tone="neutral"` —
  negative cash rendered calm. Now `tone={cashTone}` (danger < 0, warning
  < $200) like the compact chip always did.
- **Danger heartbeat** (`.anim-heartbeat`): slow red box-shadow exhale on the
  Energy chip at 0 energy and the Cash chip when cash < 0.
- **Fit milestone ping** (`.anim-ping-success` + CanvasStatusStrip): the moment
  the active line's fit crosses **70% upward**, the Fit pill fires an expanding
  green ring (box-shadow only — text never fades) + `chime` sfx. Tracked per
  line; switching notebooks can't fire it. Complements Amelia's fit reaction.
- The two hidden ghost duplicates in E2E logs are the mounted-but-`sm:hidden`
  compact Cash chip — display:none at desktop, so only one renders visually.

Verified: tsc + prod build green; scripted phase-1 run logged ghosts live —
`+$46` (event cash), `−3`/`−5` (event energy costs), `−$400` (rush-production
choice), `+15` (rollover refill, undimmed) — zero console errors. Fit-ping is
code-verified only (blind E2E choices never crossed 70% fit).

## 23. Add-on sibling swap — ported from main line (9e197e6)

The pre-V2 main line let players pick a sibling add-on in an occupied
category and have it swap in directly (Cat Charm placed → click Penguin
Charm → swapped) instead of a blocked tile + "already have this category"
toast. The V2 rewrite of ProductPanel/ProductPage lost this; re-implemented:

- `AddOnGallery.toggleAddOn` + `ProductPage.onDragEnd` evict the placed
  same-category instance before `placeAddOn` (the engine keeps its strict
  same-category rejection — call sites own the swap, engine invariants hold).
- `AddOnTile`: `catLocked` no longer disables click or drag; only the hard
  3-cap does. Sibling tiles get an **info "swap" badge** (was warn "cat") and
  a "click to swap your current <category>" tooltip.
- At 3/3 every unplaced tile is disabled + retitled "3 add-ons already
  placed" — cap behavior unchanged.

E2E (Playwright, dev server): Bear placed → Cat click-swaps → Penguin
drag-swaps onto the canvas (count pinned at 1/3 through the chain) → two more
categories to 3/3 → capped tiles disabled, force-click changes nothing. Zero
console errors; tsc + prod build green.

## 24. Engine: just-in-time raw auto-buy (fixes hidden-panel starvation)

Hiding the Buy Raw Materials panel (§ hidden-flags) had left production able
to STARVE: a new game starts with 4 raw units total, production is hard-gated
per line by `line.inventory.raw`, and the only remaining raw sources were one
upgrade (+20) and lucky event choices. A player missing both produced ~4 units
in 90 days ("Stockouts left demand on the table", 12/100 in the blind E2E).

Fix — dayTick step **4b** (`simulationEngine.ts`, between demand roll and
production planning): each line tops up raw to cover TODAY'S build target,
cash-gated (partial buys when short — production throttles with a cash crunch
instead of silently stalling). Costs flow through the existing `buy_raw`
ledger cause (cash out at purchase; material COGS stays a sale-time P&L
entry — no double cash-hit), no history entries (auto-buys aren't decisions),
no RNG (determinism preserved). Event `rawAdd` and `supplier_bulk` +20 now
simply reduce what needs buying. The hidden panel, if ever restored, becomes
optional manual STOCKPILING (e.g. ahead of a surge).

Verified via exported run JSON from a scripted 90-day run: 233 buy_raw
entries / $696.50 spend, **268 units sold** (previously single digits),
final cash $2,523 (finite, positive), score 48/100 B vs 12/100 C with the
same blind play; zero console errors; tsc + prod build green.
