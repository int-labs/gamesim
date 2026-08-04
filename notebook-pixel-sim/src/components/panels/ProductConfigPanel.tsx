import { useGame } from '@/state/store';
import { PixelChip, PixelPanel, PixelBadge } from '@/components/primitives';
import { setProductField } from '@/engine/mockEngine';
import { A } from '@/assets';
import type { Archetype, Binding, Cover, PaperQuality, Size } from '@/types';
import { fmt$ } from '@/utils/format';
import { calcUnitCost, calcUnitTime } from '@/engine/mockEngine';
import { notebookCatalogue } from '@/data/notebookArchetypes';

/** Live catalogue, not a hardcoded list — see notebookArchetypes.ts. */
const archOptions = (): { id: Archetype; label: string; sample: string }[] =>
  notebookCatalogue().map((n) => ({ id: n.id, label: n.title, sample: n.art }));
const COVERS: Cover[] = ['hardcover', 'leather'];
const BINDINGS: Binding[] = ['ring', 'staple'];
const SIZES: Size[] = ['s', 'm', 'l'];
const PAPERS: PaperQuality[] = ['cheap', 'standard', 'premium'];

export function ProductConfigPanel() {
  // Edits the ACTIVE product line.
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === activeLineId)
      ?? s.portfolio.productLines[0],
  );
  const apply = useGame((s) => s.apply);
  const fitMap = useGame(
    (s) => s.market.fitBySegmentByLineId[activeLineId] ?? { students: 0, creators: 0, professionals: 0, gift: 0 },
  );
  const segment = useGame((s) => s.market.targetSegment);

  const fitVal = segment ? fitMap[segment] : null;
  const unitCost = useGame((s) => calcUnitCost(s));
  const unitTime = useGame((s) => calcUnitTime(s));

  const set = <K extends keyof typeof product>(k: K, v: (typeof product)[K]) =>
    apply((s) => setProductField(s, k as any, v as any));

  return (
    <div className="flex flex-col gap-3">
      <PixelPanel title="Notebook Type" tone="cream">
        <div className="grid grid-cols-3 gap-2">
          {archOptions().map((a) => (
            <button
              key={a.id}
              onClick={() => set('archetype', a.id)}
              className={`group flex flex-col items-center gap-1 p-2 border-2 transition-transform ${
                product.archetype === a.id
                  ? 'border-ink-900 bg-cream-100 shadow-pixel-2 -translate-y-0.5'
                  : 'border-ink-700/30 hover:border-ink-700 bg-cream-50'
              }`}
            >
              <img src={a.sample} alt={a.label} className="h-16 object-contain pointer-events-none" draggable={false} />
              <span className="eyebrow eyebrow-sm">{a.label}</span>
            </button>
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="Cover Material">
        <div className="flex gap-2">
          {COVERS.map((c) => (
            <PixelChip
              key={c}
              selected={product.cover === c}
              onClick={() => set('cover', c)}
              icon={<span className="inline-block w-4 h-4 border-2 border-ink-900" style={{ background: c === 'leather' ? '#7a4a2b' : '#cba87a' }} />}
              label={c}
            />
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="Binding">
        <div className="flex gap-2">
          {BINDINGS.map((b) => (
            <PixelChip key={b} selected={product.binding === b} onClick={() => set('binding', b)} label={b} />
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="Size (visual scale)">
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <PixelChip
              key={s}
              selected={product.size === s}
              onClick={() => set('size', s)}
              label={s === 's' ? 'Small' : s === 'm' ? 'Medium' : 'Large'}
              meta={s === 's' ? '33%' : s === 'm' ? '66%' : '100%'}
            />
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="Paper Quality">
        <div className="flex gap-2">
          {PAPERS.map((p) => (
            <PixelChip key={p} selected={product.paperQuality === p} onClick={() => set('paperQuality', p)} label={p} />
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="Effect Preview" tone="paper">
        <div className="grid grid-cols-2 gap-2 hint font-body">
          <Row label="Unit cost" value={fmt$(unitCost)} />
          <Row label="Unit time" value={`${unitTime.toFixed(2)}d`} />
          <Row label="Defect rate" value={`${Math.round(8)}%`} />
          {segment && fitVal !== null && (
            <Row label={`${capitalize(segment)} fit`} value={`${Math.round(fitVal * 100)}%`} />
          )}
        </div>
        <div className="pt-2">
          {fitVal !== null && fitVal > 0.7 && <PixelBadge tone="success">Strong segment fit</PixelBadge>}
          {fitVal !== null && fitVal < 0.4 && <PixelBadge tone="warn">Weak segment fit</PixelBadge>}
        </div>
      </PixelPanel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-cream-50 border-2 border-ink-900 px-2 py-1">
      <span className="eyebrow eyebrow-sm text-ink-700">{label}</span>
      <span className="eyebrow eyebrow-sm">{value}</span>
    </div>
  );
}
function capitalize(s: string) { return s[0].toUpperCase() + s.slice(1); }
