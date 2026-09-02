// runFinlitPhase — the store-facing entry point. Given the current GameState
// (an Immer draft), it simulates the current phase with the FinLit engine and
// writes the results back into the store's existing shapes (ledger, series,
// per-line inventory, cash) so the V2 P&L/stats UI renders V3 numbers unchanged.
//
// Pure engine + bridge underneath; this file only does the state plumbing.

import type { GameState } from '@/state/store';
import { ENERGY_PER_PHASE, ENERGY_CAP, PHASE_LENGTH_DAYS, type ChannelId } from '@/data/finlit';
import { simulatePhase } from './simulate';
import { toFinlitLines, toFinlitDecisions, type LineInput } from './adapter';
// `phaseResultToLedger` is gone from this import with the ledger write, and the
// `ledgerId` generator with it — nothing here mints ledger ids any more.
import { phaseResultToSeries } from './bridge';
import type { FinlitPhaseResult } from './types';

/** Map a store ProductLine into the adapter's narrow LineInput. */
function lineInput(
  l: GameState['portfolio']['productLines'][number],
  activeChannels: ChannelId[],
): LineInput {
  const stickersSpend = Math.min(
    ((l.addOnsByArchetype?.[l.archetype ?? l.genre ?? 'indie'] ?? []).length) * 0.15,
    100,
  );
  return {
    id: l.id,
    name: l.name,
    price: l.price,
    genre: l.genre,
    finlitSpec: l.finlitSpec,
    // The local day-tick scheduler genuinely works in units/day, so the /30
    // lives HERE — at the boundary where a per-day consumer needs it — and
    // nowhere in the UI, which is per phase throughout.
    targetPerDay:
      l.targetPerPhase != null ? l.targetPerPhase / PHASE_LENGTH_DAYS : undefined,
    finished: l.inventory.finished,
    targetSegment: l.targetSegment,
    stickersSpend,
    channels: activeChannels,
  };
}

function activeChannels(s: GameState): ChannelId[] {
  // A channel selection identifies the backend ITEM by `inputId`; the ChannelId
  // the local tables key on is that item's `key`. Reading `selectedStepKey` here
  // returned null for every channel (they are binary and carry no step).
  const channelItems = s.availableGlobalInputs.find((g) => g.key === 'channel')?.inputs ?? [];
  return s.globalInputSelections
    .filter((sel) => sel.key === 'channel')
    .map((sel) => channelItems.find((item) => String(item._id) === sel.inputId)?.key)
    .filter((key): key is ChannelId => key != null);
}

/** Derive hire + marketing decisions from globalInputSelections + availableGlobalInputs. */
function resolveDecisionInputs(s: GameState): Parameters<typeof toFinlitDecisions>[0] {
  // Hiring is no longer modelled by this engine — `simulate.ts` applies neutral
  // multipliers and hire effects live solely in the server's calcFinancials, via
  // globalInputs[].impacts. Kept as an empty list rather than deleted, because
  // `toFinlitDecisions` still declares the field.
  const hires: Array<{ candidate: string; level: 1 | 2 | 3 | 4 }> = [];

  const marketingSel = s.globalInputSelections.find(
    (sel) => sel.key === 'marketing' && sel.selectedStepKey != null,
  );
  const marketingGI = s.availableGlobalInputs.find((g) => g.key === 'marketing');
  const marketingMult = marketingSel?.selectedStepKey != null
    ? (marketingGI?.inputs[0]?.options?.[marketingSel.selectedStepKey] ?? 1)
    : 1;

  return {
    route: s.meta.route ?? 'self',
    hires,
    marketingMult,
    demandMult: s.finlit.demandMult,
    sellMult: s.finlit.sellMult,
  };
}

/** Pure preview — the phase result for the CURRENT state, WITHOUT mutating it.
 *  Used by the confirm modal to show an accurate estimate before the run. */
export function previewFinlitPhase(s: GameState): FinlitPhaseResult {
  const channels = activeChannels(s);
  const lines = toFinlitLines(s.portfolio.productLines.map((l) => lineInput(l, channels)));
  const decisions = toFinlitDecisions(resolveDecisionInputs(s));
  return simulatePhase(lines, decisions, s.meta.phase);
}

export function runFinlitPhase(s: GameState): FinlitPhaseResult {
  const phase = s.meta.phase;
  const channels = activeChannels(s);
  const lines = toFinlitLines(s.portfolio.productLines.map((l) => lineInput(l, channels)));
  const decisions = toFinlitDecisions(resolveDecisionInputs(s));

  const result = simulatePhase(lines, decisions, phase);

  // THE LEDGER IS NO LONGER WRITTEN FROM HERE.
  //
  // This used to push four aggregate P&L rows per round via
  // `phaseResultToLedger(result, phase)` — revenue, cogs, channel and opex —
  // taken from `simulatePhase`, i.e. from the LOCAL engine. The P&L sheet then
  // rendered those under the heading "Actual Results", which they never were:
  // the actual figures come from the server's `calcFinancials`, and an actual
  // cannot exist at all until the administrator calculates the round.
  //
  // `FinanceTable` now reads `financialsByRound` straight from the session, so
  // the money rows have exactly one author. `phaseResultToLedger` is left in
  // `bridge.ts` with no caller rather than deleted in the same change, so this
  // diff is one decision and not two.

  // Series — append the phase's 30 daily points. STILL LOCAL: `state.series`
  // feeds `selectCashTrend`, which the evaluation screen charts. The server has
  // no per-day series to replace it with, so `simulatePhase` cannot be retired
  // in this change — only unhooked from the money path.
  const ser = phaseResultToSeries(result);
  s.series.revenue.push(...ser.revenue);
  s.series.profit.push(...ser.profit);
  s.series.sold.push(...ser.sold);
  s.series.finished.push(...ser.finished);
  s.series.demand.push(...ser.demand);
  s.series.stockout.push(...ser.stockout);
  s.series.overstock.push(...ser.overstock);
  // Running cash balance, one point per day (starting cash + cumulative netCash).
  let running = s.player.cash;
  for (const day of result.series) {
    running += day.netCash;
    s.series.cash.push(Math.round(running));
  }

  // Per-line inventory + cleanliness counters from the rollup.
  const byId = new Map(result.byLine.map((b) => [b.lineId, b]));
  for (const line of s.portfolio.productLines) {
    const b = byId.get(line.id);
    if (!b) continue;
    line.inventory.finished = Math.round(b.endingInventory);
    line.inventory.producedToday = Math.round(b.produced / result.days);
  }
  // Company-wide cleanliness days (from the phase series).
  s.inventory.stockoutDays += result.stockoutDays;
  s.inventory.overstockDays += result.overstockDays;
  s.inventory.totalFinished = s.portfolio.productLines.reduce((a, l) => a + l.inventory.finished, 0);

  // CASH IS NOT ADVANCED HERE ANY MORE.
  //
  // This was `s.player.cash = s.player.cash + result.netProfit`, which made
  // `player.cash` mean "cash right now" and sourced the movement from the local
  // engine. `player.cash` is now the run's OPENING balance — the route's
  // starting capital, and nothing else — and the running balance is derived in
  // `FinanceTable` as opening cash plus every scored round's operating profit.
  //
  // Leaving this line in would double-count: the derived balance would add the
  // server's profit on top of a local profit already banked here.

  return result;
}

/**
 * advanceFinlitPhase — the V3 replacement for the V2 day-tick loop. The player
 * makes decisions for the whole phase, then "runs the simulation": all 30 days
 * resolve at once via the FinLit engine, the day counter jumps to the phase
 * end, and the evaluation is queued — reusing the existing evaluation/insight
 * flow. (Mid-phase key scenarios arrive in P5.)
 */
export function advanceFinlitPhase(s: GameState): FinlitPhaseResult {
  const phase = s.meta.phase;
  const result = runFinlitPhase(s);
  // Scenario multipliers apply to THIS phase only — reset so they don't compound.
  s.finlit.demandMult = 1;
  s.finlit.sellMult = 1;
  const endDay = phase * 30; // 30 / 60 / 90
  s.meta.day = endDay;

  // Energy replenish for the NEXT phase (V3 bypasses the V2 day-tick that used
  // to do this). +30, capped at 100. maxEnergy stays at the cap.
  if (phase < 3) {
    s.player.maxEnergy = ENERGY_CAP;
    s.player.energy = Math.min(ENERGY_CAP, s.player.energy + ENERGY_PER_PHASE);
  }

  // Queue the phase evaluation (same flag the V2 flow uses).
  s.meta.pendingEvalPhase = phase;

  // Day 90 — settle any outstanding obligation from cash, then end the run.
  if (endDay === 90) {
    if (s.player.debt > 0) {
      const owed = s.player.debt;
      s.player.cash -= owed;
      s.player.debt = 0;
      s.history.push({ day: 90, text: `Repaid outstanding obligation of $${owed}.`, cause: 'debt_settle' });
    }
    s.meta.ended = true;
  }
  return result;
}
