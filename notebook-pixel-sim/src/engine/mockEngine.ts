// Engine entry point — kept as `mockEngine.ts` to avoid renaming every
// import across the UI. Real implementation lives in dedicated modules:
//
//   demand.ts            — per-line × per-segment demand with cannibalization
//   cost.ts              — per-line cost / time / price; portfolio aggregates
//   production.ts        — shared-capacity allocation across product lines
//   simulationEngine.ts  — day-tick orchestrator (per-line loop)
//   modifiers.ts         — global event modifier aggregation
//   cashflow.ts          — DSO/DPO scheduling
//   eventEffects.ts      — event:option → modifier + immediate effects
//   insightGenerator.ts  — phase-end insight question
//   scoring.ts           — final score rubric
//   selectors.ts         — pure UI projections from state
//   validation.ts        — clamp / finite / safeDiv guards
//
// This file owns:
//   - Re-exports of the public API
//   - Decision mutators including LINE-MANAGEMENT mutators (add / dup /
//     delete / activate / rename / setQuantityTarget)
//   - Event resolution

import type { GameState } from '@/state/store';
import { DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import { CHANNELS } from '@/data/channels';
import { ADDONS } from '@/data/addOns';
import { eventForDay } from '@/data/events';
import {
  HIRE_CAPACITY_GAIN,
  TOOL_CAPACITY_GAIN,
  PROCESS_DEFECT_REDUCTION,
  MAX_DEFECT_RATE,
  BRAND_MAX,
  BRAND_MIN,
} from './config';
import {
  scenarioById as finlitScenarioById,
  GENRES,
} from '@/data/finlit';
import { clamp, phaseOf } from '@/utils/format';
import type {
  LedgerEntry, Segment, ProductLine, Archetype, AddOnInstance,
  FinlitGenreId, FinlitProductionSpec,
} from '@/types';
import { hireStep } from '@/engine/finlit/core/config/hiring';
import { vendorStep } from '@/engine/finlit/core/config/vendors';
import type { GlobalInputItemDto } from '@/gamesim/types';
import type { ChannelId } from '@/engine/finlit/core/config';
import { resolveEventOption } from './eventEffects';
import { calcRawPurchaseUnitCostForLine, getActiveLine, getLineOrThrow } from './cost';
import { finite } from './validation';
import { makeModifierId } from './modifiers';
import { defaultPlacementFor, PLACEMENT_BOUNDS } from '@/data/addOnDefaults';

// ---- Public engine API (re-exports) -------------------------------------
export {
  calcUnitCost,
  calcUnitCostForLine,
  calcUnitTime,
  calcUnitTimeForLine,
  calcEffectivePrice,
  calcEffectivePriceForLine,
  currentAddOns,
  currentAddOnsForLine,
  getActiveLine,
  getLineOrThrow,
  portfolioAvgUnitCost,
} from './cost';
export { calcCapacityToday, calcDefectRate, planProduction, dailyTargetForLine } from './production';
export {
  calcComplexityScore,
  calcComplexityThreshold,
  calcComplexityPenalty,
  calcComplexityLevel,
  selectComplexity,
  MAX_LINES_HARD_CAP,
  type ComplexityState,
  type ComplexityLevel,
} from './complexity';
export {
  calcSegmentFit,
  calcSegmentFitForLine,
  calcDemandToday,
  calcDemandTodayForLine,
  cannibalizationFactor,
  countLinesByTargetSegment,
} from './demand';
export { dayTick, advanceDay } from './simulationEngine';
export { computeFinalScore, type FinalScore } from './scoring';
export { generateInsightQuestion } from './insightGenerator';
// V3 (FinLit) — the store-facing phase runner. Simulates the current phase with
// the FinLit engine and writes results into ledger/series/inventory/cash.
export { runFinlitPhase, advanceFinlitPhase, previewFinlitPhase } from './finlit/storeRun';

// ---- Notebook count cap -------------------------------------------------
//
// The simulation no longer hard-caps how many notebook lines a player
// can run per phase. Phase used to gate slots (P1=3, P2=5, P3=8); that
// approach was wrong for the intended gameplay because it implied
// "Phase 1 forbids more than 3 notebooks" — but the real intent is
// "more notebooks make operations harder", not blocking.
//
// What replaced it:
//   • A soft sanity ceiling (`MAX_LINES_HARD_CAP = 20`) so the array
//     can't grow unbounded from runaway loops or button-mashing.
//   • A complexity score (engine/complexity.ts) that ratchets a
//     penalty into capacity and defect rate as the portfolio grows
//     beyond what current operations can comfortably handle.
//   • UI that surfaces complexity status instead of a hard cap.
//
// `MAX_LINES_BY_PHASE` is kept in shape for backward compat (UI calls
// `lineCapForCurrentPhase` to read it) but every phase returns the
// same hard ceiling now.

export const MAX_LINES_BY_PHASE: Record<1 | 2 | 3, number> = { 1: 20, 2: 20, 3: 20 };

export const lineCapForCurrentPhase = (s: GameState): number =>
  MAX_LINES_BY_PHASE[phaseOf(s.meta.day)];

export const canAddProductLine = (s: GameState): boolean =>
  s.portfolio.productLines.length < lineCapForCurrentPhase(s);

// ---- Line management mutators -------------------------------------------

const newLineId = () => 'line-' + Math.random().toString(36).slice(2, 8);

/**
 * Default human-readable label for a notebook. Reads the live catalogue, so a
 * notebook published by an operator names itself correctly with no code change.
 * Unknown ids fall back to the raw id rather than throwing — naming is cosmetic
 * and must never be the thing that breaks a load.
 */
export const archetypeLabel = (archetype: Archetype): string =>
  GENRES.find((g) => g.id === archetype)?.name ?? archetype;

/**
 * Pick the next available name for a new notebook of the given archetype:
 *   first one  → "Student"
 *   second one → "Student-2"
 *   third one  → "Student-3"
 * Skips suffixes already taken by other lines.
 */
export const nextNameForArchetype = (s: GameState, archetype: Archetype): string => {
  const base = archetypeLabel(archetype);
  const taken = new Set(s.portfolio.productLines.map((l) => l.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/** The notebook a new line makes when the caller doesn't name one. */
export const defaultNotebookId = (): Archetype => GENRES[0].id;

/**
 * The add-on list for a line's current notebook, created on first use.
 *
 * Notebook ids are open-ended now, so a line can be switched to an id that has
 * no list yet — including one an operator published after the save was written.
 * Every read and write goes through here so that case is a no-op rather than a
 * crash on `undefined.push`.
 */
export const addOnsForLine = (line: ProductLine): AddOnInstance[] => {
  const key = line.archetype;
  let list = line.addOnsByArchetype[key];
  if (!list) {
    list = [];
    line.addOnsByArchetype[key] = list;
  }
  return list;
};

const defaultLine = (id: string, name: string, archetype: Archetype = defaultNotebookId()): ProductLine => {
  // Identity and market are the same thing now, so there is nothing to map.
  const genre = archetype;
  return {
    id,
    name,
    isCustomName: false,
    archetype,
    cover: 'hardcover',
    binding: 'ring',
    size: 'm',
    paperQuality: 'standard',
    pricePoint: 'balanced',
    price: 16,
    // Seeded for this notebook only; other ids get a list when first used.
    addOnsByArchetype: { [archetype]: [] },
    quantityTarget: 30,
    targetSegment: segmentForGenre(genre),
    inventory: { raw: 0, finished: 0, stockoutDays: 0, overstockDays: 0, producedToday: 0 },
    // V3 defaults — a valid market + a lean/cheap spec.
    genre,
    finlitSpec: { type: genre, paper: 'recycled', size: 'b5', pageDesign: 'blank', addon: 'bookmark', cover: 'plastic' },
  };
};

/**
 * Add a new notebook item. Respects phase cap.
 *
 * Auto-names based on archetype: "Student" / "Student-2" / "Student-3", etc.
 * In Phase 1 the new item inherits the shared global target segment.
 */
export const addProductLine = (s: GameState, archetype: Archetype = defaultNotebookId()): string | null => {
  if (!canAddProductLine(s)) return null;
  const id = newLineId();
  const name = nextNameForArchetype(s, archetype);
  const line = defaultLine(id, name, archetype);
  if (phaseOf(s.meta.day) === 1) line.targetSegment = s.market.targetSegment;
  s.portfolio.productLines.push(line);
  s.market.fitBySegmentByLineId[id] = { students: 0.5, creators: 0.4, professionals: 0.4, gift: 0.4 };
  // If portfolio was empty, this is now the active item.
  if (!s.portfolio.activeLineId) s.portfolio.activeLineId = id;
  s.history.push({ day: s.meta.day, text: `Added notebook: ${line.name}`, cause: 'line_add' });
  return id;
};

/** Duplicate an existing line (same design, fresh inventory and id). */
export const duplicateProductLine = (s: GameState, sourceId: string): string | null => {
  if (!canAddProductLine(s)) return null;
  const src = s.portfolio.productLines.find((l) => l.id === sourceId);
  if (!src) return null;
  const id = newLineId();
  const copy: ProductLine = {
    ...src,
    id,
    name: `${src.name} (copy)`,
    // Copy whatever notebooks this line actually has lists for — the set is
    // open-ended, so enumerating ids here would silently drop the rest.
    addOnsByArchetype: Object.fromEntries(
      Object.entries(src.addOnsByArchetype).map(([k, list]) => [
        k,
        (list ?? []).map((a) => ({ ...a, id: 'inst-' + Math.random().toString(36).slice(2, 8) })),
      ]),
    ),
    inventory: { raw: 0, finished: 0, stockoutDays: 0, overstockDays: 0, producedToday: 0 },
  };
  s.portfolio.productLines.push(copy);
  s.market.fitBySegmentByLineId[id] = { ...(s.market.fitBySegmentByLineId[sourceId] ?? { students: 0.5, creators: 0.4, professionals: 0.4, gift: 0.4 }) };
  s.history.push({ day: s.meta.day, text: `Duplicated line: ${src.name} → ${copy.name}`, cause: 'line_duplicate' });
  return id;
};

/**
 * Remove a notebook item. Permitted to delete the last one — the UI will
 * surface an empty state and block phase confirmation until the player
 * adds a new notebook.
 */
export const removeProductLine = (s: GameState, lineId: string): boolean => {
  const idx = s.portfolio.productLines.findIndex((l) => l.id === lineId);
  if (idx < 0) return false;
  const removed = s.portfolio.productLines[idx];
  s.portfolio.productLines.splice(idx, 1);
  delete s.market.fitBySegmentByLineId[lineId];
  if (s.portfolio.activeLineId === lineId) {
    s.portfolio.activeLineId = s.portfolio.productLines[0]?.id ?? '';
  }
  s.history.push({ day: s.meta.day, text: `Removed notebook: ${removed.name}`, cause: 'line_remove' });
  return true;
};

export const setActiveLine = (s: GameState, lineId: string) => {
  if (s.portfolio.productLines.find((l) => l.id === lineId)) {
    s.portfolio.activeLineId = lineId;
  }
};

export const renameProductLine = (s: GameState, lineId: string, name: string) => {
  const line = s.portfolio.productLines.find((l) => l.id === lineId);
  if (!line) return false;
  line.name = name.slice(0, 40);
  // Any explicit rename pins the name — archetype changes won't overwrite it.
  line.isCustomName = true;
  return true;
};

export const setLineQuantityTarget = (s: GameState, lineId: string, qty: number) => {
  const line = s.portfolio.productLines.find((l) => l.id === lineId);
  if (!line) return false;
  line.quantityTarget = clamp(Math.round(finite(qty, line.quantityTarget)), 0, 999);
  s.history.push({ day: s.meta.day, text: `Line "${line.name}" quantity → ${line.quantityTarget}`, cause: 'line_qty' });
  return true;
};

// ---- Line-scoped product mutators (the rest take a lineId) -------------

/**
 * Place an add-on on a specific line's current archetype.
 * Rules: max 3 add-ons per archetype; one add-on per category.
 *
 * `lineId` defaults to the active line so legacy single-product callers
 * keep working.
 */
/**
 * Place an add-on. If `placement` is supplied (e.g. from a drag-drop
 * coordinate calculation), use that as the starting position; otherwise
 * fall back to the category default. Either way, values pass through
 * the engine's bounds clamp so the add-on can never land off-canvas.
 */
export const placeAddOn = (
  s: GameState,
  defId: string,
  lineId?: string,
  placement?: { x?: number; y?: number; scale?: number },
) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const list = addOnsForLine(line);
  if (list.length >= 3) return false;
  const cat = ADDONS.find((a) => a.id === defId)?.category;
  if (!cat) return false;
  if (list.find((a) => ADDONS.find((x) => x.id === a.defId)?.category === cat)) return false;
  const def = defaultPlacementFor(cat);
  const x = placement?.x !== undefined
    ? clamp(finite(placement.x, def.x), PLACEMENT_BOUNDS.xMin, PLACEMENT_BOUNDS.xMax)
    : def.x;
  const y = placement?.y !== undefined
    ? clamp(finite(placement.y, def.y), PLACEMENT_BOUNDS.yMin, PLACEMENT_BOUNDS.yMax)
    : def.y;
  const scale = placement?.scale !== undefined
    ? clamp(finite(placement.scale, def.scale), PLACEMENT_BOUNDS.scaleMin, PLACEMENT_BOUNDS.scaleMax)
    : def.scale;
  list.push({
    id: 'inst-' + Math.random().toString(36).slice(2, 8),
    defId,
    placedAt: s.meta.day,
    x,
    y,
    scale,
    rotation: def.rotation ?? 0,
    zIndex: def.zIndex,
  });
  s.history.push({ day: s.meta.day, text: `Added add-on (${line.name}/${line.archetype}): ${defId}`, cause: 'addon_' + defId });
  return true;
};

/**
 * Update the placement (position / scale / rotation / z) of one add-on
 * instance on a specific line. Called by the free-drag canvas editor.
 *
 * Values are clamped to PLACEMENT_BOUNDS so a runaway drag/resize can't
 * push the sprite off-canvas.
 */
export const updateAddOnPlacement = (
  s: GameState,
  instId: string,
  patch: Partial<{ x: number; y: number; scale: number; rotation: number; zIndex: number }>,
  lineId?: string,
) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const inst = addOnsForLine(line).find((a) => a.id === instId);
  if (!inst) return false;
  if (patch.x !== undefined) inst.x = clamp(finite(patch.x, inst.x), PLACEMENT_BOUNDS.xMin, PLACEMENT_BOUNDS.xMax);
  if (patch.y !== undefined) inst.y = clamp(finite(patch.y, inst.y), PLACEMENT_BOUNDS.yMin, PLACEMENT_BOUNDS.yMax);
  if (patch.scale !== undefined) inst.scale = clamp(finite(patch.scale, inst.scale), PLACEMENT_BOUNDS.scaleMin, PLACEMENT_BOUNDS.scaleMax);
  if (patch.rotation !== undefined) inst.rotation = finite(patch.rotation, inst.rotation ?? 0);
  if (patch.zIndex !== undefined) inst.zIndex = clamp(Math.round(finite(patch.zIndex, inst.zIndex)), 1, 9);
  return true;
};

/** Reset an add-on's placement back to its category default. */
export const resetAddOnPlacement = (s: GameState, instId: string, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const inst = addOnsForLine(line).find((a) => a.id === instId);
  if (!inst) return false;
  const def = ADDONS.find((a) => a.id === inst.defId);
  const place = defaultPlacementFor(def?.category);
  inst.x = place.x;
  inst.y = place.y;
  inst.scale = place.scale;
  inst.rotation = place.rotation ?? 0;
  inst.zIndex = place.zIndex;
  return true;
};

export const removeAddOn = (s: GameState, instId: string, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.addOnsByArchetype[line.archetype] = addOnsForLine(line).filter((a) => a.id !== instId);
  s.history.push({ day: s.meta.day, text: `Removed add-on (${line.name})`, cause: 'addon_remove' });
};

/**
 * Set a product field on a specific line. `lineId` defaults to active.
 *
 * Special-case: when changing `archetype`, if the line's name has NOT
 * been customized by the player, regenerate the name from the new
 * archetype's default (e.g. "Student" → "Planner"). If the player has
 * already renamed the line, the custom name is preserved.
 */
export const setProductField = <K extends keyof ProductLine>(
  s: GameState,
  k: K,
  v: ProductLine[K],
  lineId?: string,
) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  (line as any)[k] = v;
  if (k === 'archetype' && !line.isCustomName) {
    // Pick the next available default name for the new archetype, but
    // exclude THIS line's current name from the "taken" set so we don't
    // append a needless suffix when the line is being renamed in-place.
    const others = s.portfolio.productLines.filter((l) => l.id !== line.id);
    const taken = new Set(others.map((l) => l.name));
    const base = archetypeLabel(v as Archetype);
    let name = base;
    let n = 2;
    while (taken.has(name)) { name = `${base}-${n}`; n++; }
    line.name = name;
  }
  s.history.push({ day: s.meta.day, text: `Changed ${line.name} ${String(k)} → ${String(v)}`, cause: 'product_' + String(k) });
};

/**
 * Set the target segment.
 *
 * In Phase 1, all lines share the global target — this mutator updates the
 * global value AND propagates to every line. In Phase 2+ it can be scoped
 * to a single line via `lineId`.
 */
export const setSegment = (s: GameState, seg: Segment, lineId?: string) => {
  const phase = phaseOf(s.meta.day);
  if (phase === 1 || !lineId) {
    // Global: every line shares the same target.
    s.market.targetSegment = seg;
    for (const l of s.portfolio.productLines) l.targetSegment = seg;
    s.history.push({ day: s.meta.day, text: `Targeted segment: ${seg} (all lines)`, cause: 'segment_' + seg });
    return;
  }
  // Per line (P2+): just this line.
  const line = getLineOrThrow(s, lineId);
  line.targetSegment = seg;
  s.market.targetSegment = seg; // keep "lead" target in sync
  s.history.push({ day: s.meta.day, text: `${line.name} → segment ${seg}`, cause: 'segment_' + seg });
};

/** Set price on a line. `lineId` defaults to active. */
export const setPrice = (s: GameState, n: number, lineId?: string) => {
  console.log('[decision] setPrice', n);
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.price = clamp(finite(n, line.price), 1, 30);
  s.history.push({ day: s.meta.day, text: `${line.name} price $${line.price}`, cause: 'price' });
};

// ── V3 (FinLit) decision mutators ─────────────────────────────────────────
// Set the FinLit fields on a line (genre/spec/channels/target) and the company
// decision slice (hire/marketing). All route through apply() like the rest.

// Genre → legacy segment, so choosing a V3 market also clears the V2
// "pick a target audience" phase-gate until that gate is migrated to genres.
// Re-exported from the config module, which is where `src/data/` reads it
// without importing this facade (that would be circular).
export { GENRE_TO_SEGMENT } from './finlit/core/config/genreSegments';
import { segmentForGenre } from './finlit/core/config/genreSegments';

/**
 * Set the notebook a line makes. `genre` is the identity, and `archetype`
 * mirrors it so the two never disagree — see the note on ProductLine.
 */
export const setLineGenre = (s: GameState, genre: FinlitGenreId, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.genre = genre;
  line.archetype = genre;
  // Bridge to the legacy target so the phase-confirm gate is satisfied.
  const seg = segmentForGenre(genre);
  line.targetSegment = seg;
  s.market.targetSegment = seg;
  s.history.push({ day: s.meta.day, text: `${line.name} → ${genre} market`, cause: 'finlit_genre' });
};

/** Set one axis of a line's production spec (type/paper/size/pageDesign/addon/cover). */
export const setFinlitAxis = (
  s: GameState,
  axis: keyof FinlitProductionSpec,
  optionId: string,
  lineId?: string,
) => {
  console.log('[decision] setFinlitAxis', axis, '→', optionId);
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.finlitSpec = { ...(line.finlitSpec ?? {}), [axis]: optionId };
  s.history.push({ day: s.meta.day, text: `${line.name} ${axis} → ${optionId}`, cause: 'finlit_spec' });
};

/** Activate or update a GlobalInput selection. energyDelta > 0 = spend, < 0 = refund.
 *  Returns false (and toasts) if the player can't afford the spend. */
export const setGlobalInputSelection = (
  s: GameState,
  key: string,
  selectedStepKey: string | null,
  energyDelta = 0,
): boolean => {
  console.log('[decision] setGlobalInputSelection', key, '→', selectedStepKey);
  if (energyDelta !== 0 && !applyEnergyDelta(s, energyDelta, key)) return false;
  const idx = s.globalInputSelections.findIndex((sel) => sel.key === key);
  if (idx >= 0) {
    s.globalInputSelections[idx].selectedStepKey = selectedStepKey;
  } else {
    s.globalInputSelections.push({ key, selectedStepKey });
  }
  s.history.push({ day: s.meta.day, text: `${key} → ${selectedStepKey ?? 'on'}`, cause: 'global_input' });
  return true;
};

/** Clear a GlobalInput selection and optionally refund its energy. */
export const clearGlobalInputSelection = (s: GameState, key: string, energyRefund = 0): void => {
  const idx = s.globalInputSelections.findIndex((sel) => sel.key === key);
  if (idx < 0) return;
  s.globalInputSelections.splice(idx, 1);
  if (energyRefund > 0) {
    s.player.energy = clamp(s.player.energy + energyRefund, 0, s.player.maxEnergy);
  }
  s.history.push({ day: s.meta.day, text: `${key} cleared`, cause: 'global_input' });
};

/**
 * Name (or rename) the player's shop. Called when founding the business on the
 * route screen and from the rename affordances in-run. Trims, caps the length,
 * and falls back to the default so the shop is never nameless. A no-op rename
 * doesn't get a history entry.
 */
export const setShopName = (s: GameState, name: string) => {
  const next = (name ?? '').trim().slice(0, MAX_SHOP_NAME) || DEFAULT_SHOP_NAME;
  if (next === s.meta.shopName) return;
  const prev = s.meta.shopName;
  s.meta.shopName = next;
  s.history.push({ day: s.meta.day, text: `Shop renamed: ${prev} → ${next}`, cause: 'shop_name' });
};

/** Set the line's per-PHASE production target (LP2 lever). Undefined = full
 *  capacity. Units match the server's `inventoryQty`, which is what bounds it. */
export const setLineTargetPerPhase = (s: GameState, units: number | undefined, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.targetPerPhase = units === undefined ? undefined : clamp(finite(units, 0), 0, 100000);
  s.history.push({ day: s.meta.day, text: `${line.name} production target ${units ?? 'max'}`, cause: 'finlit_target' });
};

// `setLineVendor` is gone with `ProductLine.vendor`: a vendor is a company-wide
// globalInput selection, not a property of a notebook. See engageFinlitVendor.

// ── Energy-gated "engage" decisions ────────────────────────────────────────
// Each key decision spends ENERGY (the scarce per-phase resource). Decisions
// are fully REVERSIBLE: engaging spends only the DELTA vs the current
// commitment, and clearing refunds it.

/** Apply an energy delta (spend when +, refund when −). Refunds cap at
 *  maxEnergy; a spend that can't be afforded toasts and returns false. */
function applyEnergyDelta(s: GameState, delta: number, label: string): boolean {
  if (delta > 0 && s.player.energy < delta) {
    s.toast = { id: 'energy-short', kind: 'warning', text: `Not enough energy for ${label} (need ${delta})`, until: Date.now() + 1800 };
    return false;
  }
  s.player.energy = clamp(s.player.energy - delta, 0, s.player.maxEnergy);
  return true;
}

/**
 * Resolve a key scenario option — spends energy, folds the option's demand/sell
 * multipliers into the phase decisions (applied to the coming phase, then reset
 * by advanceFinlitPhase), and applies any immediate cash effect.
 */
export const resolveFinlitScenario = (s: GameState, scenarioId: string, optId: 'A' | 'B' | 'C' | 'D'): boolean => {
  const sc = finlitScenarioById(scenarioId);
  if (!sc) return false;
  const opt = sc.options.find((o) => o.id === optId);
  if (!opt) return false;
  if (!applyEnergyDelta(s, opt.energy, sc.title)) return false;
  s.finlit.demandMult *= opt.demandMult ?? 1;
  s.finlit.sellMult *= opt.sellMult ?? 1;
  if (opt.cashNow) s.player.cash += opt.cashNow;
  if (!s.finlit.resolvedScenarios.includes(scenarioId)) s.finlit.resolvedScenarios.push(scenarioId);
  s.history.push({ day: s.meta.day, text: `Scenario "${sc.title}" - ${optId}: ${opt.label}`, cause: 'finlit_scenario' });
  return true;
};

/** Engage a shipping vendor for a line (spends the vendor's phase energy). */
/**
 * Engage a supply-chain vendor. COMPANY-WIDE, like every other global input:
 * one selection for the business, not one per line. `productsImpacted` on the
 * item decides which products actually receive the bonus, and the server already
 * enforces that when it filters globalInputs per product.
 *
 * This used to write `line.vendor` on a ProductLine, which meant a vendor
 * decision never became a globalInputSelection and so NEVER REACHED THE SERVER
 * at all — the supply-chain lever had no effect on any official number.
 */
export const engageFinlitVendor = (
  s: GameState,
  item: GlobalInputItemDto,
  stepKey: string | null = null,
  maxSelections = 1,
): boolean => {
  const step = vendorStep(item, stepKey);
  if (!step) return false;
  const itemId = String(item._id);
  const active = s.globalInputSelections.filter((sel) => sel.key === 'supply_chain');
  const existing = active.find((sel) => sel.inputId === itemId);
  if (!existing && active.length >= maxSelections) {
    // At the cap and this is a NEW vendor: swap the oldest out rather than
    // silently refusing, since the cap is usually 1 and the player is choosing.
    const outgoing = active[0];
    const outgoingItem = s.availableGlobalInputs
      .find((g) => g.key === 'supply_chain')
      ?.inputs.find((i) => String(i._id) === outgoing.inputId);
    const refund = outgoingItem
      ? vendorStep(outgoingItem, outgoing.selectedStepKey ?? null)?.energy ?? 0
      : 0;
    s.player.energy = clamp(s.player.energy + refund, 0, s.player.maxEnergy);
    s.globalInputSelections = s.globalInputSelections.filter((sel) => sel !== outgoing);
  }
  const oldEnergy = existing
    ? vendorStep(item, existing.selectedStepKey ?? null)?.energy ?? 0
    : 0;
  if (!applyEnergyDelta(s, step.energy - oldEnergy, `vendor ${item.key}`)) return false;
  if (existing) {
    existing.selectedStepKey = step.stepKey;
  } else {
    s.globalInputSelections.push({
      key: 'supply_chain',
      selectedStepKey: step.stepKey,
      inputId: itemId,
    });
  }
  s.history.push({ day: s.meta.day, text: `Vendor → ${item.label}`, cause: 'finlit_vendor' });
  return true;
};

/** Un-engage a vendor and refund its energy. Pass no item to clear all. */
export const clearFinlitVendor = (s: GameState, item?: GlobalInputItemDto): void => {
  const itemId = item ? String(item._id) : null;
  const matches = (sel: { key: string; inputId?: string }) =>
    sel.key === 'supply_chain' && (itemId == null || sel.inputId === itemId);
  if (item) {
    for (const sel of s.globalInputSelections.filter(matches)) {
      const refund = vendorStep(item, sel.selectedStepKey ?? null)?.energy ?? 0;
      if (refund > 0) s.player.energy = clamp(s.player.energy + refund, 0, s.player.maxEnergy);
    }
  }
  s.globalInputSelections = s.globalInputSelections.filter((sel) => !matches(sel));
  s.history.push({ day: s.meta.day, text: `Vendor cleared: ${item?.label ?? 'all'}`, cause: 'finlit_vendor' });
};

/**
 * Buy raw materials for a specific line at that line's unit cost.
 * `lineId` defaults to the active line.
 */
export const buyRawMaterials = (s: GameState, units: number, lineId?: string) => {
  if (units <= 0) return false;
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const unitCost = calcRawPurchaseUnitCostForLine(s, line);
  const cost = units * unitCost;
  if (s.player.cash < cost) return false;
  s.player.cash -= cost;
  line.inventory.raw += units;
  s.inventory.totalRaw = s.portfolio.productLines.reduce((acc, l) => acc + l.inventory.raw, 0);
  pushLedger(s, { kind: 'inventory-purchase', amount: -cost, cause: 'buy_raw', decisionId: line.id });
  s.history.push({
    day: s.meta.day,
    text: `Bought ${units} raw for ${line.name} @ $${unitCost.toFixed(2)}/u`,
    cause: 'buy_raw',
  });
  return true;
};

/**
 * Acquire a company-wide upgrade. All upgrades are GLOBAL — they affect
 * every product line uniformly:
 *   - hire_*: company capacity
 *   - tool_*: company capacity + defect rate
 *   - process_qa: defect rate
 *   - supplier_premium: paperQuality = 'premium' on EVERY line
 *   - supplier_bulk: +20 raw added to ACTIVE line (one-shot)
 *   - finance_loan: cash +500 / debt +560
 *   - marketing_campaign: marketingPerDay +6
 *   - marketing_loyalty: +0.1 retention to every segment
 */
export const acquireUpgrade = (s: GameState, upgradeId: string, costs: { time: number; energy: number; cash: number }) => {
  if (s.player.energy < costs.energy) return false;
  if (costs.cash > 0 && s.player.cash < costs.cash) return false;
  s.player.energy -= costs.energy;
  s.player.cash -= costs.cash;
  s.upgrades.acquired.push(upgradeId);

  if (upgradeId === 'hire_helper')      { s.ops.hires += 1; s.ops.capacity += HIRE_CAPACITY_GAIN; }
  if (upgradeId === 'hire_second')      { s.ops.hires += 1; s.ops.capacity += HIRE_CAPACITY_GAIN + 1; }
  if (upgradeId === 'tool_basic')       { s.ops.tools.push('basic'); s.ops.capacity += TOOL_CAPACITY_GAIN.basic; s.ops.defectRate = clamp(s.ops.defectRate - 0.02, 0, MAX_DEFECT_RATE); }
  if (upgradeId === 'tool_pro')         { s.ops.tools.push('pro'); s.ops.capacity += TOOL_CAPACITY_GAIN.pro; s.ops.defectRate = clamp(s.ops.defectRate - 0.04, 0, MAX_DEFECT_RATE); }
  if (upgradeId === 'process_qa')       { s.ops.process.push('qa'); s.ops.defectRate = clamp(s.ops.defectRate - PROCESS_DEFECT_REDUCTION.qa, 0, MAX_DEFECT_RATE); }
  if (upgradeId === 'supplier_premium') {
    // Apply to ALL lines (D7).
    for (const l of s.portfolio.productLines) l.paperQuality = 'premium';
  }
  if (upgradeId === 'supplier_bulk')    {
    // One-shot bulk drop to active line + permanent −10% material
    // cost modifier (matches the displayed copy in upgrades.ts).
    getActiveLine(s).inventory.raw += 20;
    s.inventory.totalRaw = s.portfolio.productLines.reduce((acc, l) => acc + l.inventory.raw, 0);
    s.activeModifiers.push({
      id: makeModifierId(),
      name: 'Bulk Supplier Deal',
      cause: 'upgrade_supplier_bulk',
      startDay: s.meta.day,
      endDay: null,
      effects: { materialCostMult: 0.9 },
    });
  }
  if (upgradeId === 'finance_loan')     {
    // Cost is `-500` in upgrades.ts so line 431 (`cash -= costs.cash`)
    // already credits +500 cash. Only add the debt obligation here —
    // adding cash again would double-credit.
    s.player.debt += 560;
    pushLedger(s, { kind: 'cash-in', amount: 500, cause: 'upgrade_finance_loan' });
  }
  if (upgradeId === 'marketing_campaign') { s.channels.marketingPerDay += 6; }
  if (upgradeId === 'marketing_loyalty') {
    for (const k of Object.keys(s.market.retention) as Array<keyof typeof s.market.retention>)
      s.market.retention[k] = clamp(s.market.retention[k] + 0.1, 0, 1);
  }
  pushLedger(s, { kind: 'opex-tool', amount: -Math.max(0, costs.cash), cause: 'upgrade_' + upgradeId });
  s.history.push({ day: s.meta.day, text: `Acquired upgrade: ${upgradeId}`, cause: 'upgrade_' + upgradeId });
  return true;
};

export const toggleChannel = (s: GameState, channelId: string) => {
  const idx = s.channels.active.indexOf(channelId as any);
  const def = CHANNELS.find((c) => c.id === channelId);
  if (!def) return false;
  if (idx >= 0) {
    if (channelId === 'word_of_mouth') return false;
    s.channels.active.splice(idx, 1);
    s.channels.marketingPerDay = Math.max(0, s.channels.marketingPerDay - def.dailyCost);
  } else {
    if (s.player.energy < def.unlockEnergy) return false;
    if (s.player.cash < def.unlockCash) return false;
    s.player.energy -= def.unlockEnergy;
    s.player.cash -= def.unlockCash;
    s.channels.active.push(channelId as any);
    s.channels.marketingPerDay += def.dailyCost;
  }
  s.history.push({ day: s.meta.day, text: `Toggled channel: ${def.name}`, cause: 'channel_' + channelId });
  return true;
};

// ---- Event resolution ---------------------------------------------------
//
// Events apply to the WHOLE PORTFOLIO via the global modifier system
// (materialCostMult / demandMult / capacityMult / etc.). Immediate
// inventory effects (rawAdd, finishedAdd, inventorySell) iterate over
// every line so a "liquidate" event affects the entire portfolio.

export const applyEventChoice = (s: GameState, eventId: string, opt: 'A' | 'B' | 'C' | 'D') => {
  const ev = eventForDay(s.meta.day);
  if (!ev || ev.id !== eventId) return;
  const choice = ev.options.find((o) => o.id === opt);
  if (!choice) return;

  // Pay event option cost.
  s.player.energy = Math.max(0, s.player.energy - choice.cost.energy);
  if (choice.cost.cash) s.player.cash -= choice.cost.cash;

  const res = resolveEventOption(s, eventId, opt);
  for (const m of res.modifiers) s.activeModifiers.push(m);

  if (res.immediate.cash) s.player.cash += res.immediate.cash;
  // Raw/finished injections: split evenly across lines (or to active line if even=0)
  if (res.immediate.rawAdd) distributeRawAcrossLines(s, res.immediate.rawAdd);
  if (res.immediate.finishedAdd) distributeFinishedAcrossLines(s, res.immediate.finishedAdd);
  if (res.immediate.brandAdd) s.player.brand = clamp(s.player.brand + res.immediate.brandAdd, BRAND_MIN, BRAND_MAX);
  if (res.immediate.defectAdd !== undefined) s.ops.defectRate = clamp(s.ops.defectRate + res.immediate.defectAdd, 0, MAX_DEFECT_RATE);
  if (res.immediate.debtAdd) s.player.debt += res.immediate.debtAdd;
  if (res.immediate.priceSet !== undefined) {
    // Apply price reset to every line.
    for (const l of s.portfolio.productLines) l.price = clamp(res.immediate.priceSet, 1, 30);
  }
  if (res.immediate.inventorySell) {
    // Liquidate proportionally across all lines, at each line's price.
    const upTo = res.immediate.inventorySell.upTo;
    const mult = res.immediate.inventorySell.priceMult;
    let totalToSell = upTo;
    let totalProceeds = 0;
    for (const line of s.portfolio.productLines) {
      if (totalToSell <= 0) break;
      const sellable = Math.min(totalToSell, line.inventory.finished);
      if (sellable <= 0) continue;
      const proceeds = sellable * line.price * mult;
      line.inventory.finished -= sellable;
      totalProceeds += proceeds;
      totalToSell -= sellable;
      pushLedger(s, { kind: 'revenue', amount: proceeds, cause: 'event_' + eventId, decisionId: line.id });
    }
    s.player.cash += totalProceeds;
  }
  // Recompute aggregate inventory rollup (lines may have changed).
  s.inventory.totalRaw = s.portfolio.productLines.reduce((acc, l) => acc + l.inventory.raw, 0);
  s.inventory.totalFinished = s.portfolio.productLines.reduce((acc, l) => acc + l.inventory.finished, 0);

  s.events.resolved.push({ id: eventId, option: opt, day: s.meta.day });
  s.meta.pendingEventId = null;
  s.history.push({ day: s.meta.day, text: `Event "${ev.title}" - ${opt}: ${res.feedback}`, cause: 'event_' + eventId });
};

function distributeRawAcrossLines(s: GameState, total: number) {
  const lines = s.portfolio.productLines;
  if (lines.length === 0) return;
  const per = Math.floor(total / lines.length);
  let rem = total - per * lines.length;
  for (const line of lines) {
    let add = per;
    if (rem > 0) { add += 1; rem -= 1; }
    line.inventory.raw += add;
  }
}

function distributeFinishedAcrossLines(s: GameState, total: number) {
  const lines = s.portfolio.productLines;
  if (lines.length === 0) return;
  const per = Math.floor(total / lines.length);
  let rem = total - per * lines.length;
  for (const line of lines) {
    let add = per;
    if (rem > 0) { add += 1; rem -= 1; }
    line.inventory.finished += add;
  }
}

export const answerInsight = (s: GameState, checkId: string, _optId: 'A' | 'B' | 'C' | 'D', correct: boolean) => {
  s.insights.answered.push({ id: checkId, correct });
  s.insights.score.total += 1;
  if (correct) s.insights.score.correct += 1;
};

// ---- Helpers ------------------------------------------------------------

function pushLedger(
  s: GameState,
  e: Omit<LedgerEntry, 'id' | 'day'> & Partial<Pick<LedgerEntry, 'id' | 'day'>>,
) {
  s.ledger.push({
    id: 'l-' + Math.random().toString(36).slice(2, 9),
    day: s.meta.day,
    kind: e.kind,
    amount: finite(e.amount, 0),
    cause: e.cause,
    decisionId: e.decisionId,
  });
}

import { computeFinalScore } from './scoring';
// ── V3 FinLit company decisions → globalInputSelections ──────────────────
// Replaces s.finlit.hire / marketingBudget / salesBudget (removed in v13).
// All decisions write to globalInputSelections so the local preview engine
// and the gamesim backend share the same source of truth.

const CHANNEL_ENERGY = 12; // matches globalInputs MongoDB (channel.inputs[*].energy)

/** Engage or upgrade a hiring candidate. Spends only the energy delta vs the
 *  current level so upgrading costs the difference, not the full new amount.
 *  Pass maxSelections from the hydrated availableGlobalInputs at the call site. */
/**
 * Engage or re-level a hiring item. Takes the BACKEND item and one of its own
 * `options` keys — never a frontend-invented candidate id, which the server
 * cannot resolve and scores as unselected (dropping every impact on it).
 *
 * One selection per backend item, identified by `inputId` (`item._id`), so a
 * re-level updates in place and the payload carries every hire rather than
 * collapsing them.
 */
export const engageFinlitHire = (
  s: GameState,
  item: GlobalInputItemDto,
  stepKey: string,
  maxSelections = 3,
): boolean => {
  console.log('[decision] engageFinlitHire', item.key, '→ step', stepKey);
  const step = hireStep(item, stepKey);
  if (!step) return false; // not a configured option on this item
  const itemId = String(item._id);
  const activeHires = s.globalInputSelections.filter((sel) => sel.key === 'hiring');
  const existing = activeHires.find((sel) => sel.inputId === itemId);
  if (!existing && activeHires.length >= maxSelections) return false;
  // Charge only the DIFFERENCE, so re-levelling costs the delta, not the full
  // new amount. The previous energy comes from the step already stored.
  const oldEnergy = hireStep(item, existing?.selectedStepKey ?? null)?.energy ?? 0;
  if (!applyEnergyDelta(s, step.energy - oldEnergy, `hire ${item.key}`)) return false;
  if (existing) {
    existing.selectedStepKey = stepKey;
  } else {
    s.globalInputSelections.push({ key: 'hiring', selectedStepKey: stepKey, inputId: itemId });
  }
  s.history.push({ day: s.meta.day, text: `Hired ${item.label} (${stepKey})`, cause: 'finlit_hire' });
  return true;
};

/**
 * Release a hire and refund its energy. Pass no item to clear all — in which
 * case nothing is refunded, because working out each refund needs the item that
 * priced it and the caller did not supply one.
 */
export const clearFinlitHire = (s: GameState, item?: GlobalInputItemDto): void => {
  const itemId = item ? String(item._id) : null;
  console.log('[decision] clearFinlitHire', item?.key ?? 'all');
  const matches = (sel: { key: string; inputId?: string }) =>
    sel.key === 'hiring' && (itemId == null || sel.inputId === itemId);
  if (item) {
    for (const sel of s.globalInputSelections.filter(matches)) {
      const refund = hireStep(item, sel.selectedStepKey ?? null)?.energy ?? 0;
      if (refund > 0) s.player.energy = clamp(s.player.energy + refund, 0, s.player.maxEnergy);
    }
  }
  s.globalInputSelections = s.globalInputSelections.filter((sel) => !matches(sel));
  s.history.push({ day: s.meta.day, text: `Released hire: ${item?.label ?? 'all'}`, cause: 'finlit_hire_clear' });
};

/** Set the marketing slider step (e.g. "1", "-2", "0"). No energy gate —
 *  marketing has energy: 0 in the backend globalInputs schema. */
export const setFinlitMarketingBudget = (
  s: GameState,
  item: GlobalInputItemDto,
  stepKey: string,
): boolean => {
  console.log('[decision] setFinlitMarketingBudget', stepKey);
  // `stepKey` must be a key of the item's own `options` map — the caller reads it
  // from there. It used to be a raw slider integer (0…40, from a hardcoded
  // frontend BUDGET_MAX) that the server could not look up.
  //
  // ENERGY: this used to charge nothing, on the since-outdated grounds that
  // marketing had `energy: 0` in the schema. Energy now comes from the item and
  // scales with the step, exactly like a hire, and only the DELTA is charged so
  // moving between steps costs the difference and stepping back down refunds.
  const stepEnergy = (key: string | null | undefined): number =>
    key == null ? 0 : Math.ceil((item.energy ?? 0) * (item.options?.[key] ?? 0));

  const idx = s.globalInputSelections.findIndex((sel) => sel.key === 'marketing');
  const oldEnergy = idx >= 0 ? stepEnergy(s.globalInputSelections[idx].selectedStepKey) : 0;
  if (!applyEnergyDelta(s, stepEnergy(stepKey) - oldEnergy, 'marketing')) return false;

  const entry = { key: 'marketing', selectedStepKey: stepKey, inputId: String(item._id) };
  if (idx >= 0) Object.assign(s.globalInputSelections[idx], entry);
  else s.globalInputSelections.push(entry);
  s.history.push({ day: s.meta.day, text: `Marketing → step ${stepKey}`, cause: 'finlit_marketing' });
  return true;
};

/** No-op stub. Sales boost comes from hiring (candidates B/D impact sales_channel),
 *  not a separate budget slider — there is no salesBudget in globalInputs. */
export const setFinlitSalesBudget = (_s: GameState, _v: unknown): void => {};

/**
 * Pure selector — active ChannelIds from globalInputSelections.
 *
 * Channel selections identify the backend ITEM by `inputId`; the ChannelId the
 * local tables key on is that item's `key`, so it is resolved here rather than
 * stored. Storing it would put a frontend id back in the selection, which is
 * what the server cannot resolve.
 */
export const finlitCompanyChannels = (s: GameState): ChannelId[] => {
  const channelItems = s.availableGlobalInputs.find((g) => g.key === 'channel')?.inputs ?? [];
  return s.globalInputSelections
    .filter((sel) => sel.key === 'channel')
    .map((sel) => channelItems.find((item) => String(item._id) === sel.inputId)?.key)
    .filter((key): key is ChannelId => key != null);
};

/** Toggle a sales channel. Enforces maxSelections from the backend config.
 *  Pass maxSelections from the hydrated availableGlobalInputs at the call site.
 *  The UI is responsible for preventing removal of the last active channel. */
export const toggleFinlitChannelAll = (
  s: GameState,
  item: GlobalInputItemDto,
  maxSelections = 1,
): boolean => {
  // A channel is one backend ITEM, toggled on or off. It carries no option
  // steps, so `selectedStepKey` stays null and the server treats the entry as
  // binary (selected ⇒ multiplier 1). `inputId` is mandatory: without it the
  // payload builder cannot resolve the entry and drops the selection.
  const itemId = String(item._id);
  console.log('[decision] toggleFinlitChannelAll', item.key);
  const active = s.globalInputSelections.filter((sel) => sel.key === 'channel');
  const idx = s.globalInputSelections.findIndex(
    (sel) => sel.key === 'channel' && sel.inputId === itemId,
  );
  const energy = item.energy || CHANNEL_ENERGY;
  if (idx >= 0) {
    s.globalInputSelections.splice(idx, 1);
    s.player.energy = clamp(s.player.energy + energy, 0, s.player.maxEnergy);
    s.history.push({ day: s.meta.day, text: `Channel ${item.label} removed`, cause: 'finlit_channel' });
  } else {
    if (active.length >= maxSelections) return false;
    if (!applyEnergyDelta(s, energy, `channel ${item.key}`)) return false;
    s.globalInputSelections.push({ key: 'channel', selectedStepKey: null, inputId: itemId });
    s.history.push({ day: s.meta.day, text: `Channel ${item.label} added`, cause: 'finlit_channel' });
  }
  return true;
};

/** Set the player's own demand estimate for a line (units/phase). Pure UI input —
 *  coaches production targets without affecting the engine simulation. */
export const setLineDemandEst = (s: GameState, units: number, lineId?: string): void => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.demandEstPerPhase = Math.max(0, Math.round(finite(units, 0)));
};

export const finalScore = (s: GameState) => {
  const r = computeFinalScore(s);
  return {
    total: r.total,
    netProfit: r.netProfit,
    inventory: r.inventory,
    insight: r.insight,
    netDollar: r.netDollar,
  };
};
