import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Package,
  History as HistoryIcon,
  Volume2,
  VolumeX,
  Music,
  CircleHelp,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { setShopName } from '@/engine/mockEngine';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { audio, playSfx } from '@/audio/audioManager';
import { lockAccess } from '@/access/passkey';
import { NavIcon } from '@/components/icons/NavIcon';
import { MusicOffIcon } from '@/components/icons/MusicOffIcon';
import { HistoryDropdown } from '@/components/hud/HistoryDropdown';
import { Tooltip } from '@/components/primitives/Tooltip';

interface Props {
  /** Opens the full Stats & KPIs drawer (owned by TopHUD). */
  onOpenStats: () => void;
  /** Fires Amelia's quick-refresher help script (owned by TopHUD). */
  onHelp: () => void;
}

/**
 * HudMenu — the top bar's utility controls (undo / redo, stats, history, audio,
 * help, log out), rendered TWO ways so the bar is never empty AND never
 * overcrowded:
 *
 *   • Wide bars (xl+): a full inline ICON TOOLBAR on the right. It gives the bar
 *     a weighted right cluster that balances the numbers on the left instead of
 *     a lone hamburger stranded past a big gap.
 *   • Narrow bars (<xl): the same actions collapse into ONE hamburger dropdown.
 *
 * Decision history and log-out open as centered MODALS (shared by both layouts),
 * never as a second popup stacked on the menu.
 */
export function HudMenu({ onOpenStats, onHelp }: Props) {
  const shopName = useGame((s) => s.meta.shopName);
  const apply = useGame((s) => s.apply);
  // The gamesim session logout — `lockAccess()` alone only flips the local
  // unlocked flag and would leave the bearer token in place, so the next load
  // would walk straight back in.
  const { logout: gamesimLogout } = useGamesimSession();
  const sfxEnabled = useGame((s) => s.audio.sfxEnabled);
  const musicEnabled = useGame((s) => s.audio.musicEnabled);
  const toggleSfx = useGame((s) => s.toggleSfx);
  const toggleMusic = useGame((s) => s.toggleMusic);

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const place = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };
  const toggle = () => { playSfx('click-soft'); place(); setOpen((v) => !v); };
  const close = () => setOpen(false);

  // Shared action handlers — used by BOTH the inline toolbar and the dropdown.
  const openStats = () => { close(); onOpenStats(); };
  const openHistory = () => { close(); setHistoryOpen(true); };
  const doHelp = () => { close(); onHelp(); };
  const askLogout = () => { close(); setConfirmLogout(true); };
  const doToggleSfx = () => {
    const next = !sfxEnabled;
    toggleSfx();
    audio.setSfxEnabled(next);
    if (next) playSfx('click-soft');
  };
  const doToggleMusic = () => {
    const next = !musicEnabled;
    // The PREFERENCE flips first, then we try to act on it. Doing it the other
    // way round means any failure to start audio — an autoplay policy, a
    // backgrounded tab, no output device — takes the store update down with it,
    // and the control reads as broken: you click Music, nothing changes, and
    // nothing ever will. The setting is the player's; whether sound actually
    // comes out is the environment's business.
    toggleMusic();
    // Still called directly from the click handler, not an effect, so it counts
    // as a user gesture under Safari's autoplay policy.
    audio.setMusicEnabled(next);
  };

  // Dropdown: outside-click + Escape + reposition on resize/scroll.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById('hud-menu')?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <>
      {/* ── Utility controls — a COMPACT, always-inline toolbar so the bar's
             right side is a real cluster (never a lone hamburger past a gap) and
             never overflows the numbers on the left:

             • The four run-work controls — Undo, Redo, Stats, Decision history —
               are always icons. (Stats/history fold away only below `sm`, i.e.
               phones, where the whole HUD compacts.)
             • The settings-type controls — sound, music, help, log out — live in
               a "More" (⋯) menu. All eight as separate icons would need ~1520px
               beside the studio name + KPIs (measured), overflowing every common
               laptop; this set fits from 1280 up.

           So every desktop width shows the same substantial 5-button cluster
           instead of a hamburger stranded past dead space. ─────────────────── */}
      <div className="inline-flex items-center gap-1 shrink-0" role="toolbar" aria-label="Controls">
        {/* Undo / Redo — bar icons on sm+; on phones they collapse into the ⋯
            menu so the compact bar has room for Energy + the Stats icon. */}
        <span className="hidden sm:inline-flex items-center gap-1">
          <span aria-hidden className="game-hud-divider" />
        </span>
        {/* All stats & KPIs — visible at EVERY width, phones included. */}
        <ToolbarIcon icon={Package} tip="All stats & KPIs" onClick={openStats} />
        {/* Decision history — bar icon on sm+; in the ⋯ menu on phones. */}
        <span className="hidden sm:inline-flex">
          <ToolbarIcon icon={HistoryIcon} tip="Decision history" onClick={openHistory} />
        </span>
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          aria-label="More controls"
          aria-haspopup="menu"
          aria-expanded={open}
          className="game-hud-iconbtn"
        >
          <NavIcon icon={MoreHorizontal} size={16} color="currentColor" />
        </button>
      </div>

      {open && rect &&
        createPortal(
          <div
            id="hud-menu"
            role="menu"
            className="fixed z-[130] w-[248px] panel-frame panel-frame--lifted bg-surface"
            style={{ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) }}
          >
            {/* This is the OVERFLOW menu: it only holds controls that aren't
                already visible in the bar, so nothing here is redundant.
                • Studio name — shown only < 1400px, where the bar's inline name
                  tag is hidden (it IS the primary rename above that width).
                • Undo / Redo / Decision history — shown only < sm (phones), where
                  their bar icons collapse to make room for Energy + the Stats
                  icon. On sm+ they're bar icons, so no menu copy there.
                • Sound / Music / Help / Log out — the bar never shows these, so
                  this menu is their one and only home. */}
            <div className="min-[1400px]:hidden px-3 pt-2.5 pb-2 border-b border-border-soft">
              <label htmlFor="hud-shop-name" className="block stat-label mb-1">
                Studio name
              </label>
              <input
                id="hud-shop-name"
                type="text"
                value={shopName}
                maxLength={24}
                placeholder="Notebook Studio"
                onChange={(e) => apply((st) => setShopName(st, e.target.value))}
                className="w-full h-[30px] bg-surface-2 border border-border-soft px-2 item-name text-text focus:outline-none focus:border-primary"
              />
            </div>

            <div className="sm:hidden py-1 border-b border-border-soft">
              {/* Undo / Redo belong to a V2.1 store slice this tree does not
                  carry, so those rows are deliberately absent. */}
              <MenuRow icon={HistoryIcon} label="Decision history" onClick={openHistory} chevron />
            </div>

            <div className="py-1 border-b border-border-soft">
              <MenuRow
                icon={sfxEnabled ? Volume2 : VolumeX}
                label="Sound effects"
                onClick={doToggleSfx}
                trailing={<StatePill on={sfxEnabled} />}
              />
              <MenuRow
                icon={musicEnabled ? Music : undefined}
                iconNode={musicEnabled ? undefined : <MusicOffIcon size={15} color="currentColor" />}
                label="Music"
                onClick={doToggleMusic}
                trailing={<StatePill on={musicEnabled} />}
              />
            </div>

            <div className="py-1">
              <MenuRow icon={CircleHelp} label="Help" onClick={doHelp} chevron />
              <MenuRow icon={LogOut} label="Log out" onClick={askLogout} tone="danger" chevron />
            </div>
          </div>,
          document.body,
        )}

      {/* Decision history — centered modal, shared by both layouts. */}
      {historyOpen && <HistoryDropdown onClose={() => setHistoryOpen(false)} />}

      {/* Log-out confirm — centered modal, shared by both layouts. */}
      {confirmLogout &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] bg-black/55 flex items-center justify-center p-4"
            onClick={() => setConfirmLogout(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label="Log out"
              onClick={(e) => e.stopPropagation()}
              className="panel-frame panel-frame--lifted-lg bg-surface w-full max-w-[360px]"
            >
              <header className="px-4 py-3 border-b-2 border-border-soft bg-surface-2 flex items-center gap-2">
                <NavIcon icon={LogOut} size={14} color="var(--c-danger)" />
                <span className="section-title text-text">Log out?</span>
              </header>
              <div className="px-4 py-4 body-sm text-text-2 leading-relaxed">
                Log out and re-enter your pass key? Your progress is saved.
              </div>
              <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-soft bg-surface-2/70">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  className="h-[34px] px-4 border-2 border-border-soft bg-surface text-text btn-label-sm uppercase hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { playSfx('click'); gamesimLogout(); lockAccess(); }}
                  // `bg-danger` is the bright pastel — cream on it is 3.5:1.
                  // `-strong` is the same hue darkened until cream passes.
                  className="h-[34px] px-4 border-2 border-border bg-danger-strong btn-label-sm uppercase cursor-pointer inline-flex items-center gap-1.5"
                  style={{ color: '#FAF7E8' }}
                >
                  <NavIcon icon={LogOut} size={12} color="#FAF7E8" />
                  Log out
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** One inline toolbar icon button (wide layout). Shares the raised HUD keycap. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolbarIcon({ icon, iconNode, tip, disabled, onClick }: { icon?: any; iconNode?: React.ReactNode; tip: string; disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip content={tip} placement="bottom">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={tip}
        className={clsx('game-hud-iconbtn', disabled && 'opacity-40 cursor-not-allowed')}
      >
        {iconNode ?? <NavIcon icon={icon} size={16} color="currentColor" />}
      </button>
    </Tooltip>
  );
}

/** A full-width menu row: icon + label + optional trailing state / chevron. */
function MenuRow({
  icon,
  iconNode,
  label,
  onClick,
  trailing,
  chevron,
  tone,
  disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any;
  iconNode?: React.ReactNode;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
  chevron?: boolean;
  tone?: 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 h-[36px] text-left transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-text hover:bg-surface-2',
      )}
    >
      <span className="shrink-0 inline-flex w-4 justify-center">
        {iconNode ?? (icon ? <NavIcon icon={icon} size={15} color="currentColor" /> : null)}
      </span>
      <span className="flex-1 item-name">{label}</span>
      {trailing}
      {chevron && <NavIcon icon={ChevronRight} size={13} color="var(--c-text-3)" />}
    </button>
  );
}

/** on/off state chip for the toggle rows. */
function StatePill({ on }: { on: boolean }) {
  return (
    <span
      className={clsx(
        'stat-label px-1.5 py-0.5 border',
        on ? 'border-success bg-success-soft text-success' : 'border-border-soft bg-surface-2 text-text-3',
      )}
    >
      {on ? 'On' : 'Off'}
    </span>
  );
}
