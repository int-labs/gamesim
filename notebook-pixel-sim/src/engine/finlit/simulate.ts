// V3 phase simulator — deterministic (matches the sheet; no RNG). Given the
// player's lines + company decisions + phase, it runs 30 days and returns a
// full P&L + operational summary. Pure: no store, no side effects.
//
// Cost layers (kept distinct so the P&L reads cleanly):
//   • COGS         — unitCost(spec) × units SOLD (recognised at sale)
//   • channelCost  — per stocked channel: maintenance/day + consignment×sold
//                    + inventoryCost×sold (variable, tied to actual sales)
//   • opex         — ongoing daily operating cost of marketing + hiring +
//                    per-line vendor engagement (the sheet's Cost columns)
// (One-time key-decision MONEY costs from the PDF are applied separately by the
//  key-decision system, not here.)

import {
  PHASE_LENGTH_DAYS, GAME_PHASE_TO_DEMAND, BASE_MARKET_SHARE, DEMAND_SCALE,
  HOLDING_RATE_PER_DAY, marketingDemandMult, salesSellBonus,
  prodPerDay, unitCost, customersPer30d, genreDemand,
  channelRow, hireLevel, vendorCoverage,
  type GenreId,
} from '@/data/finlit';
import { vocFit } from './fit';
import type { FinlitLine, FinlitDecisions, FinlitPhaseResult, FinlitDaySnapshot, FinlitLineResult } from './types';

/** Overstock threshold: finished inventory beyond N days of demand reads as excess. */
const OVERSTOCK_DAYS_COVER = 5;

interface LinePlan {
  line: FinlitLine;
  prodDay: number;
  unitCostLine: number;
  demandDay: number; // fit- & bonus-adjusted units/day wanted
  addressable30d: number; // genreDemand × share (the line's own slice)
  vendorDayCost: number;
  finished: number;
  // accumulators
  produced: number; sold: number; demand: number; revenue: number; cogs: number;
}

export function simulatePhase(
  lines: FinlitLine[],
  decisions: FinlitDecisions,
  phase: 1 | 2 | 3,
  opts: { marketShare?: number } = {},
): FinlitPhaseResult {
  const phaseKey = GAME_PHASE_TO_DEMAND[phase];
  const share = opts.marketShare ?? BASE_MARKET_SHARE;
  const demandMult = decisions.demandMult ?? 1;
  const sellMult = decisions.sellMult ?? 1;

  // Company-wide daily operating costs + global sell/prod bonuses.
  //   • Marketing budget → lifts demand (folded into demandMult below).
  //   • Sales budget     → lifts sell-rate (added to globalSellBonus).
  //   • Both $/day spends flow into companyOpexDay.
  const hire = decisions.hire ? hireLevel(decisions.hire.candidate, decisions.hire.level) : null;
  const marketingBudget = Math.max(0, decisions.marketingBudget ?? 0);
  const salesBudget = Math.max(0, decisions.salesBudget ?? 0);
  const companyOpexDay = (hire?.cost ?? 0) + marketingBudget + salesBudget;
  const globalSellBonus = (hire?.sellBonus ?? 0) + salesSellBonus(salesBudget);
  const globalProdBonus = hire?.prodBonus ?? 0;
  const marketingMult = marketingDemandMult(marketingBudget);

  // Build a per-line plan.
  const plans: LinePlan[] = lines.map((line) => {
    const vend = line.vendor ? vendorCoverage(line.vendor, phase === 3 ? 2 : (phase as 1 | 2), line.genre) : null;
    const vendorSell = vend?.sellBonus ?? 0;
    const vendorProd = vend?.prodBonus ?? 0;
    const vendorDayCost = vend?.cost ?? 0;

    const capacity = prodPerDay(line.spec, globalProdBonus + vendorProd);
    // The player's production target throttles output below capacity (LP2).
    const prodDay = line.targetPerDay != null ? Math.max(0, Math.min(line.targetPerDay, capacity)) : capacity;
    const unitCostLine = unitCost(line.spec);
    const sellBonus = globalSellBonus + vendorSell;
    const fit = vocFit(line.spec, line.price, line.channels, line.genre);
    const demand = genreDemand(line.genre, phaseKey);

    // Sum demand across stocked channels; each channel uses its split + sell-rate.
    let demand30d = 0;
    for (const ch of line.channels) {
      const row = channelRow(line.genre, ch);
      demand30d += customersPer30d({
        demand, channelSellRate: row.sellRate, sellBonus, split: row.split, share,
      });
    }
    demand30d *= fit * demandMult * marketingMult * sellMult * DEMAND_SCALE;
    const demandDay = demand30d / PHASE_LENGTH_DAYS;
    const addressable30d = demand * share * DEMAND_SCALE;

    return {
      line, prodDay, unitCostLine, demandDay, addressable30d, vendorDayCost,
      finished: line.finished,
      produced: 0, sold: 0, demand: 0, revenue: 0, cogs: 0,
    };
  });

  const series: FinlitDaySnapshot[] = [];
  let stockoutDays = 0;
  let overstockDays = 0;

  for (let d = 1; d <= PHASE_LENGTH_DAYS; d++) {
    let dProduced = 0, dSold = 0, dRevenue = 0, dCogs = 0, dChannelCost = 0, dDemand = 0;
    let dayHadStockout = false;
    let dayHadOverstock = false;

    for (const p of plans) {
      // Produce.
      p.finished += p.prodDay;
      p.produced += p.prodDay;
      dProduced += p.prodDay;

      // Sell (gated by inventory).
      const want = p.demandDay;
      dDemand += want;
      p.demand += want;
      const sold = Math.min(want, p.finished);
      p.finished -= sold;
      p.sold += sold;
      dSold += sold;

      // Revenue + COGS.
      const rev = sold * p.line.price;
      const cogs = sold * p.unitCostLine;
      p.revenue += rev;
      p.cogs += cogs;
      dRevenue += rev;
      dCogs += cogs;

      // Channel costs — maintenance/day for each stocked channel + variable
      // consignment/inventory tied to units sold (allocated by split weight).
      const splits = p.line.channels.map((ch) => channelRow(p.line.genre, ch).split);
      const splitSum = splits.reduce((a, b) => a + b, 0) || 1;
      p.line.channels.forEach((ch, i) => {
        const row = channelRow(p.line.genre, ch);
        const soldVia = sold * (splits[i] / splitSum);
        dChannelCost += row.maintenance + (row.consignment + row.inventoryCost) * soldVia;
      });

      // Holding cost — unsold finished stock ties up cash each day it sits
      // (charged as an inventory/channel overhead). This gives over-production
      // a real cost, since COGS above is recognised only on units sold.
      dChannelCost += p.finished * p.unitCostLine * HOLDING_RATE_PER_DAY;

      // Tolerant cleanliness: only flag a MEANINGFUL miss, so producing roughly
      // to demand reads as clean (exact fractional matching is impossible).
      const unmet = want - sold;
      if (unmet > Math.max(1, want * 0.2)) dayHadStockout = true; // missed >20% of demand
      if (p.finished > Math.max(want * OVERSTOCK_DAYS_COVER, 8)) dayHadOverstock = true; // real pile-up
    }

    const dOpex = companyOpexDay + plans.reduce((a, p) => a + p.vendorDayCost, 0);
    if (dayHadStockout) stockoutDays++;
    if (dayHadOverstock) overstockDays++;

    series.push({
      day: d,
      produced: dProduced,
      sold: dSold,
      revenue: dRevenue,
      cogs: dCogs,
      opex: dOpex,
      channelCost: dChannelCost,
      netCash: dRevenue - dCogs - dOpex - dChannelCost,
      finished: plans.reduce((a, p) => a + p.finished, 0),
      demandUnits: dDemand,
      stockout: dayHadStockout,
      overstock: dayHadOverstock,
    });
  }

  // Roll up.
  const sum = (f: (s: FinlitDaySnapshot) => number) => series.reduce((a, s) => a + f(s), 0);
  const revenue = sum((s) => s.revenue);
  const cogs = sum((s) => s.cogs);
  const opex = sum((s) => s.opex);
  const channelCost = sum((s) => s.channelCost);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex - channelCost;

  const byLine: FinlitLineResult[] = plans.map((p) => ({
    lineId: p.line.id,
    genre: p.line.genre,
    produced: p.produced,
    sold: p.sold,
    demand: p.demand,
    revenue: p.revenue,
    cogs: p.cogs,
    endingInventory: p.finished,
    shareCaptured: p.addressable30d > 0 ? Math.min(1, p.sold / p.addressable30d) * share : 0,
  }));

  const addressableTotal = plans.reduce((a, p) => a + p.addressable30d, 0);
  const soldTotal = plans.reduce((a, p) => a + p.sold, 0);
  const marketShare = addressableTotal > 0 ? Math.min(1, soldTotal / addressableTotal) * share : 0;

  return {
    phase,
    days: PHASE_LENGTH_DAYS,
    revenue,
    cogs,
    grossProfit,
    opex,
    channelCost,
    netProfit,
    producedTotal: plans.reduce((a, p) => a + p.produced, 0),
    soldTotal,
    demandTotal: plans.reduce((a, p) => a + p.demand, 0),
    endingInventory: plans.reduce((a, p) => a + p.finished, 0),
    stockoutDays,
    overstockDays,
    marketShare,
    series,
    byLine,
  };
}

export type { GenreId };
