// V3 FinLit engine — decision + result types. Pure data; no store coupling, so
// the simulator can be unit-verified in isolation.

import type { GenreId, ProductionSpec, ChannelId } from './config';

/** 'self' = bootstrapped/self-funded, 'investor' = took outside investment. Ported verbatim from notebook-pixel-sim src/types/index.ts. */
export type Route = 'self' | 'investor';

/** One notebook line the player produces + sells. */
export interface FinlitLine {
  id: string;
  name: string;
  genre: GenreId;
  spec: ProductionSpec;
  /** Sell price ($/unit). Drives revenue and the price-fit term. */
  price: number;
  /** Channels the line is stocked in (offline/online/retail). */
  channels: ChannelId[];
  /** Stickers spend derived from placed canvas add-on instances × unitCost (0.15). */
  stickersSpend: number;
  /** Shipping vendor engaged for this line (adds sell/prod bonus if it covers the genre). */
  // No `vendor`: vendors are company-wide globalInputs, applied server-side.

  /**
   * Units/day the player commits to producing (the LP2 "how much to produce"
   * lever). Actual output = min(target, capacity). Undefined = run at full
   * capacity. Producing to demand avoids both overstock and stockout.
   */
  targetPerDay?: number;
  /** Finished units currently in inventory for this line. */
  finished: number;
}

/** Company-wide decisions in force for a phase. */
export interface FinlitDecisions {
  route: Route;
  /** All hired candidates for this phase (up to maxSelections from globalInputs). */
  hires: { candidate: string; level: 1 | 2 | 3 | 4 }[];
  /** Direct demand multiplier from marketing globalInput options[selectedStepKey] (1.0 = no spend). */
  marketingMult: number;
  /** Global demand/sell multipliers from key-decision cards (e.g. +15% demand). */
  demandMult: number; // default 1
  sellMult: number; // default 1
}

/** One day of simulated results for the whole portfolio. */
export interface FinlitDaySnapshot {
  day: number;
  produced: number;
  sold: number;
  revenue: number;
  cogs: number;
  opex: number;
  channelCost: number;
  netCash: number; // revenue − cogs − opex − channelCost
  finished: number; // total finished inventory after the day
  demandUnits: number; // total units demanded across lines/channels
  stockout: boolean; // any line left demand unmet this day
  overstock: boolean; // any line sitting on excess inventory this day
}

/** Per-line rolled-up result for a phase. */
export interface FinlitLineResult {
  lineId: string;
  genre: GenreId;
  produced: number;
  sold: number;
  demand: number;
  revenue: number;
  cogs: number;
  endingInventory: number;
  /** Fraction of this genre's addressable slice the line captured (market share proxy). */
  shareCaptured: number;
}

/** Phase-level P&L + operational summary. */
export interface FinlitPhaseResult {
  phase: number;
  days: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number; // hiring wage + marketing + vendor
  channelCost: number; // maintenance + consignment + inventory cost
  netProfit: number;
  producedTotal: number;
  soldTotal: number;
  demandTotal: number;
  endingInventory: number;
  stockoutDays: number;
  overstockDays: number;
  marketShare: number; // portfolio-weighted share of targeted genres
  series: FinlitDaySnapshot[];
  byLine: FinlitLineResult[];
}
