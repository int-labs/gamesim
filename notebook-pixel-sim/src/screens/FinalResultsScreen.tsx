import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGame } from '@/state/store';
import { finalScore } from '@/engine/mockEngine';
import { PixelPanel, PixelButton, PixelBadge } from '@/components/primitives';
import { PixelStepLine } from '@/components/charts/PixelStepLine';
import { PixelStackedBar } from '@/components/charts/PixelStackedBar';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { Confetti } from '@/components/fx/Confetti';
import { RankBadge, rankForScore } from '@/components/results/RankBadge';
import { fmt$ } from '@/utils/format';
import { A } from '@/assets';
import { FINAL } from '@/content/copy';
import { playSfx } from '@/audio/audioManager';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { DebriefCard } from '@/gamesim/OperatorContent';

/**
 * FinalResultsScreen — Day 90, reworked as a CELEBRATION instead of a report.
 *
 * Choreography (reduced-motion collapses to instant):
 *   1. hero band drops in — talking-head Amelia greets, tier-matched line
 *   2. the score COUNTS UP to /100
 *   3. the rank badge STAMPS in (S/A/B/C tier) + confetti scaled to the tier
 *   4. the data reveals in a stagger: score cells fill, charts slide in,
 *      did-well/hurt stamp item by item, the decision timeline slides in
 *
 * ALL of the old report's data is retained: score breakdown, cash/profit
 * trends, cost mix, did-well/hurt, decision timeline, export/home CTAs.
 * A rocky run (<45) gets a calm variant — no confetti, softer copy tone.
 */
export function FinalResultsScreen() {
  const state = useGame();
  const shopName = state.meta.shopName;
  const reduced = useReducedMotion();
  const score = finalScore(state as any);
  const rank = rankForScore(score.total);
  // Server-finalized result (if an operator has run it) — additive, shown
  // alongside the local celebration screen without changing its own score/
  // animation, which stay driven by the local engine as before.
  const { latestResults, latestFinancials, bootstrap } = useGamesimSession();
  const teamId = bootstrap?.teamId ?? null;

  const ledger = state.ledger;
  const sum = (k: string) => ledger.filter((e) => e.kind === k).reduce((a, b) => a + b.amount, 0);
  const matCost = -sum('cogs-material');
  const labor = -sum('cogs-labor');
  const packaging = -sum('cogs-packaging');
  const fulfillment = -sum('cogs-fulfillment');
  const marketing = -sum('opex-marketing');
  const tools = -sum('opex-tool');
  // V3 channel/overhead costs (maintenance + consignment + inventory), booked
  // as opex-rent by the FinLit bridge.
  const channel = -sum('opex-rent');
  // Legacy V2 categories (labor/packaging/fulfillment/tools) are ~0 in V3, so
  // the cost mix below shows the three that actually move: Material, Channels,
  // Marketing/Ops. Keep the vars referenced so the build stays clean.
  void labor; void packaging; void fulfillment; void tools;

  // ── Choreography clock ────────────────────────────────────────────────
  const COUNT_DELAY = reduced ? 0 : 0.55; // s — score starts counting
  const BADGE_AT = reduced ? 0 : 1.85; // s — badge stamps in
  const DATA_AT = reduced ? 0 : 2.15; // s — data sections begin

  const shownScore = useCountUp(score.total, 1250, COUNT_DELAY * 1000);

  // Badge slam gets a physical "pop"; skipped under reduced motion.
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => playSfx('pop'), (BADGE_AT + 0.12) * 1000);
    return () => window.clearTimeout(t);
  }, [reduced, BADGE_AT]);

  /** Shared stagger for the data sections below the hero. */
  const sec = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: DATA_AT + i * 0.16, duration: 0.38, ease: [0.2, 1, 0.4, 1] as const },
        };

  const didWell: string[] = [];
  if (state.market.targetSegment) didWell.push(FINAL.didWell.pickedSegment);
  if (state.upgrades.acquired.includes('process_qa')) didWell.push(FINAL.didWell.qualityProcess);
  if (state.channels.active.length >= 2) didWell.push(FINAL.didWell.diversifiedChannels);
  if (state.player.cash > 0) didWell.push(FINAL.didWell.cashPositive);
  if (state.upgrades.acquired.length === 0) didWell.push(FINAL.didWell.keptLean);

  const hurt: string[] = [];
  if (state.inventory.stockoutDays > 3) hurt.push(FINAL.hurt.stockouts);
  if (state.inventory.overstockDays > 3) hurt.push(FINAL.hurt.overstock);
  if (!state.market.targetSegment) hurt.push(FINAL.hurt.noSegment);
  if (state.player.cash < 0) hurt.push(FINAL.hurt.cashNegative);
  if (state.portfolio.productLines.every((line) => Object.values(line.addOnsByArchetype).every((arr) => (arr ?? []).length === 0)))
    hurt.push(FINAL.hurt.noDifferentiation);

  const takeaway =
    score.total >= 70 ? FINAL.takeaway.strong : score.total >= 50 ? FINAL.takeaway.mixed : FINAL.takeaway.tough;

  const exportRun = () => {
    const data = JSON.stringify({ ...state, mascot: undefined, toast: undefined }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `intlabs-run-${state.meta.seed}.json`;
    a.click();
  };

  return (
    // z-[60] — must cover the sim's floating chrome underneath (EdgeDock
    // z-50, page tabs z-40) while staying under transitions/toast/VN.
    <div className="absolute inset-0 bg-cream-50 z-[60] overflow-y-auto">
      <Confetti tone={rank.confetti} />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        {/* Header row */}
        <motion.div
          className="flex items-center gap-3 mb-4"
          initial={reduced ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <img src={A.logo} alt="int labs" className="h-10" />
          <div className="min-w-0">
            <div className="eyebrow eyebrow-sm text-brand-500">Day 90 · Final</div>
            {/* The run belongs to the player's shop - name it in the payoff. */}
            <h2 className="h2 uppercase truncate">{shopName}</h2>
            <div className="stat-label mt-0.5">Final Results</div>
          </div>
        </motion.div>

        {/* ── HERO — Amelia + count-up score + rank stamp ─────────────── */}
        <motion.div
          className="relative overflow-hidden pixel-frame bg-surface mb-4"
          initial={reduced ? false : { opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.2, 1.2, 0.4, 1] }}
        >
          {/* warm spotlight wash */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 55% 90% at 50% 0%, rgba(255,226,160,0.35) 0%, rgba(255,226,160,0) 65%)',
            }}
          />
          <div className="relative flex flex-col md:flex-row items-center gap-4 md:gap-6 px-4 sm:px-6 py-5">
            {/* Amelia hosts */}
            <div className="flex items-center gap-3 md:w-[300px] shrink-0">
              <MascotAvatar size={88} />
              <div className="min-w-0">
                <div className="eyebrow eyebrow-sm text-brand-500">Amelia's takeaway</div>
                <p className="body-xs text-ink-900 mt-1">{takeaway}</p>
              </div>
            </div>

            {/* The number */}
            <div className="flex-1 text-center py-1">
              <div className="inline-flex items-center gap-1.5 stat-label">
                <img src={A.ui.pixel.trophy} alt="" className="w-[16px] h-[16px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                Final score
              </div>
              <div className="num-hero text-[58px] sm:text-[66px] leading-none mt-1 text-ink-900">
                {shownScore}
                <span className="num-lg text-ink-700">/100</span>
              </div>
              <div className="body-xs text-ink-800 mt-1.5">
                Net profit projected from ledger: <span className="num-xs">{fmt$(score.netDollar)}</span>
              </div>
            </div>

            {/* Rank stamp */}
            <div className="shrink-0 md:pr-2">
              <RankBadge rank={rank} delay={BADGE_AT} />
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Score breakdown - cells with animated fill bars */}
            <motion.div {...sec(0)}>
              <PixelPanel title="Score Breakdown" tone="paper">
                <div className="grid grid-cols-3 gap-2">
                  <ScoreCell label="Net Profit" value={score.netProfit} max={50} color="#5fb27a" bg="bg-success-soft" delay={DATA_AT + 0.15} />
                  <ScoreCell label="Inventory" value={score.inventory} max={25} color="#5b86c2" bg="bg-info-soft" delay={DATA_AT + 0.3} />
                  <ScoreCell label="Insight" value={score.insight} max={25} color="#9b6cd9" bg="bg-brand-300" delay={DATA_AT + 0.45} />
                </div>
              </PixelPanel>
            </motion.div>

            {/* Trends + cost mix */}
            <motion.div {...sec(1)}>
              <PixelPanel title="The full 90 days" tone="paper">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="stat-label mb-1">Cash trend</div>
                    <PixelStepLine data={state.series.cash} stroke="#5fb27a" fill="rgba(95,178,122,0.18)" width={420} height={120} />
                  </div>
                  <div>
                    <div className="stat-label mb-1">Profit trend</div>
                    <PixelStepLine data={state.series.profit} stroke="#5b86c2" fill="rgba(91,134,194,0.15)" width={420} height={120} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="stat-label mb-1">Cost mix</div>
                  <PixelStackedBar
                    data={[
                      { label: 'Material (COGS)', value: matCost, color: '#e07a6a' },
                      { label: 'Channels', value: channel, color: '#e09b6a' },
                      { label: 'Marketing / Ops', value: marketing, color: '#e6b54a' },
                    ]}
                    width={520}
                    height={26}
                  />
                </div>
              </PixelPanel>
            </motion.div>

            {/* Did well / hurt - items stamp in one by one */}
            <motion.div {...sec(2)}>
              <PixelPanel title="What you did well / What hurt">
                <div className="grid md:grid-cols-2 gap-3 body-xs">
                  <StampList
                    title={FINAL.panels.didWell}
                    items={didWell}
                    boxClass="bg-success-soft"
                    baseDelay={DATA_AT + 0.45}
                    reduced={!!reduced}
                  />
                  <StampList
                    title={FINAL.panels.hurt}
                    items={hurt}
                    boxClass="bg-error-soft"
                    baseDelay={DATA_AT + 0.6}
                    reduced={!!reduced}
                  />
                </div>
              </PixelPanel>
            </motion.div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Decision timeline - slides in from the right */}
            <motion.div
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, x: 22 },
                    animate: { opacity: 1, x: 0 },
                    transition: { delay: DATA_AT + 0.3, duration: 0.4, ease: [0.2, 1, 0.4, 1] as const },
                  })}
            >
              <PixelPanel title="Decision Timeline">
                <div className="max-h-[420px] overflow-y-auto pr-2 body-xs">
                  {[...state.history].reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5 border-b border-ink-700/15">
                      <PixelBadge tone="neutral">D{h.day}</PixelBadge>
                      <div className="flex-1">{h.text}</div>
                    </div>
                  ))}
                </div>
              </PixelPanel>
            </motion.div>

            {/* Official numbers from the simulation server — market share and
                score from calcMarketModel (GET /results), financials from
                calcFinancials (GET /projections). A different model from the
                local score above, and the only one that counts. */}
            {(latestResults || latestFinancials) && (
              <motion.div
                initial={reduced ? false : { opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: DATA_AT + 0.45, duration: 0.4, ease: [0.2, 1, 0.4, 1] }}
              >
                <PixelPanel title="Official Result">
                  <div className="flex items-center gap-2 mb-2">
                    <PixelBadge tone="info">From the simulation server</PixelBadge>
                    <span className="hint">
                      Round {latestResults?.roundNumber ?? latestFinancials?.roundNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 body-xs">
                    <div>
                      <div className="stat-label">Revenue</div>
                      <div className="num-sm text-ink-900">{fmt$(latestFinancials?.revenue ?? 0)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Gross Profit</div>
                      <div className="num-sm text-ink-900">{fmt$(latestFinancials?.grossProfit ?? 0)}</div>
                    </div>
                    <div>
                      <div className="stat-label">COGS</div>
                      <div className="num-sm text-ink-900">{fmt$(latestFinancials?.cogs ?? 0)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Customers</div>
                      <div className="num-sm text-ink-900">{Math.round(latestFinancials?.customersObtained ?? 0)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Market Share</div>
                      <div className="num-sm text-ink-900">
                        {latestResults
                          ? `${(latestResults.averageMarketShare * 100).toFixed(1)}%`
                          : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Rank</div>
                      <div className="num-sm text-ink-900">
                        {latestResults && teamId
                          ? `#${
                              latestResults.leaderboard.findIndex((t) => t.teamId === teamId) + 1
                            } / ${latestResults.leaderboard.length}`
                          : 'Pending'}
                      </div>
                    </div>
                  </div>

                  {latestResults && (
                    <div className="mt-3">
                      <div className="stat-label mb-1">Leaderboard</div>
                      <div className="body-xs">
                        {latestResults.leaderboard.map((t, i) => (
                          <div
                            key={t.teamId}
                            className="flex items-center gap-2 py-0.5 border-b border-ink-700/15"
                          >
                            <PixelBadge tone={t.teamId === teamId ? 'info' : 'neutral'}>
                              #{i + 1}
                            </PixelBadge>
                            <div className="flex-1">
                              {t.teamId === teamId ? 'Your team' : `Team ${t.teamId.slice(-6)}`}
                            </div>
                            <div className="stat-label">
                              {(t.averageMarketShare * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!latestResults && (
                    <p className="hint mt-2">
                      Market share and ranking appear once your facilitator has run this round's
                      calculation for every team.
                    </p>
                  )}
                </PixelPanel>
              </motion.div>
            )}

            {/* Facilitator's debrief — renders nothing until it is published
                AND the simulation is Completed. */}
            <DebriefCard />

            {/* CTAs */}
            <motion.div {...sec(3)} className="flex gap-2">
              <PixelButton variant="primary" onClick={() => { playSfx('whoosh'); state.setScreen('start'); }}>
                Back to Home
              </PixelButton>
              <PixelButton variant="secondary" onClick={() => { playSfx('click-soft'); exportRun(); }}>
                Export run JSON
              </PixelButton>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/** Score cell - value counts alongside a bar that fills to value/max. */
function ScoreCell({
  label,
  value,
  max,
  color,
  bg,
  delay,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  bg: string;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`${bg} border-2 border-ink-900 p-2 text-center`}>
      <div className="stat-label">{label}</div>
      <div className="num-lg mt-1">
        {value}
        <span className="body-xs text-ink-700">/{max}</span>
      </div>
      <div className="mt-2 h-[7px] border border-ink-900/60 bg-cream-50 overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: color }}
          initial={{ width: reduced ? `${pct * 100}%` : '0%' }}
          animate={{ width: `${pct * 100}%` }}
          transition={reduced ? { duration: 0 } : { delay, duration: 0.7, ease: [0.2, 1, 0.4, 1] }}
        />
      </div>
    </div>
  );
}

/** Bulleted list whose items stamp in one at a time. */
function StampList({
  title,
  items,
  boxClass,
  baseDelay,
  reduced,
}: {
  title: string;
  items: string[];
  boxClass: string;
  baseDelay: number;
  reduced: boolean;
}) {
  return (
    <div className={`${boxClass} border-2 border-ink-900 p-2`}>
      <div className="stat-label">{title}</div>
      <ul className="list-disc pl-5 mt-1">
        {items.map((text, i) => (
          <motion.li
            key={text}
            initial={reduced ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduced ? 0 : baseDelay + i * 0.12, duration: 0.26, ease: [0.2, 1, 0.4, 1] }}
          >
            {text}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** Local count-up (0 → target) - CountUp primitive is silent on mount, and
 *  here the count-up IS the moment. Reduced-motion snaps to the target. */
function useCountUp(target: number, duration = 1250, delayMs = 0) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setV(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const t = window.setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setV(Math.round(eased * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delayMs, reduced]);
  return v;
}
