// Simulation orchestrator — portfolio model.
//
// Each tick processes EVERY product line through the full pipeline:
// per-line demand → per-line production → per-line sales → ledger
// entries tagged with lineId. Shared resources (capacity, channels,
// brand, retention, modifiers) live at the company level and the engine
// applies them once per tick.
//
// Order of operations (per day):
//
//   0.  Phase rollover (must be BEFORE demand calc so phaseMult is correct)
//   1.  Drain pending cash (AR/AP)
//   2.  Expire stale modifiers
//   3.  Cache fits per line × per segment
//   4.  Roll demand for whole portfolio (single seeded RNG → all lines)
//   4b. Auto-buy raw materials per line (just-in-time, cash-gated) — the
//       manual Buy Raw panel is hidden; the studio restocks itself
//   5.  Plan production (shared capacity, proportional allocation)
//   6.  Apply production → consume raw, add finished per line
//   7.  Sales loop per line:
//        sold[i] = min(round(demand[i].total), line.finished)
//        lost[i] = max(0, demand - finished)
//        ledger entries tagged with lineId
//   8.  Pay daily opex (labor + marketing) — company-wide
//   9.  Update brand & retention (global) using portfolio aggregates
//   10. Recompute aggregate inventory rollup
//   11. Append daily series snapshot (totals)
//   12. Interrupts: events / evaluations / end-of-game
//
// Every numeric path passes through validation helpers — NaN can't leak.

import type { GameState } from '@/state/store';
import type { LedgerEntry, ProductLine, Segment } from '@/types';
import { SEGMENTS } from '@/data/segments';
import { CHANNELS } from '@/data/channels';
import { PHASE_MAX_ENERGY } from '@/data/balance';
import { eventForDay } from '@/data/events';
import { phaseOf } from '@/utils/format';
import { mulberry32, seedFrom } from '@/utils/rng';

import {
  CHANNEL_DSO,
  ENERGY_REPLENISH,
  OVERSTOCK_DAYS_COVER,
  BRAND_MAX,
  BRAND_MIN,
} from './config';
import { aggregateActive, expireModifiers } from './modifiers';
import { drainCashSchedule, makePendingId, type PendingCash } from './cashflow';
import {
  calcUnitCostForLine,
  calcEffectivePriceForLine,
  calcRawPurchaseUnitCostForLine,
  calcDailyOpex,
  PACKAGING_PER_UNIT,
  FULFILLMENT_PER_UNIT,
} from './cost';
import { planProduction, dailyTargetForLine } from './production';
import { calcDemandToday, calcSegmentFitForLine } from './demand';
import { clamp, finite, nonNeg, roundInt } from './validation';

export const dayTick = (s: GameState) => {
  // 0. Phase rollover — bump first so today's calc uses the new phase.
  // We refill energy on TWO triggers:
  //   (a) `phaseOf(day)` differs from current `meta.phase`  — covers
  //       Phase 2 / 3 boundaries when the engine catches up.
  //   (b) `meta.day ∈ {1, 31, 61}` — covers the opening tick where
  //       phase numbers already match (both 1) so (a) misses.
  const newPhase = phaseOf(s.meta.day);
  const isPhaseBoundaryDay = s.meta.day === 1 || s.meta.day === 31 || s.meta.day === 61;
  if (newPhase !== s.meta.phase || isPhaseBoundaryDay) {
    s.meta.phase = newPhase;
    s.player.maxEnergy = PHASE_MAX_ENERGY[newPhase];
    s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + ENERGY_REPLENISH);
  }

  // 1. Drain cash schedule.
  const drained = drainCashSchedule(s.cashSchedule, s.meta.day);
  s.cashSchedule = drained.remaining;
  if (drained.applied !== 0) {
    s.player.cash = finite(s.player.cash + drained.applied, s.player.cash);
    for (const e of drained.entries) {
      pushLedger(s, {
        kind: e.amount > 0 ? 'cash-in' : 'cash-out',
        amount: 0,
        cause: e.source,
      });
    }
  }

  // 2. Expire stale modifiers.
  s.activeModifiers = expireModifiers(s.activeModifiers, s.meta.day);

  // 3. Cache per-line × per-segment fits.
  const lines = s.portfolio.productLines;
  for (const line of lines) {
    const map: Record<Segment, number> = { students: 0, creators: 0, professionals: 0, gift: 0 };
    for (const seg of SEGMENTS) map[seg.id] = calcSegmentFitForLine(line, seg.id);
    s.market.fitBySegmentByLineId[line.id] = map;
  }
  // Drop fits for any deleted lines.
  for (const lid of Object.keys(s.market.fitBySegmentByLineId)) {
    if (!lines.find((l) => l.id === lid)) delete s.market.fitBySegmentByLineId[lid];
  }

  // 4. Roll demand for whole portfolio.
  const rand = mulberry32(seedFrom(`${s.meta.seed}-${s.meta.day}`));
  const portfolioDemand = calcDemandToday(s, rand);

  // 4b. Just-in-time raw replenishment. The manual Buy Raw panel is hidden
  //     (product direction), so the studio restocks materials automatically
  //     each morning: every line tops up to cover today's build target, cash
  //     permitting (partial buys when short — production throttles with the
  //     cash crunch instead of silently starving). Costs flow through the
  //     same `buy_raw` ledger cause the manual purchase used, so the P&L
  //     projection and the raw-purchase insight stay coherent. Free raw from
  //     events (`rawAdd`) and the supplier_bulk upgrade reduces what needs
  //     buying. Deliberately NO history entry — auto-buys aren't decisions.
  for (const line of lines) {
    const need = Math.max(0, dailyTargetForLine(line) - nonNeg(line.inventory.raw));
    if (need <= 0) continue;
    const unitCost = Math.max(0.01, finite(calcRawPurchaseUnitCostForLine(s, line), 0.01));
    const affordable = Math.min(need, Math.floor(nonNeg(s.player.cash) / unitCost));
    if (affordable <= 0) continue;
    const cost = affordable * unitCost;
    s.player.cash = finite(s.player.cash - cost, s.player.cash);
    line.inventory.raw = nonNeg(line.inventory.raw + affordable);
    pushLedger(s, {
      kind: 'inventory-purchase',
      amount: -cost,
      cause: 'buy_raw',
      decisionId: line.id,
    });
  }

  // 5. Plan production (shared-capacity allocation).
  const plan = planProduction(s);

  // 6. Apply production per line.
  let totalProducedToday = 0;
  for (const lp of plan.byLine) {
    const line = lines.find((l) => l.id === lp.lineId);
    if (!line) continue;
    line.inventory.raw = nonNeg(line.inventory.raw - lp.attempted);
    line.inventory.finished = nonNeg(line.inventory.finished + lp.finishedAdded);
    line.inventory.producedToday = lp.finishedAdded;
    totalProducedToday += lp.finishedAdded;
  }

  // 7. Sales loop per line. Each line's demand competes for ITS OWN
  //    finished inventory; lines do not steal stock from each other.
  let totalSold = 0;
  let totalLost = 0;
  let totalRevenue = 0;
  let totalMatCost = 0;
  let totalPackaging = 0;
  let totalFulfillment = 0;
  const linesWithStockout: string[] = [];
  const linesWithOverstock: string[] = [];

  for (const line of lines) {
    const demandForLine = portfolioDemand.byLine[line.id]?.total ?? 0;
    const intDemand = roundInt(demandForLine);
    const sold = Math.max(0, Math.min(intDemand, line.inventory.finished));
    const lost = Math.max(0, intDemand - line.inventory.finished);
    line.inventory.finished = nonNeg(line.inventory.finished - sold);

    // Cleanliness counters per line
    if (lost > 0) {
      line.inventory.stockoutDays += 1;
      linesWithStockout.push(line.id);
    }
    const overstockThreshold = OVERSTOCK_DAYS_COVER * Math.max(4, intDemand);
    const isOverstocked = line.inventory.finished > overstockThreshold;
    if (isOverstocked) {
      line.inventory.overstockDays += 1;
      linesWithOverstock.push(line.id);
    }

    // Per-line P&L
    const effectivePrice = calcEffectivePriceForLine(s, line);
    const unitCost = calcUnitCostForLine(s, line);
    const revenue = nonNeg(sold * effectivePrice);
    const matCost = nonNeg(sold * unitCost);
    const packaging = nonNeg(sold * PACKAGING_PER_UNIT);
    const fulfillment = nonNeg(sold * FULFILLMENT_PER_UNIT);

    if (revenue > 0) {
      pushLedger(s, {
        kind: 'revenue',
        amount: revenue,
        cause: causeForLineSales(line),
        decisionId: line.id,
      });
      distributeRevenueToCash(s, revenue);
    }
    if (matCost > 0) {
      pushLedger(s, {
        kind: 'cogs-material',
        amount: -matCost,
        cause: `cogs_material_${line.cover}`,
        decisionId: line.id,
      });
    }
    if (packaging > 0) {
      pushLedger(s, {
        kind: 'cogs-packaging',
        amount: -packaging,
        cause: 'packaging_per_unit',
        decisionId: line.id,
      });
      // Route packaging through the cash schedule with the same DSO as
      // its originating channel — otherwise cash debits day-of-sale
      // while revenue is delayed, creating a false mid-phase crunch.
      distributeCashOutflowAcrossChannels(s, packaging, 'packaging');
    }
    if (fulfillment > 0) {
      pushLedger(s, {
        kind: 'cogs-fulfillment',
        amount: -fulfillment,
        cause: 'fulfillment_per_unit',
        decisionId: line.id,
      });
      distributeCashOutflowAcrossChannels(s, fulfillment, 'fulfillment');
    }

    totalSold += sold;
    totalLost += lost;
    totalRevenue += revenue;
    totalMatCost += matCost;
    totalPackaging += packaging;
    totalFulfillment += fulfillment;
  }

  // 8. Daily company-wide opex (labor + marketing).
  const { labor, marketing } = calcDailyOpex(s);
  if (labor > 0) {
    pushLedger(s, { kind: 'cogs-labor', amount: -labor, cause: 'wages_hires' });
    s.player.cash -= labor;
  }
  if (marketing > 0) {
    pushLedger(s, { kind: 'opex-marketing', amount: -marketing, cause: 'marketing_run_rate' });
    s.player.cash -= marketing;
  }
  s.player.cash = finite(s.player.cash, 0);

  // 9. Brand & retention (global) — driven by portfolio totals.
  // Brand decays gently so an early Phase-1 day (sold ~3-5) doesn't
  // monotonically grind brand to 0. Decay ramps up only when the
  // business stalls (no sales); active sales days are roughly net-flat.
  const profit = totalRevenue - totalMatCost - totalPackaging - totalFulfillment - labor - marketing;
  const mods = aggregateActive(s.activeModifiers);
  const brandDecay = totalSold === 0 ? 0.08 : 0.05;
  s.player.brand = clamp(
    finite(s.player.brand + totalSold * 0.04 - totalLost * 0.06 - brandDecay, s.player.brand),
    BRAND_MIN,
    BRAND_MAX,
  );
  // Retention updates per segment based on whether ANY line targeting that
  // segment sold today. Multiple lines on the same segment don't double-credit.
  for (const seg of SEGMENTS) {
    const segId = seg.id;
    const segDemand = portfolioDemand.totalBySeg[segId];
    if (segDemand <= 0) continue;
    // Did any line targeting this segment make sales? Approximate via per-line
    // sales weighted by segment fit.
    const linesOnSeg = lines.filter((l) => l.targetSegment === segId);
    if (linesOnSeg.length === 0) continue;
    const anySold = linesOnSeg.some((l) => (portfolioDemand.byLine[l.id]?.bySeg[segId] ?? 0) > 0);
    const prev = finite(s.market.retention[segId], 0);
    const baseRet = prev * 0.985 + (anySold ? 0.04 : -0.005);
    s.market.retention[segId] = clamp(finite(baseRet * mods.retentionMult, prev), 0, 1);
  }

  // 10. Recompute aggregate inventory rollup.
  const totalRaw = lines.reduce((acc, l) => acc + l.inventory.raw, 0);
  const totalFinished = lines.reduce((acc, l) => acc + l.inventory.finished, 0);
  if (linesWithStockout.length > 0) s.inventory.stockoutDays += 1;
  if (linesWithOverstock.length > 0) s.inventory.overstockDays += 1;
  s.inventory.totalRaw = totalRaw;
  s.inventory.totalFinished = totalFinished;
  s.inventory.productionPerDay = totalProducedToday;
  s.inventory.linesWithStockout = linesWithStockout;
  s.inventory.linesWithOverstock = linesWithOverstock;

  // 11. Series snapshot for charts (totals).
  s.series.cash.push(roundInt(s.player.cash));
  s.series.revenue.push(roundInt(totalRevenue));
  s.series.profit.push(roundInt(profit));
  s.series.sold.push(totalSold);
  s.series.finished.push(totalFinished);
  s.series.raw.push(totalRaw);
  s.series.demand.push(roundInt(portfolioDemand.total));
  s.series.stockout.push(totalLost);
  s.series.overstock.push(linesWithOverstock.length > 0 ? totalFinished : 0);

  // 12. Interrupts.
  const ev = eventForDay(s.meta.day);
  if (ev && !s.events.resolved.find((r) => r.id === ev.id)) {
    s.meta.pendingEventId = ev.id;
  }
  if (s.meta.day === 30 || s.meta.day === 60 || s.meta.day === 90) {
    s.meta.pendingEvalPhase = newPhase;
  }
  // Day 90 — auto-repay any outstanding debt (investor route, finance
  // loan upgrade, event-induced debt) from cash. Cash can go negative
  // here on purpose; the negative balance feeds scoring as the
  // "obligation missed" penalty signal.
  if (s.meta.day === 90 && s.player.debt > 0) {
    const owed = s.player.debt;
    s.player.cash -= owed;
    s.player.debt = 0;
    s.history.push({
      day: 90,
      text: `Repaid outstanding obligation of $${owed}.`,
      cause: 'debt_settle',
    });
  }
  if (s.meta.day >= 90) s.meta.ended = true;
};

export const advanceDay = (s: GameState, days = 1) => {
  for (let i = 0; i < days; i++) {
    if (s.meta.ended) break;
    if (s.meta.pendingEventId || s.meta.pendingEvalPhase !== null) break;
    s.meta.day += 1;
    dayTick(s);
  }
};

// ---------------- Helpers -------------------------------------------------

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

function causeForLineSales(line: ProductLine): string {
  return 'sales_' + (line.targetSegment ?? 'mixed') + '_' + line.id;
}

/**
 * Distribute a single line's revenue across active channels by reach
 * share, then schedule cash receipts according to channel DSO. Channels
 * are company-wide so we share the same routing logic across every line.
 */
function distributeRevenueToCash(s: GameState, revenue: number) {
  const active = s.channels.active;
  if (active.length === 0 || revenue <= 0) return;
  const reachByChannel = active.map((id) => finite(CHANNELS.find((c) => c.id === id)?.reach, 0.4));
  const reachSum = reachByChannel.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < active.length; i++) {
    const id = active[i];
    const share = reachByChannel[i] / reachSum;
    const slice = nonNeg(revenue * share);
    if (slice <= 0) continue;
    const dso = finite(CHANNEL_DSO[id], 0);
    if (dso === 0) {
      s.player.cash += slice;
    } else {
      const pc: PendingCash = {
        id: makePendingId(),
        day: s.meta.day + dso,
        amount: slice,
        source: `sale_${id}`,
      };
      s.cashSchedule.push(pc);
    }
  }
  s.player.cash = finite(s.player.cash, 0);
}

/**
 * Mirror of `distributeRevenueToCash` for per-unit-sold cash OUTFLOWS
 * (packaging, fulfillment). Routes the negative amount across active
 * channels by reach share and schedules it on the same DSO as the
 * matching revenue. If a channel is DSO-immediate, the slice debits
 * cash today; otherwise it queues. This keeps cash in/out symmetric
 * per channel — preventing artificial cash crunch when high-DSO
 * channels (online/store) dominate sales.
 */
function distributeCashOutflowAcrossChannels(s: GameState, amount: number, label: string) {
  const active = s.channels.active;
  if (active.length === 0 || amount <= 0) {
    // No active channels — fall back to immediate cash debit so the
    // cost still hits the books.
    s.player.cash -= amount;
    s.player.cash = finite(s.player.cash, 0);
    return;
  }
  const reachByChannel = active.map((id) => finite(CHANNELS.find((c) => c.id === id)?.reach, 0.4));
  const reachSum = reachByChannel.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < active.length; i++) {
    const id = active[i];
    const share = reachByChannel[i] / reachSum;
    const slice = nonNeg(amount * share);
    if (slice <= 0) continue;
    const dso = finite(CHANNEL_DSO[id], 0);
    if (dso === 0) {
      s.player.cash -= slice;
    } else {
      const pc: PendingCash = {
        id: makePendingId(),
        day: s.meta.day + dso,
        amount: -slice,
        source: `${label}_${id}`,
      };
      s.cashSchedule.push(pc);
    }
  }
  s.player.cash = finite(s.player.cash, 0);
}
