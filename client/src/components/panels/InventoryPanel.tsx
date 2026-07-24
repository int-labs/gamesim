import { useGame } from '@/state/store';
import { setLineTargetPerDay } from '@/engine/mockEngine';
import {
  genreById, prodPerDay, customersPer30dFor, genreDemand, GAME_PHASE_TO_DEMAND,
  DEMAND_SCALE, hireLevel, salesSellBonus, marketingDemandMult,
  type GenreId, type ProductionSpec, type ChannelId,
} from '@/data/finlit';
import { vocFit } from '@/engine/finlit/fit';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { fmt$, fmtInt } from '@/utils/format';
import { PixelStepLine } from '@/components/charts/PixelStepLine';
import { BUSINESS_PAGE } from '@/content/copy';
import { Tooltip } from '@/components/primitives/Tooltip';
import clsx from 'clsx';

const DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

interface LineStats {
  genre: GenreId;
  capacity: number;
  demandDay: number;
  finished: number;
  target: number;
  /** Read-only here — price is set on the Product page (it pairs with unit cost). */
  price: number;
}

function statsFor(
  line: { genre?: GenreId; finlitSpec?: Partial<ProductionSpec>; channels?: ChannelId[]; price: number; targetPerDay?: number; inventory: { finished: number } },
  phase: 1 | 2 | 3,
  sellBonus: number,
  marketingMult: number,
): LineStats {
  const genre = (line.genre ?? 'indie') as GenreId;
  const spec: ProductionSpec = { ...DEFAULT_SPEC, type: genre, ...(line.finlitSpec ?? {}) };
  const channels = (line.channels ?? ['offline']) as ChannelId[];
  const capacity = prodPerDay(spec, 0);
  const d = genreDemand(genre, GAME_PHASE_TO_DEMAND[phase]);
  const fit = vocFit(spec, line.price, channels, genre);
  let demand30 = 0;
  for (const ch of channels) demand30 += customersPer30dFor(genre, ch, d, sellBonus);
  const demandDay = (demand30 * fit * marketingMult * DEMAND_SCALE) / 30;
  return {
    genre,
    capacity,
    demandDay,
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
  const phase = useGame((s) => s.meta.phase);
  const hire = useGame((s) => s.finlit.hire);
  const marketingBudget = useGame((s) => s.finlit.marketingBudget);
  const salesBudget = useGame((s) => s.finlit.salesBudget);
  const finished = useGame((s) => s.inventory.totalFinished);
  const stockoutDays = useGame((s) => s.inventory.stockoutDays);
  const overstockDays = useGame((s) => s.inventory.overstockDays);
  const series = useGame((s) => s.series);
  const apply = useGame((s) => s.apply);

  const sellBonus =
    (hire ? hireLevel(hire.candidate, hire.level).sellBonus : 0) +
    salesSellBonus(salesBudget);
  const marketingMult = marketingDemandMult(marketingBudget);

  const stats = lines.map((l) => statsFor(l, phase, sellBonus, marketingMult));
  const totalTarget = stats.reduce((a, s) => a + s.target, 0);
  const totalCapacity = stats.reduce((a, s) => a + s.capacity, 0);
  const totalDemand = stats.reduce((a, s) => a + s.demandDay, 0);

  if (lines.length === 0) {
    return (
      <div className="border-2 border-border-soft bg-surface p-6 text-center text-[17px] text-text-2">
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
          <Box label="Produce / day" value={`~${fmtInt(totalTarget)}`} tone="neutral" hint="Total units/day you've planned across all notebooks." />
          <Box label="Capacity / day" value={`~${fmtInt(Math.round(totalCapacity))}`} tone="info" hint="Most you can make per day at your current specs + hires." />
          <Box label="Demand / day" value={`~${fmtInt(Math.round(totalDemand))}`} tone="info" hint="Estimated units/day customers will buy this phase." />
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
        <div className="text-[12px] font-medium text-text-3 -mt-1 mb-2 leading-tight">
          Set how many of each notebook to make per day. Aim near demand - over-make and stock piles up, under-make and you sell out.
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <ProductionRow
              key={line.id}
              name={line.name}
              stats={stats[i]}
              onChange={(v) => apply((s) => setLineTargetPerDay(s, v, line.id))}
            />
          ))}
        </div>
      </PixelPanel>

      {/* ── Trends ── */}
      <PixelPanel title="Trends" tone="paper">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="eyebrow eyebrow-sm mb-1">Finished goods</div>
            <PixelStepLine data={series.finished.slice(-30)} stroke="#5fb27a" fill="rgba(95,178,122,0.18)" />
          </div>
          <div>
            <div className="eyebrow eyebrow-sm mb-1">Demand</div>
            <PixelStepLine data={series.demand.slice(-30)} stroke="#5b86c2" fill="rgba(91,134,194,0.18)" />
          </div>
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
  onChange,
}: {
  name: string;
  stats: LineStats;
  onChange: (v: number) => void;
}) {
  const capMax = Math.max(1, Math.ceil(stats.capacity));
  const value = Math.min(stats.target, capMax);
  const demandRounded = Math.max(0, Math.round(stats.demandDay));
  // Tone the target against demand — the produce-to-demand coaching signal.
  const gap = value - stats.demandDay;
  const tone: 'good' | 'warn' | 'over' =
    stats.demandDay <= 0 ? 'good'
    : gap < -stats.demandDay * 0.2 ? 'warn'   // >20% under demand → will sell out
    : gap > stats.demandDay * 0.5 ? 'over'    // >50% over demand → will pile up
    : 'good';
  const hint =
    tone === 'warn' ? 'Below demand - you may sell out'
    : tone === 'over' ? 'Above demand - stock may pile up'
    : 'Matched to demand';
  const hintColor = tone === 'warn' ? 'text-warning' : tone === 'over' ? 'text-info' : 'text-success';

  return (
    <div className="border-2 border-border-soft bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* TITLE = line name; genre is a quiet tag before it */}
          <span className="text-[9.5px] uppercase tracking-wider font-semibold text-brand-500 shrink-0">{genreById(stats.genre).name}</span>
          <span className="text-[16px] font-bold text-text truncate">{name}</span>
        </div>
        <span className="flex items-center gap-2.5 shrink-0 text-[11.5px] font-medium text-text-3">
          {/* Price is read-only here - it's set on the Product page next to unit
              cost/margin. Echoed so the commercial picture reads in one place. */}
          <span>price <span className="font-bold text-text tabular-nums text-[13px]">{fmt$(stats.price)}</span></span>
          <span>stock <span className="font-bold text-text tabular-nums text-[13px]">{fmtInt(stats.finished)}</span></span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-wider text-text-3 w-20 shrink-0">Produce / day</span>
        <input
          type="range"
          min={0}
          max={capMax}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="flex-1 accent-ui-primary cursor-pointer"
        />
        {/* VALUE — the loudest thing in the row */}
        <span className="text-[19px] font-extrabold tabular-nums text-text w-14 text-right">{value}<span className="text-text-3 font-bold text-[12px]">/d</span></span>
      </div>
      <div className="flex items-center justify-between mt-1 text-[11.5px]">
        <span className="text-text-3">demand <span className="font-bold text-info tabular-nums">~{demandRounded}/d</span> · capacity <span className="font-bold text-text-2 tabular-nums">~{stats.capacity.toFixed(1)}/d</span></span>
        <span className={clsx('font-bold', hintColor)}>{hint}</span>
      </div>
    </div>
  );
}

function Box({ label, value, tone, hint }: { label: string; value: string; tone: 'info' | 'success' | 'neutral'; hint?: string }) {
  const bg =
    tone === 'info' ? 'bg-info-soft/60' : tone === 'success' ? 'bg-success-soft/60' : 'bg-surface-2';
  const inner = (
    <div className={`readout ${bg} border border-border-soft p-2`}>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div className="num-lg text-text mt-0.5 tabular-nums">{value}</div>
    </div>
  );
  return hint ? <Tooltip content={hint}>{inner}</Tooltip> : inner;
}
