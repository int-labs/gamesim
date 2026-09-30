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
  line: {
    /** The backend Product this line makes — its whole identity. */
    productId: string;
    price: number;
    targetPerPhase?: number;
    inventory: { finished: number };
  },
  capacity: number | null,
  openingStock: number,
  unitCost: number | null,
): LineStats {
  const genre = line.productId as GenreId;
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


  // Keyed by productId below — `byProduct` is ordered by the server's own
  // pairing, which is NOT portfolio order.
  const byProduct = liveProjection?.byProduct ?? null;
  // The same base the chip and the P&L show — see selectCashBalance.
  const { financialsByRound, bootstrap } = useGamesimSession();
  const phase = useGame((s) => s.meta.phase);
  const cashBase = useGame((s) =>
    selectCashBalance(
      s,
      s.meta.phase,
      (r) => financialsByRound[roundNumberFromPhase(r)]?.operatingProfit,
    ),
  );
  /**
   * CARRIED STOCK — the PREVIOUS round's scored `closingStock`, per product.
   *
   * NOT the live projection's `closingStock`, which is what this read before:
   * that is THIS round's projected leftover, so a round that sells through
   * closes at zero and the row read 0 almost always. The server's own rule is
   * `openingStock(r) = closingStock(r - 1)`.
   *
   * Round 0 has no predecessor, so the lookup misses and every notebook opens
   * at 0 — correct, nothing has been carried yet. Parked notebooks use the same
   * source, and have no other: nothing was submitted for them, so they have no
   * projection.
   */
  const carriedIn = financialsByRound[roundNumberFromPhase(phase) - 1]?.byProduct ?? null;
  const carriedFor = (productId: string) =>
    Math.round(carriedIn?.find((bp) => bp.productId === productId)?.closingStock ?? 0);

  const stats = lines.map((l) => {
    const p = byProduct?.find((bp) => bp.productId === l.productId);
    return statsFor(l, p?.inventoryQty ?? null, carriedFor(l.productId), p?.dynamicCost ?? null);
  });
  /**
   * EVERY notebook in the catalogue gets a row — active or PARKED.
   *
   * `removeProductLine` SPLICES the line out of `portfolio.productLines`, so a
   * parked notebook had no entry here and vanished from this panel entirely,
   * taking any carried stock with it. The row is rendered either way now and
   * `isActive` decides how it reads.
   *
   * RENDERING ONLY — parked stays parked. Nothing here adds a line, and
   * `buildDecisionInputs` still reads `productLines`, so a parked notebook
   * submits nothing, produces nothing and sells nothing until the player
   * activates it in Notebook Items.
   */
  const parked = (bootstrap?.products ?? []).filter(
    (prod) => !lines.some((l) => l.productId === prod._id),
  );

  const totalTarget = stats.reduce((a, s) => a + s.target, 0);
  // Null when ANY line is missing its capacity: a partial sum would read as a
  // whole-portfolio ceiling while silently omitting lines.
  const totalCapacity = stats.some((s) => s.capacity == null)
    ? null
    : stats.reduce((a, s) => a + (s.capacity ?? 0), 0);

  // Only when there is NOTHING to show. A player whose notebooks are all parked
  // still gets rows — that is the point of rendering them.
  if (lines.length === 0 && parked.length === 0) {
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
                const extra = unit == null ? 0 : (v - stats[i].target) * unit;
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

          {/* Parked notebooks, after the active ones so the running lines keep
              their established order. Same row, `isActive={false}`. */}
          {parked.map((prod) => (
            <ProductionRow
              key={prod._id}
              name={prod.productName}
              isActive={false}
              carried={carriedFor(prod._id)}
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
  isActive = true,
  carried = 0,
}: {
  name: string;
  stats?: LineStats;
  onChange?: (v: number) => void;
  /** Interaction END — pointer released, or a keyboard drag finished. */
  onCommit?: () => void;
  /** PARKED when false: the notebook has no product line this phase. The row
   *  still renders — it used to be omitted entirely, which hid any stock the
   *  notebook was holding. Read-only, and it changes nothing: parked units stay
   *  parked until the player activates the notebook themselves. */
  isActive?: boolean;
  /** Units this parked notebook is holding, from last round's `closingStock`. */
  carried?: number;
}) {
  // The ceiling is literally `inventoryQty`. With no capacity yet there is
  // nothing to plan against, so the slider is disabled rather than bounded by a
  // guess. A PARKED notebook has no projection at all, so it is never known.
  const known = isActive && stats?.capacity != null;
  // FLOOR, matching the server's clamp: `produced = min(target, inventoryQty)`
  // against the raw value. `Math.round` could hand back a ceiling ABOVE
  // inventoryQty (round(10.6) = 11), letting the slider offer a build the
  // server would silently trim.
  const capMax = known ? Math.max(1, Math.floor(stats!.capacity!)) : 1;
  const value = Math.min(stats?.target ?? 0, capMax);
  // ONE figure, one source: last round's scored `closingStock`. An active row
  // gets it through `stats.openingStock`, a parked row has no `stats` and takes
  // it directly — but both are the same number for the same notebook.
  const inStock = isActive ? (stats?.openingStock ?? 0) : carried;

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
          {stats && (
            <span className="eyebrow eyebrow-sm text-info shrink-0">{genreById(stats.genre).name}</span>
          )}
          <span className="item-name text-text truncate">{name}</span>
          {!isActive && (
            <span className="eyebrow eyebrow-sm text-text-3 shrink-0">Parked</span>
          )}
        </div>
        <span className="flex items-center gap-3 shrink-0">
          {/* Price is read-only here - it's set on the Product page next to unit
              cost/margin. Echoed so the commercial picture reads in one place. */}
          {stats && (
            <>
              <span className="flex items-baseline gap-1.5">
                <span className="stat-label">Price</span>
                <span className="num-xs text-text">{fmt$(stats.price)}</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="stat-label">Stock</span>
                <span className="num-xs text-text">{fmtInt(stats.finished)}</span>
              </span>
            </>
          )}
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
          onChange={(e) => onChange?.(parseInt(e.target.value, 10))}
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
              {known ? fmtInt(Math.round(stats!.capacity!)) : '—'}
            </span>
          </span>
          {/* Carried stock is sellable without producing it again, and was
              already expensed — so without showing it the player cannot explain
              why sales exceeded what they made this round. On a PARKED notebook
              it is the whole point of the row: those units exist and are not
              being offered. */}
          {inStock > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="stat-label">In stock</span>
              <span className="num-xs text-text-2">
                {fmtInt(inStock)} carried
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
