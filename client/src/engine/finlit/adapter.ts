// Adapter — maps the store's product lines + company decisions into the
// engine's FinlitLine[] / FinlitDecisions. Typed over NARROW structural inputs
// (not GameState) so it stays decoupled + unit-testable. V3 fields are read
// when present; otherwise sensible defaults keep un-migrated lines simulating.

import {
  TYPE_OPTIONS, PAPER_OPTIONS, SIZE_OPTIONS, PAGE_DESIGN_OPTIONS, ADDON_OPTIONS, COVER_OPTIONS,
  type GenreId, type ProductionSpec, type ChannelId, type VendorId, type CandidateId, type MarketingId,
} from '@/data/finlit';
import type { FinlitLine, FinlitDecisions, Route } from './types';

/** Narrow view of a store product line (only what the adapter needs). */
export interface LineInput {
  id: string;
  name: string;
  price: number;
  genre?: GenreId;
  finlitSpec?: Partial<ProductionSpec>;
  channels?: ChannelId[];
  vendor?: VendorId;
  targetPerDay?: number;
  finished?: number;
  /** Legacy hint used only to pick a default genre when `genre` is unset. */
  targetSegment?: string | null;
}

export interface DecisionInput {
  route: Route;
  hire?: { candidate: CandidateId; level: 1 | 2 | 3 | 4 } | null;
  marketingBudget?: number;
  salesBudget?: number;
  demandMult?: number;
  sellMult?: number;
}

const DEFAULT_SPEC: ProductionSpec = {
  type: TYPE_OPTIONS[0].id,
  paper: PAPER_OPTIONS[0].id,
  size: SIZE_OPTIONS[0].id,
  pageDesign: PAGE_DESIGN_OPTIONS[0].id,
  addon: ADDON_OPTIONS[0].id,
  cover: COVER_OPTIONS[0].id,
};

// Legacy audience → default genre, when a line predates the genre field.
const SEGMENT_TO_GENRE: Record<string, GenreId> = {
  students: 'minimalist', professionals: 'minimalist', creators: 'cute', gift: 'anime',
};

export function toFinlitLine(l: LineInput): FinlitLine {
  const genre: GenreId = l.genre ?? SEGMENT_TO_GENRE[l.targetSegment ?? ''] ?? 'indie';
  const spec: ProductionSpec = {
    type: l.finlitSpec?.type ?? genre, // type mirrors genre by default
    paper: l.finlitSpec?.paper ?? DEFAULT_SPEC.paper,
    size: l.finlitSpec?.size ?? DEFAULT_SPEC.size,
    pageDesign: l.finlitSpec?.pageDesign ?? DEFAULT_SPEC.pageDesign,
    addon: l.finlitSpec?.addon ?? DEFAULT_SPEC.addon,
    cover: l.finlitSpec?.cover ?? DEFAULT_SPEC.cover,
  };
  return {
    id: l.id,
    name: l.name,
    genre,
    spec,
    price: l.price > 0 ? l.price : 16,
    channels: l.channels && l.channels.length ? l.channels : ['offline'],
    vendor: l.vendor,
    targetPerDay: l.targetPerDay,
    finished: l.finished ?? 0,
  };
}

export function toFinlitLines(lines: LineInput[]): FinlitLine[] {
  return lines.map(toFinlitLine);
}

export function toFinlitDecisions(d: DecisionInput): FinlitDecisions {
  return {
    route: d.route,
    hire: d.hire ?? undefined,
    marketingBudget: d.marketingBudget ?? 0,
    salesBudget: d.salesBudget ?? 0,
    demandMult: d.demandMult ?? 1,
    sellMult: d.sellMult ?? 1,
  };
}

/**
 * Reverse of toFinlitLine — the subset of a store ProductLine that a
 * FinlitLine actually carries. NOT a full ProductLine: fields with no
 * FinlitLine counterpart (archetype, cover, binding, size, paperQuality,
 * pricePoint, addOnsByArchetype, quantityTarget, isCustomName, targetSegment)
 * have no way to be reconstructed from server data alone, so this is only
 * safe to merge onto an EXISTING local line with a matching id (e.g.
 * restoring a saved draft into the same browser/session) — never used to
 * synthesize a brand-new line from scratch.
 */
export interface FinlitLineOverlay {
  name: string;
  genre: GenreId;
  finlitSpec: ProductionSpec;
  price: number;
  channels: ChannelId[];
  vendor?: VendorId;
  targetPerDay?: number;
  finished: number;
}

export function fromFinlitLine(l: FinlitLine): FinlitLineOverlay {
  return {
    name: l.name,
    genre: l.genre,
    finlitSpec: l.spec,
    price: l.price,
    channels: l.channels,
    vendor: l.vendor,
    targetPerDay: l.targetPerDay,
    finished: l.finished,
  };
}

export function fromFinlitDecisions(d: FinlitDecisions): DecisionInput {
  return {
    route: d.route,
    hire: d.hire ?? null,
    marketingBudget: d.marketingBudget,
    salesBudget: d.salesBudget,
    demandMult: d.demandMult,
    sellMult: d.sellMult,
  };
}
