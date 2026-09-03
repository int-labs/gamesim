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
import { perPhase } from '@/utils/format';

const NO_DESC = 'No description provided';

const money = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`;
const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;

const CHANNEL_ORDER: ChannelId[] = ['offline', 'online', 'retail'];
const GENRE_IDS: GenreId[] = GENRES.map((g) => g.id);

export interface SectionDetail {
  title: string;
  intro: string;
  inputs: DetailInput[];
  tables: DetailTable[];
}

// ── Sales channels ───────────────────────────────────────────────────────────

export function channelDetail(gi?: GlobalInputDto): SectionDetail {
  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    inputs: CHANNEL_ORDER.map((ch) => {
      // Economics other than reach are identical across genres, so a single
      // representative row is honest here; reach varies and gets its own table.
      const row = CHANNELS_BY_GENRE.indie.find((r) => r.channel === ch)!;
      const costs = [`${money(perPhase(row.maintenance))} / phase`];
      if (row.consignment > 0) costs.push(`${money(row.consignment)} / sale`);
      return {
        name: CHANNEL_META[ch].name,
        description: CHANNEL_META[ch].blurb,
        cost: costs.join(' + '),
        impacts: 'All notebooks',
        effect: `${pct(row.sellRate, 1)} sell-rate`,
      };
    }),
    tables: [
      {
        caption: 'Reach by market (share of demand)',
        columns: ['Market', 'Offline', 'Online', 'Retail'],
        rows: GENRE_IDS.map((g) => [
          GENRES.find((x) => x.id === g)!.name,
          ...CHANNEL_ORDER.map((ch) => pct(CHANNELS_BY_GENRE[g].find((r) => r.channel === ch)!.split)),
        ]),
      },
      {
        caption: 'Sell-rate by market',
        columns: ['Market', 'Offline', 'Online', 'Retail'],
        rows: GENRE_IDS.map((g) => [
          GENRES.find((x) => x.id === g)!.name,
          ...CHANNEL_ORDER.map((ch) =>
            pct(CHANNELS_BY_GENRE[g].find((r) => r.channel === ch)!.sellRate, 2),
          ),
        ]),
      },
      {
        caption: 'Running cost',
        columns: ['Channel', 'Per phase', 'Per sale', 'Inventory'],
        rows: CHANNEL_ORDER.map((ch) => {
          const r = CHANNELS_BY_GENRE.indie.find((x) => x.channel === ch)!;
          return [
            CHANNEL_META[ch].name,
            money(perPhase(r.maintenance)),
            r.consignment > 0 ? money(r.consignment) : '-',
            r.inventoryCost > 0 ? money(r.inventoryCost) : '-',
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
        cost: first
          ? `${money(perPhase(first.cost))} to ${money(perPhase(top.cost))} / phase`
          : money(perPhase(item.cost)),
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
          money(perPhase(st.cost)),
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
