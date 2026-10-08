// Round transition — state plumbing only. Simulates nothing; the server owns
// every figure. See ../../../../server/README.md#the-four-collections

import type { GameState } from '@/state/store';
import { ENERGY_PER_PHASE, PHASE_LENGTH_DAYS } from '@/data/finlit';
import { maxEnergyForPhase } from '@/data/balance';

/** `totalRounds` is passed in: a pure Immer mutator has no session access. */
export function advanceFinlitPhase(s: GameState, totalRounds: number): void {
  const phase = s.meta.phase;

  // Per-round only — reset so they don't compound.
  s.finlit.demandMult = 1;
  s.finlit.sellMult = 1;

  // THE INSIGHT COUNTER IS PER ROUND TOO.
  //
  // Safe here and only here: the insight check is answered BEFORE the round is
  // submitted, and this mutator runs AFTER that POST — so the figures have
  // already gone up on `Decision.clientMetrics` by the time they are cleared.
  //
  // Per round because that is the primitive: the server holds one value per
  // `simulation × team × round`, so a cumulative leaderboard is a sum it can do
  // whenever, while a cumulative CLIENT counter could never be taken apart
  // again. See `insights` in state/store.ts.
  //
  // `answered` is NOT cleared — it is the run-long history, and the two
  // run-to-date displays derive their totals from it.
  //
  // Captured FIRST: the round's own tally is the source for the evaluation
  // record pushed below, and the next line wipes it. `total === 0` means the
  // player never answered, which records as null rather than "wrong".
  const insightCorrect = s.insights.score.total > 0 ? s.insights.score.correct > 0 : null;
  s.insights.score = { correct: 0, total: 0 };

  // `meta.day` is narrative copy. Nothing ticks it and nothing buckets by it.
  const endDay = phase * PHASE_LENGTH_DAYS;
  s.meta.day = endDay;

  // The limbo debrief reads the LAST entry's `phase` (`App.tsx` → debriefPhase),
  // so this push is load-bearing, not bookkeeping. `day` is recorded after the
  // line above sets it to the phase end, matching what the phase-review slide
  // used to record.
  s.evaluations.resolved.push({ phase, insightCorrect, day: s.meta.day });

  // `phase` is 1-based, `totalRounds` is a COUNT.
  const isFinalRound = phase >= totalRounds;

  // THE PHASE BUMP AND THE ENERGY REFILL ARE ONE STEP, HERE AND NOWHERE ELSE.
  //
  // Both used to run a second time in the modal's `finishEvaluation`, off a
  // hardcoded `phase < 3` while this gate reads `totalRounds` — so a 4-round
  // simulation refilled energy at the end of phase 3 and then never advanced
  // past it. The grants also stacked: ENERGY_PER_PHASE here plus
  // ENERGY_REPLENISH there, clamped to the next phase's max.
  //
  // One grant now, clamped to the phase being entered. `maxEnergy` is the
  // clamp — clamping to ENERGY_CAP instead lets energy finish above the bar
  // the HUD draws it against.
  if (!isFinalRound) {
    const next = (phase + 1) as typeof phase;
    s.meta.phase = next;
    s.player.maxEnergy = maxEnergyForPhase(next);
    s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + ENERGY_PER_PHASE);
  }

  if (isFinalRound) {
    if (s.player.debt > 0) {
      const owed = s.player.debt;
      s.player.cash -= owed;
      s.player.debt = 0;
    }
    s.meta.ended = true;
  }
}
