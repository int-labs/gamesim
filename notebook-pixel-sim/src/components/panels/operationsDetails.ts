// Detail-sheet content for each Operations section.
//
// Section title and intro come from the backend GlobalInputDto (label /
// description), so the admin controls the copy from the configuration layer.
// When no backend data is available the fields show 'No description provided'
// so misconfiguration is visible rather than silently hidden behind stale copy.

import { CHANNELS_BY_GENRE, CHANNEL_META, type ChannelId } from '@/engine/finlit/core/config/channels';
import { GENRES, type GenreId } from '@/engine/finlit/core/config/genres';
import { CANDIDATES } from '@/engine/finlit/core/config/hiring';
import { VENDORS } from '@/engine/finlit/core/config/vendors';
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

export function budgetDetail(
  leverEnergy: number,
  budgetMax: number,
  demandMult: (v: number) => number,
  sellBonus: (v: number) => number,
): SectionDetail {
  const steps = [0, Math.round(budgetMax * 0.25), Math.round(budgetMax * 0.5), Math.round(budgetMax * 0.75), budgetMax];
  return {
    title: 'Marketing & Sales Budget',
    intro:
      'Two separate levers. Marketing makes more people want the notebook; sales converts more of the people who already do. Both are priced per phase and both cost energy to switch on, refunded when you set them back to zero.',
    inputs: [
      {
        name: 'Marketing budget',
        description: 'Awareness. Lifts demand, so more people want what you make.',
        cost: `up to ${money(perPhase(budgetMax))} / phase`,
        energy: leverEnergy,
        impacts: 'All notebooks',
        effect: `+${Math.round((demandMult(budgetMax) - 1) * 100)}%`,
      },
      {
        name: 'Sales budget',
        description: 'Conversion. Lifts sell-rate, so more of the interested actually buy.',
        cost: `up to ${money(perPhase(budgetMax))} / phase`,
        energy: leverEnergy,
        impacts: 'All notebooks',
        effect: `+${(sellBonus(budgetMax) * 100).toFixed(1)}%`,
      },
    ],
    tables: [
      {
        caption: 'What your spend buys',
        columns: ['Spend / phase', 'Demand', 'Sell-rate'],
        rows: steps.map((v) => [
          money(perPhase(v)),
          `+${Math.round((demandMult(v) - 1) * 100)}%`,
          `+${(sellBonus(v) * 100).toFixed(1)}%`,
        ]),
      },
    ],
  };
}

// ── Hiring ───────────────────────────────────────────────────────────────────

export function hiringDetail(gi?: GlobalInputDto): SectionDetail {
  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    inputs: CANDIDATES.map((c) => {
      const top = c.levels[c.levels.length - 1];
      return {
        name: c.name,
        description: c.blurb,
        cost: `${money(perPhase(c.levels[0].cost))} to ${money(perPhase(top.cost))} / phase`,
        energy: c.levels[0].energy,
        impacts: 'All notebooks',
        effect: `+${top.prodBonus.toFixed(1)}`,
      };
    }),
    tables: CANDIDATES.map((c) => ({
      caption: `${c.name} levels`,
      columns: ['Level', 'Output', 'Sell', 'Energy', 'Cost / phase'],
      rows: c.levels.map((lv) => [
        `L${lv.level}`,
        `+${lv.prodBonus.toFixed(2)}`,
        `+${(lv.sellBonus * 100).toFixed(1)}%`,
        `${lv.energy}⚡`,
        money(perPhase(lv.cost)),
      ]),
    })),
  };
}

// ── Shipping vendor ──────────────────────────────────────────────────────────

export function vendorDetail(gi?: GlobalInputDto): SectionDetail {
  return {
    title: gi?.label ?? NO_DESC,
    intro: gi?.description ?? NO_DESC,
    inputs: VENDORS.map((v) => ({
      name: v.name,
      description: v.coveredGenres.length
        ? `Supplies ${v.coveredGenres.map((g) => GENRES.find((x) => x.id === g)?.name ?? g).join(', ')}.`
        : 'Supplies all markets.',
      cost: `${money(v.cost)} / phase`,
      energy: v.energy,
      impacts: 'Production rate',
      effect: `+${(v.prodBonus * 100).toFixed(0)}% prod (${v.quality})`,
    })),
    tables: [
      {
        caption: 'Production boost by vendor',
        columns: ['Vendor', 'Prod boost', 'Quality', 'Cost / phase', 'Energy'],
        rows: VENDORS.map((v) => [
          v.name,
          `+${(v.prodBonus * 100).toFixed(0)}%`,
          v.quality,
          money(v.cost),
          String(v.energy),
        ]),
      },
    ],
  };
}
