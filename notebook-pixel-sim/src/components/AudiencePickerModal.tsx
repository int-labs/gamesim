import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/state/store';
import { SEGMENTS } from '@/data/segments';
import { setSegment } from '@/engine/mockEngine';
import { PixelModal } from '@/components/primitives/PixelModal';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { fmt$ } from '@/utils/format';
import { playSfx } from '@/audio/audioManager';

const PREF_LABELS: Record<string, string> = {
  paperQuality: 'paper quality',
  coverPremium: 'premium covers',
  decorative: 'decoration',
  functional: 'function',
  packaging: 'packaging',
};

// The two things a segment cares about most — a quick "who is this for" hint.
function topPrefs(pref: Record<string, number>, n = 2) {
  return Object.entries(pref)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => PREF_LABELS[k] ?? k);
}

/**
 * AudiencePickerModal — the very first decision of a run.
 *
 * When the simulation is entered with no target audience yet, this pops so the
 * player picks who they're selling to (audience drives demand + product fit).
 * It's dismissible — they can also pick/change it anytime on the Business page,
 * and the action-bar warning chip still nudges them if they skip.
 *
 * Self-contained (like DayAdvanceFlash): it opens on the transition INTO
 * 'simulation' with no segment, so it also fires for a fresh New Game, and
 * never re-nags once dismissed within the same run.
 */
export function AudiencePickerModal() {
  const screen = useGame((s) => s.meta.screen);
  const target = useGame((s) => s.market.targetSegment);
  const sequenceActive = useGame((s) => s.meta.sequenceActive);
  const apply = useGame((s) => s.apply);

  const [open, setOpen] = useState(false);
  const lastScreen = useRef(screen);

  useEffect(() => {
    const prev = lastScreen.current;
    lastScreen.current = screen;
    if (screen === 'simulation' && prev !== 'simulation' && target === null && !sequenceActive) {
      setOpen(true);
    }
  }, [screen, target, sequenceActive]);

  return (
    <PixelModal
      open={open}
      onClose={() => setOpen(false)}
      title="Choose your target audience"
      width="min(680px, calc(100vw - 32px))"
    >
      <div className="mb-4 flex items-start gap-3">
        <MascotAvatar mood="presenting" size={60} />
        <p className="body-xs text-text">
          First things first: pick who you're making notebooks for. Your audience drives demand and
          decides which design choices land. You can switch anytime on the Business page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.id}
            type="button"
            onClick={() => {
              playSfx('select');
              apply((s) => setSegment(s, seg.id));
              setOpen(false);
            }}
            className="flex items-start gap-3 border-2 border-border-soft bg-surface p-3 text-left transition-all hover:-translate-y-px hover:border-primary hover:shadow-[2px_2px_0_0_var(--c-shadow)]"
          >
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center border-2 border-border-soft bg-surface-2">
              <img src={seg.imgPath} alt={seg.name} className="h-12 w-12 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="eyebrow eyebrow-sm text-text">{seg.name}</div>
              <div className="mt-0.5 hint leading-snug text-text-2">{seg.description}</div>
              <div className="mt-1.5 hint text-text-3">
                Anchor ~{fmt$(seg.preferredPriceRef)} · Cares about {topPrefs(seg.preference).join(', ')}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="hint text-text-3 underline underline-offset-2 hover:text-text"
        >
          I'll choose on the Business page
        </button>
      </div>
    </PixelModal>
  );
}
