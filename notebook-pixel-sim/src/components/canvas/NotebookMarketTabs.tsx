// The "who wants this" and "how big is it" halves of the Notebook Details
// modal.
//
// EVERY NUMBER HERE IS LIVE DATA, not illustration:
//   • FIELD_CONFIG[genre][field].direction — the operator's Voice-of-Customer
//                         weight, read off the real Product documents by
//                         `hydrateFieldConfig`. This is what the SERVER scores
//                         with, in `calcFinancials`' dynamicPrice:
//                             sum += resolved × bellFactor × field.direction
//                         Plotted as an interest LINE on a scale shared by every
//                         market, plus a rank. NOT as a share: these weights do
//                         not sum to 1 (live sums run 0.62-0.94), so a per-market
//                         percentage inflated whichever market summed lowest.
//   • GENRES[].demand   — the per-phase addressable market curve.
//
// The V2 SEGMENT axis is GONE (2026-09-14) — `data/segments.ts`,
// `GENRE_TO_SEGMENT` and the `students | creators | professionals | gift` union
// had no backend counterpart to re-source from, and a notebook IS its market
// now. Do not reintroduce a frontend table to name the buyers; if segments
// return they come from the SEGMENTS collection.
//
// This header used to claim the bars came from `GENRES[].voc`, "the exact
// weights vocFit() uses". That was already false: the code reads FIELD_CONFIG,
// and `vocFit()` is the obsolete local VoC model the server does not use. Do
// not point these bars back at it.
//
// TYPOGRAPHY: use the shared scale in src/styles/index.css, never ad-hoc sizes.
//   .h3 / .section-title  headings (VT323, 16-18px)
//   .eyebrow-*            uppercase labels (Inter 700, tracked)
//   .num-*                ALL numerals (Inter 700, tabular-nums)
//   .body-*               sentences (Jura 600)
// Numerals are never set in a pixel face: digits like 9,752 turn to mush.

import { motion } from 'framer-motion';
import { GENRES, genreGrowth, type GenreDef } from '@/engine/finlit/core/config/genres';
import {
  priceAnchorCost,
  priceSensitivity,
} from '@/engine/finlit/core/config/fieldConfig';
import { fmt$ } from '@/utils/format';
import { PixelBadge } from '@/components/primitives';

// The "What they weigh" rows are DERIVED — `driverAxes(genreId)` reads the
// product's own fields, in the operator's `order`, labelled with their own
// `label`. A hardcoded six-key list used to live here; see the note on
// `driverAxes` for what that broke. Hints come from the operator too, via
// PlayerConfig's `drivers` section.

// `p0` is labelled "Pre" — it is the market BEFORE the run starts, which is what
// the player is reading it as. There used to be a fifth column ahead of it for
// the sheet's year −1; that column belongs to a printed edition of the copy and
// said nothing here, so two adjacent columns both read as "before we began".
const PHASES = [
  { key: 'p0', label: 'Pre' },
  { key: 'p1', label: 'P1' },
  { key: 'p2', label: 'P2' },
  { key: 'p3', label: 'P3' },
] as const;

/* `isSameMarket` was DELETED here on 2026-10-05. It asked "is this the notebook
   being designed?" and the answer tinted a table row and gated a card. Every
   market is shown to every player now, with nothing marked — owner's call: the
   sheet is a reference, and highlighting one row says the others matter less. */

const fmt = (n: number) => n.toLocaleString('en-US');

/* `maxDriverWeight` went with the VoC chart on 2026-10-05 — it existed to give
   the interest lines one shared y-scale across all four markets. `rankOrder`
   had gone earlier, when the chart started sorting its own axes. */

// ── Buyer Interest ───────────────────────────────────────────────────────────

/**
 * EVERY market, one card each, on arrival.
 *
 * It took an `arch` and drew the one card a tab strip had selected. There is no
 * tab strip any more: the cards are the page, so the comparison happens by
 * scrolling rather than by paging.
 */
export function BuyerInterestTab() {
  if (GENRES.length === 0) {
    return (
      <div className="body-xs text-text-3 italic">
        No notebooks in the published catalogue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* A HEADER, not a loose paragraph. The two blocks on this sheet read as
          one undifferentiated wall otherwise — each now announces what the
          cards under it are. */}
      <header className="border-b-2 border-ink-900 pb-1.5">
        {/* `.h2`, not `.section-title` (16px) — this heads a whole sheet and
            was smaller than the card titles under it. */}
        <h3 className="h2 text-ink-900">What each market looks like today:</h3>
      </header>

      {GENRES.map((genre) => (
        <MarketCard key={genre.id} genre={genre} />
      ))}
    </div>
  );
}

function MarketCard({ genre }: { genre: GenreDef }) {
  // No fit border or badge. Every market is drawn; marking one as the player's
  // own would say the others matter less, and the numbers are what distinguish
  // them.
  return (
    <motion.div
      className="border-2 border-ink-900 bg-cream-50 shadow-pixel-1 flex flex-col"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b-2 border-ink-900 bg-success-soft">
        <div className="h3 uppercase text-ink-900">{genre.name}</div>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5">
        <p className="body-xs text-text-2">{genre.blurb}</p>

        {/* All three read the operator's PRODUCT FIELDS. They previously read a
            bundled `data/segments.ts` table, for a segment `GENRE_TO_SEGMENT`
            may only have guessed at — neither exists now. */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Market now" value={fmt(genre.demand.p0)} note="units of demand" delay={0} />
          <Stat
            label="Price anchor"
            value={fmt$(priceAnchorCost(genre.id))}
            note="market avg price"
            delay={0.05}
          />
          {/* No figure here on purpose — whether a market tolerates a price
              change is the whole decision; a "±$X" would invite arithmetic
              against a curve that pivots on a server-side `dynamicPrice`. */}
          <Stat
            label="Price sens."
            value={priceSensitivity(genre.id).label}
            note="how much price matters"
            delay={0.1}
          />
        </div>

        {/* The "Customer Preference" VoC chart was REMOVED here on 2026-10-05,
            and `VocInterestChart` with it. The card keeps the three figures;
            the driver weights it plotted are not displayed anywhere now. */}

        {/* WHAT EACH DECISION MEANS — permanent, not a hover.

            The same operator copy the chart above carries as an SVG `<title>`
            on each point. A tooltip is the wrong surface for it: this is the
            information the player needs in order to MAKE the decision, and it
            was reachable only by hovering a 3.5px dot.

            This replaced the buyer description that came from the deleted
            `data/segments.ts`. `genre.blurb` above still says who wants the
            notebook; this says what each driver is asking them about.

            Rows with NO hint are SKIPPED, never given a placeholder — the copy
            is the operator's and an invented line would keep describing a field
            they have since repurposed. See the note at the top of `drivers.ts`. */}
        {/* described.length > 0 && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border-soft">
            <div className="stat-label">What these mean</div>
            <dl className="flex flex-col gap-2">
              {described.map(({ axis, copy }) => (
                <div key={axis.key}>
                  <dt className="item-name text-text">{copy.label ?? axis.label}</dt>
                  <dd className="body-xs text-text-2 mt-0.5">{copy.hint}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) */}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, note, delay = 0 }: { label: string; value: string; note: string; delay?: number }) {
  return (
    <motion.div
      className="bg-surface-2 border border-border-soft px-2.5 py-2.5 min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
    >
      <div className="stat-label truncate">{label}</div>
      <div className="num-md text-ink-900 mt-1.5 truncate">{value}</div>
      <div className="body-xs text-text-3 truncate">{note}</div>
    </motion.div>
  );
}

/* VoC is GONE from this file. `VocBar` was deleted 2026-09-14 and the
   `VocInterestChart` that replaced it on 2026-10-05 — the interest curve over
   each market's decision axes, drawn on a shared y-scale.

   The rule that outlived both, should a VoC surface ever return: `direction` is
   a COEFFICIENT `calcFinancials` feeds into dynamicPrice. It is not a share,
   the weights do NOT sum to 1, and normalising them into percentages inflates
   the small-sum markets. See [[project-voc-interest-display]]. */


// ── Market Data ──────────────────────────────────────────────────────────────

export function MarketDataTab() {
  const maxDemand = Math.max(...GENRES.flatMap((g) => PHASES.map((p) => g.demand[p.key])));

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Same treatment as the Buyer Interest header above. */}
      <header className="border-b-2 border-ink-900 pb-1.5">
        <h3 className="h2 text-ink-900">Addressable demand per market per phase:</h3>
      </header>

      {/* One chart per market. `max` spans EVERY market, so the bars are
          comparable across cards rather than each rescaling to its own peak. */}
      {GENRES.map((genre) => (
        <DemandChart key={genre.id} genre={genre} max={maxDemand} />
      ))}

      {/* The table is the same figures side by side — the charts give each
          market its shape, the table ranks them. */}
      <DemandTable />
    </div>
  );
}

/** Hand-built bars. The codebase deliberately ships no chart library. */
// No `arch`/fit: this is the only chart on screen, so there is nothing to
// contrast it against. The badge now carries GROWTH, which is information,
// rather than doubling as a "this is yours" marker.
function DemandChart({ genre, max }: { genre: GenreDef; max: number }) {
  const growth = Math.round(genreGrowth(genre, 'p0', 'p3') * 100);

  return (
    <motion.div
      className="border-2 border-ink-900 bg-cream-50 shadow-pixel-1 p-3.5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h3 uppercase text-ink-900">{genre.name}</div>
        <PixelBadge tone="success">+{growth}%</PixelBadge>
      </div>

      {/* items-stretch (not items-end) is required: with items-end the columns
          size to their content, so the flex-1 track has no free space to grow
          into and every bar collapses to its borders. */}
      <div className="flex items-stretch gap-2 h-[108px]">
        {PHASES.map((p, i) => {
          const v = genre.demand[p.key];
          const pct = Math.max(0.04, v / max);
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="num-xs text-ink-900">{v}</div>
              {/* `relative` + an absolutely-positioned bar is load-bearing: a
                  percentage height on a normal-flow child of a flex-1 track
                  resolves against `auto`, and since the bar is an empty div
                  that collapses to 0 (you see only its borders). Absolute
                  positioning resolves the % against the track's real box. */}
              <div className="w-full flex-1 relative min-h-0">
                {/* Height is static and only scaleY animates: it keeps the
                    grow-up motion off the layout path (compositor-only). */}
                <motion.div
                  className="absolute inset-x-0 bottom-0 border-2 border-ink-900 bg-ui-primary"
                  style={{ height: `${pct * 100}%`, transformOrigin: 'bottom' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
                />
              </div>
              <div className="stat-label">{p.label}</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function DemandTable() {
  return (
    <div className="border-2 border-ink-900 bg-cream-50 shadow-pixel-1 overflow-x-auto">
      <table className="w-full border-collapse min-w-[520px]">
        <thead>
          <tr className="bg-cream-200 border-b border-border-soft">
            <th className="stat-label text-left px-3.5 py-3">Market</th>
            {PHASES.map((p) => (
              <th key={p.key} className="stat-label text-right px-3.5 py-3">
                {p.label}
              </th>
            ))}
            <th className="stat-label text-right px-3.5 py-3">Growth</th>
          </tr>
        </thead>
        <tbody>
          {/* Every row drawn the same. The player's own market used to be
              tinted `bg-success-soft/40`; nothing is marked now. */}
          {GENRES.map((g) => (
            <tr key={g.id} className="border-b border-border-soft last:border-b-0">
              <td className="px-3.5 py-2.5 item-name text-text whitespace-nowrap">{g.name}</td>
              {PHASES.map((p) => (
                <td key={p.key} className="px-3.5 py-2.5 text-right num-xs text-ink-900">
                  {fmt(g.demand[p.key])}
                </td>
              ))}
              <td className="px-3.5 py-2.5 text-right num-xs text-success">
                +{Math.round(genreGrowth(g, 'p0', 'p3') * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
