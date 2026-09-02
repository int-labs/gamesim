import { useGame } from '@/state/store';
import { useState, useMemo } from 'react';
import { answerInsight, generateInsightQuestion } from '@/engine/mockEngine';
import { selectEvaluationSummary, selectCashTrend } from '@/engine/selectors';
import { maxEnergyForPhase } from '@/data/balance';
import { ENERGY_REPLENISH } from '@/engine/config';
import type { Phase } from '@/types';
import { PixelPanel, PixelButton, PixelBadge } from '@/components/primitives';
import { PixelStepLine } from '@/components/charts/PixelStepLine';
import { PixelStackedBar } from '@/components/charts/PixelStackedBar';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { fmt$ } from '@/utils/format';
import clsx from 'clsx';
import { A } from '@/assets';
import { playSfx } from '@/audio/audioManager';
import { useGamesimSession, useTotalRounds, roundNumberFromPhase } from '@/gamesim/GamesimProvider';

export function EvaluationScreen() {
  const phase = useGame((s) => s.meta.pendingEvalPhase) ?? 1;
  const cash = useGame((s) => s.player.cash);
  // The operator's round count and the server's scored figures. `?? phase`
  // treats an unknown count as "this round is the last", which ends the run
  // rather than advancing into a round that may not be configured.
  const { financialsByRound, bootstrap } = useGamesimSession();
  const finalRound = useTotalRounds() ?? phase;
  /** Is a server round driving the counter? If so, it — not this screen — advances it. */
  const hasServerRound = bootstrap?.round?.roundNumber !== undefined;
  const inventory = useGame((s) => s.inventory);
  const apply = useGame((s) => s.apply);
  const setScreen = useGame((s) => s.setScreen);

  const insight = useMemo(() => generateInsightQuestion(useGame.getState() as any, phase), [phase]);
  const [answer, setAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Phase-windowed P&L summary — derived once per render via getState() so
  // we don't trigger the zustand "new object reference" rerender loop.
  // Subscribe to the underlying signals so the summary recomputes when they change.
  const ledgerLen = useGame((s) => s.ledger.length);
  const seriesLen = useGame((s) => s.series.cash.length);
  const summary = useMemo(() => selectEvaluationSummary(useGame.getState() as any, phase), [phase, ledgerLen, seriesLen]);
  const trend = useMemo(() => selectCashTrend(useGame.getState() as any), [seriesLen]);
  const grossRevenue = summary.revenue;
  const matCost = summary.matCost;
  const labor = summary.labor;
  const marketing = summary.marketing;
  const tools = summary.tools;
  const channel = summary.channel;
  const opProfit = summary.opProfit;

  const onSubmit = () => {
    if (!answer) return;
    const correct = !!insight.options.find((o) => o.id === answer)?.correct;
    playSfx(correct ? 'chime' : 'fail');
    apply((s) => answerInsight(s, insight.id, answer, correct));
    setRevealed(true);
  };

  const onContinue = () => {
    playSfx('phase-up');
    apply((s) => {
      s.meta.pendingEvalPhase = null;
      s.evaluations.resolved.push({
        phase,
        insightCorrect: revealed ? !!insight.options.find((o) => o.id === answer)?.correct : null,
        day: s.meta.day,
      });
      // Bump the round counter and replenish energy now, *before* the player
      // re-enters simulation.
      //
      // THIS IS THE ONLY PLACE THE ROUND ADVANCES. `PhaseSequenceModal` also
      // contains a `s.meta.phase = next` but that path is not reached: after
      // confirming, the player goes into limbo and sees nothing of the round's
      // score until the administrator calculates it. So the cash carry below
      // lives here and cannot double-apply.
      if (phase < finalRound) {
        const next = (phase + 1) as Phase;

        // Cash at ROUND start, carried forward. `player.cash` is not "cash now"
        // — it moves only at a round boundary, and the movement is the round's
        // SERVER-scored operating profit. Banking it here is safe because limbo
        // guarantees the round was calculated before this screen was reachable.
        //
        // Indexed by ROUND NUMBER, not phase: `phase` is 1-based and the map is
        // keyed 0-based, so `financialsByRound[phase]` banked the NEXT round's
        // profit (or nothing at all on the last phase).
        const scored = financialsByRound[roundNumberFromPhase(phase)]?.operatingProfit ?? 0;
        s.player.cash += scored;

        // Write-once. An opening already recorded is never recomputed, which is
        // what stops a later round from retroactively changing what an earlier
        // column showed.
        if (s.cashOpeningByRound[next] === undefined) {
          s.cashOpeningByRound[next] = s.player.cash;
        }

        // The ROUND COUNTER IS THE SERVER'S when a round is known — the
        // provider syncs `meta.phase` from `bootstrap.round.roundNumber`, which
        // only moves when the administrator ends a round. Incrementing here as
        // well would race that sync: the local value would jump ahead, then be
        // corrected back on the next bootstrap, and the sheet would flick
        // between two rounds.
        //
        // The local bump survives only for play with no server attached, where
        // nothing else can advance the round.
        if (!hasServerRound) s.meta.phase = next;

        s.player.maxEnergy = maxEnergyForPhase(next);
        s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + ENERGY_REPLENISH);
      }
    });
    if (phase >= finalRound) {
      apply((s) => { s.meta.ended = true; });
      setScreen('final');
    } else {
      setScreen('phase_intro');
    }
  };

  const isFinal = phase >= finalRound;
  return (
    // z-[60] — must cover the sim's floating chrome underneath (EdgeDock
    // z-50, page tabs z-40) while staying under transitions/toast/VN.
    <div className="absolute inset-0 z-[60]">
      {/* Same scene backdrop as the final screen — see the note there. A phase
          debrief is a pause IN the run, not a departure from it, and a flat
          cream fill edge to edge was the only thing in the game that made the
          world disappear between phases. */}
      <img
        src={A.env.deskFull}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      <div aria-hidden className="absolute inset-0 bg-ink-900/60" />
      <div className="absolute inset-0 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        {/* One floating sheet over the scene — same reasoning as the final
            screen: a backdrop only helps if the content keeps a surface. */}
        <div className="pixel-frame bg-cream-50 p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <img src={A.logo} alt="int labs" className="h-10" />
          <div>
            <div className="eyebrow eyebrow-sm text-brand-500">Phase {phase} {isFinal ? 'Final' : 'Evaluation'}</div>
            <h2 className="pixel-caption">{isFinal ? 'Closing the books' : `Looking back at Phase ${phase}`}</h2>
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <PixelPanel title="Phase Snapshot">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Gross Revenue" value={fmt$(grossRevenue)} tone="info" />
                <Stat label="Operating Profit" value={fmt$(opProfit)} tone={opProfit >= 0 ? 'success' : 'error'} />
                <Stat label="Cash" value={fmt$(cash)} tone={cash >= 0 ? 'success' : 'error'} />
                <Stat label="Finished" value={String(inventory.totalFinished)} tone="neutral" />
                <Stat label="Stockout days" value={String(inventory.stockoutDays)} tone={inventory.stockoutDays > 3 ? 'warn' : 'neutral'} />
                <Stat label="Overstock days" value={String(inventory.overstockDays)} tone={inventory.overstockDays > 3 ? 'warn' : 'neutral'} />
              </div>
            </PixelPanel>
            <div className="grid md:grid-cols-2 gap-3">
              <PixelPanel title="Cash trend">
                <PixelStepLine data={trend.cash} stroke="#5fb27a" fill="rgba(95,178,122,0.18)" width={420} height={120} />
              </PixelPanel>
              <PixelPanel title="Profit trend">
                <PixelStepLine data={trend.profit} stroke="var(--c-fin-profit)" fill="rgba(79,156,114,0.16)" width={420} height={120} />
              </PixelPanel>
            </div>
            {/* Cost mix for THIS PHASE, and only the lines that can be
                non-zero in the V3 economy. It used to plot Material · Labor ·
                Marketing · Tools — of which Labor and Tools are structurally
                always $0 (the FinLit bridge never emits `cogs-labor` or
                `opex-tool`), while Channel & Holding, usually the LARGEST
                cost, was not plotted at all. Amelia's debrief one panel over
                tells the player to "open the cost mix to see which line ate
                the margin", so the chart has to be able to show it. Legacy V2
                rows are still rendered when they carry a value, so an older
                saved run does not silently lose them. */}
            <PixelPanel title={`Cost mix · Phase ${phase}`}>
              <PixelStackedBar
                data={[
                  { label: 'Material', value: matCost, color: '#e07a6a' },
                  { label: 'Channel & holding', value: channel, color: '#6c93d9' },
                  { label: 'Marketing / ops', value: marketing, color: '#e6b54a' },
                  { label: 'Labor', value: labor, color: '#9b6cd9' },
                  { label: 'Tools / upgrades', value: tools, color: 'var(--c-fin-cash)' },
                ].filter((d) => Math.abs(d.value) > 0.005)}
                width={520}
                height={26}
              />
            </PixelPanel>
          </div>

          <div className="flex flex-col gap-3">
            <PixelPanel title="Amelia's debrief" tone="paper">
              <div className="flex gap-2 items-start">
                <MascotAvatar mood={opProfit >= 0 ? 'happy' : 'concerned'} size={68} />
                <div className="body-xs font-body text-ink-800 leading-relaxed">
                  <p className="mb-1.5">
                    {opProfit >= 0
                      ? `Profit positive (${fmt$(opProfit)}) - your decisions paid off this phase. The audience and price found each other.`
                      : `Profit dipped (${fmt$(opProfit)}). Revenue alone is not the story - open the cost mix on the left to see which line ate the margin.`}
                  </p>
                  {inventory.stockoutDays > 3 && (
                    <p className="mb-1.5">
                      <strong>{inventory.stockoutDays} stockout days</strong> - that's demand you couldn't fulfil. Hire a helper, raise your production target, or trim a slow line.
                    </p>
                  )}
                  {inventory.overstockDays > 3 && (
                    <p className="mb-1.5">
                      <strong>{inventory.overstockDays} overstock days</strong> - cash trapped in unsold notebooks. Lower your production target or boost demand with marketing.
                    </p>
                  )}
                  {inventory.stockoutDays <= 3 && inventory.overstockDays <= 3 && opProfit >= 0 && (
                    <p className="mb-1.5">
                      Inventory stayed clean and profit landed positive - solid run. Keep an eye on cost creep next phase.
                    </p>
                  )}
                  <p className="text-text-3 italic">
                    {phase === 1
                      ? "Next: Phase 2 is about inventory flow. Demand grows - match it without trapping cash."
                      : phase === 2
                        ? "Next: Phase 3 is the cash phase. Read your P&L and protect your runway."
                        : "Final results next - your full 90-day timeline awaits."}
                  </p>
                </div>
              </div>
            </PixelPanel>

            <PixelPanel title="Insight check">
              <div className="body-xs font-body mb-2 text-ink-900">{insight.question}</div>
              <div className="flex flex-col gap-1">
                {insight.options.map((o) => {
                  const picked = answer === o.id;
                  const showAns = revealed && o.correct;
                  const wrongPicked = revealed && picked && !o.correct;
                  return (
                    <button
                      key={o.id}
                      disabled={revealed}
                      onClick={() => { playSfx('click-soft'); setAnswer(o.id); }}
                      className={clsx(
                        'text-left p-2 border-2 font-body hint transition-all',
                        // Selected (pre-reveal): dark walnut + cream
                        // text — unambiguous against the cream panel.
                        picked && !revealed && 'bg-[#221710] text-[#FAF7E8] border-primary',
                        showAns && 'bg-success-soft border-ink-900',
                        wrongPicked && 'bg-error-soft border-ink-900',
                        !picked && !revealed && 'bg-cream-50 border-ink-900 hover:-translate-y-0.5 shadow-pixel-1',
                      )}
                    >
                      <span
                        className={clsx(
                          'eyebrow eyebrow-sm mr-2 uppercase',
                          picked && !revealed ? 'text-primary' : '',
                        )}
                      >
                        {o.id}.
                      </span>
                      {o.text}
                      {showAns && <PixelBadge className="ml-2" tone="success">Correct</PixelBadge>}
                    </button>
                  );
                })}
              </div>
              {!revealed ? (
                <PixelButton variant="primary" size="sm" disabled={!answer} onClick={onSubmit} className="mt-2">
                  Submit answer
                </PixelButton>
              ) : (
                <PixelButton variant="primary" size="sm" onClick={onContinue} className="mt-2">
                  {isFinal ? 'See final results' : 'Continue to next phase'}
                </PixelButton>
              )}
            </PixelPanel>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warn' | 'info' | 'error' | 'neutral' }) {
  const bg =
    tone === 'success' ? 'bg-success-soft' :
    tone === 'warn' ? 'bg-warn-soft' :
    tone === 'info' ? 'bg-info-soft' :
    tone === 'error' ? 'bg-error-soft' : 'bg-cream-100';
  return (
    <div className={`${bg} border border-border-soft p-2`}>
      <div className="eyebrow eyebrow-sm text-ink-700">{label}</div>
      <div className="h3">{value}</div>
    </div>
  );
}
