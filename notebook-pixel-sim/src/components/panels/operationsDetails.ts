// Detail-sheet content for each Operations section.
//
// Every value is read from the FinLit engine config, so what the sheet claims
// and what the simulation does cannot drift. The server's /global-inputs
// collection is empty for this simulation type and, more importantly, is a
// SEPARATE model that feeds the server's official scoring — mirroring it here
// would create a second source of truth that silently disagrees with the
// engine the player is actually playing against.

import { CHANNELS_BY_GENRE, CHANNEL_META, type ChannelId } from '@/engine/finlit/core/config/channels';
import { GENRES, type GenreId } from '@/engine/finlit/core/config/genres';
import { CANDIDATES } from '@/engine/finlit/core/config/hiring';
import { VENDORS } from '@/engine/finlit/core/config/vendors';
import type { DetailInput, DetailTable } from './OperationsKit';
import { perPhase } from '@/utils/format';

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

export function channelDetail(): SectionDetail {
  return {
    title: 'Sales Channels',
    intro:
      'Channels are company-wide: every notebook you make ships through the ones you switch on. Each adds reach at an overhead per phase, and some take a cut of every sale.',
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

export function hiringDetail(): SectionDetail {
  return {
    title: 'Hiring',
    intro:
      'One hire at a time. Each candidate trades production output against sell-rate, and each level costs more energy to unlock and more money per phase to keep.',
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

export function vendorDetail(level: 1 | 2): SectionDetail {
  return {
    title: 'Shipping Vendor',
    intro:
      'Vendors are per notebook, not company-wide. A vendor only helps if it actually stocks that notebook\'s market, so coverage matters more than headline cost.',
    inputs: VENDORS.map((v) => {
      const stocked = GENRE_IDS.filter((g) => v.coverage[level][g].quality !== 'none');
      const best = stocked
        .map((g) => v.coverage[level][g])
        .sort((a, b) => b.sellBonus - a.sellBonus)[0];
      return {
        name: v.name,
        description: stocked.length
          ? `Stocks ${stocked.map((g) => GENRES.find((x) => x.id === g)!.name).join(', ')}.`
          : 'Stocks nothing at this level.',
        cost: best ? `${money(perPhase(best.cost))} / phase` : undefined,
        energy: v.energyByLevel[level],
        impacts: 'Active notebook',
        effect: best ? `+${(best.sellBonus * 100).toFixed(1)}%` : 'No coverage',
      };
    }),
    tables: [
      {
        caption: 'Sell bonus by market',
        columns: ['Vendor', ...GENRES.map((g) => g.name)],
        rows: VENDORS.map((v) => [
          v.name,
          ...GENRE_IDS.map((g) => {
            const c = v.coverage[level][g];
            return c.quality === 'none' ? '-' : `+${(c.sellBonus * 100).toFixed(1)}%`;
          }),
        ]),
      },
      {
        caption: 'Cost per phase by market',
        columns: ['Vendor', ...GENRES.map((g) => g.name)],
        rows: VENDORS.map((v) => [
          v.name,
          ...GENRE_IDS.map((g) => {
            const c = v.coverage[level][g];
            return c.quality === 'none' ? '-' : money(c.cost);
          }),
        ]),
      },
    ],
  };
}
