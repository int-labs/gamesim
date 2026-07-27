import clsx from 'clsx';

interface Props {
  value: number;
  max: number;
  pips?: number;
  tint?: 'energy' | 'cash' | 'brand' | 'inv';
  showLabel?: boolean;
  label?: string;
}

const tints = {
  energy: 'bg-ui-warm',
  cash: 'bg-success',
  brand: 'bg-brand-400',
  inv: 'bg-ui-secondary',
};

export function PixelMeter({ value, max, pips = 10, tint = 'energy', showLabel = true, label }: Props) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  const filled = Math.round(pct * pips);
  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <div className="flex justify-between font-hud text-[9px] text-ink-800 uppercase">
          <span>{label}</span>
          <span>
            {Math.round(value)} / {max}
          </span>
        </div>
      )}
      <div className="flex gap-[2px] p-[2px] bg-ink-900 border-2 border-ink-900 w-full">
        {Array.from({ length: pips }).map((_, i) => (
          <div
            key={i}
            className={clsx('flex-1 h-3 transition-colors', i < filled ? tints[tint] : 'bg-ink-700/40')}
          />
        ))}
      </div>
    </div>
  );
}
