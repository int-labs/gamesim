import { useEffect, useRef } from 'react';
import { useGame } from '@/state/store';
import { genreById, unitCost, type GenreId, type ProductionSpec, type ChannelId } from '@/data/finlit';
import { vocFit } from '@/engine/finlit/fit';
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

export function AmeliaReactions() {
  const pushMascot = useGame((s) => s.pushMascot);
  const line = useGame((s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId));

  const genre: GenreId = (line?.genre ?? 'indie') as GenreId;
  const spec: ProductionSpec = { ...DEFAULT_SPEC, type: genre, ...(line?.finlitSpec ?? {}) };
  const price = line?.price ?? 0;
  const fit = line ? vocFit(spec, price, ['offline'], genre) : 1;
  const margin = line ? price - unitCost(spec) : 0;

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
    if (was >= 0 && margin < 0) {
      pushMascot({
        id: `react-margin-${line.id}`,
        type: 'warning',
        body: `Careful - ${line.name} costs ${fmt$(unitCost(spec))} to make but only sells for ${fmt$(price)}. You'd lose money on every unit. Raise the price or simplify the spec.`,
        priority: 2,
        mood: 'concerned',
      });
    }
  }, [margin, line, spec, price, pushMascot]);

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
