import clsx from 'clsx';

export type MetricIconKind =
  | 'cash'
  | 'profit'
  | 'revenue'
  | 'stock'
  | 'demand'
  | 'capacity'
  | 'fit'
  | 'material'
  | 'labor'
  | 'marketing'
  | 'packaging'
  | 'fulfillment'
  | 'tools'
  | 'brand'
  | 'discount';

interface Props {
  kind: MetricIconKind;
  size?: number;
  tone?: 'cream' | 'mint' | 'amber' | 'rose' | 'sky' | 'violet' | 'sand';
  className?: string;
}

const toneBg: Record<NonNullable<Props['tone']>, string> = {
  cream: 'bg-cream-100',
  mint: 'bg-success-soft',
  amber: 'bg-warn-soft',
  rose: 'bg-error-soft',
  sky: 'bg-info-soft',
  violet: 'bg-brand-300',
  sand: 'bg-cream-200',
};

/** Code-built pixel-style metric glyph. No external assets. */
export function MetricIcon({ kind, size = 24, tone = 'cream', className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center border-2 border-ink-900 shadow-pixel-1 shrink-0',
        toneBg[tone],
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size - 6}
        height={size - 6}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated' }}
      >
        {renderGlyph(kind)}
      </svg>
    </span>
  );
}

function renderGlyph(kind: MetricIconKind) {
  switch (kind) {
    case 'cash':
      // Coin with $
      return (
        <g>
          <rect x="2" y="2" width="12" height="12" fill="#e6b54a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="6" y="3" width="4" height="1" fill="#fff7d0" />
          <rect x="7" y="5" width="2" height="6" fill="#7a4a2b" />
          <rect x="6" y="6" width="4" height="1" fill="#7a4a2b" />
          <rect x="6" y="9" width="4" height="1" fill="#7a4a2b" />
        </g>
      );
    case 'profit':
      return (
        <g>
          <rect x="1" y="13" width="2" height="2" fill="#5fb27a" />
          <rect x="4" y="10" width="2" height="5" fill="#5fb27a" />
          <rect x="7" y="7" width="2" height="8" fill="#5fb27a" />
          <rect x="10" y="4" width="2" height="11" fill="#5fb27a" />
          <rect x="13" y="2" width="2" height="13" fill="#5fb27a" />
        </g>
      );
    case 'revenue':
      // Cash bundle
      return (
        <g>
          <rect x="2" y="4" width="12" height="9" fill="#65b483" stroke="#3f8a59" strokeWidth="1" />
          <rect x="2" y="6" width="12" height="1" fill="#3f8a59" />
          <rect x="2" y="11" width="12" height="1" fill="#3f8a59" />
          <rect x="7" y="7" width="2" height="3" fill="#fff7d0" />
        </g>
      );
    case 'stock':
      // Stacked boxes
      return (
        <g>
          <rect x="3" y="3" width="6" height="5" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="9" y="6" width="5" height="5" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="3" y="9" width="6" height="5" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="5" y="5" width="2" height="1" fill="#7a4a2b" />
          <rect x="11" y="8" width="2" height="1" fill="#7a4a2b" />
          <rect x="5" y="11" width="2" height="1" fill="#7a4a2b" />
        </g>
      );
    case 'demand':
      // shopping cart-ish
      return (
        <g>
          <rect x="2" y="4" width="2" height="2" fill="#8E6CAC" />
          <rect x="4" y="6" width="9" height="5" fill="#8E6CAC" stroke="#62467C" strokeWidth="1" />
          <rect x="5" y="11" width="2" height="2" fill="#62467C" />
          <rect x="10" y="11" width="2" height="2" fill="#62467C" />
          <rect x="6" y="7" width="1" height="3" fill="#bfd4ee" />
          <rect x="9" y="7" width="1" height="3" fill="#bfd4ee" />
        </g>
      );
    case 'capacity':
      // Gear
      return (
        <g>
          <rect x="6" y="2" width="4" height="2" fill="#7a4a2b" />
          <rect x="6" y="12" width="4" height="2" fill="#7a4a2b" />
          <rect x="2" y="6" width="2" height="4" fill="#7a4a2b" />
          <rect x="12" y="6" width="2" height="4" fill="#7a4a2b" />
          <rect x="4" y="4" width="8" height="8" fill="#bfae90" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="6" y="6" width="4" height="4" fill="#7a4a2b" />
        </g>
      );
    case 'fit':
      // Target / bullseye
      return (
        <g>
          <rect x="2" y="2" width="12" height="12" fill="#e8b46a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="4" y="4" width="8" height="8" fill="#fdf8ec" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="6" y="6" width="4" height="4" fill="#c95448" />
        </g>
      );
    case 'material':
      // Notebook stack
      return (
        <g>
          <rect x="3" y="3" width="9" height="11" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="3" y="3" width="2" height="11" fill="#7a4a2b" />
          <rect x="6" y="5" width="5" height="1" fill="#7a4a2b" />
          <rect x="6" y="8" width="5" height="1" fill="#7a4a2b" />
          <rect x="6" y="11" width="5" height="1" fill="#7a4a2b" />
        </g>
      );
    case 'labor':
      // Two figures
      return (
        <g>
          <rect x="2" y="4" width="3" height="3" fill="#e6b54a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="1" y="8" width="5" height="6" fill="#8E6CAC" stroke="#62467C" strokeWidth="1" />
          <rect x="9" y="4" width="3" height="3" fill="#e07a6a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="8" y="8" width="5" height="6" fill="#9b6cd9" stroke="#62467C" strokeWidth="1" />
        </g>
      );
    case 'marketing':
      // Megaphone
      return (
        <g>
          <rect x="2" y="6" width="3" height="4" fill="#bfae90" />
          <rect x="5" y="4" width="6" height="8" fill="#c95448" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="11" y="2" width="3" height="12" fill="#e07a6a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="2" y="11" width="2" height="3" fill="#bfae90" />
        </g>
      );
    case 'packaging':
      // Gift box
      return (
        <g>
          <rect x="2" y="6" width="12" height="8" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="2" y="4" width="12" height="2" fill="#9a7a55" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="7" y="4" width="2" height="10" fill="#c95448" />
          <rect x="5" y="3" width="2" height="2" fill="#c95448" />
          <rect x="9" y="3" width="2" height="2" fill="#c95448" />
        </g>
      );
    case 'fulfillment':
      // Truck
      return (
        <g>
          <rect x="1" y="6" width="8" height="6" fill="#cba87a" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="9" y="8" width="5" height="4" fill="#8E6CAC" stroke="#62467C" strokeWidth="1" />
          <rect x="2" y="12" width="3" height="2" fill="#2a2017" />
          <rect x="10" y="12" width="3" height="2" fill="#2a2017" />
        </g>
      );
    case 'tools':
      // Wrench
      return (
        <g>
          <rect x="2" y="2" width="4" height="4" fill="#bfae90" stroke="#7a4a2b" strokeWidth="1" />
          <rect x="3" y="3" width="2" height="2" fill="#fdf8ec" />
          <rect x="6" y="6" width="2" height="2" fill="#7a4a2b" />
          <rect x="8" y="8" width="6" height="2" fill="#5a4a37" />
          <rect x="10" y="10" width="2" height="2" fill="#5a4a37" />
          <rect x="12" y="12" width="2" height="2" fill="#5a4a37" />
        </g>
      );
    case 'brand':
      // Sparkle / star
      return (
        <g>
          <rect x="7" y="2" width="2" height="4" fill="#9b56c8" />
          <rect x="7" y="10" width="2" height="4" fill="#9b56c8" />
          <rect x="2" y="7" width="4" height="2" fill="#9b56c8" />
          <rect x="10" y="7" width="4" height="2" fill="#9b56c8" />
          <rect x="6" y="6" width="4" height="4" fill="#c87bd9" />
        </g>
      );
    case 'discount':
      // Discount tag
      return (
        <g>
          <rect x="3" y="3" width="9" height="9" fill="#e6b54a" stroke="#7a4a2b" strokeWidth="1" transform="rotate(45 8 8)" />
          <rect x="6" y="6" width="2" height="2" fill="#fdf8ec" />
        </g>
      );
    default:
      return null;
  }
}
