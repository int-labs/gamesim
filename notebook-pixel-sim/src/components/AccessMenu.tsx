import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { PixelButton } from '@/components/primitives';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';

/**
 * AccessMenu — a global, deliberately low-hierarchy control to log out
 * (clear the pass key) and return to the entry gate.
 *
 * Two placements, same confirm flow:
 *   • floating (default) → a quiet pill pinned bottom-left. Used on the
 *     non-game screens (start / route / phase intro), where that corner is
 *     empty.
 *   • inline (`inline`)  → an icon button that lives INSIDE the TopHUD utility
 *     toolbar during the run, so it never overlaps the bottom phase bar.
 *
 * A one-step confirm prevents accidental logout; progress is persisted, so
 * logging out just returns to the Pass Key screen.
 */
export function AccessMenu({ inline = false }: { inline?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  // Log out through the session provider: it clears the stored gamesim session
  // AND drops the loaded simulation context, so the next login can't inherit
  // the previous team's round/products.
  const { logout } = useGamesimSession();

  const confirmCard = (
    <div className="pixel-frame w-[240px] bg-cream-50 p-2.5 shadow-pixel-2">
      <p className="mb-2 font-body hint text-ink-800">
        Log out and re-enter your pass key? Your progress is saved.
      </p>
      <div className="flex justify-end gap-2">
        <PixelButton variant="ghost" size="sm" onClick={() => setConfirm(false)}>
          Cancel
        </PixelButton>
        <PixelButton
          variant="danger"
          size="sm"
          onClick={() => {
            playSfx('click');
            logout();
          }}
        >
          Log out
        </PixelButton>
      </div>
    </div>
  );

  // ── Inline (in the TopHUD toolbar during the run) ─────────────────────────
  if (inline) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            playSfx('click-soft');
            setConfirm((v) => !v);
          }}
          aria-label="Log out and re-enter pass key"
          title="Log out / re-enter pass key"
          aria-haspopup="dialog"
          aria-expanded={confirm}
          className="game-hud-iconbtn"
        >
          <NavIcon icon={LogOut} size={15} color="currentColor" />
        </button>
        {confirm && (
          <>
            {/* Click-away catcher. */}
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setConfirm(false)} />
            {/* Pinned just under the HUD at the top-right corner so it can never
                overflow the viewport edge (the button itself sits flush right). */}
            <div className="fixed right-2 top-[54px] z-50">{confirmCard}</div>
          </>
        )}
      </div>
    );
  }

  // ── Floating pill (non-game screens) ──────────────────────────────────────
  return (
    <div className="fixed bottom-2 left-2 z-40 select-none">
      {confirm ? (
        confirmCard
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          aria-label="Log out and re-enter pass key"
          title="Log out / re-enter pass key"
          className="flex cursor-pointer items-center gap-1.5 rounded-pixel border border-ink-900/25 bg-ink-900/35 px-2 py-1 text-cream-50/70 backdrop-blur-sm transition-colors hover:bg-ink-900/60 hover:text-cream-50"
        >
          <PixelIcon kind="lock" size={11} color="currentColor" />
          <span className="eyebrow eyebrow-sm tracking-wide">Log out</span>
        </button>
      )}
    </div>
  );
}
