// Detail-sheet content for each Operations section.
//
// Section title and intro come from the backend GlobalInputDto (label /
// description), so the admin controls the copy from the configuration layer.
// When no backend data is available the fields show 'No description provided'
// so misconfiguration is visible rather than silently hidden behind stale copy.

import { CHANNELS_BY_GENRE, CHANNEL_META, type ChannelId } from '@/engine/finlit/core/config/channels';
import { GENRES, type GenreId } from '@/engine/finlit/core/config/genres';
import { hireSteps } from '@/engine/finlit/core/config/hiring';
import { vendorSteps, vendorQuality } from '@/engine/finlit/core/config/vendors';
import type { DetailInput, DetailTable } from './OperationsKit';
import type { GlobalInputDto } from '@/gamesim/types';
import { studyFor } from '@/content/finlitCaseStudies';

const NO_DESC = 'No description provided';

const money = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`;
const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;

// LAZY, both of them. `GENRES` is emptied and refilled in place by
// `configHydrator` at boot, so a module-scope `GENRES.map(...)` froze the
// bundled list and no published genre ever reached these tables. Channels come
// from the backend container, never a hardcoded triple.
const genreIds = (): GenreId[] => GENRES.map((g) => g.id);
const channelIds = (gi?: GlobalInputDto): ChannelId[] =>
  (gi?.inputs ?? []).map((i) => i.key as ChannelId);

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
export function channelDetail(gi?: GlobalInputDto): SectionDetail {
  const items = gi?.inputs ?? [];

  // A row may be absent for a channel the bundled table never had; `null`
  // rather than a `.find(...)!` that throws inside a render.
  const rowFor = (ch: ChannelId, genre: GenreId) =>
    CHANNELS_BY_GENRE[genre]?.find((r) => r.channel === ch) ?? null;
  // Maintenance/consignment/inventoryCost are written uniformly across genres
  // by `hydrateChannels`, so any genre's row carries them. `.indie` used to be
  // hardcoded here, which threw once genres came from config.
  const flatRow = (ch: ChannelId) => {
    for (const g of genreIds()) {
      const r = rowFor(ch, g);
      if (r) return r;
    }
    return null;
  };

  const chIds = channelIds(gi);
  const chNames = items.map((i) => CHANNEL_META[i.key as ChannelId]?.name ?? i.label);

  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    inputs: items.map((item) => {
      const ch = item.key as ChannelId;
      const row = flatRow(ch);
      const study = studyFor('channel', item.key);
      // `item.cost` — the SAME field every other lever charges from, and the
      // one the server turns into `costTreatment`. This read the `maintenance`
      // impact, which `IMPACT_CONFIG` has no entry for, so calcFinancials
      // skipped it: the sheet quoted a per-phase cost the round never charged.
      // (And it ran that figure through `perPhase`, so it was also 30×.)
      const costs: string[] = [`${money(item.cost)} / phase`];
      if (row && row.consignment > 0) costs.push(`${money(row.consignment)} / sale`);
      return {
        name: CHANNEL_META[ch]?.name ?? item.label,
        description: study.brief || item.description || NO_DESC,
        cost: costs.length > 0 ? costs.join(' + ') : NO_DESC,
        impacts: 'All notebooks',
        effect: row ? `${pct(row.sellRate, 1)} sell-rate` : NO_DESC,
      };
    }),
    tables: chIds.length === 0 ? [] : [
      {
        caption: 'Reach by market (share of demand)',
        columns: ['Market', ...chNames],
        rows: genreIds().map((g) => [
          GENRES.find((x) => x.id === g)?.name ?? g,
          ...chIds.map((ch) => {
            const r = rowFor(ch, g);
            return r ? pct(r.split) : '-';
          }),
        ]),
      },
      {
        caption: 'Sell-rate by market',
        columns: ['Market', ...chNames],
        rows: genreIds().map((g) => [
          GENRES.find((x) => x.id === g)?.name ?? g,
          ...chIds.map((ch) => {
            const r = rowFor(ch, g);
            return r ? pct(r.sellRate, 2) : '-';
          }),
        ]),
      },
      {
        caption: 'Running cost',
        columns: ['Channel', 'Per phase', 'Per sale', 'Inventory'],
        rows: items.map((item) => {
          const ch = item.key as ChannelId;
          const r = flatRow(ch);
          return [
            CHANNEL_META[ch]?.name ?? item.label,
            money(item.cost),
            r && r.consignment > 0 ? money(r.consignment) : '-',
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
      spend: Math.ceil((item.cost ?? 0) * mult),
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
      cost: top ? `up to ${money(top.spend)} / phase` : NO_DESC,
      energy: item.energy ?? 0,
      impacts: 'All notebooks',
      effect: top ? `+${(top.demand * 100).toFixed(1)}%` : '—',
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
          ? `${money(first.cost)} to ${money(top.cost)} / phase`
          : money(item.cost),
        energy: first?.energy ?? item.energy,
        impacts: 'All notebooks',
        effect: top ? `+${top.prodBonus.toFixed(1)}` : '—',
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
        cost: `${money(top?.cost ?? item.cost)} / phase`,
        energy: top?.energy ?? item.energy,
        impacts: scoped ? `Production rate (${scoped} products)` : 'Production rate',
        effect: top
          ? `+${(top.prodBonus * 100).toFixed(0)}% prod (${vendorQuality(top.prodBonus)})`
          : '—',
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
