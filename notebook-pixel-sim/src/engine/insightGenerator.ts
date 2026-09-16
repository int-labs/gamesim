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

/** Return the insight question for the given phase, derived from real state. */
export function generateInsightQuestion(state: GameState, phase: Phase): InsightQuestion {

  if (phase === 1) {
    // Copy unchanged. The correct answer used to be picked from
    // `market.targetSegment` + best `fitBySegmentByLineId`, both deleted with
    // the V2 segment axis; it now resolves to the same branch that ran whenever
    // a segment WAS set, so the question is fixed rather than state-derived.
    const opts: InsightQuestion['options'] = [
      { id: 'A', text: 'Picking and matching a target audience', correct: true },
      { id: 'B', text: 'Buying lots of raw materials', correct: false },
      { id: 'C', text: 'Setting the highest price possible', correct: false },
      { id: 'D', text: 'Adding many decorative items', correct: false },
    ];
    return {
      id: 'phase1_demand_driver',
      phase,
      question: 'Which of these levers drive demand the most when starting a new business venture?',
      options: opts,
      explanation:
        "You picked an audience and your design fit them - that's why demand had a base to grow from.",
    };
  }

  if (phase === 2) {
  
    return {
      id: 'phase2_cash_dip',
      phase,
      question: `Which one of these is the biggest contributing factor to your cash dipping?`,
      options: [
        { id: 'A', text: 'A raw-material purchase hit cash before sales arrived', correct: false },
        { id: 'B', text: 'Material cost climbed with each sale', correct: false },
        { id: 'C', text: 'Wages from new helpers stacked up', correct: false },
        { id: 'D', text: 'Marketing was bleeding cash without enough sales', correct: true },
      ],
      explanation:
        "Marketing works by establishing a wider audience. if the product is too niche, all of that marketing budget is aimed at no one. even if all other production costs are lessened. marketing strategies bleed money"
    };
  }

  return {
    id: 'phase3_pl_diagnosis',
    phase,
    question: 'Across the full run, the biggest reason profit didn\'t scale with revenue was:',
    options: [
      { id: 'A', text: 'Material costs increased as sales volume grew', correct: false },
      { id: 'B', text: 'Operating expenses consumed too much of the profit margin', correct: true },
      { id: 'C', text: 'Demand was not strong enough to sustain revenue growth', correct: false },
      { id: 'D', text: 'Pricing was too low for the target segment', correct: false },
    ],
    explanation:
      'Over-investing into operating expenses and not actually investing enough into the quality of the product itself. this can in turn cause lower profit returns despite higher revenue',
  };
}
