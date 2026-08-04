/**
 * Applies the operator's published PlayerConfig over the bundled game data.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * The bundled tables (`GENRES`, `ADDONS`, `CHANNELS_BY_GENRE`, …) are plain
 * `const` arrays/objects that ~25 UI and engine modules import *directly* —
 * not through a provider, not through a hook. A `const` binding can't be
 * reassigned from here, but the object it points at is shared by every
 * importer, so we edit the CONTENTS in place and everyone sees it. Nothing in
 * the app derives a lookup map at module scope (verified: every read is a
 * `.find()` / index at call time), so there is nothing to invalidate.
 *
 * WHY IT REFUSES MORE THAN IT ACCEPTS
 * -----------------------------------
 * The engine's accessors THROW on an unknown id — `genreById`, `configOption`,
 * `channelRow` and `vendorById` all `throw new Error('Unknown …')`. A dropped
 * id is therefore not a cosmetic regression, it's a crash the moment a saved
 * game or a rendered list touches it. So:
 *
 *   - an id present in the bundle may never disappear (edits and additions
 *     are fine; removals are refused),
 *   - the five structurally-coupled sections are validated as one graph and
 *     applied together or not at all,
 *   - anything unexpected — a failed fetch, a malformed payload, a thrown
 *     error mid-apply — leaves the bundled data exactly as it shipped.
 *
 * The bundled values are always a complete, playable game. This module can
 * only ever make them differ from the console; it can never make them absent.
 *
 * ROLLBACK: delete the `hydratePlayerConfig` call in GamesimProvider.tsx.
 */
import { A } from '@/assets';
import {
  ADDON_OPTIONS,
  CANDIDATES,
  CHANNEL_META,
  CHANNELS_BY_GENRE,
  COVER_OPTIONS,
  GENRES,
  MARKETING_TEAMS,
  PAGE_DESIGN_OPTIONS,
  PAPER_OPTIONS,
  ROUTE_START,
  SCENARIO_DAYS,
  SCENARIOS,
  SCENARIOS_PER_PHASE,
  SIZE_OPTIONS,
  TYPE_OPTIONS,
  VENDORS,
} from '@/data/finlit';
import {
  BINDING_COST,
  COVER_COST,
  ENERGY_COSTS,
  PAPER_COST,
  PHASE_DEMAND_MULT,
  PHASE_MAX_ENERGY,
  PRICE_REFERENCE,
  SIZE_COST_MULT,
  SIZE_TIME_MULT,
  STARTING_CASH,
  STARTING_DEBT,
} from '@/data/balance';
import { ADDONS } from '@/data/addOns';
import { CHANNELS } from '@/data/channels';
import { EVENTS } from '@/data/events';
import { INSIGHTS } from '@/data/insights';
import { SEGMENTS } from '@/data/segments';
import { UPGRADES } from '@/data/upgrades';
import * as CONTENT from '@/content/copy';
import { getGamesimBaseUrl, getGamesimToken } from './client';

// ── Report ──────────────────────────────────────────────────────────────
export interface HydrationReport {
  /** True when at least one section was applied. */
  applied: boolean;
  /** Why nothing was applied — absent when `applied` is true. */
  reason?: string;
  version?: number;
  publishedAt?: string;
  /** Sections whose values are now live. */
  sections: string[];
  /** Sections deliberately not applied, and why. */
  skipped: Array<{ section: string; why: string }>;
}

const empty = (reason: string): HydrationReport => ({
  applied: false,
  reason,
  sections: [],
  skipped: [],
});

// ── Small helpers ───────────────────────────────────────────────────────
type Dict = Record<string, any>;

const isObj = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Resolve a dotted key into the typed asset map (`addons.integrated.charm_bear`). */
const assetUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  const hit = path.split('.').reduce<any>((acc, k) => (isObj(acc) ? acc[k] : undefined), A);
  return typeof hit === 'string' ? hit : undefined;
};

/**
 * An uploaded asset wins over a bundled sprite key. `imageAssetId` is an
 * absolute URL written by the console's uploader; `imagePath` is a key into
 * `A`, which URL-encodes the segments containing spaces / `&` / em-dashes.
 */
const imageFor = (row: Dict): string | undefined =>
  (typeof row.imageAssetId === 'string' && row.imageAssetId) || assetUrl(row.imagePath);

/** Copy `src`'s own keys onto `dst`, skipping undefined and the image fields
 *  (those are resolved separately into the player's `imgPath` shape). */
function assignKnown(dst: Dict, src: Dict, keys: string[]): void {
  for (const k of keys) {
    const v = src[k];
    if (v === undefined) continue;
    dst[k] = v;
  }
}

/** Replace an array's contents while keeping the object identity every
 *  importer holds. */
function replaceArray<T>(target: T[], next: T[]): void {
  target.length = 0;
  target.push(...next);
}

/** Same, for a plain object used as a map. */
function replaceObject(target: Dict, next: Dict): void {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, next);
}

const idsOf = (rows: Array<{ id?: unknown }>): Set<string> =>
  new Set(rows.map((r) => String(r?.id)));

/** Every id the bundle ships must still be present. Additions are fine. */
function keepsAllIds(bundled: Array<{ id: string }>, incoming: unknown): incoming is Dict[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return false;
  if (incoming.some((r) => !isObj(r) || typeof r.id !== 'string' || !r.id)) return false;
  const have = idsOf(incoming as Dict[]);
  return bundled.every((b) => have.has(b.id));
}

/**
 * Merge incoming rows onto a bundled array by id: existing entries are edited
 * in place (so object identity survives for anything holding a reference),
 * genuinely new entries are appended, and the incoming order is adopted.
 */
function mergeById(
  target: Dict[],
  incoming: Dict[],
  keys: string[],
  opts: { image?: 'imgPath'; thumb?: boolean; after?: (row: Dict, src: Dict) => void } = {},
): void {
  const byId = new Map(target.map((r) => [r.id, r]));
  const next: Dict[] = [];

  for (const src of incoming) {
    const row = byId.get(src.id) ?? { id: src.id };
    assignKnown(row, src, keys);

    if (opts.image) {
      const url = imageFor(src);
      if (url) row[opts.image] = url;
    }
    if (opts.thumb) {
      const thumb =
        (typeof src.thumbAssetId === 'string' && src.thumbAssetId) || assetUrl(src.thumbPath);
      if (thumb) row.thumbPath = thumb;
    }
    opts.after?.(row, src);
    next.push(row);
  }

  replaceArray(target, next);
}

// ── The structural guard for the coupled core ───────────────────────────
/**
 * `genres`, `channelMeta`, `channelsByGenre`, `vendors` and `productionOptions`
 * reference each other by id: channel rows are indexed by genre, vendor
 * coverage is indexed by [level][genre], and a saved design holds production
 * option ids. Validating them one at a time would let a half-consistent set
 * through, so they pass or fail as a graph.
 */
function coupledCoreIsSafe(cfg: Dict): string | null {
  const { genres, channelMeta, channelsByGenre, vendors, productionOptions } = cfg;

  // Anything absent simply keeps its bundled value — that's not a failure,
  // but the cross-checks below then run against the bundle.
  const genreRows = genres ?? GENRES;
  const metaRows =
    channelMeta ?? Object.entries(CHANNEL_META).map(([id, v]) => ({ id, ...v }));

  if (genres !== undefined && !keepsAllIds(GENRES, genres))
    return 'genres would drop a bundled genre';
  if (channelMeta !== undefined && !keepsAllIds(Object.keys(CHANNEL_META).map((id) => ({ id })), channelMeta))
    return 'channelMeta would drop a bundled channel';

  const genreIds = idsOf(genreRows);
  const channelIds = idsOf(metaRows);

  if (channelsByGenre !== undefined) {
    if (!Array.isArray(channelsByGenre)) return 'channelsByGenre is not a list';
    const covered = new Set(channelsByGenre.map((g: Dict) => String(g?.genreId)));
    for (const g of genreIds)
      if (!covered.has(g)) return `channelsByGenre has no rows for genre "${g}"`;
    for (const g of channelsByGenre) {
      if (!Array.isArray(g?.rows)) return `channelsByGenre["${g?.genreId}"] has no rows`;
      const have = new Set(g.rows.map((r: Dict) => String(r?.channel)));
      for (const c of channelIds)
        if (!have.has(c)) return `genre "${g.genreId}" is missing a "${c}" channel row`;
      for (const r of g.rows)
        if (!num(r?.split) || !num(r?.sellRate))
          return `genre "${g.genreId}" has a non-numeric channel row`;
    }
  } else {
    // Bundled rows must still cover any NEW genre or channel the config adds.
    for (const g of genreIds) {
      const rows = (CHANNELS_BY_GENRE as Dict)[g];
      if (!Array.isArray(rows)) return `new genre "${g}" has no bundled channel rows`;
      const have = new Set(rows.map((r: Dict) => String(r.channel)));
      for (const c of channelIds)
        if (!have.has(c)) return `new channel "${c}" has no row under genre "${g}"`;
    }
  }

  if (vendors !== undefined) {
    if (!keepsAllIds(VENDORS as any, vendors)) return 'vendors would drop a bundled vendor';
    for (const v of vendors as Dict[]) {
      if (!Array.isArray(v.coverage)) return `vendor "${v.id}" has no coverage`;
      const seen = new Set(v.coverage.map((c: Dict) => `${c?.level}|${c?.genreId}`));
      for (const level of [1, 2])
        for (const g of genreIds)
          if (!seen.has(`${level}|${g}`))
            return `vendor "${v.id}" has no level-${level} coverage for genre "${g}"`;
      if (!num(v.energyByLevel?.l1) || !num(v.energyByLevel?.l2))
        return `vendor "${v.id}" has non-numeric energy`;
    }
  } else {
    for (const v of VENDORS) {
      for (const level of [1, 2] as const)
        for (const g of genreIds)
          if (!(v.coverage as Dict)[level]?.[g])
            return `new genre "${g}" has no coverage on bundled vendor "${v.id}"`;
    }
  }

  if (productionOptions !== undefined) {
    if (!isObj(productionOptions)) return 'productionOptions is not an object';
    for (const [axis, bundled] of Object.entries(AXES)) {
      const rows = productionOptions[axis];
      if (rows === undefined) continue;
      if (!keepsAllIds(bundled, rows)) return `productionOptions.${axis} would drop an option`;
      for (const r of rows as Dict[])
        if (!num(r.rate) || !num(r.cost))
          return `productionOptions.${axis} option "${r.id}" has a non-numeric rate/cost`;
    }
  }

  return null;
}

const AXES: Record<string, Array<{ id: string }>> = {
  type: TYPE_OPTIONS,
  paper: PAPER_OPTIONS,
  size: SIZE_OPTIONS,
  pageDesign: PAGE_DESIGN_OPTIONS,
  addon: ADDON_OPTIONS,
  cover: COVER_OPTIONS,
};

// ── Section appliers ────────────────────────────────────────────────────
function applyCoupledCore(cfg: Dict, applied: string[]): void {
  if (Array.isArray(cfg.genres)) {
    // The identity fields travel with the genre so an operator-published
    // notebook arrives complete — name, copy AND art — without a code change.
    mergeById(
      GENRES as any,
      cfg.genres,
      ['name', 'blurb', 'demand', 'voc', 'tagline', 'description', 'strengths', 'tradeoffs'],
      { image: 'imgPath' },
    );
    applied.push('genres');
  }

  if (isObj(cfg.productionOptions)) {
    for (const [axis, table] of Object.entries(AXES)) {
      const rows = cfg.productionOptions[axis];
      if (Array.isArray(rows)) mergeById(table as any, rows, ['name', 'rate', 'cost']);
    }
    applied.push('productionOptions');
  }

  if (Array.isArray(cfg.channelMeta)) {
    const next: Dict = {};
    for (const c of cfg.channelMeta) next[c.id] = { name: c.name, blurb: c.blurb ?? '' };
    replaceObject(CHANNEL_META as Dict, next);
    applied.push('channelMeta');
  }

  if (Array.isArray(cfg.channelsByGenre)) {
    const next: Dict = {};
    for (const g of cfg.channelsByGenre) {
      next[g.genreId] = g.rows.map((r: Dict) => ({
        channel: r.channel,
        split: r.split,
        maintenance: r.maintenance,
        consignment: r.consignment,
        inventoryCost: r.inventoryCost,
        sellRate: r.sellRate,
      }));
    }
    replaceObject(CHANNELS_BY_GENRE as Dict, next);
    applied.push('channelsByGenre');
  }

  if (Array.isArray(cfg.vendors)) {
    // Config stores coverage flat so it can be edited as a table; the engine
    // indexes it as coverage[level][genre].
    mergeById(VENDORS as any, cfg.vendors, ['name'], {
      image: 'imgPath',
      after: (row, src) => {
        row.energyByLevel = { 1: src.energyByLevel.l1, 2: src.energyByLevel.l2 };
        const coverage: Dict = { 1: {}, 2: {} };
        for (const c of src.coverage) {
          coverage[c.level][c.genreId] = {
            cost: c.cost,
            quality: c.quality,
            sellBonus: c.sellBonus,
            prodBonus: c.prodBonus,
          };
        }
        row.coverage = coverage;
      },
    });
    applied.push('vendors');
  }
}

/** Independent catalogs — each validated and applied on its own. */
function applyCatalogs(cfg: Dict, applied: string[], skipped: HydrationReport['skipped']): void {
  const section = (
    name: string,
    bundled: Array<{ id: string }>,
    apply: (rows: Dict[]) => void,
  ): void => {
    const rows = cfg[name];
    if (rows === undefined) return;
    if (!keepsAllIds(bundled, rows)) {
      skipped.push({ section: name, why: 'would drop an entry the bundle ships' });
      return;
    }
    apply(rows as Dict[]);
    applied.push(name);
  };

  section('hiringCandidates', CANDIDATES as any, (rows) =>
    mergeById(CANDIDATES as any, rows, ['name', 'blurb', 'levels'], { image: 'imgPath' }),
  );

  section('marketingTeams', MARKETING_TEAMS as any, (rows) =>
    mergeById(MARKETING_TEAMS as any, rows, ['name', 'blurb', 'cost', 'sellBonus', 'energy']),
  );

  section('scenarios', SCENARIOS as any, (rows) =>
    mergeById(SCENARIOS as any, rows, ['phase', 'title', 'body'], {
      image: 'imgPath',
      // Optional multipliers round-trip as null; the engine reads them with
      // `??`, so drop the nulls rather than storing them.
      after: (row, src) => {
        row.options = (src.options ?? []).map((o: Dict) => {
          const opt: Dict = { id: o.id, label: o.label, detail: o.detail, energy: o.energy };
          for (const k of ['demandMult', 'sellMult', 'cashNow'])
            if (o[k] !== null && o[k] !== undefined) opt[k] = o[k];
          return opt;
        });
      },
    }),
  );

  section('addOns', ADDONS as any, (rows) =>
    mergeById(
      ADDONS as any,
      // `active: false` is the console's way of retiring an add-on without
      // deleting it — the id survives for saved games, it just leaves the shop.
      rows.filter((r) => r.active !== false),
      ['name', 'category', 'costPerUnit', 'perceivedValue', 'segmentBoost', 'slot', 'description'],
      { image: 'imgPath', thumb: true },
    ),
  );

  section('segments', SEGMENTS as any, (rows) =>
    mergeById(
      SEGMENTS as any,
      rows,
      ['name', 'description', 'baseDemand', 'priceSensitivity', 'preferredPriceRef', 'preference'],
      { image: 'imgPath' },
    ),
  );

  section('channelsV2', CHANNELS as any, (rows) =>
    mergeById(
      CHANNELS as any,
      rows,
      ['name', 'description', 'reach', 'dailyCost', 'unlockEnergy', 'unlockCash', 'segmentAffinity'],
      { image: 'imgPath' },
    ),
  );

  section('events', EVENTS as any, (rows) =>
    mergeById(EVENTS as any, rows, ['day', 'title', 'body', 'mascotMood'], {
      image: 'imgPath',
      after: (row, src) => {
        row.options = (src.options ?? []).map((o: Dict) => ({
          id: o.id,
          label: o.label,
          description: o.description,
          cost: { energy: o.cost.energy, ...(o.cost.cash != null ? { cash: o.cost.cash } : {}) },
          effects: o.effects ?? [],
          modifierIds: o.modifierIds ?? [],
        }));
      },
    }),
  );

  section('upgrades', UPGRADES as any, (rows) =>
    mergeById(UPGRADES as any, rows, ['name', 'category', 'description', 'costs', 'effects'], {
      image: 'imgPath',
      after: (row, src) => {
        row.requires = src.requires ?? [];
        if (src.unlockDay != null) row.unlockDay = src.unlockDay;
        else delete row.unlockDay;
      },
    }),
  );

  section('insights', INSIGHTS as any, (rows) =>
    mergeById(INSIGHTS as any, rows, ['phase', 'question', 'options']),
  );

  /**
   * Archetypes are DERIVED, not stored — so this section is deliberately inert.
   *
   * `ARCHETYPE_INFO` used to be a plain keyed record this merged into. It is
   * now a read-only Proxy that rebuilds each entry from the matching GENRE on
   * every read (see data/notebookArchetypes.ts); assigning to it throws
   * "Cannot redefine property", which took hydration down mid-apply and left
   * every later section unapplied.
   *
   * Writing archetype fields back onto the genre was the obvious fix and is
   * the wrong one: `title` and `name` would then be the same field owned by
   * two sections, and whichever applied last would silently overwrite the
   * other — an operator renaming a genre would watch the rename disappear.
   * One field, one owner: genres own the text, archetypes render it.
   */
  /**
   * `addOnCategories` has no player-side table to merge into.
   *
   * A category exists in the player only as a string on each add-on plus a
   * placement entry in `data/addOnDefaults.ts`; the shop's grouping is a fixed
   * layout in `ProductPanel.tsx`, not data. The section is still load-bearing
   * — the server validates every add-on's `category` against it — it just has
   * no effect HERE, and saying so is better than looking applied.
   */
  if (Array.isArray(cfg.addOnCategories) && cfg.addOnCategories.length > 0) {
    skipped.push({
      section: 'addOnCategories',
      why: 'a registry the server validates add-ons against - the player has no table to merge it into',
    });
  }

  if (Array.isArray(cfg.archetypes) && cfg.archetypes.length > 0) {
    skipped.push({
      section: 'archetypes',
      why: 'derived from genres - edit the genre instead (title = genre name)',
    });
  }
}

/**
 * Balance constants. Only the object-shaped ones can be applied: the scalars
 * (`BASERATE`, `ENERGY_CAP`, `HIRE_DAILY_WAGE`, …) are `const` number exports,
 * and a module's own `const` binding cannot be rebound from outside it. Editing
 * those in the console is currently a no-op, so they're reported as skipped
 * rather than silently dropped.
 */
const CONSTANT_OBJECTS: Record<string, Dict> = {
  PHASE_MAX_ENERGY,
  PAPER_COST,
  COVER_COST,
  BINDING_COST,
  SIZE_COST_MULT,
  SIZE_TIME_MULT,
  PRICE_REFERENCE,
  PHASE_DEMAND_MULT,
  STARTING_CASH,
  STARTING_DEBT,
  ENERGY_COSTS,
  SCENARIOS_PER_PHASE: SCENARIOS_PER_PHASE as unknown as Dict,
};

/**
 * The export flattens `ROUTE_START.self.cash` to `ROUTE_START_SELF_CASH` so the
 * console can edit it as a plain number. `ROUTE_START` itself is an object, so
 * unlike the true scalars these DO hydrate — they just need unflattening.
 */
const ROUTE_START_KEYS: Record<string, [route: 'self' | 'investor', field: 'cash' | 'openingProfit']> = {
  ROUTE_START_SELF_CASH: ['self', 'cash'],
  ROUTE_START_SELF_OPENING_PROFIT: ['self', 'openingProfit'],
  ROUTE_START_INVESTOR_CASH: ['investor', 'cash'],
  ROUTE_START_INVESTOR_OPENING_PROFIT: ['investor', 'openingProfit'],
};

function applyConstants(cfg: Dict, applied: string[], skipped: HydrationReport['skipped']): void {
  if (!isObj(cfg.constants)) return;

  const unapplied: string[] = [];
  let touched = false;

  for (const [key, value] of Object.entries(cfg.constants)) {
    // SCENARIO_DAYS is an array, not a keyed table — replace it wholesale.
    if (key === 'SCENARIO_DAYS') {
      if (Array.isArray(value) && value.length && value.every(num)) {
        replaceArray(SCENARIO_DAYS as unknown as number[], value as number[]);
        touched = true;
      }
      continue;
    }

    const route = ROUTE_START_KEYS[key];
    if (route) {
      if (num(value)) {
        (ROUTE_START as Dict)[route[0]][route[1]] = value;
        touched = true;
      }
      continue;
    }

    const target = CONSTANT_OBJECTS[key];
    if (!target) {
      unapplied.push(key);
      continue;
    }
    if (!isObj(value)) continue;
    // Per-key so a partial object can't blank out the rest of the table.
    for (const [k, v] of Object.entries(value)) {
      if (num(v) || isObj(v)) (target as Dict)[k] = v;
    }
    touched = true;
  }

  if (touched) applied.push('constants');
  if (unapplied.length) {
    skipped.push({
      section: 'constants',
      why: `${unapplied.length} scalar constant(s) need a build to take effect: ${unapplied
        .slice(0, 6)
        .join(', ')}${unapplied.length > 6 ? '…' : ''}`,
    });
  }
}

// ── Copy + image overrides ──────────────────────────────────────────────
/**
 * Both are keyed by dotted path and applied the same way the catalogs are: by
 * editing the exported object in place, so not one UI file changes.
 *
 *   copy   "FINAL.title"                  → CONTENT.FINAL.title
 *   images "mascot.expressions.happy"     → A.mascot.expressions.happy
 *
 * Two rules make this safe to hand an operator:
 *
 *  - A path that doesn't already exist is ignored. Inventing `HOME.newThing`
 *    would write a key nothing renders; worse, a typo'd override would look
 *    accepted while the real string stayed put.
 *  - Only STRING leaves are replaced. Several copy entries are functions that
 *    interpolate live values (`HOME.cta.continue(day)`) or arrays of objects;
 *    overwriting one with a string turns a render into a crash.
 */
const COPY_ROOTS: Dict = CONTENT;

let COPY: Record<string, string> = {};
let IMAGES: Record<string, string> = {};

/** Walk a dotted path to its parent object + final key, or null if absent. */
function resolvePath(root: Dict, path: string): { parent: Dict; key: string } | null {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts.pop() as string;
  let node: any = root;
  for (const p of parts) {
    if (!isObj(node) || !(p in node)) return null;
    node = node[p];
  }
  return isObj(node) && key in node ? { parent: node, key } : null;
}

/** Set string leaves only; returns how many actually landed. */
function applyStringOverrides(root: Dict, overrides: Record<string, string>): number {
  let applied = 0;
  for (const [path, value] of Object.entries(overrides)) {
    if (typeof value !== 'string') continue;
    const hit = resolvePath(root, path);
    if (!hit) continue;
    if (typeof hit.parent[hit.key] !== 'string') continue; // function / array / object
    hit.parent[hit.key] = value;
    applied += 1;
  }
  return applied;
}

/** Operator copy override for `key`, else `fallback`. Kept for call sites that
 *  want an explicit lookup rather than relying on the in-place merge. */
export const configCopy = (key: string, fallback: string): string => COPY[key] ?? fallback;

/** Operator image override for `key`, else `fallback`. */
export const configImage = (key: string, fallback?: string): string | undefined =>
  IMAGES[key] ?? fallback;

// ── Entry point ─────────────────────────────────────────────────────────
let done = false;

/**
 * Fetch the published config for `simulationTypeId` and apply it.
 *
 * Runs at most once per page load: the tables it edits are read continuously
 * by a running game, so re-applying them on a background poll could change
 * prices or energy costs underneath a day already in progress.
 */
export async function hydratePlayerConfig(simulationTypeId: string): Promise<HydrationReport> {
  if (done) return empty('already hydrated this session');
  done = true;

  let payload: Dict;
  try {
    const res = await fetch(
      `${getGamesimBaseUrl()}/player-config/${simulationTypeId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(getGamesimToken() ? { Authorization: `Bearer ${getGamesimToken()}` } : {}),
        },
      },
    );
    // 404 is the normal "operator hasn't published anything" case.
    if (!res.ok) return empty(`no published config (${res.status})`);
    payload = await res.json();
  } catch (err) {
    return empty(err instanceof Error ? err.message : 'config fetch failed');
  }

  const cfg = payload?.config;
  if (!isObj(cfg)) return empty('config payload was not an object');

  const applied: string[] = [];
  const skipped: HydrationReport['skipped'] = [];

  try {
    const unsafe = coupledCoreIsSafe(cfg);
    if (unsafe) {
      for (const s of ['genres', 'productionOptions', 'channelMeta', 'channelsByGenre', 'vendors'])
        if (cfg[s] !== undefined) skipped.push({ section: s, why: unsafe });
    } else {
      applyCoupledCore(cfg, applied);
    }

    applyCatalogs(cfg, applied, skipped);
    applyConstants(cfg, applied, skipped);

    if (isObj(cfg.copy)) {
      COPY = Object.fromEntries(
        Object.entries(cfg.copy).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>;
      const landed = applyStringOverrides(COPY_ROOTS, COPY);
      if (landed) applied.push('copy');
      const ignored = Object.keys(COPY).length - landed;
      if (ignored > 0) {
        skipped.push({
          section: 'copy',
          why: `${ignored} key(s) don't match a string the player renders`,
        });
      }
    }

    if (isObj(cfg.images)) {
      IMAGES = {};
      for (const [k, v] of Object.entries(cfg.images)) {
        const url = isObj(v) ? imageFor(v) : undefined;
        if (url) IMAGES[k] = url;
      }
      const landed = applyStringOverrides(A as Dict, IMAGES);
      if (landed) applied.push('images');
      const ignored = Object.keys(IMAGES).length - landed;
      if (ignored > 0) {
        skipped.push({
          section: 'images',
          why: `${ignored} key(s) don't match a path in the player's asset map`,
        });
      }
    }
  } catch (err) {
    // A throw mid-apply can leave a table half-merged, and a half-merged table
    // is worse than an un-merged one. Say so loudly; a reload restores the
    // bundle, which is the only state we can still guarantee.
    console.error('[gamesim] player config hydration failed mid-apply - reload to restore bundled data', err);
    return {
      applied: false,
      reason: err instanceof Error ? err.message : 'hydration threw',
      sections: applied,
      skipped,
    };
  }

  return {
    applied: applied.length > 0,
    reason: applied.length ? undefined : 'config published but no section applied',
    version: payload.version,
    publishedAt: payload.publishedAt,
    sections: applied,
    skipped,
  };
}

/** Test/dev helper — lets a second hydration run in the same page. */
export function __resetHydrationForTests(): void {
  done = false;
}
