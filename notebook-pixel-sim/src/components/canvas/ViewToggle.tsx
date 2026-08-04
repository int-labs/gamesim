import clsx from 'clsx';
import { A } from '@/assets';
import { useGame } from '@/state/store';
import { playSfx } from '@/audio/audioManager';
import { Tooltip } from '@/components/primitives/Tooltip';

/**
 * ViewToggle — segmented control that flips the canvas between the single
 * FOCUS view (one notebook, hero) and the SHELF gallery (browse all). Bound to
 * the transient `ui.viewMode`. Rendered in both view headers, in the same
 * spot, so it never moves when the view flips.
 *
 * Icons are house-style pixel glyphs cropped from the master icon sheet
 * (A.ui.pixel) — a spiral notebook for Focus, a grid for Shelf.
 */
const OPTS: { id: 'focus' | 'gallery'; label: string; icon: string; tip: string }[] = [
  { id: 'focus', label: 'Focus', icon: A.ui.pixel.notebook_focus, tip: 'Focus - design one notebook' },
  { id: 'gallery', label: 'Shelf', icon: A.ui.pixel.grid_shelf, tip: 'Shelf - browse all your notebooks' },
];

export function ViewToggle() {
  const viewMode = useGame((s) => s.ui.viewMode);
  const setViewMode = useGame((s) => s.setViewMode);

  return (
    <div role="group" aria-label="Canvas view" className="inline-flex items-center gap-1 p-0.5 bg-surface-2 border border-border-soft">
      {OPTS.map((o) => {
        const active = viewMode === o.id;
        return (
          <Tooltip key={o.id} content={o.tip}>
            <button
              type="button"
              onClick={() => { if (!active) { playSfx('click-soft'); setViewMode(o.id); } }}
              aria-pressed={active}
              className={clsx(
                'inline-flex items-center gap-1.5 px-2 h-[26px] eyebrow eyebrow-sm border transition-all duration-150 active:scale-95 cursor-pointer',
                active ? 'border-primary bg-primary-soft text-text' : 'border-transparent text-text-3 hover:text-text-2 hover:bg-surface',
              )}
            >
              <img
                src={o.icon}
                alt=""
                className={clsx('w-[15px] h-[15px] object-contain', !active && 'opacity-60 grayscale-[35%]')}
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
