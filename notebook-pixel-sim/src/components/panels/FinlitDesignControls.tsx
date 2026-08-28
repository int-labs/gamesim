import { useGame } from '@/state/store';
import {
  setLineGenre, setFinlitAxis, setPrice,
} from '@/engine/mockEngine';
import {
  GENRES, CONFIG_TABLES, CHANNEL_META, prodPerDay, unitCost,
  type GenreId, type ConfigAxis, type ChannelId, type ProductionSpec,
} from '@/data/finlit';
import { PixelSelect } from '@/components/primitives/PixelSelect';
import { fmt$, fmtInt, perPhase } from '@/utils/format';
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

// `addon` is deliberately absent: add-ons are picked visually from the Add-ons
// drawer on the canvas, so a duplicate dropdown here was a second way to set the
// same value. The axis still exists in the spec and the engine still costs it.
const AXES: { axis: ConfigAxis; label: string }[] = [
  { axis: 'paper', label: 'Paper' },
  { axis: 'size', label: 'Size' },
  { axis: 'pageDesign', label: 'Page Design' },
  { axis: 'cover', label: 'Cover Material' },
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
  if (!line) {
    return <div className="body-sm text-text-2 p-2">Add a notebook first, then design it here.</div>;
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
  // Channels from globalInputSelections (backend-driven, company-wide).
  const activeChannels = useGame((s) =>
    s.globalInputSelections
      .filter((sel) => sel.key === 'channel' && sel.selectedStepKey != null)
      .map((sel) => sel.selectedStepKey as ChannelId),
  );
  const channelLabel = activeChannels.map((c) => CHANNEL_META[c].name).join(' + ');
  const stickersSpend = Math.min((line.addOnsByArchetype?.[line.archetype] ?? []).length * 0.15, 100);
  const capacity = prodPerDay(spec, 0);
  const uCost = unitCost(spec);
  const margin = line.price - uCost;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Market (genre) — HIDDEN for now. The picker still exists and
           `setLineGenre` is untouched, so nothing about the engine changed;
           this section is just not surfaced in the design drawer. ── */}

      {/* ── Production spec (5 axes; type mirrors genre) ── */}
      <Section title="Production Spec" hint="Each choice changes production speed and unit cost.">
        <div className="flex flex-col gap-2">
          {AXES.map(({ axis, label }) => (
            <div key={axis} className="flex items-center justify-between gap-2">
              <span className="field-label w-28 shrink-0">{label}</span>
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
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Capacity" value={`${fmtInt(perPhase(capacity))} / phase`} tone="info" />
        <Stat label="Unit cost" value={fmt$(uCost)} tone="warn" />
        <Stat label="Margin" value={fmt$(margin)} tone={margin > 0 ? 'good' : 'bad'} />
      </div>

      {/* Signpost — these used to live here; tell the player where they went. */}
      <div className="hint border-t border-border-soft pt-3">
        Selling through <span className="strong text-text-2">{channelLabel}</span>.
        Set sales channels in <span className="strong text-text-2">Business ▸ Operations</span>,
        and how many to make in <span className="strong text-text-2">Business ▸ Inventory</span>.
      </div>
    </div>
  );
}

/**
 * A titled group. Sections used to be a bare caption over content, so two of
 * them in a column read as one undifferentiated list. The framed header gives
 * each a clear start and end — RULE 5: border-2 is the container weight.
 */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-soft bg-cream-50">
      <header className="px-3.5 py-2.5 border-b border-border-soft bg-cream-200">
        <div className="section-title text-ink-900">{title}</div>
        {hint && <div className="hint mt-0.5">{hint}</div>}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function Slider({
  label, value, min, max, step, fmt, onChange,
}: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="field-label">{label}</span>
        <span className="num-sm text-text">{fmt(value)}</span>
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
    <div className="readout border border-border-soft bg-surface px-2.5 py-2 text-center">
      <div className="stat-label">{label}</div>
      <div className={clsx('num-sm mt-1', cls)}>{value}</div>
    </div>
  );
}
