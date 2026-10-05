import { useGame } from '@/state/store';
import { setLineTargetPerPhase } from '@/engine/mockEngine';
import { canSpend, selectCashBalance } from '@/engine/selectors';
import { useGamesimSession, roundNumberFromPhase } from '@/gamesim/GamesimProvider';
import { playSfx } from '@/audio/audioManager';
import { genreById, type GenreId } from '@/data/finlit';
import { PixelPanel } from '@/components/primitives';
import { fmt$, fmtInt } from '@/utils/format';
import type { ServerProjectionResult } from '@/gamesim/sync';

interface LineStats {
  genre: GenreId;
  /** Per phase, from the server's `inventoryQty`. Null until it answers. */
  capacity: number | null;
  /** Units carried in from last round's `closingStock` — sellable WITHOUT being
   *  produced again, and already expensed, so they cost no further COGS. */
  openingStock: number;
  target: number;
  /* `finished` and `price` were dropped on 2026-10-05 with the readouts that
     showed them. Stock on hand is the Portfolio sheet's; price is set in the
     Notebook section, beside the unit cost it has to be weighed against. */
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
    targetPerPhase?: number;
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
    // ZERO until stated — production is a decision. It used to default to half
    // the ceiling, which built and billed units nobody asked for, and a standing
    // figure let the planner be ignored: the number looked filled in already.
    // `calcFinancials` applies the same zero to an unstated `produced`.
    target: line.targetPerPhase ?? 0,
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
  // `inventory.totalFinished` / `stockoutDays` / `overstockDays` were read here
  // for the removed summary panel. They are portfolio totals and belong to the
  // Portfolio sheet; this panel is per-notebook decisions only.
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
      {/* The "Stock & Output" panel was REMOVED here on 2026-10-05 — the
          Finished goods / Produce / Capacity tiles and the stockout/overstock
          badges. Every figure on it was a portfolio total, which the Portfolio
          sheet already carries; here they restated the rows below them. */}

      {/* ── Production Plan — the decisions: units per phase per notebook ── */}
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
      {/* HEADER — which notebook. */}
      <div className="flex items-center gap-2 min-w-0 mb-1.5">
        {/* TITLE = line name; genre is a quiet tag before it */}
        {stats && (
          <span className="eyebrow eyebrow-sm text-info shrink-0">{genreById(stats.genre).name}</span>
        )}
        <span className="item-name text-text truncate">{name}</span>
        {!isActive && (
          <span className="eyebrow eyebrow-sm text-text-3 shrink-0">Parked</span>
        )}
      </div>

      {/* CAPACITY — the decision over its ceiling, as one fraction. It was two
          separate readouts ("Produce / phase" above the slider, "Capacity"
          below it), so the player had to hold both to know how much headroom
          was left. */}
      <div className="flex items-baseline gap-1.5">
        <span className="stat-label">Capacity</span>
        <span className="num-sm text-text tabular-nums">
          {known ? `${fmtInt(value)} / ${fmtInt(Math.round(stats!.capacity!))}` : '—'}
        </span>
      </div>

      {/* The slider owns its own full-width row. It used to share one with a
          fixed `w-24` caption, and `.stat-label` is `white-space: nowrap`, so a
          long caption ran past its box and the slider was drawn over it. */}
      <input
        type="range"
        min={0}
        max={capMax}
        step={1}
        value={value}
        disabled={!known}
        aria-label={`Units of ${name} to produce this phase`}
        onChange={(e) => onChange?.(parseInt(e.target.value, 10))}
        // Pointer up covers mouse and touch; key up covers arrow-key dragging.
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full mt-1.5 accent-ui-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* STOCK — what carries in, and what this phase's build adds to it.
          Carried units are sellable WITHOUT being produced again and were
          already expensed, so without this the player cannot explain why sales
          exceeded what they made. On a PARKED notebook it is the whole point of
          the row: those units exist and are not being offered. */}
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="stat-label">Stock</span>
        <span className="num-xs text-text-2 tabular-nums">
          {fmtInt(inStock)}
          {known && value > 0 && <> (+{fmtInt(value)})</>}
        </span>
      </div>
    </div>
  );
}
