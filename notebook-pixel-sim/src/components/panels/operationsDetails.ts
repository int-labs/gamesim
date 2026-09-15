// Detail-sheet content for each Operations section.
//
// Section title and intro come from the backend GlobalInputDto (label /
// description), so the admin controls the copy from the configuration layer.
// When no backend data is available the fields show 'No description provided'
// so misconfiguration is visible rather than silently hidden behind stale copy.

import { CHANNEL_ROWS, CHANNEL_META, type ChannelId } from '@/engine/finlit/core/config/channels';
import { GENRES } from '@/engine/finlit/core/config/genres';
import { hireSteps } from '@/engine/finlit/core/config/hiring';
import { vendorSteps, vendorQuality } from '@/engine/finlit/core/config/vendors';
import { channelEnergyCost } from '@/engine/mockEngine';
import type { DetailInput, DetailTable } from './OperationsKit';
import type { GlobalInputDto } from '@/gamesim/types';
import { studyFor } from '@/content/finlitCaseStudies';
import { fmt$ } from '@/utils/format';

const NO_DESC = 'No description provided';

// THE app-wide money formatter, not a local one. This was
// `$${n % 1 === 0 ? n : n.toFixed(2)}`, which dropped the decimals on a whole
// number — so the same channel read "$137" on its detail sheet and "$137.00" on
// its card. Two spellings of one figure reads as two figures.
const money = fmt$;
const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;

export interface SectionDetail {
  title: string;
  intro: string;
  inputs: DetailInput[];
  tables: DetailTable[];
}

// ── Sales channels ───────────────────────────────────────────────────────────

/**
 * ONE CONSOLIDATOR, TWO SOURCES — the shape every detail sheet follows.
 *
 *   numbers → the backend `channel` GlobalInput, via the rows `hydrateChannels`
 *             resolved (it is the single place per-product `impact.selections`
 *             are turned into per-genre values; re-resolving them here would be
 *             a second implementation of it)
 *   copy    → `PlayerConfig.caseStudy`, through `studyFor`, falling back to the
 *             item's own `description`
 *
 * The channel list is `gi.inputs`, so a channel the operator adds appears here
 * without a code change. It used to be a hardcoded `['offline','online','retail']`.
 */
export function channelDetail(
  gi?: GlobalInputDto,
  /** For mapping an impact's per-product `selections` onto genres. Without it
   *  the reach matrix shows each channel's DEFAULT reach in every row. */
  products?: { _id: string; productName: string }[],
): SectionDetail {
  const items = gi?.inputs ?? [];

  // `null` for a channel with no row yet, rather than a `.find(...)!` that
  // throws inside a render.
  const rowFor = (ch: ChannelId) => CHANNEL_ROWS.find((r) => r.channel === ch) ?? null;

  // genreId → its productIds, by the same name-matching heuristic
  // `hydrateChannels` used. Lazy: GENRES is refilled in place at boot.
  const productIdsByGenre = (genreId: string): string[] =>
    (products ?? [])
      .filter((p) => p.productName.toLowerCase().includes(genreId.toLowerCase()))
      .map((p) => String(p._id));

  /**
   * Reach for (genre × channel), straight off `impacts['sales_channel']` — the
   * impact the SERVER consumes as `customersObtained`. The per-product
   * `selections[]` override wins for that genre's products; otherwise the
   * impact's own value stands.
   *
   * Read from `gi.inputs` rather than a local table so it cannot drift from
   * what the round actually scores.
   */
  const reachFor = (item: GlobalInputDto['inputs'][number], genreId: string): string => {
    const impact = item.impacts?.['sales_channel'];
    if (!impact) return '-';
    const ids = productIdsByGenre(genreId);
    const match = impact.selections?.find((s) => ids.includes(String(s.productId)));
    return pct(match ? match.value : impact.value);
  };

  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    inputs: items.map((item) => {
      const ch = item.key as ChannelId;
      const row = rowFor(ch);
      const study = studyFor('channel', item.key);
      return {
        name: CHANNEL_META[ch]?.name ?? item.label,
        description: study.brief || item.description || NO_DESC,
        // The figure ALONE — the chip's caption says "/ phase". These used to
        // be joined into one string ("$137 / phase + 20% of each sale"), which
        // said the same thing as the card's two chips in a different shape and
        // overflowed its box.
        // `item.cost` — the SAME field every other lever charges from, and the
        // one the server turns into `costTreatment`.
        cost: money(item.cost),
        // A RATE on the selling price, not a dollar fee — `money()` rendered
        // retail's 0.2 as "$0.20" when it means a fifth of every sale.
        perSale: row && row.consignment > 0 ? pct(row.consignment) : 'None',
        // WAS MISSING ENTIRELY, so every channel's sheet read "Energy: None"
        // while the toggle charged 12. Same accessor the mutator and the card
        // use, so all three now quote one figure.
        energy: channelEnergyCost(item),
        impacts: 'All notebooks',
      };
    }),
    tables: items.length === 0 ? [] : [
      {
        // GENRES × channels, cells straight from the `sales_channel` impact.
        // Decision-critical: `customersObtained` is marketShare ×
        // availableMarket × productScore, and this reach is how much of a
        // market's demand a channel puts in front of the player — without it
        // the number cannot be reasoned about, only observed.
        //
        // Rows are GENRES read LAZILY (refilled in place at boot) and columns
        // are `gi.inputs`, so neither axis is a hardcoded list. The previous
        // version of this table read a local genre × channel table instead,
        // which is what pinned the channel count at three.
        caption: 'Reach by market (share of demand)',
        columns: ['Market', ...items.map((i) => CHANNEL_META[i.key as ChannelId]?.name ?? i.label)],
        rows: GENRES.map((g) => [g.name, ...items.map((item) => reachFor(item, g.id))]),
      },
      {
        caption: 'Running cost',
        columns: ['Channel', 'Per phase', 'Cut of each sale', 'Per unsold unit'],
        rows: items.map((item) => {
          const r = rowFor(item.key as ChannelId);
          return [
            CHANNEL_META[item.key as ChannelId]?.name ?? item.label,
            money(item.cost),
            // A rate, not a fee — see the note on `costs` above.
            r && r.consignment > 0 ? pct(r.consignment) : '-',
            r && r.inventoryCost > 0 ? money(r.inventoryCost) : '-',
          ];
        }),
      },
    ],
  };
}

// ── Marketing & sales budget ─────────────────────────────────────────────────

/**
 * Marketing reference sheet, built from the item's own `options` steps. It used
 * to be derived from a hardcoded frontend ceiling (`BUDGET_MAX = 40`) sliced
 * into quarters, and from the local `marketingDemandMult` curve — so the sheet
 * documented a spend range and an effect the server never applied.
 */
export function budgetDetail(gi?: GlobalInputDto): SectionDetail {
  // Every item, not `inputs[0]`: the container may hold several marketing
  // options and the server charges and applies all of them.
  const levers = (gi?.inputs ?? []).map((item) => {
    const impact = item.impacts?.['marketing']?.value ?? 0;
    // Each step is a key of `options`; its value is the multiplier the server
    // applies to both the cost and the impact.
    const steps = Object.entries(item.options ?? {}).map(([stepKey, mult]) => ({
      stepKey,
      spend: (item.cost ?? 0) * mult,
      demand: impact * mult,
    }));
    const top = steps.reduce<typeof steps[number] | null>(
      (best, s) => (best == null || s.demand > best.demand ? s : best),
      null,
    );
    return { item, steps, top };
  });

  return {
    title: gi?.label ?? 'Marketing Budget',
    intro: gi?.description
      ?? 'Marketing makes more people want the notebook. It is priced per phase and costs energy to switch on, refunded when you set it back to zero.',
    inputs: levers.map(({ item, top }) => ({
      name: item.label ?? 'Marketing budget',
      description: item.description ?? 'Awareness. Lifts demand, so more people want what you make.',
      // Figure only; the chip caption carries "/ phase".
      cost: top ? `up to ${money(top.spend)}` : NO_DESC,
      energy: item.energy ?? 0,
      impacts: 'All notebooks',
    })),
    // One table per lever, captioned by name so several are still readable.
    tables: levers
      .filter(({ steps }) => steps.length > 0)
      .map(({ item, steps }) => ({
        caption: levers.length > 1
          ? `${item.label ?? 'Marketing'} - what your spend buys`
          : 'What your spend buys',
        columns: ['Step', 'Spend / phase', 'Demand'],
        rows: steps.map((s) => [s.stepKey, money(s.spend), `+${(s.demand * 100).toFixed(1)}%`]),
      })),
  };
}

// ── Hiring ───────────────────────────────────────────────────────────────────

export function hiringDetail(gi?: GlobalInputDto): SectionDetail {
  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    // Straight off the backend items — label, description, and the steps its
    // own `options` map configures. Items with no options are binary hires and
    // contribute no level table.
    inputs: (gi?.inputs ?? []).map((item) => {
      const steps = hireSteps(item);
      const first = steps[0];
      const top = steps[steps.length - 1];
      return {
        name: item.label,
        description: item.description ?? NO_DESC,
        // NO `perPhase`: `hireStep.cost` is `item.cost × multiplier`, the same
        // per-phase expression the engage modal shows as "Wage / phase". The
        // sheet was multiplying it by 30 and contradicting that tile.
        cost: first
          ? `${money(first.cost)} to ${money(top.cost)}`
          : money(item.cost),
        energy: first?.energy ?? item.energy,
        impacts: 'All notebooks',
      };
    }),
    tables: (gi?.inputs ?? [])
      .filter((item) => hireSteps(item).length > 0)
      .map((item) => ({
        caption: `${item.label} levels`,
        columns: ['Level', 'Output', 'Sell', 'Energy', 'Cost / phase'],
        rows: hireSteps(item).map((st) => [
          st.stepKey,
          `+${st.prodBonus.toFixed(2)}`,
          `+${(st.sellBonus * 100).toFixed(1)}%`,
          `${st.energy}⚡`,
          money(st.cost),
        ]),
      })),
  };
}

// ── Shipping vendor ──────────────────────────────────────────────────────────

export function vendorDetail(gi?: GlobalInputDto): SectionDetail {
  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    // Built from the backend items. `productsImpacted` is stated as a COUNT of
    // products rather than translated into genre names — it is a list of product
    // ids, and the old code guessed genres by testing whether a product's name
    // contained a genre id as a substring.
    inputs: (gi?.inputs ?? []).map((item) => {
      const top = vendorSteps(item).reduce<ReturnType<typeof vendorSteps>[number] | null>(
        (best, s) => (best == null || s.prodBonus > best.prodBonus ? s : best),
        null,
      );
      const scoped = (item.productsImpacted ?? []).length;
      return {
        name: item.label,
        description: item.description
          ?? (scoped ? `Supplies ${scoped} of your products.` : 'Supplies all markets.'),
        cost: money(top?.cost ?? item.cost),
        energy: top?.energy ?? item.energy,
        impacts: scoped ? `Production rate (${scoped} products)` : 'Production rate',
      };
    }),
    tables: [
      {
        caption: 'Production boost by vendor',
        columns: ['Vendor', 'Step', 'Prod boost', 'Quality', 'Cost / phase', 'Energy'],
        rows: (gi?.inputs ?? []).flatMap((item) =>
          vendorSteps(item).map((s) => [
            item.label,
            s.stepKey ?? '—',
            `+${(s.prodBonus * 100).toFixed(0)}%`,
            vendorQuality(s.prodBonus),
            money(s.cost),
            String(s.energy),
          ]),
        ),
      },
    ],
  };
}
