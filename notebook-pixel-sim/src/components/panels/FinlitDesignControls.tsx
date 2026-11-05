import { useGame } from '@/state/store';
import { setFinlitAxis, setPrice } from '@/engine/mockEngine';
import {
  CONFIG_TABLES, CHANNEL_META, PRICE_MAX,
  type GenreId, type ConfigAxis, type ChannelId, type ProductionSpec,
} from '@/data/finlit';
import { optionUnitCost } from '@/engine/finlit/core/config/fieldConfig';
import { PixelSelect } from '@/components/primitives/PixelSelect';
import { fmt$, fmtInt } from '@/utils/format';
import type { ServerProjectionResult } from '@/gamesim/sync';
import clsx from 'clsx';

/** The V3 product editor: what the notebook is. Spec and price only; where and how many live on the Business page. */

// `addon` is absent on purpose: add-ons are picked from the canvas drawer.
const AXES: { axis: ConfigAxis; label: string }[] = [
  { axis: 'paper', label: 'Paper' },
  { axis: 'size', label: 'Size' },
  { axis: 'pageDesign', label: 'Page Design' },
  { axis: 'cover', label: 'Cover Material' },
];

// No `type`: this only supplies the five design axes below, and a hardcoded
// type slug named a notebook the catalogue no longer has.
const DEFAULT_SPEC: Omit<ProductionSpec, 'type'> = {
  paper: 'cream', size: 'a5', pageDesign: 'lined', cover: 'plastic',
};

export function FinlitDesignControls({
  liveProjection,
  recalc,
}: {
  liveProjection?: ServerProjectionResult | null;
  /** Called at the END of a decision interaction. See useLiveProjection. */
  recalc?: (reason: string) => void;
}) {
  const line = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const apply = useGame((s) => s.apply);
  // Channels from globalInputSelections (backend-driven, company-wide).
  const activeChannels = useGame((s) =>
    s.globalInputSelections
      .filter((sel) => sel.key === 'channel' && sel.selectedStepKey != null)
      .map((sel) => sel.selectedStepKey as ChannelId),
  );

  // !important the canvas popup owns the "no notebook" message for the whole screen.
  if (!line) return null;

  const genre: GenreId = line.productId;
  // Full spec = the line's overrides on top of defaults (type follows genre).
  const spec: ProductionSpec = {
    type: line.finlitSpec?.type ?? genre,
    paper: line.finlitSpec?.paper ?? DEFAULT_SPEC.paper,
    size: line.finlitSpec?.size ?? DEFAULT_SPEC.size,
    pageDesign: line.finlitSpec?.pageDesign ?? DEFAULT_SPEC.pageDesign,
    cover: line.finlitSpec?.cover ?? DEFAULT_SPEC.cover,
    // The canvas axes carry no default, unchosen means 0, not a free charm.
    charms: line.finlitSpec?.charms,
    ribbons: line.finlitSpec?.ribbons,
    stickers: line.finlitSpec?.stickers,
    functional: line.finlitSpec?.functional,
  };
  const channelLabel = activeChannels.map((c) => CHANNEL_META[c].name).join(' + ');

  // !important unit cost and capacity come from the server's projection, with no local fallback.
  const proj = liveProjection?.byProduct.find((p) => p.productId === line?.productId) ?? null;
  const uCost = proj?.dynamicCost ?? null;
  const capacityPerPhase = proj?.inventoryQty ?? null;
  const margin = uCost != null ? (line.price - uCost) / line.price : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Market (genre) is hidden for now; the picker and `setLineGenre` are untouched. */}

      {/* ── Production spec (5 axes; type mirrors genre) ── */}
      <Section title="Production Spec" hint="Each choice changes production speed and unit cost.">
        <div className="flex flex-col gap-2">
          {AXES.map(({ axis, label }) => (
            <div key={axis} className="flex items-center justify-between gap-2">
              <span className="field-label w-28 shrink-0">{label}</span>
              <PixelSelect
                ariaLabel={label}
                // The canvas axes are optional, so `spec[axis]` may be undefined.
                value={spec[axis] ?? ''}
                // Computed, not stored: the same arithmetic the server's `dynamicCost` runs.
                options={CONFIG_TABLES[axis].options.map((o) => {
                  const added = optionUnitCost(genre, axis, o.id);
                  return {
                    id: o.id,
                    label: o.name,
                    hint: added != null ? `+${fmt$(added)}` : undefined,
                  };
                })}
                // A select has no interaction end distinct from its change, so
                // this is both the edit and the commit.
                onChange={(id) => {
                  apply((s) => setFinlitAxis(s, axis, id));
                  recalc?.(`spec axis ${axis}`);
                }}
                className="flex-1 min-w-0"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Price stays with the product: margin is price minus the unit cost the spec sets. */}
      <Section title="Price" hint="What you charge. Margin is price minus unit cost.">
        <Slider
          label="Price" value={line.price} min={1} max={PRICE_MAX} step={1}
          fmt={(v) => fmt$(v)} onChange={(v) => apply((s) => setPrice(s, v))}
          onCommit={() => recalc?.('price slider released')}
        />
      </Section>

      {/* ── Live feedback, the server's figures for this line, so the margin
           you price against is the one the P&L will actually use. ── */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Capacity"
          value={capacityPerPhase != null ? `${fmtInt(Math.round(capacityPerPhase))} / phase` : '—'}
          tone="info"
        />
        <Stat label="Unit cost" value={uCost != null ? fmt$(uCost) : '—'} tone="warn" />
        <Stat
          label="Margin"
          value={margin != null ? `${Math.round(margin * 100)}%` : '—'}
          tone={margin == null ? 'info' : margin > 0 ? 'good' : 'bad'}
        />
      </div>
      {uCost == null && (
        <div className="hint text-text-3">
          Waiting for the server projection - these figures come from it, not from the spec.
        </div>
      )}

      {/* Signpost, these used to live here; tell the player where they went. */}
      <div className="hint border-t border-border-soft pt-3">
        Selling through <span className="strong text-text-2">{channelLabel}</span>.
        Set sales channels in <span className="strong text-text-2">Business ▸ Operations</span>,
        and how many to make in <span className="strong text-text-2">Business ▸ Inventory</span>.
      </div>
    </div>
  );
}

/** A titled group; the filled header separates sections, not a border. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    // !important no border: everything actionable inside already has one.
    <section className="soft-panel">
      <header className="px-3.5 py-2.5 bg-cream-200">
        <div className="section-title text-ink-900">{title}</div>
        {hint && <div className="hint mt-0.5">{hint}</div>}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function Slider({
  label, value, min, max, step, fmt, onChange, onCommit,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
  /** Interaction END, pointer released, or a keyboard drag finished. */
  onCommit?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="field-label">{label}</span>
        <span className="num-sm text-text">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        // `onPointerUp` covers pointer drags, `onKeyUp` covers arrow-key ones.
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-ui-primary cursor-pointer"
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'info' | 'warn' | 'good' | 'bad' }) {
  const cls =
    tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-text';
  return (
    // A readout: nothing here responds to a click, so it takes the soft plate.
    <div className="readout soft-panel px-2.5 py-2 text-center">
      <div className="stat-label">{label}</div>
      <div className={clsx('num-sm mt-1', cls)}>{value}</div>
    </div>
  );
}
