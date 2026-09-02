// Insight check generator.
// For each phase evaluation, reads the ACTUAL ledger window and decision
// history, and produces an insight question whose options are derived from
// what the player really did. The "correct" option is the engine's ground
// truth for the largest contributor — players can only score insight points
// by showing they understand THEIR run.

import type { GameState } from '@/state/store';
import type { Phase } from '@/types';

export interface InsightQuestion {
  id: string;
  phase: Phase;
  question: string;
  options: { id: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }[];
  explanation: string;
}

interface CauseSum { cause: string; amount: number }

// Was a DAY WINDOW (`fromDay`..`toDay`). Ledger entries are tagged with the
// round they belong to, not a day, and one round writes a single aggregate set
// of entries — so a sub-round window can only ever match all of that round's
// entries or none of them. The window is gone; the round is the granularity.
function sumByCause(state: GameState, roundNumber: number, sign: 'pos' | 'neg' | 'all' = 'all'): CauseSum[] {
  const map = new Map<string, number>();
  for (const e of state.ledger) {
    if (e.roundNumber !== roundNumber) continue;
    if (sign === 'pos' && e.amount <= 0) continue;
    if (sign === 'neg' && e.amount >= 0) continue;
    const key = e.cause;
    map.set(key, (map.get(key) ?? 0) + Math.abs(e.amount));
  }
  return Array.from(map.entries())
    .map(([cause, amount]) => ({ cause, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function labelCause(cause: string): string {
  if (cause.startsWith('sales_')) {
    const seg = cause.replace('sales_', '');
    return `Sales to ${seg}`;
  }
  if (cause.startsWith('cogs_material_')) return `Material cost (${cause.replace('cogs_material_', '')})`;
  if (cause === 'wages_hires') return 'Helper wages';
  if (cause === 'marketing_run_rate') return 'Daily marketing spend';
  if (cause.startsWith('upgrade_')) return `Upgrade: ${cause.replace('upgrade_', '')}`;
  if (cause === 'buy_raw') return 'Raw material purchase';
  if (cause.startsWith('event_')) return `Event response`;
  return cause;
}

/** Return the insight question for the given phase, derived from real state. */
export function generateInsightQuestion(state: GameState, phase: Phase): InsightQuestion {
  const fromDay = phase === 1 ? 1 : phase === 2 ? 31 : 61;
  const toDay = phase === 1 ? 30 : phase === 2 ? 60 : 90;

  if (phase === 1) {
    // What drove demand most? Correct = "audience focus" if a segment was set
    // and the BEST line fit > 0.55, else "neither — no audience picked".
    const hadSegment = state.market.targetSegment !== null;
    let fit = 0;
    if (state.market.targetSegment) {
      const target = state.market.targetSegment;
      // Take best fit across all lines for the target segment.
      for (const lineId of Object.keys(state.market.fitBySegmentByLineId)) {
        const f = state.market.fitBySegmentByLineId[lineId]?.[target] ?? 0;
        if (f > fit) fit = f;
      }
    }
    const correctIdx = hadSegment && fit >= 0.55 ? 0 : (!hadSegment ? 3 : 0);
    const opts: InsightQuestion['options'] = [
      { id: 'A', text: 'Picking and matching a target audience', correct: correctIdx === 0 },
      { id: 'B', text: 'Buying lots of raw materials', correct: false },
      { id: 'C', text: 'Setting the highest price possible', correct: false },
      {
        id: 'D',
        text: hadSegment ? 'Adding many decorative items' : "I didn't pick an audience - demand stayed weak",
        correct: correctIdx === 3,
      },
    ];
    return {
      id: 'phase1_demand_driver',
      phase,
      question: 'In Phase 1, which lever drove your demand the most?',
      options: opts,
      explanation:
        hadSegment && fit >= 0.55
          ? "You picked an audience and your design fit them - that's why demand had a base to grow from."
          : "Demand was thin because no clear audience was chosen - fit drives every other lever.",
    };
  }

  if (phase === 2) {
    // Find the day with the largest cash drop and its biggest cost contributor.
    // Guarded against sparse data: if cash series is too short or no negative
    // deltas exist, fall back to the dominant cost line across the whole phase.
    const cash = state.series.cash;
    let worstDay = 31;
    let worstDelta = 0;
    for (let i = 30; i < cash.length && i < 60; i++) {
      const prev = cash[i - 1] ?? cash[i] ?? 0;
      const cur = cash[i] ?? 0;
      const delta = cur - prev;
      if (delta < worstDelta) { worstDelta = delta; worstDay = i + 1; }
    }

    // The worst-day window and the whole-phase fallback now resolve to the same
    // set, so only the phase-wide call remains. `worstDay` is still computed
    // above and still feeds the question copy below.
    const causes = sumByCause(state, phase, 'neg');

    const top = causes[0]?.cause ?? '';
    const correctIdx = top.startsWith('cogs_material_') ? 1
                     : top === 'wages_hires' ? 2
                     : top === 'buy_raw' ? 0
                     : top === 'marketing_run_rate' ? 3
                     : 0;

    // If we still have nothing (no costs incurred at all), point at the
    // most defensible default — raw purchase timing — and admit the data
    // is thin in the explanation.
    const explanation = top
      ? `The biggest cash drain in that window was: ${labelCause(top)}.`
      : 'No major cash drains were recorded - Phase 2 ran lean on costs.';

    return {
      id: 'phase2_cash_dip',
      phase,
      question: `Why did cash dip around Day ${worstDay} this phase?`,
      options: [
        { id: 'A', text: 'A raw-material purchase hit cash before sales arrived', correct: correctIdx === 0 },
        { id: 'B', text: 'Material cost climbed with each sale', correct: correctIdx === 1 },
        { id: 'C', text: 'Wages from new helpers stacked up', correct: correctIdx === 2 },
        { id: 'D', text: 'Marketing was bleeding cash without enough sales', correct: correctIdx === 3 },
      ],
      explanation,
    };
  }

  // Phase 3 — diagnose flat profit despite revenue.
  // We compare cost lines to revenue and pick the dominant inefficiency.
  // Falls back to "demand" when no standout exists (the run was balanced
  // but volume was weak).
  const ledger = state.ledger;
  const revenue = ledger.filter((e) => e.kind === 'revenue').reduce((s, e) => s + e.amount, 0);
  const matCost = ledger.filter((e) => e.kind === 'cogs-material').reduce((s, e) => s - e.amount, 0);
  const opex = ledger.filter((e) => e.kind.startsWith('opex')).reduce((s, e) => s - e.amount, 0);

  const denom = Math.max(1, revenue);
  const matRatio = matCost / denom;
  const opexRatio = opex / denom;

  // Whichever cost-to-revenue ratio is the highest wins, with a tie-break
  // toward material (most directly controllable). Price-too-low is only
  // reported when revenue exists AND price is genuinely below segment refs.
  let topReason: 'material' | 'opex' | 'demand' | 'price';
  if (matRatio >= opexRatio && matRatio > 0.45) topReason = 'material';
  else if (opexRatio > matRatio && opexRatio > 0.35) topReason = 'opex';
  else if (revenue > 0 && Math.min(...state.portfolio.productLines.map((l) => l.price)) < 8) topReason = 'price';
  else topReason = 'demand';

  return {
    id: 'phase3_pl_diagnosis',
    phase,
    question: 'Across the full run, the biggest reason profit didn\'t scale with revenue was:',
    options: [
      { id: 'A', text: 'Material cost climbed with each sale', correct: topReason === 'material' },
      { id: 'B', text: 'Operating expenses outran revenue', correct: topReason === 'opex' },
      { id: 'C', text: 'Demand collapsed late in the run', correct: topReason === 'demand' },
      { id: 'D', text: 'Price was set too low for the segment', correct: topReason === 'price' },
    ],
    explanation:
      topReason === 'material' ? 'Material was the dominant cost line - cover, paper, and add-on choices matter.'
      : topReason === 'opex' ? 'Wages and marketing scaled too aggressively for revenue earned.'
      : topReason === 'demand' ? 'Late-game demand cooled - likely segment-fit drift or overpricing.'
      : 'Price under-monetized a willing segment.',
  };
}
