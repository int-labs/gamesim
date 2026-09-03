import { useGame } from '@/state/store';
import { setLineTargetPerPhase } from '@/engine/mockEngine';
import { canSpend, selectCashBalance } from '@/engine/selectors';
import { useGamesimSession, roundNumberFromPhase } from '@/gamesim/GamesimProvider';
import { playSfx } from '@/audio/audioManager';
import { genreById, type GenreId } from '@/data/finlit';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { fmt$, fmtInt } from '@/utils/format';
import { BUSINESS_PAGE } from '@/content/copy';
import { Tooltip } from '@/components/primitives/Tooltip';
import type { ServerProjectionResult } from '@/gamesim/sync';

interface LineStats {
  genre: GenreId;
  /** Per phase, from the server's `inventoryQty`. Null until it answers. */
  capacity: number | null;
  /** Units carried in from last round's `closingStock` — sellable WITHOUT being
   *  produced again, and already expensed, so they cost no further COGS. */
  openingStock: number;
  finished: number;
  target: number;
  /** Read-only here — price is set on the Product page (it pairs with unit cost). */
  price: number;
  /** Server `dynamicCost` — what one unit costs to BUILD, so the planner can
   *  price a change before committing it. Null until the server answers. */
  unitCost: number | null;
}

/**
 * Per-line figures for the production planner. Everything is PER PHASE.
 *
 * `capacity` is the server's `inventoryQty` — the only real ceiling, since
 * `unitsSold = min(customersObtained, inventoryQty)`. It used to be
 * `prodPerDay(spec, 0)` from the local spec table: a different model, in
 * per-day units, with a hardcoded ZERO production bonus, which is why this
 * panel and the metrics never agreed. `null` when the server has not answered
 * yet — there is no local fallback, because a fabricated ceiling reads exactly
 * like a real one.
 */
function statsFor(
  line: { genre?: GenreId; price: number; targetPerPhase?: number; inventory: { finished: number } },
  capacity: number | null,
  openingStock: number,
  unitCost: number | null,
): LineStats {
  const genre = (line.genre ?? 'indie') as GenreId;
  return {
    genre,
    capacity,
    openingStock,
    finished: line.inventory.finished,
    // ZERO until stated — production is a decision. It used to default to half
    // the ceiling, which built and billed units nobody asked for, and a standing
    // figure let the planner be ignored: the number looked filled in already.
    // `calcFinancials` applies the same zero to an unstated `produced`.
    target: line.targetPerPhase ?? 0,
    price: line.price,
    unitCost,
  };
}

/**
 * InventoryPanel — the V3 PRODUCTION PLANNER. In the FinLit model there's no
 * raw-material buffer (notebooks are produced straight from the spec), so the
 * inventory decision is "how many units/day to make per line" — the LP2 lever.
 * This panel surfaces that control per notebook (previously only on the
 * Product page), plus a live stock/output overview and the trend charts.
 */
export function InventoryPanel({
  liveProjection,
  recalc,
}: {
  liveProjection?: ServerProjectionResult | null;
  /** Called at the END of a decision interaction. See useLiveProjection. */
  recalc?: (reason: string) => void;
}) {
  const lines = useGame((s) => s.portfolio.productLines);
  const finished = useGame((s) => s.inventory.totalFinished);
  const stockoutDays = useGame((s) => s.inventory.stockoutDays);
  const overstockDays = useGame((s) => s.inventory.overstockDays);
  const apply = useGame((s) => s.apply);


  // `byProduct` is index-aligned with portfolio order, the same assumption the
  // rest of the gamesim bridge makes.
  const byProduct = liveProjection?.byProduct ?? null;
  // The same base the chip and the P&L show — see selectCashBalance.
  const { financialsByRound } = useGamesimSession();
  const cashBase = useGame((s) =>
    selectCashBalance(
      s,
      s.meta.phase,
      (r) => financialsByRound[roundNumberFromPhase(r)]?.operatingProfit,
    ),
  );
  const stats = lines.map((l, i) => {
    const p = byProduct?.[i];
    return statsFor(l, p?.inventoryQty ?? null, Math.round(p?.closingStock ?? 0), p?.dynamicCost ?? null);
  });
  const totalTarget = stats.reduce((a, s) => a + s.target, 0);
  // Null when ANY line is missing its capacity: a partial sum would read as a
  // whole-portfolio ceiling while silently omitting lines.
  const totalCapacity = stats.some((s) => s.capacity == null)
    ? null
    : stats.reduce((a, s) => a + (s.capacity ?? 0), 0);

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
          <Box label="Produce / phase" value={fmtInt(totalTarget)} tone="neutral" hint="Total units per phase you've planned across all notebooks." />
          <Box
            label="Capacity / phase"
            value={totalCapacity != null ? fmtInt(totalCapacity) : '—'}
            tone="info"
            hint="Most you can make per phase, from the server's projection for your current specs and business decisions."
          />
          {/* No "Demand est. / phase" box — "Produce / phase" above is the same
              number now that the produce plan states the player's estimate. */}
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
              onChange={(v) => apply((s) => {
                // Cash bounds the round: a build the team cannot pay for is
                // REFUSED, leaving the last legal target in place. Only the
                // DELTA is tested, so winding a target back down is always free.
                const unit = stats[i].unitCost;
                const extra = unit == null ? 0 : Math.ceil((v - stats[i].target) * unit);
                if (!canSpend(s, extra, byProduct, cashBase)) {
                  playSfx('fail');
                  s.toast = {
                    id: 'cash-short-build-' + line.id,
                    kind: 'warning',
                    text: `Not enough cash to build that many ${line.name} — ${fmt$(extra)} more needed than you have.`,
                    until: Date.now() + 1900,
                  };
                  return;
                }
                setLineTargetPerPhase(s, v, line.id);
              })}
              onCommit={() => recalc?.(`produce slider released · ${line.name}`)}
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
  onChange,
  onCommit,
}: {
  name: string;
  stats: LineStats;
  onChange: (v: number) => void;
  /** Interaction END — pointer released, or a keyboard drag finished. */
  onCommit?: () => void;
}) {
  // The ceiling is literally `inventoryQty`. With no capacity yet there is
  // nothing to plan against, so the slider is disabled rather than bounded by a
  // guess.
  const known = stats.capacity != null;
  // FLOOR, matching the server's clamp: `produced = min(target, inventoryQty)`
  // against the raw value. `Math.round` could hand back a ceiling ABOVE
  // inventoryQty (round(10.6) = 11), letting the slider offer a build the
  // server would silently trim.
  const capMax = known ? Math.max(1, Math.floor(stats.capacity!)) : 1;
  const value = Math.min(stats.target, capMax);

  // No tone / hint. It graded the produce target against a separate demand
  // estimate, and the target IS that estimate now — so every reading was the
  // player compared with themselves ("Matched to your estimate" was true by
  // construction). There is no second number to loop back and fill it in, so
  // the coaching is gone rather than reworded.

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
          {/* Per phase throughout now — the slider's value IS the figure, with
              no /30 between the control and what the player reads. */}
          <span className="num-sm text-text tabular-nums">{known ? fmtInt(value) : '—'}</span>
        </div>
        <input
          type="range"
          min={0}
          max={capMax}
          step={1}
          value={value}
          disabled={!known}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          // Pointer up covers mouse and touch; key up covers arrow-key dragging.
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          className="w-full mt-1.5 accent-ui-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="flex items-center gap-3 min-w-0 flex-wrap">
          {/* No "Demand est." input. The produce slider above IS the estimate. */}
          <span className="flex items-baseline gap-1.5">
            <span className="stat-label">Capacity</span>
            <span className="num-xs text-text-2">
              {stats.capacity != null ? fmtInt(Math.round(stats.capacity)) : '—'}
            </span>
          </span>
          {/* Carried stock is sellable without producing it again, and was
              already expensed — so without showing it the player cannot explain
              why sales exceeded what they made this round. */}
          {stats.openingStock > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="stat-label">In stock</span>
              <span className="num-xs text-text-2">
                {fmtInt(stats.openingStock)} carried
              </span>
            </span>
          )}
        </span>
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
