import clsx from 'clsx';
import { PixelIcon, type PixelIconKind } from '@/components/icons/PixelIcon';

export type CostTone = 'cost' | 'energy' | 'gain' | 'danger' | 'neutral';

export interface CostTile {
  label: string;
  /** The headline number/text, rendered big + arcade-font. */
  value: string;
  tone?: CostTone;
  icon?: PixelIconKind;
}

// No `border` key any more — see the tile below. Tone is carried by the tint
// behind the tile and the ink of its figure, which is all it ever needed.
const TONE: Record<CostTone, { text: string; bg: string; icon: string }> = {
  cost:    { text: 'text-warning', bg: 'bg-warning-soft/40', icon: 'var(--c-warning)' },
  energy:  { text: 'text-warning', bg: 'bg-warning-soft/40', icon: 'var(--c-warning)' },
  gain:    { text: 'text-success', bg: 'bg-success-soft/40', icon: 'var(--c-success)' },
  danger:  { text: 'text-danger',  bg: 'bg-danger-soft/40',  icon: 'var(--c-danger)' },
  neutral: { text: 'text-text',    bg: 'bg-surface-2/50',    icon: 'var(--c-text-2)' },
};

/**
 * CostTiles — the prominent "what this costs" strip for decision modals. Each
 * tile shows a small label + a BIG, colour-coded, arcade-font number so the
 * cost/energy/impact reads at a glance instead of as faint list text.
 */
export function CostTiles({ tiles, className }: { tiles: CostTile[]; className?: string }) {
  // 4 tiles in 3 columns leaves the fourth stranded alone on a second row with
  // two empty cells beside it. Pair them 2x2 instead; 1-3 stay on one row.
  const cols = tiles.length === 4 ? 2 : Math.min(tiles.length, 3);
  return (
    <div
      className={clsx('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) => {
        const tone = TONE[t.tone ?? 'neutral'];
        return (
          // NO border. These are the numbers you are deciding AGAINST, sitting
          // beside the button you press — and they used to carry the same 2px
          // frame as that button, which is most of why "what can I click?" was
          // the first question this screen provoked. A 2px frame is reserved
          // for controls; a tile is a readout, so the tint alone holds it.
          <div key={t.label} className={clsx('readout flex flex-col items-center justify-center gap-1.5 px-2 py-3 text-center', tone.bg)}>
            <span className="inline-flex items-center gap-1 stat-label">
              {t.icon && <PixelIcon kind={t.icon} size={10} color={tone.icon} />}
              {t.label}
            </span>
            {/* .num-md, not .h3 — these are figures. A heading class put them in
                the pixel face, which mangles digits and rendered the value
                SMALLER than the caption above it. */}
            <span className={clsx('num-md leading-none', tone.text)}>{t.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ImpactList — the "what it does" effects, as a clean labelled list of chips
 * (paired with CostTiles above it in decision modals).
 */
export function ImpactList({ label = 'Effects', items }: { label?: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="stat-label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          // Same rule as the tiles above: an effect is something you read, not
          // something you press, so it loses its 2px frame too.
          <span key={i} className="inline-flex items-center px-2.5 py-1.5 bg-success-soft/40 num-xs text-text leading-none">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
