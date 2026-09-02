import { useEffect, useRef } from 'react';
import { useGame } from '@/state/store';
import { genreById, type GenreId, type ProductionSpec } from '@/data/finlit';
import { vocFit } from '@/engine/finlit/fit';
import type { ServerProjectionResult } from '@/gamesim/sync';
import { fmt$ } from '@/utils/format';

/**
 * AmeliaReactions (V3) — the mascot notices what you're DOING, live:
 *
 *   • the active notebook's VoC fit crosses 110% → she celebrates the match
 *   • its margin goes negative (price below unit cost) → a gentle warning
 *   • its fit drifts below 85% → a nudge that the design is off-market
 *
 * Each reaction fires once per notebook per session (pushMascot de-dupes by
 * id, and ids embed the line id), stays quiet during the phase sequence, and
 * renders nothing — a pure watcher mounted by SimulationScreen.
 */
const DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

export function AmeliaReactions({ liveProjection }: { liveProjection?: ServerProjectionResult | null }) {
  const pushMascot = useGame((s) => s.pushMascot);
  const line = useGame((s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId));
  const lineIndex = useGame((s) => s.portfolio.productLines.findIndex((l) => l.id === s.portfolio.activeLineId));

  const genre: GenreId = (line?.genre ?? 'indie') as GenreId;
  const spec: ProductionSpec = { ...DEFAULT_SPEC, type: genre, ...(line?.finlitSpec ?? {}) };
  const price = line?.price ?? 0;
  const stickersSpend = Math.min((line?.addOnsByArchetype?.[line?.archetype ?? genre] ?? []).length * 0.15, 100);
  const fit = line ? vocFit(spec, price, stickersSpend, genre) : 1;

  // The SERVER's `dynamicCost` — the same figure the P&L shows, so her warning
  // cannot contradict it. `null` = no projection yet; the margin check is
  // SKIPPED rather than defaulting the cost to 0 (which reads as infinite margin).
  const proj = liveProjection?.byProduct[lineIndex] ?? liveProjection?.byProduct[0] ?? null;
  const serverUnitCost = proj?.dynamicCost ?? null;
  const margin = line && serverUnitCost != null ? price - serverUnitCost : null;

  const quiet = () => useGame.getState().meta.sequenceActive;

  // ── VoC fit crosses the 110% "strong match" line ────────────────────
  const prevFit = useRef(fit);
  useEffect(() => {
    const was = prevFit.current;
    prevFit.current = fit;
    if (!line || quiet()) return;
    if (was < 1.1 && fit >= 1.1) {
      pushMascot({
        id: `react-fit-${line.id}-${genre}`,
        type: 'success',
        body: `Ooh - ${line.name} really clicks with the ${genreById(genre).name} market now. Strong fit means more of that demand converts.`,
        priority: 1,
        mood: 'excited',
      });
    }
  }, [fit, line, genre, pushMascot]);

  // ── margin goes negative (selling below cost) ───────────────────────
  const prevMargin = useRef(margin);
  useEffect(() => {
    const was = prevMargin.current;
    prevMargin.current = margin;
    if (!line || quiet()) return;
    // A transition into or out of null is not a crossing.
    if (was == null || margin == null) return;
    if (was >= 0 && margin < 0) {
      pushMascot({
        id: `react-margin-${line.id}`,
        type: 'warning',
        body: `Careful - ${line.name} costs ${fmt$(serverUnitCost ?? 0)} to make but only sells for ${fmt$(price)}. You'd lose money on every unit. Raise the price or simplify the spec.`,
        priority: 2,
        mood: 'concerned',
      });
    }
  }, [margin, line, serverUnitCost, price, pushMascot]);

  // ── fit drifts below 85% (design off-market) ────────────────────────
  const prevLowFit = useRef(fit);
  useEffect(() => {
    const was = prevLowFit.current;
    prevLowFit.current = fit;
    if (!line || quiet()) return;
    if (was >= 0.85 && fit < 0.85) {
      pushMascot({
        id: `react-drift-${line.id}-${genre}`,
        type: 'hint',
        body: `Hmm - this design is drifting from what ${genreById(genre).name} buyers want. Check the paper, price and channels against the market.`,
        priority: 1,
        mood: 'thinking',
      });
    }
  }, [fit, line, genre, pushMascot]);

  return null;
}
