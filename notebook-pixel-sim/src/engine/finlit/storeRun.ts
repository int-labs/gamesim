// Round transition — state plumbing only. Simulates nothing; the server owns
// every figure. See ../../../../server/README.md#the-four-collections

import type { GameState } from '@/state/store';
import { ENERGY_PER_PHASE, ENERGY_CAP, PHASE_LENGTH_DAYS } from '@/data/finlit';

/** `totalRounds` is passed in: a pure Immer mutator has no session access. */
export function advanceFinlitPhase(s: GameState, totalRounds: number): void {
  const phase = s.meta.phase;

  // Per-round only — reset so they don't compound.
  s.finlit.demandMult = 1;
  s.finlit.sellMult = 1;

  // `meta.day` is narrative copy. Nothing ticks it and nothing buckets by it.
  const endDay = phase * PHASE_LENGTH_DAYS;
  s.meta.day = endDay;

  // `phase` is 1-based, `totalRounds` is a COUNT.
  const isFinalRound = phase >= totalRounds;

  if (!isFinalRound) {
    s.player.maxEnergy = ENERGY_CAP;
    s.player.energy = Math.min(ENERGY_CAP, s.player.energy + ENERGY_PER_PHASE);
  }

  s.meta.pendingEvalPhase = phase;

  if (isFinalRound) {
    if (s.player.debt > 0) {
      const owed = s.player.debt;
      s.player.cash -= owed;
      s.player.debt = 0;
      s.history.push({ day: endDay, text: `Repaid outstanding obligation of $${owed}.`, cause: 'debt_settle' });
    }
    s.meta.ended = true;
  }
}
