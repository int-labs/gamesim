// Concrete effect packages per event/option.
// Each entry returns an array of ActiveModifier templates and immediate state
// effects. Day-bound modifiers expire on their endDay.

import type { GameState } from '@/state/store';
import type { ActiveModifier } from './modifiers';
import { makeModifierId } from './modifiers';

interface ImmediateEffect {
  cash?: number;
  rawAdd?: number;
  finishedAdd?: number;
  brandAdd?: number;
  retentionMultTarget?: number;
  defectAdd?: number;
  debtAdd?: number;
  priceSet?: number;        // absolute new price (e.g. liquidate)
  inventorySell?: { upTo: number; priceMult: number }; // sell at discount
}

export interface EventResolution {
  modifiers: ActiveModifier[];
  immediate: ImmediateEffect;
  /** Human label attached to the history entry & the mascot bubble. */
  feedback: string;
}

const mod = (
  name: string,
  cause: string,
  duration: number,
  effects: ActiveModifier['effects'],
): Omit<ActiveModifier, 'startDay' | 'endDay'> => ({
  id: makeModifierId(),
  name,
  cause,
  effects,
});

/** Returns the resolution for `eventId:option` evaluated against current state. */
export function resolveEventOption(
  s: GameState,
  eventId: string,
  option: 'A' | 'B' | 'C' | 'D',
): EventResolution {
  const day = s.meta.day;
  const since = (n: number) => ({ startDay: day, endDay: day + n });
  const permanent = { startDay: day, endDay: null as number | null };

  switch (`${eventId}:${option}`) {
    // ─── Supplier Shock (Day 15) ────────────────────────────────────────
    case 'supplier_shock:A': // absorb cost — margin down, demand stable
      return {
        modifiers: [{ ...mod('Material price spike (absorbed)', eventId, 30, { materialCostMult: 1.2 }), ...since(30) }],
        immediate: {},
        feedback: 'Material cost up 20% for 30 days. Margins thinner; demand unchanged.',
      };
    case 'supplier_shock:B': // pass to customers — margin OK, demand dips
      return {
        modifiers: [
          { ...mod('Price increase to customers', eventId, 30, { priceMult: 1.15 }), ...since(30) },
          { ...mod('Short demand dip from price hike', eventId, 14, { demandMult: 0.9 }), ...since(14) },
        ],
        immediate: {},
        feedback: 'You raised prices 15%. Margin protected, demand dips for two weeks.',
      };
    case 'supplier_shock:C': // secondary supplier — slower, slightly more cost
      return {
        modifiers: [
          { ...mod('Secondary supplier (lead time +2d)', eventId, 20, { capacityMult: 0.9, materialCostMult: 1.08 }), ...since(20) },
        ],
        immediate: {},
        feedback: 'Secondary supplier - slightly higher cost, slower lead time for 20 days.',
      };
    case 'supplier_shock:D': // cut quality — defect up
      // Note: defect bump applied ONCE via immediate (it sticks via ops.defectRate
      // until QA upgrades reduce it). Retention multiplier is the durable side.
      // Previously this both set `defectAdd: 0.06` in the modifier AND in
      // immediate, double-stacking the defect penalty. Fixed.
      return {
        modifiers: [{ ...mod('Reduced product quality', eventId, 30, { retentionMult: 0.9 }), ...permanent }],
        immediate: { defectAdd: 0.06 },
        feedback: 'Quality reduced. Defect rate climbs and retention slips.',
      };

    // ─── Campus Demand Surge (Day 30) ────────────────────────────────────
    case 'demand_surge:A': // rush production
      return {
        modifiers: [{ ...mod('Influencer surge captured', eventId, 10, { demandMult: 1.45 }), ...since(10) }],
        immediate: { cash: -200, rawAdd: 30 },
        feedback: 'Cash −$200 for raw materials. Demand surges for 10 days.',
      };
    case 'demand_surge:B': // waitlist
      return {
        modifiers: [{ ...mod('Waitlist - slower fulfillment', eventId, 10, { demandMult: 1.15, retentionMult: 1.05 }), ...since(10) }],
        immediate: { brandAdd: 6 },
        feedback: 'Waitlist preserves quality. Brand awareness ticks up.',
      };
    case 'demand_surge:C': // raise prices
      return {
        modifiers: [{ ...mod('Temporary price hike', eventId, 7, { priceMult: 1.2, demandMult: 0.92 }), ...since(7) }],
        immediate: {},
        feedback: 'Price up 20% for a week. Margin up, demand softer.',
      };
    case 'demand_surge:D': // decline excess orders
      return {
        modifiers: [{ ...mod('Quality protected, growth capped', eventId, 10, { demandMult: 1.05, retentionMult: 1.05 }), ...since(10) }],
        immediate: { defectAdd: -0.02 },
        feedback: 'Stayed disciplined. Quality stable, growth limited.',
      };

    // ─── Competitor Opens (Day 45) ───────────────────────────────────────
    case 'competitor_opens:A': // differentiate via add-ons
      return {
        modifiers: [
          { ...mod('Differentiation push', eventId, 25, { demandMult: 1.1, materialCostMult: 1.05 }), ...since(25) },
        ],
        immediate: { cash: -30 },
        feedback: 'Add-on differentiation. Slightly higher cost, demand up.',
      };
    case 'competitor_opens:B': // discount campaign
      return {
        modifiers: [{ ...mod('Discount campaign', eventId, 10, { demandMult: 1.18, priceMult: 0.92 }), ...since(10) }],
        immediate: { cash: -80, brandAdd: 4 },
        feedback: 'Discount running for 10 days. Demand spikes; margin pressed.',
      };
    case 'competitor_opens:C': // tighten target segment
      return {
        modifiers: [
          // Boosts the chosen segment's demand multiplier (we apply globally as proxy)
          { ...mod('Tighter focus on chosen segment', eventId, 20, { demandMult: 0.92, retentionMult: 1.12 }), ...since(20) },
        ],
        immediate: {},
        feedback: 'Niche focus. Volume down, retention up - leaner moat.',
      };
    case 'competitor_opens:D': // ignore
      return {
        modifiers: [{ ...mod('Brand decay (ignored competitor)', eventId, 30, { demandMult: 0.94 }), ...since(30) }],
        immediate: { brandAdd: -5 },
        feedback: 'No response. Brand awareness drops; demand cools.',
      };

    // ─── Defect Wave (Day 60) ───────────────────────────────────────────
    case 'defect_wave:A': // recall + apologise
      return {
        modifiers: [{ ...mod('Apology lifts retention', eventId, 20, { retentionMult: 1.12 }), ...since(20) }],
        immediate: { cash: -120 },
        feedback: 'Recall cost $120. Trust recovered.',
      };
    case 'defect_wave:B': // rework batch
      return {
        modifiers: [{ ...mod('Rework - capacity hit', eventId, 5, { capacityMult: 0.7 }), ...since(5) }],
        immediate: {},
        feedback: 'Capacity drops 30% for 5 days while you fix the batch.',
      };
    case 'defect_wave:C': // sell discounted
      return {
        modifiers: [{ ...mod('Discount this batch', eventId, 4, { priceMult: 0.8 }), ...since(4) }],
        immediate: {},
        feedback: 'Discounted to move stock. Margin and retention slightly down.',
      };
    case 'defect_wave:D': // ship as-is
      return {
        modifiers: [{ ...mod('Ship as-is - brand bruised', eventId, 30, { retentionMult: 0.85, demandMult: 0.95 }), ...permanent }],
        immediate: { brandAdd: -10 },
        feedback: 'Shipped a bad batch. Brand bruised; retention drops.',
      };

    // ─── Cash Crunch (Day 75) ───────────────────────────────────────────
    case 'cash_crunch:A': // short-term loan
      return {
        modifiers: [],
        immediate: { cash: 500, debtAdd: 560 },
        feedback: '+$500 cash now. You owe $560 by Day 90.',
      };
    case 'cash_crunch:B': // pause marketing
      return {
        modifiers: [{ ...mod('Marketing paused', eventId, 10, { marketingMult: 0, demandMult: 0.88 }), ...since(10) }],
        immediate: {},
        feedback: 'Marketing paused for 10 days. Cash protected, demand softer.',
      };
    case 'cash_crunch:C': // emergency liquidation
      return {
        modifiers: [],
        immediate: { inventorySell: { upTo: 30, priceMult: 0.7 } },
        feedback: 'Emergency stock sale. 30 units sold at 70%.',
      };
    case 'cash_crunch:D': // renegotiate supplier terms
      return {
        modifiers: [{ ...mod('Renegotiated supplier terms', eventId, 30, { capacityMult: 0.92 }), ...since(30) }],
        immediate: {},
        feedback: 'Supplier terms stretched. Cash relief; lead time longer.',
      };

    // ─── Late Pivot (Day 89) ────────────────────────────────────────────
    case 'late_pivot:A': // pivot premium
      return {
        modifiers: [{ ...mod('Pivot to premium', eventId, 0, { retentionMult: 1.15, demandMult: 0.98 }), ...permanent }],
        immediate: { cash: -60 },
        feedback: 'Pivot to premium. Final-stretch retention up.',
      };
    case 'late_pivot:B': // stay focused
      return {
        modifiers: [],
        immediate: {},
        feedback: 'Stayed the course.',
      };
    case 'late_pivot:C': // hybrid
      return {
        modifiers: [{ ...mod('Hybrid offering', eventId, 0, { demandMult: 0.95, materialCostMult: 1.05 }), ...permanent }],
        immediate: { cash: -40 },
        feedback: 'Hybrid offer is a stretch. Mediocre on every axis.',
      };
    case 'late_pivot:D': // liquidate
      return {
        modifiers: [],
        immediate: { inventorySell: { upTo: 999, priceMult: 0.65 } },
        feedback: 'Liquidated remaining stock at 65%.',
      };

    default:
      return { modifiers: [], immediate: {}, feedback: 'Decision logged.' };
  }
}
