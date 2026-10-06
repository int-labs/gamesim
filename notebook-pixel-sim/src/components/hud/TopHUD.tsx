import { useEffect, useRef, useState } from 'react';
import {
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
import { CountUp } from '@/components/primitives/CountUp';
import { HudMenu } from '@/components/hud/HudMenu';
import clsx from 'clsx';
import { HUD_TOOLTIPS } from '@/content/copy';
import { Tooltip } from '@/components/primitives/Tooltip';

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
 * Top HUD — calm pixel status bar, inside the notebook STAGE since 2026-10-05.
 *
 * Layout: `justify-between`, so the readouts sit at equal distances.
 *   [Energy] [Cash] ←→ [Op Profit · Revenue · Satisfaction] ←→ [More]
 *
 * Gone with the move: the Int Labs LOGO, and the PHASE chip — the footer's
 * `PhaseActionBar` already states the phase, and two copies of one number can
 * only ever agree or be a bug.
 *
 * Read-only chips have `cursor-default` and no hover lift; utility buttons
 * have `cursor-pointer` and hover translate.
 */
export function TopHUD({ liveProjectionState }: { liveProjectionState?: LiveProjectionState }) {
  const hasLines = useGame((s) => s.portfolio.productLines.length > 0);
  // The build cost needs the server's ceiling and unit cost, so the projection
  // is passed in — the chip is the round's spending limit, not just a tally of
  // the discretionary levers.
  const byProduct = liveProjectionState?.liveProjection?.byProduct ?? null;
  // The BASE is the round's cash balance, not `player.cash` — it pivots as soon
  // as the operator scores the round.
  const { financialsByRound } = useGamesimSession();
  // THE ONLY CASH SURFACE. The P&L sheet used to carry a parallel cash walk off
  // the same `selectCashBalance`; it became a pure income statement on
  // 2026-09-17, so this chip is now the single place a cash POSITION is stated.
  // What it shows is that balance minus what this round has committed but not
  // yet been scored on.
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
    // `shrink-0`, not `sticky top-0 z-30` — it is a row inside the stage column
    // now, not a bar floating over the whole screen.
    <header className="game-hud shrink-0">
      {/* `justify-between`: equal distance between each readout. There is no
          `gap` and no `flex-1` spacer — either would override the distribution
          this is here to produce. */}
      {/* `min-h`, not `h`. The chips inside scale with the type scale, so a
          fixed bar height would crop them at a high resolution. */}
      <div className="flex items-center justify-between px-3 sm:px-4 min-h-[58px] py-1.5">
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
            lg+ only — the FINANCIAL section covers smaller screens.

            `min-w-0 overflow-hidden` is the guard, not the decoration. Every
            other child of this bar is `shrink-0` — correct, they are the
            essentials — so this is the ONLY thing that can absorb a narrow
            stage. Without it the strip keeps its full 519px however little room
            it has and spills over the chips on either side. A flex child cannot
            overflow a box that clips. */}
        {/* `xl`, not `lg`. The breakpoint keys off the VIEWPORT, but this bar
            lives in the STAGE — roughly 60% of it, behind a 52px tab rail and a
            rail capped at 40vw. At a 1024px viewport (`lg`) the stage is ~610px
            and the strip needs more than that, so it appeared exactly where it
            could not fit and spilled over the chips either side. Shown from
            1280px up, the stage has ~770px and the row fits. */}
        <div className="min-w-0 overflow-hidden hidden xl:flex px-2">
          {hasLines && <CanvasStatusStrip liveProjection={liveProjectionState?.liveProjection ?? null} />}
        </div>

        {/* === Utility — Help + Stats (compact only) + Mascot toggle === */}
        {/* Utility controls. Six separate icons (stats, sfx, music, history,
            help, logout) crowded the bar's right edge and pushed the KPI chips
            at common laptop widths, so several were hidden below `lg` and
            simply unreachable there. HudMenu keeps the two run-work icons on
            the bar and folds the settings-type controls — shop rename, sound,
            music, help, log out — into one "More" menu that fits at every
            width. Its log out calls the gamesim provider, which is what
            actually ends the session. */}
        <HudMenu onHelp={helpClick} />
      </div>
    </header>
  );
}

/* `Sep` — the `.game-hud-divider` rule between chip groups — went with the
   logo and phase chip on 2026-10-05. `justify-between` is the separation now;
   a rule inside a justified row is one more thing competing for the gap. */

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

