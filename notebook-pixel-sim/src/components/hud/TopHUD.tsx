import { useEffect, useRef, useState } from 'react';
import {
  Flag,
  Zap,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { CanvasStatusStrip } from '@/components/canvas/CanvasStatusStrip';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';
import { audio } from '@/audio/audioManager';
import { useGame } from '@/state/store';
import { selectCashBalance, selectProjectedCash } from '@/engine/selectors';
import { useGamesimSession, roundNumberFromPhase } from '@/gamesim/GamesimProvider';
import { fmt$ } from '@/utils/format';
import { NavIcon } from '@/components/icons/NavIcon';
import { SafeImage } from '@/components/primitives/SafeImage';
import { CountUp } from '@/components/primitives/CountUp';
import { A } from '@/assets';
import { HudMenu } from '@/components/hud/HudMenu';
import { HistoryDropdown } from '@/components/hud/HistoryDropdown';
import { StatsDrawer } from '@/components/hud/StatsDrawer';
import clsx from 'clsx';
import { HUD_TOOLTIPS } from '@/content/copy';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useTotalRounds } from '@/gamesim/GamesimProvider';

type KpiTone = 'neutral' | 'success' | 'warning' | 'danger';

// Warm-only palette — no blue accents bleed into the navbar. The
// theme's `--c-info`/`--c-secondary`/`--c-fin-cash` tokens are blue
// hold-overs from the original design system; we deliberately do NOT
// reference them here. Cash uses the warm-green "success" tone when
// healthy; everything reads on a single warm cream + ink axis.
const toneText: Record<KpiTone, string> = {
  neutral: 'text-text',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
// -ink, for the same reason as CanvasStatusStrip's: the Energy chip's fill IS
// caramel and the bolt was drawn in --c-warning, i.e. caramel on caramel.
const toneIcon: Record<KpiTone, string> = {
  neutral: 'var(--c-text-2)',
  success: 'var(--c-success-ink)',
  warning: 'var(--c-warning-ink)',
  danger: 'var(--c-danger-ink)',
};

// The Cash chip fills with saturated green (`.game-hud-chip-success`, #B7DDC0),
// so the normal light `text-success` value was green-on-green and unreadable.
// On that chip we use DEEP, state-tinted ink instead: dark money-green when
// healthy, dark amber when low, dark red when underwater. All read sharply on
// the light-green fill while still colour-coding the state.
const successChipInk: Record<KpiTone, string> = {
  neutral: '#213A28',
  success: '#0F4C29',
  warning: '#7A4310',
  danger: '#8A1717',
};

/**
 * Top HUD — calm pixel status bar.
 *
 * Layout (left → right):
 *   [LOGO] · [PHASE chip] · [Energy] [Cash] · [Op Profit] [Revenue] · [Stock] [Demand] [Fit] ← → [P&L↓] [Help] [Mascot]
 *
 * Visual rules:
 *   - Default chips: 1px soft border, no shadow, calm bg.
 *   - Phase chip is slightly stronger (subtle ink border + tinted bg) — but
 *     no drop shadow.
 *   - Utility buttons (clickable) get hover lift only on hover.
 *   - Subtle vertical separators delineate functional groups; no heavy
 *     bordered tiles around groups.
 *
 * Read-only chips have `cursor-default` and no hover lift; utility buttons
 * have `cursor-pointer` and hover translate.
 */
export function TopHUD({ liveProjectionState }: { liveProjectionState?: LiveProjectionState }) {
  const phase = useGame((s) => s.meta.phase);
  const totalRounds = useTotalRounds();
  const hasLines = useGame((s) => s.portfolio.productLines.length > 0);
  // The build cost needs the server's ceiling and unit cost, so the projection
  // is passed in — the chip is the round's spending limit, not just a tally of
  // the discretionary levers.
  const byProduct = liveProjectionState?.liveProjection?.byProduct ?? null;
  // The BASE is the round's cash balance, not `player.cash`. Same function the
  // P&L's Cash Balance row uses, so the chip and the sheet agree — and it
  // pivots as soon as the operator scores the round.
  const { financialsByRound } = useGamesimSession();
  // The chip's BASE is the ledger's figure — the same `selectCashBalance` call
  // the P&L's Cash Balance row makes — minus what this round has committed but
  // not yet been scored on. So the two read identically until a decision is
  // made, and then diverge by exactly the committed spend.
  const cashBalance = useGame((s) =>
    selectCashBalance(
      s,
      s.meta.phase,
      (r) => financialsByRound[roundNumberFromPhase(r)]?.operatingProfit,
    ),
  );
  const projectedCash = useGame(
    (s) => selectProjectedCash(s, byProduct, cashBalance).projected,
  );
  const projectedCashDelta = useGame(
    (s) => selectProjectedCash(s, byProduct, cashBalance).delta,
  );
  const energy = useGame((s) => s.player.energy);
  const maxEnergy = useGame((s) => s.player.maxEnergy);
  const mascotMin = useGame((s) => s.mascot.minimized);
  const mascotCurrent = useGame((s) => s.mascot.current);
  const toggleMascot = useGame((s) => s.toggleMascotMinimize);
  const pushMascot = useGame((s) => s.pushMascot);
  const sfxEnabled = useGame((s) => s.audio.sfxEnabled);
  const musicEnabled = useGame((s) => s.audio.musicEnabled);
  // Mirror store audio prefs into the AudioManager singleton on
  // mount + on rehydration. NOTE: for music in particular we ALSO
  // call audio.setMusicEnabled directly from the click handlers
  // below — Safari's autoplay policy requires AudioContext.resume()
  // to be called inside the user gesture, but useEffect runs AFTER
  // the click event has bubbled, which is too late on Safari. The
  // direct call is the actual gesture; this effect is a safety net
  // for rehydration and external state changes.
  useEffect(() => { audio.setSfxEnabled(sfxEnabled); }, [sfxEnabled]);
  useEffect(() => { audio.setMusicEnabled(musicEnabled); }, [musicEnabled]);

  useEffect(() => {
    if (projectedCashDelta === 0) return;
    const s = useGame.getState();
    const breakdown = selectProjectedCash(s, byProduct, cashBalance).breakdown;
    const label = breakdown.map((b) => `${b.decision} (-$${b.cost.toFixed(2)})`).join(', ');
    console.log(`[cash] committed $${Math.abs(projectedCashDelta).toFixed(2)}: ${label}`);
  }, [projectedCashDelta, byProduct, cashBalance]);

  const cashTone: KpiTone = projectedCash < 0 ? 'danger' : projectedCash < 200 ? 'warning' : 'success';
  const energyTone: KpiTone = energy / maxEnergy < 0.2 ? 'danger' : 'warning';

  // Phase-change pulse on the phase chip
  const [phasePulse, setPhasePulse] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current !== phase) {
      setPhasePulse(true);
      const id = setTimeout(() => setPhasePulse(false), 1000);
      lastPhase.current = phase;
      return () => clearTimeout(id);
    }
  }, [phase]);

  const helpClick = () => {
    if (mascotCurrent && mascotMin) {
      toggleMascot();
      return;
    }
    // Push a 3-message refresher script so the player can browse with
    // Previous/Next instead of getting one wall of text.
    const helpId = 'help-' + Date.now();
    [
      {
        body: "Need a refresher? You're running a notebook business for 90 days across 3 phases.",
        mood: 'presenting' as const,
      },
      {
        body: "Open Business → Audience first. The segment you pick determines fit, demand, and price tolerance for every notebook.",
        mood: 'pointing_left_explain' as const,
      },
      {
        body: "Then design on the Product page. Watch the right rail - it tells you instantly how each choice changes demand, cost, and fit.",
        mood: 'pointing_right_explain' as const,
      },
      {
        body: "Confirm the phase when you're ready. Each phase runs 30 days at once and ends with a debrief.",
        mood: 'happy_soft' as const,
      },
    ].forEach((m, i, arr) => {
      pushMascot({
        id: `${helpId}__${i}`,
        seqId: helpId,
        seqIndex: i,
        seqLen: arr.length,
        seqTitle: 'Quick Refresher',
        type: 'tutorial',
        body: m.body,
        priority: 1,
        mood: m.mood,
      });
    });
  };

  return (
    <header className="game-hud sticky top-0 z-30">
      <div className="flex items-center gap-2 px-3 sm:px-4 h-[58px]">
        {/* === BRAND === (hidden on phones — the Product/Business tabs need
             the room; the brand shows on the start screen) */}
        <a className="shrink-0 hidden sm:flex items-center mr-1 sm:mr-2" aria-label="Int Labs">
          <SafeImage
            src={A.logo}
            alt="Int Labs"
            className="h-6 sm:h-7 w-auto"
            fallbackIcon="sparkle"
            fallbackSize={22}
          />
        </a>

        {/* === PHASE chip — strongest variant: ranks above other chips === */}
        <Tooltip content={HUD_TOOLTIPS.phase} placement="bottom">
          <div
            className={clsx(
              'game-hud-chip game-hud-chip-strong shrink-0',
              phasePulse && 'anim-pulse-on-change',
            )}
            role="status"
            // The denominator is the operator's `simulation.config.totalRounds`,
            // not a fixed 3. When it is unknown the chip shows the phase alone
            // rather than asserting a total the simulation may not have.
            aria-label={totalRounds ? `Phase ${phase} of ${totalRounds}` : `Phase ${phase}`}
          >
            <NavIcon icon={Flag} size={14} color="var(--c-primary)" />
            <span className="hidden sm:inline eyebrow eyebrow-sm text-text-2 leading-none">Phase</span>
            <span className="num-sm text-text leading-none">
              {phase}
              {totalRounds && <span className="body-xs text-text-3"> / {totalRounds}</span>}
            </span>
          </div>
        </Tooltip>

        <Sep />

        {/* === Resources — Energy (caramel) + Cash (green). Matches
             Figma 1: ENERGY is the only caramel chip, CASH is the
             only green-filled value chip. === */}
        <div className="hidden sm:inline-flex items-center gap-2">
          <Chip
            icon={Zap}
            label="Energy"
            tone={energyTone}
            variant="warm"
            tooltip={HUD_TOOLTIPS.energy}
            numValue={energy}
            ghostFormat={(d) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`}
            ghostDownClass="text-warning"
            pulseDanger={energy === 0}
            render={
              <span className="num-xs text-text">
                {energy}<span className="body-xs text-text-3">/{maxEnergy}</span>
              </span>
            }
          />
          <Chip
            icon={Wallet}
            label="Cash"
            numValue={projectedCash}
            format={fmt$}
            tone={cashTone}
            variant="success"
            tooltip={HUD_TOOLTIPS.cash}
            ghostFormat={(d) => `${d > 0 ? '+' : '−'}${fmt$(Math.abs(d))}`}
            pulseDanger={projectedCash < 0}
          />
        </div>
        {/* Compact-only: Cash chip on its own (no Energy) */}
        <div className="inline-flex sm:hidden items-center">
          <Chip
            icon={Wallet}
            label="Cash"
            numValue={projectedCash}
            format={fmt$}
            tone={cashTone}
            compact
            tooltip={HUD_TOOLTIPS.cash}
            ghostFormat={(d) => `${d > 0 ? '+' : '−'}${fmt$(Math.abs(d))}`}
            pulseDanger={projectedCash < 0}
          />
        </div>

        {/* Center — the run's headline OUTCOME dashboard: Projected Revenue ·
            Projected Profit · Customer Satisfaction (see CanvasStatusStrip).
            Each card is self-framed and high-contrast; the Product/Business
            tabs float on the canvas top-center (see SimulationScreen).
            lg+ only — the bottom Stats section covers smaller screens. */}
        {/* `overflow-hidden` is the guard, not the decoration. Every other
            child of this bar is `shrink-0` — correct, they are the essentials —
            so the centre track is the ONLY thing that can absorb a narrow
            viewport. It used to hold a `shrink-0` strip, which meant the strip
            kept its full 519px no matter how little room the track had and
            spilled out BOTH sides of it (justify-center), drawing over the cash
            chip on the left and the utility menu on the right. A flex child
            cannot overflow a track that clips. */}
        <div className="flex-1 min-w-0 overflow-hidden hidden lg:flex justify-center px-2">
          {hasLines && <CanvasStatusStrip liveProjection={liveProjectionState?.liveProjection ?? null} />}
        </div>
        <div className="flex-1 min-w-0 lg:hidden" />

        {/* === Utility — Help + Stats (compact only) + Mascot toggle === */}
        {/* Utility controls. Six separate icons (stats, sfx, music, history,
            help, logout) crowded the bar's right edge and pushed the KPI chips
            at common laptop widths, so several were hidden below `lg` and
            simply unreachable there. HudMenu keeps the two run-work icons on
            the bar and folds the settings-type controls — shop rename, sound,
            music, help, log out — into one "More" menu that fits at every
            width. Its log out calls the gamesim provider, which is what
            actually ends the session. */}
        <HudMenu onOpenStats={() => setStatsOpen(true)} onHelp={helpClick} />
      </div>
      {/* StatsDrawer's History row opens this. HudMenu owns its own copy for
          the bar/menu path; both are the same self-contained modal. */}
      {historyOpen && <HistoryDropdown onClose={() => setHistoryOpen(false)} />}
      {statsOpen && (
        <StatsDrawer
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          onOpenHistory={() => setHistoryOpen(true)}
          liveProjection={liveProjectionState?.liveProjection ?? null}
        />
      )}
    </header>
  );
}

/* Group separators use the shared `.game-hud-divider` token so the
   top HUD and (future) bottom HUD stay visually consistent. */
function Sep() {
  return <span aria-hidden className="game-hud-divider hidden sm:block" />;
}

/**
 * Calm read-only KPI chip.
 * - Default: 1px soft border, no shadow, transparent bg, cursor-default.
 * - Compact variant collapses label below xl breakpoint.
 * - Subtle background flash when numeric value changes.
 */
function Chip({
  icon,
  label,
  value,
  numValue,
  format,
  render,
  tone = 'neutral',
  compact = false,
  variant = 'neutral',
  tooltip,
  ghostFormat,
  ghostDownClass = 'text-danger',
  pulseDanger = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  numValue?: number;
  format?: (n: number) => string;
  render?: React.ReactNode;
  tone?: KpiTone;
  compact?: boolean;
  /** Visual variant — neutral (cream), warm (caramel), success (green). */
  variant?: 'neutral' | 'warm' | 'success';
  /** Hover tooltip explaining what the value means. */
  tooltip?: string;
  /** When set, value changes ALSO spawn a floating "+$120"/"−2" ghost. */
  ghostFormat?: (delta: number) => string;
  /** Color for negative ghosts — danger for money loss, warning for an
      expected spend like energy. */
  ghostDownClass?: string;
  /** Slow red heartbeat — resource fully spent / cash underwater. */
  pulseDanger?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const [ghosts, setGhosts] = useState<{ id: number; delta: number }[]>([]);
  const ghostId = useRef(0);
  // Ghost-removal timers live OUTSIDE the change effect's cleanup — the
  // effect re-arms on unrelated re-renders, and cancelling a pending removal
  // there would leave finished (invisible) ghosts in the DOM. Timers are only
  // force-cleared on unmount.
  const ghostTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => ghostTimers.current.forEach(clearTimeout), []);
  const last = useRef(numValue);
  useEffect(() => {
    if (numValue === undefined) return;
    if (last.current === undefined) {
      last.current = numValue;
      return;
    }
    if (last.current !== numValue) {
      const delta = numValue - last.current;
      setFlash(true);
      const flashT = setTimeout(() => setFlash(false), 700);
      if (ghostFormat) {
        const id = ++ghostId.current;
        // cap at 3 concurrent so rapid-fire changes never stack a column
        setGhosts((g) => [...g.slice(-2), { id, delta }]);
        ghostTimers.current.push(
          setTimeout(() => setGhosts((g) => g.filter((x) => x.id !== id)), 1100),
        );
      }
      last.current = numValue;
      return () => clearTimeout(flashT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numValue]);

  const displayed = numValue !== undefined && format ? format(numValue) : value;
  const tipText = tooltip ?? `${label}: ${displayed ?? ''}`;

  return (
    <Tooltip content={tipText} placement="bottom">
      {/* outer wrapper is position-only — the chip itself clips (overflow-
          hidden for the flash), so ghosts float from THIS un-clipped box */}
      <span className="relative inline-flex shrink-0">
        <div
          className={clsx(
            'game-hud-chip shrink-0 relative overflow-hidden',
            variant === 'warm' && 'game-hud-chip-warm',
            variant === 'success' && 'game-hud-chip-success',
            flash && 'anim-flash',
            pulseDanger && 'anim-heartbeat',
          )}
          role="status"
          aria-label={`${label}: ${displayed ?? ''}`}
        >
          <NavIcon icon={icon} size={14} color={variant === 'success' ? successChipInk[tone] : toneIcon[tone]} />
          <span
            className={clsx(
              'stat-label',
              variant === 'success' ? 'text-ink-900/80' : 'text-text-3',
              compact && 'hidden xl:inline',
            )}
          >
            {label}
          </span>
          {render ? (
            <span className={clsx('num-xs', variant !== 'success' && toneText[tone])} style={variant === 'success' ? { color: successChipInk[tone] } : undefined}>{render}</span>
          ) : numValue !== undefined && format ? (
            <CountUp
              value={numValue}
              format={format}
              className={clsx('num-xs', variant !== 'success' && toneText[tone])}
              style={variant === 'success' ? { color: successChipInk[tone] } : undefined}
            />
          ) : (
            <span className={clsx('num-xs', variant !== 'success' && toneText[tone])} style={variant === 'success' ? { color: successChipInk[tone] } : undefined}>{value}</span>
          )}
        </div>
        {ghostFormat &&
          ghosts.map((g) => (
            <span
              key={g.id}
              aria-hidden
              className={clsx(
                'stat-ghost',
                g.delta < 0 && 'stat-ghost--down',
                g.delta > 0 ? 'text-success' : ghostDownClass,
              )}
            >
              {ghostFormat(g.delta)}
            </span>
          ))}
      </span>
    </Tooltip>
  );
}

