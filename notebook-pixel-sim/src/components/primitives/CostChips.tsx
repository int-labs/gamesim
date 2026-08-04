import clsx from 'clsx';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { fmt$ } from '@/utils/format';

/**
 * CostChips — what a decision COSTS, shown as labelled chips OUTSIDE the button.
 *
 * Costs used to be crammed into the button label ("Open · E-2 · $60"), which
 * had three problems:
 *   • the price was styled as part of a call-to-action, so it read as
 *     decoration rather than a figure to weigh
 *   • "E-2" is not a word — energy and money were smashed into one string with
 *     no icon, no label, and no unit
 *   • a disabled button greys the cost out too, hiding exactly the number that
 *     explains WHY it's disabled
 *
 * So: the button says the verb ("Open"), and the cost stands next to it as
 * separate chips — icon + LABEL + VALUE — that stay legible whatever the
 * button's state. Shared by channels, campaigns and upgrades so one decision
 * reads the same everywhere.
 *
 * Inks are the contrast-safe *-ink tokens: the mid-tone --c-warning is only
 * 2.01:1 on cream and can't be trusted for a number that decides a purchase.
 */

export interface CostItem {
  kind: 'cash' | 'energy';
  /** What it costs. 0 renders as "Free" for cash, and is skipped for energy. */
  value: number;
  /**
   * True when the player can't currently afford it. Turns the chip red and
   * shows it as the blocker — the reason the button is disabled.
   */
  short?: boolean;
}

const META = {
  cash: { icon: 'cash' as const, label: 'Cost' },
  energy: { icon: 'energy' as const, label: 'Energy' },
};

export function CostChips({
  items,
  className,
  size = 'md',
}: {
  items: CostItem[];
  className?: string;
  /** sm = inline in a dense row; md = default. */
  size?: 'sm' | 'md';
}) {
  const shown = items.filter((i) => i.kind === 'cash' || i.value > 0);
  if (shown.length === 0) return null;
  return (
    <div className={clsx('inline-flex items-center gap-1.5 shrink-0', className)}>
      {shown.map((i) => (
        <CostChip key={i.kind} item={i} size={size} />
      ))}
    </div>
  );
}

// The PRICE-TO-ACQUIRE chips get their own dark "price tag" colour so they
// never blend with the soft pastel EFFECT chips (green/amber/tan) that describe
// what a card DOES. Energy and cash share the dark walnut fill and are told
// apart by icon + label. Free is good news (green); short is the blocker (red).
// Solid fills only — never alpha-on-var (the hex tokens render it unreliably).
const SWATCH = {
  short:  { bg: '#F1CCC4', border: '#CB6356', ink: '#8A1717' },   // can't afford → red
  free:   { bg: '#D4ECDB', border: '#6FBB85', ink: '#0F4C29' },   // costs nothing → green
  cash:   { bg: '#221710', border: '#4A3620', ink: '#FAF7E8' },   // price tag (dark walnut)
  energy: { bg: '#221710', border: '#4A3620', ink: '#FAF7E8' },   // price tag (dark walnut)
};

function CostChip({ item, size }: { item: CostItem; size: 'sm' | 'md' }) {
  const meta = META[item.kind];
  const free = item.kind === 'cash' && item.value === 0;
  const value = free ? 'Free' : item.kind === 'cash' ? fmt$(item.value) : `${item.value}`;
  const sw = item.short ? SWATCH.short : free ? SWATCH.free : SWATCH[item.kind];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 border leading-none',
        size === 'sm' ? 'px-1.5 py-1' : 'px-2 py-1.5',
      )}
      style={{ backgroundColor: sw.bg, borderColor: sw.border }}
      title={item.short ? `Not enough ${meta.label.toLowerCase()}` : undefined}
    >
      <PixelIcon kind={meta.icon} size={size === 'sm' ? 9 : 11} color={sw.ink} />
      <span
        className={clsx(
          'uppercase tracking-[0.1em] font-bold',
          size === 'sm' ? 'text-[10px]' : 'text-[11px]',
        )}
        style={{ color: sw.ink }}
      >
        {meta.label}
      </span>
      <span
        className={clsx('font-extrabold tabular-nums', size === 'sm' ? 'text-[12px]' : 'text-[14px]')}
        style={{ color: sw.ink }}
      >
        {value}
      </span>
    </span>
  );
}
