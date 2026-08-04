import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import clsx from 'clsx';
import { NavIcon } from '@/components/icons/NavIcon';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { A } from '@/assets';

/**
 * The bit of the ROOM the game never showed.
 *
 * Everything else in this HUD is about the team's own 90 days. This is the
 * facilitator's frame around it: which round is open, how long is left on the
 * clock they announced, and who this team is.
 *
 * ── WHY IT MATTERS ──────────────────────────────────────────────────────────
 * The timer existed end to end — the console sets `timer.durationMinutes`, the
 * server stores `startDate`/`endDate`, the player's `RoundDto` typed it — and
 * no component ever read it. A facilitator would say "you have 25 minutes" and
 * the room had no clock. Teams likewise had no idea what they were called;
 * the console knew, the player never asked.
 *
 * Renders NOTHING when the player is running standalone (no gamesim session),
 * so the offline/demo experience is untouched.
 */

/** Formats ms as m:ss, or h:mm:ss past an hour. */
function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** Pixel marks a team badge can take. Kept to visually distinct silhouettes so
 *  two teams in the same room are told apart at 16px. */
const TEAM_MARKS = [
  A.ui.pixel.star,
  A.ui.pixel.trophy,
  A.ui.pixel.sparkles,
  A.ui.pixel.gift,
  A.ui.pixel.notebook_focus,
  A.ui.pixel.grid_shelf,
];

/** Stable per-team pick — same name always yields the same mark. */
function teamMark(name: string | null | undefined): string {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TEAM_MARKS[h % TEAM_MARKS.length];
}

export function SessionChip() {
  const { status, bootstrap } = useGamesimSession();
  const round = bootstrap?.round ?? null;
  const endsAt = round?.timer?.endDate ? new Date(round.timer.endDate).getTime() : null;

  // Ticks only while there is something to count. A permanent 1s interval in
  // the HUD of a game that already re-renders on every day-tick is waste.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (status !== 'ready' || !bootstrap) return null;

  const left = endsAt ? endsAt - now : null;
  const over = left !== null && left <= 0;
  // Under two minutes is when a facilitator starts counting down out loud.
  const urgent = left !== null && left > 0 && left < 2 * 60 * 1000;

  return (
    <div className="flex items-center gap-2">
      {round && (
        <Tooltip
          content={
            over
              ? 'The round is past its time. You can still submit until the facilitator closes it.'
              : 'The round your facilitator has open, and the time left on it.'
          }
          placement="bottom"
        >
          <div
            className={clsx(
              'game-hud-chip shrink-0',
              urgent && 'anim-pulse-on-change',
            )}
            role="status"
            aria-label={
              left === null
                ? `Round ${round.roundNumber}`
                : over
                  ? `Round ${round.roundNumber}, past its time`
                  : `Round ${round.roundNumber}, ${formatLeft(left)} remaining`
            }
          >
            <NavIcon
              icon={Timer}
              size={14}
              color={over || urgent ? 'var(--c-danger)' : 'var(--c-text-2)'}
            />
            <span className="hidden sm:inline eyebrow eyebrow-sm text-text-2 leading-none">
              Round
            </span>
            <span className="num-sm text-text leading-none">{round.roundNumber}</span>
            {left !== null && (
              <span
                className={clsx(
                  'num-sm leading-none tabular-nums',
                  over || urgent ? 'text-danger' : 'text-text-2',
                )}
              >
                {over ? 'over' : formatLeft(left)}
              </span>
            )}
          </div>
        </Tooltip>
      )}

      {bootstrap.teamName && (
        <Tooltip content="Your team, as your facilitator set it up." placement="bottom">
          <div className="game-hud-chip shrink-0" role="status" aria-label={`Team ${bootstrap.teamName}`}>
            {/* A PIXEL mark, not the server's DiceBear avatar. That avatar is
                abstract geometry in its own palette — bright cyan and orange —
                which is right for the console's team roster and completely
                foreign inside a warm pixel-art game. The mark is still chosen
                deterministically from the team name, so each team keeps a
                distinct badge; it just belongs to the same art set as
                everything else on screen. */}
            <img
              src={teamMark(bootstrap.teamName)}
              alt=""
              className="h-4 w-4 shrink-0 object-contain"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
            <span className="body-xs text-text leading-none max-w-[9rem] truncate">
              {bootstrap.teamName}
            </span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
