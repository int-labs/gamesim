// Demand module — per-line in the portfolio model.
//
// Each product line generates its own demand vector across segments:
//
//   demand[line][seg] = baseDemand[seg]
//                     × phaseMult                  ← global
//                     × fit(line, seg)             ← line product fit
//                     × priceFactor(line, seg)     ← line price vs seg ref
//                     × brandFactor                ← global brand
//                     × reach                      ← global active channels
//                     × channelAffinity[seg]       ← global, weighted avg
//                     × isTarget(line.targetSegment === seg)   ← per line
//                     × retentionFactor[seg]       ← global retention
//                     × addOnDemandBoost(line,seg) ← line add-on boost
//                     × marketingFactor            ← global
//                     × eventDemandMult            ← global modifier
//                     × cannibalization[seg]       ★ NEW per-segment
//                     × jitter
//
// Cannibalization (step function — explainable):
//   If multiple lines target the SAME segment, those competing lines
//   each take a haircut on their target-segment demand:
//
//     1 line targeting → ×1.00
//     2 lines          → ×0.85
//     3 lines          → ×0.75
//     4+ lines         → ×0.60
//
//   Lines that DON'T target the segment use the standard non-target
//   multiplier (DEMAND_NONTARGET = 0.55) and aren't cannibalized — they
//   were never the focus.
//
// Aggregation:
//   linesByLine[lineId][seg]   raw per-line per-segment demand
//   totalByLine[lineId]        sum across segments → drives line sales
//   totalBySeg[seg]            sum across lines    → portfolio segment view
//   total                      grand total

import type { GameState } from '@/state/store';
import type { Segment, ProductLine } from '@/types';
import { SEGMENTS } from '@/data/segments';
import { CHANNELS } from '@/data/channels';
import { ADDONS } from '@/data/addOns';
import { PHASE_DEMAND_MULT } from '@/data/balance';
import {
  DEMAND_TARGET_BONUS,
  DEMAND_NONTARGET,
  DEMAND_BRAND_MAX_BOOST,
  PRICE_FACTOR_MIN,
  PRICE_FACTOR_MAX,
} from './config';
import { aggregateActive } from './modifiers';
import { calcEffectivePriceForLine, currentAddOnsForLine } from './cost';
import { phaseOf } from '@/utils/format';
import { clamp, clamp01, finite, nonNeg, safeDiv } from './validation';

const MARKETING_FULL_BOOST = 25;
const ADDON_DEMAND_CAP = 0.6;
const REACH_FLOOR = 0.3;
const DEFAULT_CHANNEL_AFFINITY = 0.6;

// ---- Cannibalization step function ---------------------------------

const cannibalizationFactor = (linesOnSameSeg: number): number => {
  if (linesOnSameSeg <= 1) return 1.0;
  if (linesOnSameSeg === 2) return 0.85;
  if (linesOnSameSeg === 3) return 0.75;
  return 0.6;
};

/** Map of segment → number of lines whose targetSegment is that segment. */
const countLinesByTargetSegment = (
  lines: ProductLine[],
): Record<Segment, number> => {
  const out: Record<Segment, number> = { students: 0, creators: 0, professionals: 0, gift: 0 };
  for (const l of lines) {
    if (l.targetSegment) out[l.targetSegment] += 1;
  }
  return out;
};

// ---- Per-line projections -------------------------------------------

/** Product fit between a specific line and a segment. */
const calcSegmentFitForLine = (line: ProductLine, seg: Segment): number => {
  const def = SEGMENTS.find((x) => x.id === seg);
  if (!def) return 0;
  const list = currentAddOnsForLine(line);

  const paper = line.paperQuality === 'premium' ? 1 : line.paperQuality === 'standard' ? 0.6 : 0.25;
  const cover = line.cover === 'leather' ? 1 : 0.5;
  const decor = clamp01(
    list.filter((a) => {
      const d = ADDONS.find((x) => x.id === a.defId);
      return d?.category.startsWith('integrated_sticker') ||
        d?.category.startsWith('decorative') ||
        d?.category.startsWith('integrated_charm');
    }).length / 3,
  );
  const fnal = clamp01(
    list.filter((a) => ADDONS.find((x) => x.id === a.defId)?.category.startsWith('functional')).length / 2,
  );
  const pkg = list.find((a) => ADDONS.find((x) => x.id === a.defId)?.category.startsWith('integrated_ribbon')) ? 1 : 0.2;

  const w = def.preference;
  const fit =
    w.paperQuality * paper +
    w.coverPremium * cover +
    w.decorative * decor +
    w.functional * fnal +
    w.packaging * pkg;
  const wsum = w.paperQuality + w.coverPremium + w.decorative + w.functional + w.packaging;
  return clamp01(safeDiv(fit, wsum, 0));
};

/** Backwards-compat: fit of the active line. */
const calcSegmentFit = (s: GameState, seg: Segment): number => {
  const line = s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId);
  return line ? calcSegmentFitForLine(line, seg) : 0;
};

const calcBrandFactor = (s: GameState): number =>
  1 + clamp01(safeDiv(s.player.brand, 100, 0)) * (DEMAND_BRAND_MAX_BOOST - 1);

const calcChannelAffinity = (s: GameState, seg: Segment): number => {
  const active = s.channels.active;
  if (active.length === 0) return 0.4;
  const sum = active.reduce((acc, id) => {
    const c = CHANNELS.find((x) => x.id === id);
    const a = c?.segmentAffinity?.[seg];
    return acc + (a !== undefined ? finite(a, DEFAULT_CHANNEL_AFFINITY) : DEFAULT_CHANNEL_AFFINITY);
  }, 0);
  return Math.max(0.1, safeDiv(sum, active.length, DEFAULT_CHANNEL_AFFINITY));
};

const calcReach = (s: GameState): number => {
  const r = s.channels.active.reduce(
    (sum, id) => sum + finite(CHANNELS.find((c) => c.id === id)?.reach, 0),
    0,
  );
  return Math.max(REACH_FLOOR, r);
};

const calcPriceFactor = (effectivePrice: number, refPrice: number, sensitivity: number): number => {
  const ratio = safeDiv(effectivePrice, refPrice, 1);
  if (ratio <= 0) return PRICE_FACTOR_MAX;
  const raw = 2 - Math.pow(ratio, finite(sensitivity, 1));
  return clamp(finite(raw, 1), PRICE_FACTOR_MIN, PRICE_FACTOR_MAX);
};

const calcRetentionFactor = (s: GameState, seg: Segment): number => {
  const r = clamp01(finite(s.market.retention?.[seg], 0));
  return 0.85 + r * 0.4;
};

const calcAddOnDemandBoostForLine = (line: ProductLine, seg: Segment): number => {
  const list = currentAddOnsForLine(line);
  let boost = 0;
  for (const inst of list) {
    const def = ADDONS.find((a) => a.id === inst.defId);
    if (!def) continue;
    const segBoost = def.segmentBoost?.[seg];
    if (segBoost !== undefined) boost += finite(segBoost, 0);
  }
  return 1 + clamp(boost, 0, ADDON_DEMAND_CAP);
};

const calcMarketingFactor = (marketingPerDay: number): number => {
  const norm = clamp01(safeDiv(finite(marketingPerDay, 0), MARKETING_FULL_BOOST, 0));
  return 1 + 0.5 * norm;
};

// ---- Per-line demand vector ----------------------------------------

interface LineDemandResult {
  /** demand by segment for THIS line */
  bySeg: Record<Segment, number>;
  /** sum across segments — what this line will try to sell today */
  total: number;
}

/**
 * Today's demand for a single product line. The cannibalization map is
 * passed in so all lines see a consistent count of who else is targeting
 * the same segment (avoids recomputing in a hot loop).
 */
const calcDemandTodayForLine = (
  s: GameState,
  line: ProductLine,
  rand: () => number,
  linesByTargetSeg: Record<Segment, number>,
): LineDemandResult => {
  const phase = phaseOf(s.meta.day);
  const phaseMult = finite(PHASE_DEMAND_MULT[phase], 1);
  const reach = calcReach(s);
  const brandFactor = calcBrandFactor(s);
  const mods = aggregateActive(s.activeModifiers);
  const eventDemandMult = finite(mods.demandMult, 1);
  const effectivePrice = calcEffectivePriceForLine(s, line);
  const marketingFactor = calcMarketingFactor(s.channels.marketingPerDay * finite(mods.marketingMult, 1));

  const bySeg = { students: 0, creators: 0, professionals: 0, gift: 0 } as Record<Segment, number>;
  for (const seg of SEGMENTS) {
    const isThisSegTarget = line.targetSegment === seg.id;
    const fit = calcSegmentFitForLine(line, seg.id);
    const priceFactor = calcPriceFactor(effectivePrice, finite(seg.preferredPriceRef, 6), finite(seg.priceSensitivity, 1));
    const isTarget = isThisSegTarget ? DEMAND_TARGET_BONUS : DEMAND_NONTARGET;
    const channelAffinity = calcChannelAffinity(s, seg.id);
    const retentionFactor = calcRetentionFactor(s, seg.id);
    const addOnBoost = calcAddOnDemandBoostForLine(line, seg.id);
    const cannib = isThisSegTarget ? cannibalizationFactor(linesByTargetSeg[seg.id]) : 1;
    const jitter = 0.85 + rand() * 0.3;

    const d =
      finite(seg.baseDemand, 0) *
      phaseMult *
      fit *
      priceFactor *
      brandFactor *
      reach *
      channelAffinity *
      isTarget *
      retentionFactor *
      addOnBoost *
      marketingFactor *
      eventDemandMult *
      cannib *
      jitter;

    bySeg[seg.id] = nonNeg(d);
  }
  const total = nonNeg(Object.values(bySeg).reduce((a, b) => a + b, 0));
  return { bySeg, total };
};

// ---- Portfolio-wide demand -----------------------------------------

interface PortfolioDemandResult {
  /** demand[lineId] = { bySeg, total } */
  byLine: Record<string, LineDemandResult>;
  /** demand by segment summed across all lines */
  totalBySeg: Record<Segment, number>;
  /** grand total demand across portfolio */
  total: number;
  /** count of lines targeting each segment (cannibalization factor input) */
  linesByTargetSeg: Record<Segment, number>;
}

/**
 * Roll demand for every product line in the portfolio. Results are
 * indexed by lineId so the simulation engine can match each line's
 * demand to its own finished inventory.
 */
export const calcDemandToday = (s: GameState, rand: () => number): PortfolioDemandResult => {
  const lines = s.portfolio.productLines;
  const linesByTargetSeg = countLinesByTargetSegment(lines);
  const byLine: Record<string, LineDemandResult> = {};
  const totalBySeg: Record<Segment, number> = { students: 0, creators: 0, professionals: 0, gift: 0 };
  let total = 0;
  for (const line of lines) {
    const r = calcDemandTodayForLine(s, line, rand, linesByTargetSeg);
    byLine[line.id] = r;
    for (const seg of SEGMENTS) totalBySeg[seg.id] += r.bySeg[seg.id];
    total += r.total;
  }
  return { byLine, totalBySeg, total, linesByTargetSeg };
};
