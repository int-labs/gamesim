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
  hireLevel as finlitHireLevel,
  vendorById as finlitVendorById,
  scenarioById as finlitScenarioById,
  BUDGET_MAX,
  BUDGET_LEVER_ENERGY,
  GENRES,
} from '@/data/finlit';
import { clamp, phaseOf, fmt$, perPhase } from '@/utils/format';
import type {
  LedgerEntry, Segment, ProductLine, Archetype, AddOnInstance,
  FinlitGenreId, FinlitProductionSpec, FinlitChannelId, FinlitVendorId,
  FinlitCandidateId, FinlitMarketingId,
} from '@/types';
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
    // V3 defaults — a valid market + a lean/cheap spec + one channel.
    genre,
    finlitSpec: { type: genre, paper: 'recycled', size: 'b5', pageDesign: 'blank', addon: 'bookmark', cover: 'plastic' },
    channels: ['offline'],
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
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.finlitSpec = { ...(line.finlitSpec ?? {}), [axis]: optionId };
  s.history.push({ day: s.meta.day, text: `${line.name} ${axis} → ${optionId}`, cause: 'finlit_spec' });
};

/** Toggle a sales channel on/off for a line (keeps at least one stocked). */
export const toggleFinlitChannel = (s: GameState, channel: FinlitChannelId, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const set = new Set(line.channels ?? ['offline']);
  if (set.has(channel)) {
    if (set.size > 1) set.delete(channel); // never leave a line with zero channels
  } else {
    set.add(channel);
  }
  line.channels = [...set] as FinlitChannelId[];
  s.history.push({ day: s.meta.day, text: `${line.name} channels → ${line.channels.join('/')}`, cause: 'finlit_channel' });
};

/**
 * The COMPANY's sales channels. "Where you sell" is a company decision, not a
 * per-notebook one, so every line shares one channel set (the engine still
 * stores it per line). Read as the union so a legacy save with per-line
 * channels resolves to something sensible.
 */
export const finlitCompanyChannels = (s: GameState): FinlitChannelId[] => {
  const set = new Set<FinlitChannelId>();
  for (const l of s.portfolio.productLines) {
    for (const c of (l.channels ?? ['offline'])) set.add(c as FinlitChannelId);
  }
  if (set.size === 0) set.add('offline');
  return [...set];
};

/**
 * Toggle a sales channel for the WHOLE company — writes the same set to every
 * notebook. Never leaves the company with zero channels (there'd be nowhere to
 * sell). Reversible, like every other company decision.
 */
export const toggleFinlitChannelAll = (s: GameState, channel: FinlitChannelId) => {
  const set = new Set(finlitCompanyChannels(s));
  if (set.has(channel)) {
    if (set.size <= 1) return; // never leave the company with nowhere to sell
    set.delete(channel);
  } else {
    set.add(channel);
  }
  const next = [...set] as FinlitChannelId[];
  for (const l of s.portfolio.productLines) l.channels = [...next];
  s.history.push({ day: s.meta.day, text: `Sales channels → ${next.join('/')}`, cause: 'finlit_channel' });
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

/** Set the line's daily production target (LP2 lever). Undefined = full capacity. */
export const setLineTargetPerDay = (s: GameState, units: number | undefined, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.targetPerDay = units === undefined ? undefined : clamp(finite(units, 0), 0, 100000);
  s.history.push({ day: s.meta.day, text: `${line.name} production target ${units ?? 'max'}`, cause: 'finlit_target' });
};

/** Set the shipping vendor engaged for a line (undefined = none). */
export const setLineVendor = (s: GameState, vendor: FinlitVendorId | undefined, lineId?: string) => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  line.vendor = vendor;
  s.history.push({ day: s.meta.day, text: `${line.name} vendor → ${vendor ?? 'none'}`, cause: 'finlit_vendor' });
};

/** Company-wide hire decision. */
export const setFinlitHire = (
  s: GameState,
  hire: { candidate: FinlitCandidateId; level: 1 | 2 | 3 | 4 } | null,
) => {
  s.finlit.hire = hire;
  s.history.push({ day: s.meta.day, text: hire ? `Hired ${hire.candidate} L${hire.level}` : 'Cleared hire', cause: 'finlit_hire' });
};

// ── Energy-gated "engage" decisions ────────────────────────────────────────
// Each key decision spends ENERGY (the scarce per-phase resource). The money
// cost of hiring/marketing/vendors flows as ONGOING opex inside the sim, so we
// do NOT also charge it here (that would double-count). Decisions are fully
// REVERSIBLE: engaging spends only the DELTA vs the current commitment, and
// clearing refunds it — energy is a per-phase planning budget, not a sunk cost.

function spendEnergy(s: GameState, cost: number, label: string): boolean {
  if (s.player.energy < cost) {
    s.toast = { id: 'energy-short', kind: 'warning', text: `Not enough energy for ${label} (need ${cost})`, until: Date.now() + 1800 };
    return false;
  }
  s.player.energy = Math.max(0, s.player.energy - cost);
  return true;
}

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

/** Engage/upgrade a hire candidate at a level. Spends only the DELTA vs the
 *  current hire, so switching level/candidate is reversible. */
export const engageFinlitHire = (
  s: GameState,
  candidate: FinlitCandidateId,
  level: 1 | 2 | 3 | 4,
): boolean => {
  const newCost = finlitHireLevel(candidate, level).energy;
  const oldCost = s.finlit.hire ? finlitHireLevel(s.finlit.hire.candidate, s.finlit.hire.level).energy : 0;
  if (!applyEnergyDelta(s, newCost - oldCost, 'hiring')) return false;
  s.finlit.hire = { candidate, level };
  s.history.push({ day: s.meta.day, text: `Hired ${candidate} (L${level}) - ${newCost}⚡`, cause: 'finlit_hire' });
  return true;
};

/** Un-engage the current hire and refund its energy. */
export const clearFinlitHire = (s: GameState): void => {
  if (!s.finlit.hire) return;
  const refund = finlitHireLevel(s.finlit.hire.candidate, s.finlit.hire.level).energy;
  s.player.energy = clamp(s.player.energy + refund, 0, s.player.maxEnergy);
  s.finlit.hire = null;
  s.history.push({ day: s.meta.day, text: `Cleared hire - +${refund}⚡ refunded`, cause: 'finlit_hire' });
};

/** Set the $/day MARKETING budget (lifts demand). A flat energy activates the
 *  lever; dropping to $0 refunds it. Returns false if energy is short. */
export const setFinlitMarketingBudget = (s: GameState, budget: number): boolean => {
  const next = clamp(finite(budget, 0), 0, BUDGET_MAX);
  const delta = (next > 0 ? BUDGET_LEVER_ENERGY : 0) - (s.finlit.marketingBudget > 0 ? BUDGET_LEVER_ENERGY : 0);
  if (!applyEnergyDelta(s, delta, 'marketing')) return false;
  s.finlit.marketingBudget = next;
  s.history.push({ day: s.meta.day, text: `Marketing budget → ${fmt$(perPhase(next))} / phase`, cause: 'finlit_marketing' });
  return true;
};

/** Set the $/day SALES budget (lifts conversion). */
export const setFinlitSalesBudget = (s: GameState, budget: number): boolean => {
  const next = clamp(finite(budget, 0), 0, BUDGET_MAX);
  const delta = (next > 0 ? BUDGET_LEVER_ENERGY : 0) - (s.finlit.salesBudget > 0 ? BUDGET_LEVER_ENERGY : 0);
  if (!applyEnergyDelta(s, delta, 'sales')) return false;
  s.finlit.salesBudget = next;
  s.history.push({ day: s.meta.day, text: `Sales budget → ${fmt$(perPhase(next))} / phase`, cause: 'finlit_marketing' });
  return true;
};

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
  if (!spendEnergy(s, opt.energy, sc.title)) return false;
  s.finlit.demandMult *= opt.demandMult ?? 1;
  s.finlit.sellMult *= opt.sellMult ?? 1;
  if (opt.cashNow) s.player.cash += opt.cashNow;
  if (!s.finlit.resolvedScenarios.includes(scenarioId)) s.finlit.resolvedScenarios.push(scenarioId);
  s.history.push({ day: s.meta.day, text: `Scenario "${sc.title}" - ${optId}: ${opt.label}`, cause: 'finlit_scenario' });
  return true;
};

/** Engage a shipping vendor for a line (spends the vendor's phase energy). */
export const engageFinlitVendor = (
  s: GameState,
  vendor: FinlitVendorId,
  lineId?: string,
): boolean => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  const level = s.meta.phase >= 2 ? 2 : 1;
  const newCost = finlitVendorById(vendor).energyByLevel[level];
  const oldCost = line.vendor ? finlitVendorById(line.vendor).energyByLevel[level] : 0;
  if (!applyEnergyDelta(s, newCost - oldCost, 'shipping')) return false;
  line.vendor = vendor;
  s.history.push({ day: s.meta.day, text: `${line.name} vendor → ${vendor} - ${newCost}⚡`, cause: 'finlit_vendor' });
  return true;
};

/** Un-engage a line's shipping vendor and refund its energy. */
export const clearFinlitVendor = (s: GameState, lineId?: string): void => {
  const line = lineId ? getLineOrThrow(s, lineId) : getActiveLine(s);
  if (!line.vendor) return;
  const level = s.meta.phase >= 2 ? 2 : 1;
  const refund = finlitVendorById(line.vendor).energyByLevel[level];
  s.player.energy = clamp(s.player.energy + refund, 0, s.player.maxEnergy);
  line.vendor = undefined;
  s.history.push({ day: s.meta.day, text: `${line.name} vendor cleared - +${refund}⚡ refunded`, cause: 'finlit_vendor' });
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
