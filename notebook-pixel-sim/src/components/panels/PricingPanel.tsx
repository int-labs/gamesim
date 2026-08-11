import { useGame } from '@/state/store';
import { setPrice, calcUnitCost } from '@/engine/mockEngine';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { SEGMENTS } from '@/data/segments';
import { fmt$, fmtPct } from '@/utils/format';
import { useState, useEffect } from 'react';

export function PricingPanel() {
  const price = useGame(
    (s) => (s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)?.price) ?? 8,
  );
  const apply = useGame((s) => s.apply);
  const seg = useGame((s) => s.market.targetSegment);
  const unitCost = useGame((s) => calcUnitCost(s));

  const [val, setVal] = useState(price);
  useEffect(() => setVal(price), [price]);

  const segDef = seg ? SEGMENTS.find((x) => x.id === seg) : null;
  const margin = ((val - unitCost) / Math.max(0.01, val));
  const distance = segDef ? Math.abs(val - segDef.preferredPriceRef) / segDef.preferredPriceRef : 0;

  return (
    <PixelPanel title="Pricing">
      <div className="hint font-body text-ink-700 mb-2">Set the price customers pay for one notebook. The badge below your price compares it to the reference price for the active audience.</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="h3">{fmt$(val)}</span>
        <PixelBadge tone={margin > 0.4 ? 'success' : margin < 0.15 ? 'warn' : 'neutral'}>
          Margin {fmtPct(margin)}
        </PixelBadge>
        {segDef && (
          <PixelBadge tone={distance < 0.2 ? 'success' : distance < 0.5 ? 'neutral' : 'warn'}>
            vs ref {fmt$(segDef.preferredPriceRef)}
          </PixelBadge>
        )}
      </div>
      <input
        type="range"
        min={1}
        max={30}
        step={1}
        value={val}
        onChange={(e) => setVal(parseInt(e.target.value, 10))}
        onMouseUp={() => apply((s) => setPrice(s, val))}
        onTouchEnd={() => apply((s) => setPrice(s, val))}
        className="w-full accent-ui-primary"
      />
      <div className="flex justify-between num-xs text-ink-700">
        <span>$1</span>
        {SEGMENTS.map((s) => (
          <span key={s.id} className="text-ink-700">{s.name[0]}{fmt$(s.preferredPriceRef).slice(1)}</span>
        ))}
        <span>$30</span>
      </div>
      <div className="pt-3 grid grid-cols-2 gap-2 hint font-body">
        <Stat label="Unit cost" value={fmt$(unitCost)} />
        <Stat label="Per-unit profit" value={fmt$(val - unitCost)} />
      </div>
    </PixelPanel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-cream-50 border-2 border-ink-900 px-2 py-1">
      <span className="eyebrow eyebrow-sm text-ink-700">{label}</span>
      <span className="eyebrow eyebrow-sm">{value}</span>
    </div>
  );
}
