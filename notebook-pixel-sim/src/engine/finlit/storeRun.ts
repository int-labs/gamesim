// runFinlitPhase — the store-facing entry point. Given the current GameState
// (an Immer draft), it simulates the current phase with the FinLit engine and
// writes the results back into the store's existing shapes (ledger, series,
// per-line inventory, cash) so the V2 P&L/stats UI renders V3 numbers unchanged.
//
// Pure engine + bridge underneath; this file only does the state plumbing.

import type { GameState } from '@/state/store';
import { ENERGY_PER_PHASE, ENERGY_CAP, type ChannelId } from '@/data/finlit';
import { simulatePhase } from './simulate';
import { toFinlitLines, toFinlitDecisions, type LineInput } from './adapter';
import { phaseResultToLedger, phaseResultToSeries } from './bridge';
import type { FinlitPhaseResult } from './types';

let ledgerSeq = 0;
const ledgerId = () => `fl-${Date.now().toString(36)}-${(ledgerSeq++).toString(36)}`;

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
    vendor: l.vendor,
    targetPerDay: l.targetPerDay,
    finished: l.inventory.finished,
    targetSegment: l.targetSegment,
    stickersSpend,
    channels: activeChannels,
  };
}

function activeChannels(s: GameState): ChannelId[] {
  return s.globalInputSelections
    .filter((sel) => sel.key === 'channel' && sel.selectedStepKey != null)
    .map((sel) => sel.selectedStepKey as ChannelId);
}

/** Derive hire + marketing decisions from globalInputSelections + availableGlobalInputs. */
function resolveDecisionInputs(s: GameState): Parameters<typeof toFinlitDecisions>[0] {
  const hires = s.globalInputSelections
    .filter((sel) => sel.key === 'hiring' && sel.selectedStepKey != null && sel.selectedLevel != null)
    .map((sel) => ({ candidate: sel.selectedStepKey!, level: sel.selectedLevel as 1 | 2 | 3 | 4 }));

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
  const startDay = (phase - 1) * 30 + 1;

  // Ledger — aggregate P&L entries for the phase.
  for (const draft of phaseResultToLedger(result, startDay)) {
    s.ledger.push({ id: ledgerId(), ...draft });
  }

  // Series — append the phase's 30 daily points.
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

  // Cash — recognise the phase's net profit (series cash already pushed above).
  s.player.cash = s.player.cash + result.netProfit;

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
