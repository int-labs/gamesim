import { useGame } from '@/state/store';
import { setLineTargetPerDay, setLineDemandEst } from '@/engine/mockEngine';
import {
  genreById, prodPerDay,
  type GenreId, type ProductionSpec,
} from '@/data/finlit';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { fmt$, fmtInt, perPhase } from '@/utils/format';
import { BUSINESS_PAGE } from '@/content/copy';
import { Tooltip } from '@/components/primitives/Tooltip';

const DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

interface LineStats {
  genre: GenreId;
  capacity: number;
  finished: number;
  target: number;
  /** Read-only here — price is set on the Product page (it pairs with unit cost). */
  price: number;
}

function statsFor(
  line: { genre?: GenreId; finlitSpec?: Partial<ProductionSpec>; price: number; targetPerDay?: number; inventory: { finished: number } },
): LineStats {
  const genre = (line.genre ?? 'indie') as GenreId;
  const spec: ProductionSpec = { ...DEFAULT_SPEC, type: genre, ...(line.finlitSpec ?? {}) };
  const capacity = prodPerDay(spec, 0);
  return {
    genre,
    capacity,
    finished: line.inventory.finished,
    target: line.targetPerDay ?? Math.ceil(capacity),
    price: line.price,
  };
}

/**
 * InventoryPanel — the V3 PRODUCTION PLANNER. In the FinLit model there's no
 * raw-material buffer (notebooks are produced straight from the spec), so the
 * inventory decision is "how many units/day to make per line" — the LP2 lever.
 * This panel surfaces that control per notebook (previously only on the
 * Product page), plus a live stock/output overview and the trend charts.
 */
export function InventoryPanel() {
  const lines = useGame((s) => s.portfolio.productLines);
  const finished = useGame((s) => s.inventory.totalFinished);
  const stockoutDays = useGame((s) => s.inventory.stockoutDays);
  const overstockDays = useGame((s) => s.inventory.overstockDays);
  const apply = useGame((s) => s.apply);


  const stats = lines.map((l) => statsFor(l));
  const totalTarget = stats.reduce((a, s) => a + s.target, 0);
  const totalCapacity = stats.reduce((a, s) => a + s.capacity, 0);
  const totalEstimatedDemand = lines.reduce((sum, l) => sum + (l.demandEstPerPhase ?? 0), 0);

  if (lines.length === 0) {
    return (
      <div className="border border-border-soft bg-surface p-6 text-center body-sm text-text-2">
        No notebooks yet - add one in Notebook Items to plan its production.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Overview — live stock + output (V3-real numbers) ── */}
      <PixelPanel title="Stock & Output">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Box label="Finished goods" value={fmtInt(finished)} tone="success" hint={BUSINESS_PAGE.inventory.finishedHint} />
          <Box label="Produce / phase" value={`~${fmtInt(perPhase(totalTarget))}`} tone="neutral" hint="Total units per phase you've planned across all notebooks." />
          <Box label="Capacity / phase" value={`~${fmtInt(perPhase(totalCapacity))}`} tone="info" hint="Most you can make per phase at your current specs + hires." />
          <Box label="Demand est. / phase" value={totalEstimatedDemand > 0 ? `~${fmtInt(totalEstimatedDemand)}` : '—'} tone="info" hint="Your estimate of units you expect to sell this phase, set per notebook below." />
        </div>
        <div className="flex items-center gap-2 mt-2">
          {stockoutDays > 0 && (
            <Tooltip content={BUSINESS_PAGE.inventory.stockoutHint}>
              <span><PixelBadge tone="error">{stockoutDays}d stockout</PixelBadge></span>
            </Tooltip>
          )}
          {overstockDays > 0 && (
            <Tooltip content={BUSINESS_PAGE.inventory.overstockHint}>
              <span><PixelBadge tone="warn">{overstockDays}d overstock</PixelBadge></span>
            </Tooltip>
          )}
        </div>
      </PixelPanel>

      {/* ── Production Plan — the decisions: units/day per notebook ── */}
      <PixelPanel title="Production Plan">
        <div className="hint text-text-3 -mt-1 mb-2 leading-tight">
          Set how many of each notebook to make per phase. Aim near demand - over-make and stock piles up, under-make and you sell out.
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <ProductionRow
              key={line.id}
              name={line.name}
              stats={stats[i]}
              demandEst={line.demandEstPerPhase ?? 0}
              onDemandEstChange={(v) => apply((s) => setLineDemandEst(s, v, line.id))}
              onChange={(v) => apply((s) => setLineTargetPerDay(s, v, line.id))}
            />
          ))}
        </div>
      </PixelPanel>
    </div>
  );
}

/* A single notebook's production control: name + genre, a units/day slider
   bounded by capacity, and a live read on target vs demand. */
function ProductionRow({
  name,
  stats,
  demandEst,
  onDemandEstChange,
  onChange,
}: {
  name: string;
  stats: LineStats;
  demandEst: number;
  onDemandEstChange: (v: number) => void;
  onChange: (v: number) => void;
}) {
  const capMax = Math.max(1, Math.ceil(stats.capacity));
  const value = Math.min(stats.target, capMax);
  // Tone production target against the player's own estimate — coaching without revealing real demand.
  const demandEstDay = demandEst / 30;
  const gap = value - demandEstDay;
  const tone: 'good' | 'warn' | 'over' =
    demandEst <= 0 ? 'good'
    : gap < -demandEstDay * 0.2 ? 'warn'
    : gap > demandEstDay * 0.5 ? 'over'
    : 'good';
  const hint =
    tone === 'warn' ? 'Below your estimate - you may sell out'
    : tone === 'over' ? 'Above your estimate - stock may pile up'
    : demandEst > 0 ? 'Matched to your estimate'
    : 'Enter your demand estimate below';
  const hintColor = tone === 'warn' ? 'text-warning' : tone === 'over' ? 'text-info' : 'text-success';

  return (
    <div className="border border-border-soft bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* TITLE = line name; genre is a quiet tag before it */}
          <span className="eyebrow eyebrow-sm text-info shrink-0">{genreById(stats.genre).name}</span>
          <span className="item-name text-text truncate">{name}</span>
        </div>
        <span className="flex items-center gap-3 shrink-0">
          {/* Price is read-only here - it's set on the Product page next to unit
              cost/margin. Echoed so the commercial picture reads in one place. */}
          <span className="flex items-baseline gap-1.5">
            <span className="stat-label">Price</span>
            <span className="num-xs text-text">{fmt$(stats.price)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="stat-label">Stock</span>
            <span className="num-xs text-text">{fmtInt(stats.finished)}</span>
          </span>
        </span>
      </div>
      {/* Caption and value on one line, slider on its own beneath. The caption
          used to sit INSIDE the slider row at a fixed `w-24` (96px), and
          `.stat-label` is `white-space: nowrap`, so "PRODUCE / PHASE" simply
          ran past its box and the slider was drawn over the last letters. The
          two fixed widths were the whole bug; without them nothing can clip,
          the slider gets the full width to drag along, and the value sits
          where every other figure in this panel sits. */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="stat-label">Produce / phase</span>
          {/* The slider's unit is still units/DAY internally — that is what the
              engine schedules — but every figure the player reads is per phase. */}
          <span className="num-sm text-text tabular-nums">{fmtInt(perPhase(value))}</span>
        </div>
        <input
          type="range"
          min={0}
          max={capMax}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full mt-1.5 accent-ui-primary cursor-pointer"
        />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="flex items-center gap-3 min-w-0 flex-wrap">
          <label className="flex items-baseline gap-1.5">
            <span className="stat-label shrink-0">Demand est. / phase</span>
            <input
              type="number"
              min={0}
              step={10}
              value={demandEst || ''}
              placeholder="?"
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onDemandEstChange(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              className="w-20 bg-cream-50 border border-border text-info num-xs text-center outline-none focus:border-primary px-1 py-0.5"
            />
          </label>
          <span className="flex items-baseline gap-1.5">
            <span className="stat-label">Capacity</span>
            <span className="num-xs text-text-2">~{fmtInt(perPhase(stats.capacity))}</span>
          </span>
        </span>
        {demandEst > 0 && (
          <span className={`hint shrink-0 ${hintColor}`}>{hint}</span>
        )}
      </div>
    </div>
  );
}

function Box({ label, value, tone, hint }: { label: string; value: string; tone: 'info' | 'success' | 'neutral'; hint?: string }) {
  const bg =
    tone === 'info' ? 'bg-surface-muted/60' : tone === 'success' ? 'bg-success-soft/60' : 'bg-surface-2';
  const inner = (
    // `.stat-label`, not `.eyebrow`: an eyebrow OPENS a section, a stat-label
    // NAMES a value, and this is the second. And `.num-md` (21px) rather than
    // `.num-lg` (28px) - these tiles were running eleven pixels and a whole
    // weight above every other readout in the app, so a summary band read as
    // the loudest thing on the page. One step up from the 17px chips is enough
    // to say "summary" without leaving the scale.
    <div className={`readout ${bg} border border-border-soft p-2`}>
      <div className="stat-label">{label}</div>
      <div className="num-md text-text mt-1 tabular-nums">{value}</div>
    </div>
  );
  return hint ? <Tooltip content={hint}>{inner}</Tooltip> : inner;
}
