import { useGame } from '@/state/store';
import {
  setLineGenre, setFinlitAxis, setPrice,
} from '@/engine/mockEngine';
import {
  GENRES, CONFIG_TABLES, CHANNEL_META, prodPerDay, unitCost,
  customersPer30dFor, genreDemand, GAME_PHASE_TO_DEMAND, DEMAND_SCALE,
  hireLevel, salesSellBonus, marketingDemandMult,
  type GenreId, type ConfigAxis, type ChannelId, type ProductionSpec,
} from '@/data/finlit';
import { vocFit } from '@/engine/finlit/fit';
import { PixelSelect } from '@/components/primitives/PixelSelect';
import { fmt$ } from '@/utils/format';
import clsx from 'clsx';

/**
 * FinlitDesignControls — the V3 product editor: what the notebook IS. Sets a
 * line's market (genre), its production-spec axes, and its price, and shows the
 * live cost/demand feedback the FinLit engine uses.
 *
 * Deliberately NOT here — these are company decisions and live on the Business
 * page, so the player isn't running the business from inside a product editor:
 *   • WHERE you sell (sales channels)  → Business ▸ Operations (company-wide)
 *   • HOW MANY you make (produce/day)  → Business ▸ Inventory (production plan)
 * Price stays because margin = price − unit cost and the spec above sets unit
 * cost; price also feeds product-market fit (vocFit).
 */

const AXES: { axis: ConfigAxis; label: string }[] = [
  { axis: 'paper', label: 'Paper' },
  { axis: 'size', label: 'Size' },
  { axis: 'pageDesign', label: 'Page Design' },
  { axis: 'addon', label: 'Add-on' },
  { axis: 'cover', label: 'Cover' },
];

const DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

export function FinlitDesignControls() {
  const line = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const apply = useGame((s) => s.apply);
  const phase = useGame((s) => s.meta.phase);
  const hire = useGame((s) => s.finlit.hire);
  const marketingBudget = useGame((s) => s.finlit.marketingBudget);
  const salesBudget = useGame((s) => s.finlit.salesBudget);

  if (!line) {
    return <div className="text-[17px] text-text-2 p-2">Add a notebook first, then design it here.</div>;
  }

  const genre: GenreId = line.genre ?? 'indie';
  // Full spec = the line's overrides on top of defaults (type follows genre).
  const spec: ProductionSpec = {
    type: line.finlitSpec?.type ?? genre,
    paper: line.finlitSpec?.paper ?? DEFAULT_SPEC.paper,
    size: line.finlitSpec?.size ?? DEFAULT_SPEC.size,
    pageDesign: line.finlitSpec?.pageDesign ?? DEFAULT_SPEC.pageDesign,
    addon: line.finlitSpec?.addon ?? DEFAULT_SPEC.addon,
    cover: line.finlitSpec?.cover ?? DEFAULT_SPEC.cover,
  };
  // Channels are set company-wide on the Business page; here they're read-only
  // inputs to the demand estimate (and echoed in the signpost below).
  const channels = new Set<ChannelId>((line.channels ?? ['offline']) as ChannelId[]);
  const channelLabel = [...channels].map((c) => CHANNEL_META[c].name).join(' + ');
  const capacity = prodPerDay(spec, 0);
  const uCost = unitCost(spec);
  const margin = line.price - uCost;

  // Estimated demand/day for this line this phase (so the player can produce to
  // it — the LP2 lever). Folds in the current hire + marketing sell bonuses.
  const sellBonus =
    (hire ? hireLevel(hire.candidate, hire.level).sellBonus : 0) +
    salesSellBonus(salesBudget);
  const demand = genreDemand(genre, GAME_PHASE_TO_DEMAND[phase]);
  const fit = vocFit(spec, line.price, [...channels], genre);
  let demand30d = 0;
  for (const ch of channels) demand30d += customersPer30dFor(genre, ch, demand, sellBonus);
  const demandPerDay = (demand30d * fit * marketingDemandMult(marketingBudget) * DEMAND_SCALE) / 30;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Market (genre) ── */}
      <Section title="Market" hint="Which notebook genre this line sells into.">
        <div className="grid grid-cols-2 gap-2">
          {GENRES.map((g) => {
            const active = genre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => apply((s) => setLineGenre(s, g.id))}
                className={clsx(
                  'ctl-btn text-left px-2.5 py-2 border-2 transition-all active:scale-[0.98]',
                  active ? 'border-primary bg-primary-soft' : 'border-border-soft bg-surface hover:border-border',
                )}
              >
                <div className="text-[17px] font-bold text-text">{g.name}</div>
                <div className="text-[14px] text-text-3 leading-tight mt-0.5 line-clamp-2">{g.blurb}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Production spec (5 axes; type mirrors genre) ── */}
      <Section title="Production Spec" hint="Each choice changes production speed and unit cost.">
        <div className="flex flex-col gap-2">
          {AXES.map(({ axis, label }) => (
            <div key={axis} className="flex items-center justify-between gap-2">
              <span className="text-[16px] text-text-2 w-24 shrink-0">{label}</span>
              <PixelSelect
                ariaLabel={label}
                value={spec[axis]}
                options={CONFIG_TABLES[axis].map((o) => ({ id: o.id, label: o.name, hint: `+${fmt$(o.cost)}` }))}
                onChange={(id) => apply((s) => setFinlitAxis(s, axis, id))}
                className="flex-1 min-w-0"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Price — stays with the product: margin = price − unit cost, and the
           spec above is what sets unit cost. Price also feeds product-market fit
           (vocFit), so it belongs next to the notebook you're designing.
           WHERE you sell (channels) and HOW MANY you make (produce/day) are
           business decisions and live on the Business page. ── */}
      <Section title="Price" hint="What you charge. Margin is price minus unit cost.">
        <Slider
          label="Price" value={line.price} min={1} max={30} step={1}
          fmt={(v) => fmt$(v)} onChange={(v) => apply((s) => setPrice(s, v))}
        />
      </Section>

      {/* ── Live feedback (the numbers the engine uses) ── */}
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Capacity" value={`${capacity.toFixed(1)}/d`} tone="info" />
        <Stat label="Demand" value={`${Math.round(demandPerDay)}/d`} tone="info" />
        <Stat label="Unit cost" value={fmt$(uCost)} tone="warn" />
        <Stat label="Margin" value={fmt$(margin)} tone={margin > 0 ? 'good' : 'bad'} />
      </div>

      {/* Signpost — these used to live here; tell the player where they went. */}
      <div className="text-[13px] font-medium text-text-3 leading-snug border-t border-border-soft pt-2.5">
        Selling through <span className="font-bold text-text-2">{channelLabel}</span>.
        Set sales channels in <span className="font-bold text-text-2">Business ▸ Operations</span>,
        and how many to make in <span className="font-bold text-text-2">Business ▸ Inventory</span>.
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[11px] uppercase tracking-[0.09em] font-bold text-text-2 mb-1">{title}</div>
      {hint && <div className="text-[12px] font-medium text-text-3 mb-1.5 leading-tight">{hint}</div>}
      {children}
    </section>
  );
}

function Slider({
  label, value, min, max, step, fmt, onChange,
}: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[16px] text-text-2">{label}</span>
        <span className="text-[17px] font-bold tabular-nums text-text">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-ui-primary cursor-pointer"
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'info' | 'warn' | 'good' | 'bad' }) {
  const cls =
    tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-text';
  return (
    <div className="readout border-2 border-border-soft bg-surface px-2 py-1.5 text-center">
      <div className="text-[14px] uppercase tracking-wider text-text-3">{label}</div>
      <div className={clsx('text-[18px] font-bold tabular-nums', cls)}>{value}</div>
    </div>
  );
}
