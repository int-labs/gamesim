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

const TONE: Record<CostTone, { text: string; border: string; bg: string; icon: string }> = {
  cost:    { text: 'text-warning', border: 'border-warning/45', bg: 'bg-warning-soft/40', icon: 'var(--c-warning)' },
  energy:  { text: 'text-warning', border: 'border-warning/45', bg: 'bg-warning-soft/40', icon: 'var(--c-warning)' },
  gain:    { text: 'text-success', border: 'border-success/45', bg: 'bg-success-soft/40', icon: 'var(--c-success)' },
  danger:  { text: 'text-danger',  border: 'border-danger/45',  bg: 'bg-danger-soft/40',  icon: 'var(--c-danger)' },
  neutral: { text: 'text-text',    border: 'border-border-soft', bg: 'bg-surface-2/50',   icon: 'var(--c-text-2)' },
};

/**
 * CostTiles — the prominent "what this costs" strip for decision modals. Each
 * tile shows a small label + a BIG, colour-coded, arcade-font number so the
 * cost/energy/impact reads at a glance instead of as faint list text.
 */
export function CostTiles({ tiles, className }: { tiles: CostTile[]; className?: string }) {
  const cols = Math.min(tiles.length, 3);
  return (
    <div
      className={clsx('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) => {
        const tone = TONE[t.tone ?? 'neutral'];
        return (
          <div key={t.label} className={clsx('readout flex flex-col items-center justify-center gap-1 border-2 px-2 py-2.5 text-center', tone.border, tone.bg)}>
            <span className="inline-flex items-center gap-1 text-[14px] uppercase tracking-wider font-bold text-text-3">
              {t.icon && <PixelIcon kind={t.icon} size={10} color={tone.icon} />}
              {t.label}
            </span>
            <span className={clsx('font-hud text-[19px] leading-none tabular-nums', tone.text)}>{t.value}</span>
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
    <div className="flex flex-col gap-1">
      <span className="text-[14px] uppercase tracking-wider font-bold text-text-3">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center px-2 py-1 border border-border-soft bg-surface-2/60 text-[16px] text-text leading-none">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
