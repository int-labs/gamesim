import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/state/store';
import { calcDemandToday } from '@/engine/mockEngine';
import { mulberry32, seedFrom } from '@/utils/rng';
import { fmt$, fmtInt } from '@/utils/format';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import { NavIcon } from '@/components/icons/NavIcon';
import { Volume2, VolumeX, Music, History as HistoryIcon } from 'lucide-react';
import { MusicOffIcon } from '@/components/icons/MusicOffIcon';
import { audio, playSfx } from '@/audio/audioManager';
import { ameliaVoice, VOICE_DISABLED } from '@/audio/ameliaVoice';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional handler — wired in TopHUD to pop open the History dropdown after the drawer closes. */
  onOpenHistory?: () => void;
}

/**
 * Stats drawer — bottom sheet shown on mobile when the player taps the
 * "Stats" button in the compact TopHUD. Surfaces the chips that are
 * hidden in compact mode (Revenue, Stock, Demand, Fit) plus a small
 * recap of the always-visible ones (Phase, Cash, Energy, Op Profit) so
 * the drawer functions as a complete at-a-glance view on small screens.
 */
export function StatsDrawer({ open, onClose, onOpenHistory }: Props) {
  // Hooks must run unconditionally — the early return for !open happens AFTER hooks.
  const phase = useGame((s) => s.meta.phase);
  const day = useGame((s) => s.meta.day);
  const cash = useGame((s) => s.player.cash);
  const energy = useGame((s) => s.player.energy);
  const maxEnergy = useGame((s) => s.player.maxEnergy);
  const finished = useGame((s) => s.inventory.totalFinished);
  const market = useGame((s) => s.market);
  const ledger = useGame((s) => s.ledger);
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  const sfxEnabled = useGame((s) => s.audio.sfxEnabled);
  const musicEnabled = useGame((s) => s.audio.musicEnabled);
  const toggleSfx = useGame((s) => s.toggleSfx);
  const toggleMusic = useGame((s) => s.toggleMusic);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sum = (k: string) => ledger.filter((e) => e.kind === k).reduce((a, b) => a + b.amount, 0);
  const grossRevenue = sum('revenue');
  const matCost = -sum('cogs-material');
  const labor = -sum('cogs-labor');
  const packaging = -sum('cogs-packaging');
  const fulfillment = -sum('cogs-fulfillment');
  const marketing = -sum('opex-marketing');
  const tools = -sum('opex-tool');
  const opProfit = grossRevenue - matCost - labor - packaging - fulfillment - marketing - tools;

  const rand = mulberry32(seedFrom(useGame.getState().meta.seed + ':drawer:' + (day + 1)));
  const demand = Math.round(calcDemandToday(useGame.getState(), rand).total);
  const fitVal = market.targetSegment
    ? (market.fitBySegmentByLineId[activeLineId]?.[market.targetSegment] ?? null)
    : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[140] bg-black/55"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All stats"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 1.4, 0.4, 1] }}
            className="fixed inset-x-0 bottom-0 z-[150] panel-frame bg-surface border-t-2 border-border shadow-[0_-3px_0_0_var(--c-shadow)]"
            style={{ maxHeight: '78vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div aria-hidden className="w-10 h-1 bg-border-soft rounded-full" />
            </div>
            <header className="flex items-center justify-between px-4 py-2 border-b border-border-soft">
              <div className="flex flex-col leading-tight">
                <span className="stat-label">All stats</span>
                <span className="hint text-text">
                  Phase <span className="strong">{phase}</span> · Day <span className="num-xs">{day}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close stats"
                className="inline-flex items-center justify-center w-9 h-9 border border-border-soft hover:bg-surface-2 cursor-pointer"
              >
                <PixelIcon kind="close" size={11} />
              </button>
            </header>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(78vh - 60px)' }}>
              <div className="p-3 grid grid-cols-2 gap-2">
                <Stat icon="cash" label="Cash" value={fmt$(cash)} tone={cash < 100 ? 'danger' : 'success'} />
                <Stat icon="energy" label="Energy" value={`${energy}/${maxEnergy}`} tone={energy / maxEnergy < 0.2 ? 'warn' : 'neutral'} />
                <Stat icon="profit" label="Op Profit" value={fmt$(opProfit)} tone={opProfit < 0 ? 'danger' : opProfit > 0 ? 'success' : 'neutral'} />
                <Stat icon="revenue" label="Revenue" value={fmt$(grossRevenue)} tone="info" />
                <Stat icon="stock" label="Stock on hand" value={fmtInt(finished)} tone={finished === 0 ? 'danger' : 'neutral'} />
                <Stat icon="demand" label="Demand est." value={`~${fmtInt(demand)}/d`} tone="info" />
                <Stat
                  icon="fit"
                  label="Customer fit"
                  value={fitVal !== null ? `${Math.round(fitVal * 100)}%` : '-'}
                  tone={fitVal === null ? 'neutral' : fitVal > 0.7 ? 'success' : fitVal < 0.4 ? 'warn' : 'neutral'}
                />
                <Stat icon="phase" label="Phase" value={`${phase} / 3`} tone="neutral" />
              </div>

              {/* Utility actions — only useful below sm where the navbar
                  hides these icons to save horizontal space. Inside the
                  drawer they always render so the player can manage
                  audio + history from one place. */}
              <div className="px-3 pb-3 pt-1 border-t border-border-soft">
                <div className="stat-label leading-tight mb-2">Settings</div>
                {!VOICE_DISABLED && <AmeliaVoicePicker open={open} />}
                <div className="grid grid-cols-3 gap-2">
                  <UtilButton
                    icon={sfxEnabled ? Volume2 : VolumeX}
                    label={sfxEnabled ? 'SFX on' : 'SFX off'}
                    active={sfxEnabled}
                    onClick={() => {
                      const next = !sfxEnabled;
                      audio.setSfxEnabled(next);
                      toggleSfx();
                      if (next) playSfx('click-soft');
                    }}
                  />
                  <UtilButton
                    iconNode={musicEnabled
                      ? <NavIcon icon={Music} size={16} color="currentColor" />
                      : <MusicOffIcon size={16} color="currentColor" />}
                    label={musicEnabled ? 'Music on' : 'Music off'}
                    active={musicEnabled}
                    onClick={() => {
                      // Direct gesture-bound call — see TopHUD note.
                      const next = !musicEnabled;
                      audio.setMusicEnabled(next);
                      toggleMusic();
                    }}
                  />
                  <UtilButton
                    icon={HistoryIcon}
                    label="History"
                    active={false}
                    onClick={() => {
                      playSfx('click-soft');
                      onClose();
                      // Defer so the drawer animates out before the dropdown opens.
                      if (onOpenHistory) window.setTimeout(onOpenHistory, 220);
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type Tone = 'success' | 'warn' | 'danger' | 'info' | 'neutral';
const toneRing: Record<Tone, string> = {
  success: 'border-success/60 bg-success-soft',
  warn:    'border-warning/60 bg-warning-soft',
  danger:  'border-danger/60 bg-danger-soft',
  info:    'border-info/60 bg-info-soft',
  neutral: 'border-border-soft bg-surface-2',
};
const toneText: Record<Tone, string> = {
  success: 'text-success',
  warn:    'text-warning',
  danger:  'text-danger',
  info:    'text-info',
  neutral: 'text-text',
};
const toneIconColor: Record<Tone, string> = {
  success: 'var(--c-success)',
  warn:    'var(--c-warning)',
  danger:  'var(--c-danger)',
  info:    'var(--c-info)',
  neutral: 'var(--c-text-2)',
};

function Stat({ icon, label, value, tone }: { icon: PixelIconKind; label: string; value: string; tone: Tone }) {
  return (
    <div className={clsx('flex items-center gap-2.5 px-2.5 py-2 border-2', toneRing[tone])}>
      <span className="inline-flex items-center justify-center w-9 h-9 border-2 border-border-soft bg-surface shrink-0">
        <PixelIcon kind={icon} size={13} color={toneIconColor[tone]} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="stat-label leading-tight">{label}</div>
        <div className={clsx('num-xs leading-tight', toneText[tone])}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Voice picker — lists Amelia-suitable English voices the OS / browser
 * exposes. The user's pick persists via localStorage. A small "Test"
 * button speaks a sample so the player can audition voices without
 * waiting for the next mascot script.
 *
 * The Web Speech voice list loads asynchronously on Chrome — we poll
 * once on mount and then via `voiceschanged` (handled inside the
 * engine, but we re-read the snapshot here on each open).
 */
function AmeliaVoicePicker({ open }: { open: boolean }) {
  const [voices, setVoices] = useState<{ name: string; lang: string; localService: boolean }[]>([]);
  const [picked, setPicked] = useState<string>('');
  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      setVoices(ameliaVoice.listVoices());
      setPicked(ameliaVoice.getCurrentVoiceName() ?? '');
    };
    refresh();
    // Voices may load slightly after the drawer opens (Chrome Edge case).
    const t1 = window.setTimeout(refresh, 200);
    const t2 = window.setTimeout(refresh, 800);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [open]);

  if (voices.length === 0) {
    return (
      <div className="hint text-text-3 italic mb-2">
        Amelia voice: no system voices detected yet.
      </div>
    );
  }
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <label className="stat-label">
        Amelia voice
      </label>
      <div className="flex items-center gap-1.5">
        <select
          value={picked}
          onChange={(e) => {
            const v = e.target.value;
            setPicked(v);
            ameliaVoice.setVoice(v || null);
          }}
          className="flex-1 min-w-0 h-[30px] border border-border bg-surface hint px-2 cursor-pointer"
          aria-label="Choose Amelia voice"
        >
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} {v.localService ? '· local' : '· online'}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            playSfx('click-soft');
            ameliaVoice.speak({
              id: 'voice_test_' + Date.now(),
              text: "Hi, I'm Amelia. How does my voice sound?",
              mood: 'happy',
            });
          }}
          className="h-[30px] px-3 border border-border bg-primary-soft text-text hover:bg-primary hover:text-[#FAF7E8] cursor-pointer eyebrow eyebrow-sm text-inherit"
        >
          Test
        </button>
      </div>
      <div className="hint text-text-3 leading-snug">
        Tip: voices labelled "Natural", "Premium", or "Enhanced" sound the cleanest. Local voices have zero delay.
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UtilButton({ icon, iconNode, label, active, onClick }: { icon?: any; iconNode?: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 px-2 py-2.5 border-2 transition-colors cursor-pointer',
        active
          ? 'border-primary bg-primary-soft text-text'
          : 'border-border-soft bg-surface-2 text-text-2 hover:border-border hover:text-text',
      )}
    >
      {iconNode ?? <NavIcon icon={icon} size={16} color="currentColor" />}
      <span className="eyebrow eyebrow-sm leading-none">{label}</span>
    </button>
  );
}
