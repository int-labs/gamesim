// ── Shared ────────────────────────────────────────────────────
export interface MongoDoc {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Image Assets ──────────────────────────────────────────────
export interface ImageAsset extends MongoDoc {
  image_id: string;
  filename: string;
  url: string;
}

// ── Simulation Types ──────────────────────────────────────────
export interface SimulationTypeOutput {
  source: "pnl" | "bizperf" | "csat" | "custom";
  format: "money" | "percentage" | "number";
  order: number;
  styles?: Record<string, string>;
  [key: string]: unknown;
}

export interface SimulationType extends MongoDoc {
  name: string;
  description?: string;
  yearRange?: Record<string, unknown>;
  pastData?: Record<string, unknown>;
  outputs?: SimulationTypeOutput[];
  brandName?: string;
  reportPlacement?: {
    cashflow?: string;
    pnl?: string;
    balancesheet?: string;
    bizperf?: string;
  };
}

// ── Simulations ───────────────────────────────────────────────
export interface Simulation extends MongoDoc {
  simulationName: string;
  status: "Active" | "Inactive" | "Completed";
  simulationTypeId: string;
  config?: Record<string, unknown>;
  startDate?: string;
  endDate?: string;
  currRounds?: number;
  totalRounds?: number;
}

// ── Rounds ────────────────────────────────────────────────────
export interface Round extends MongoDoc {
  simulationId: string;
  roundNumber: number;
  status: "Pending" | "Active" | "Completed";
  timer?: {
    startDate?: string;
    durationMinutes?: number;
    endDate?: string;
  };
}

// ── Teams ─────────────────────────────────────────────────────
export interface Team extends MongoDoc {
  simulationId: string;
  teamName: string;
  teamLeader?: string;
  score?: number;
  marketShare?: number;
}

// ── Users ─────────────────────────────────────────────────────
export interface User extends MongoDoc {
  email?: string;
  role: "admin" | "operator" | "client" | "team";
  teamId?: string;
  simulationId?: string;
  passkey?: string;
}

// ── Segments ──────────────────────────────────────────────────
export interface SegmentField {
  key: string;
  label: string;
  type: "number" | "percentage" | "currency" | "text";
  order: number;
  required?: boolean;
}

export interface Segment extends MongoDoc {
  simulationTypeId: string;
  name: string;
  description?: string;
  key?: string;
  active: boolean;
  fields?: SegmentField[];
  icon?: string;
  order?: number;
}

// ── Products ──────────────────────────────────────────────────
export interface Product extends MongoDoc {
  simulationTypeId: string;
  segmentId: string;
  productName: string;
  productType?: string;
  active: boolean;
  baseVariables?: Record<string, unknown>;
  fields?: unknown[];
  chargeoffCoefficient?: number;
  useChargeoff?: boolean;
  order?: number;
  chartPosition?: string;
  description?: string;
  displayDescription?: string;
  displayTitle?: string;
  productScopedColumns?: unknown[];
  subProducts?: unknown[];
}

// ── Drivers ───────────────────────────────────────────────────
export interface Driver extends MongoDoc {
  productId: string;
  segmentId: string;
  years?: Record<string, unknown>;
}

// ── Initiatives ───────────────────────────────────────────────
export interface Initiative {
  _id: string;
  name: string;
  details?: string;
  costConsumption?: number;
  energyConsumption?: number;
}

// ── Decisions ─────────────────────────────────────────────────
export interface Decision extends MongoDoc {
  simulationId: string;
  teamId: string;
  roundNumber: number;
  productId: string;
  segmentId: string;
  subProductKey?: string;
  inputs?: Record<string, unknown>;
}

// ── Param List ────────────────────────────────────────────────
export interface ParamList {
  _id: string;
  segmentId: string;
  productId: string;
  parameters?: unknown[];
}

// ── Projections ───────────────────────────────────────────────
export interface Projection extends MongoDoc {
  simulationId: string;
  teamId: string;
  roundNumber: number;
  bizperf?: Record<string, unknown> | null;
  pnl?: Record<string, unknown> | null;
  balanceSheet?: Record<string, unknown> | null;
  cashflow?: Record<string, unknown> | null;
  projections?: Record<string, unknown> | null;
}

// ── Results ───────────────────────────────────────────────────
export interface Result extends MongoDoc {
  simulationId: string;
  teamId: string;
  roundNumber: number;
  productId: string;
  segmentId: string;
  weightedScores?: Record<string, unknown>;
  /** teamId → market FIT: normalised productScore, the ALLOCATION. Renamed
   *  from `marketShares` 2026-09-24; it was never a share of sales. */
  marketFit?: Record<string, unknown>;
}

// ── Base Data ─────────────────────────────────────────────────
export interface BaseData extends MongoDoc {
  simulationTypeId: string;
  constants?: Record<string, unknown>;
  marketData?: Record<string, unknown>;
  marketModel?: Record<string, unknown>;
  esatMarketModel?: Record<string, unknown>;
  csatMarketModel?: Record<string, unknown>;
}

// Round debrief DTOs, mirroring `server/src/services/debriefSeries.ts` by hand.

export interface DebriefTeamRef {
  teamId: string;
  teamName: string;
}

export interface DebriefFieldDto {
  fieldId: string;
  key: string;
  label: string;
  direction: number;
  minValue: number | null;
  maxValue: number | null;
}

export interface DebriefProductDto {
  productId: string;
  productName: string;
  fields: DebriefFieldDto[];
}

export interface DebriefTeamProductDto {
  revenue: number | null;
  customersObtained: number | null;
  unitsSold: number | null;
  produced: number | null;
  inventoryQty: number | null;
  closingStock: number | null;
  /** Normalised productScore, what the decisions EARNED of the market. */
  marketFit: number | null;
  /** `customersObtained / Σ customersObtained`, share of customers WON. */
  marketShare: number | null;
  /** Per-notebook profit. These SUM to the team-level `grossProfit` /
   *  `netProfit`, the server derives those from exactly these keys, so a
   *  breakdown column always totals to its bar. */
  grossProfit: number | null;
  netProfit: number | null;
  /** The server's 0..1 pricing score. !important NOT what the player is shown as
   *  "product score", that is `dynamicPrice` below. */
  productScore: number | null;
  /** The UNNORMALISED product score: what the spec decisions are WORTH, and
   *  the centre the pricing curve pivots on. Runs 0..12.5, so the player
   *  client shows it ×8 for a 0..100 reading. */
  dynamicPrice: number | null;
  sellingPrice: number | null;
  fieldValues: Record<string, number>;
}

export interface DebriefTeamRoundDto {
  energy: number;
  cashOpening: number | null;
  cashClosing: number | null;
  revenue: number | null;
  cogs: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  netProfit: number | null;
  unitsSold: number | null;
  customersObtained: number | null;
  /** Operator-owned FREE TEXT keys, read them from the data, never hardcode. */
  costByCategory: Record<string, number>;
  energyByLever: Record<string, number>;
  byProduct: Record<string, DebriefTeamProductDto>;
}

export interface DebriefRoundDto {
  roundNumber: number;
  teams: Record<string, DebriefTeamRoundDto>;
}

/** A facilitator note on a round. `chartId` is set when the note is a chart's description. */
export interface RoundNote {
  _id: string;
  simulationId: string;
  roundNumber: number;
  teamId: string | null;
  chartId: string | null;
  /** Which instance of that chart, a Product `_id`, or null for the summary.
   *  A note is keyed by the PAIR; there is no fallback between them. */
  productId: string | null;
  title: string;
  body: string;
  pinned: boolean;
}

/** Something a chart may plot, for one simulation type. Mirrors `services/debriefDimensions.ts`. */
export interface DebriefDimension {
  field: string;
  label: string;
  kind: "categorical" | "measure";
  source: "team" | "round" | "product" | "lever" | "cost" | "spec";
}

/** A chart the PLAYER draws itself, the slot is configured here, the drawing
 *  is not. Served by `/debrief-dimensions` so this list is never hardcoded. */
export interface ClientChart {
  key: string;
  label: string;
  note: string;
}

export interface DebriefDimensions {
  categorical: DebriefDimension[];
  measures: DebriefDimension[];
  clientCharts: ClientChart[];
}

/** The gallery shape. `category` is the family, `name` the variant. */
export interface DebriefChartStyle {
  _id: string;
  name: string;
  category: string;
  /** The renderable shape. Sanitised on save, never at render. */
  shape: string;
}

/** A configured chart as stored. Mirrors `models/debriefChart.ts`. */
export interface DebriefChartConfig {
  _id: string;
  simulationTypeId: string;
  name: string;
  category: string;
  order: number;
  /** `each` fans this row out to N + 1 instances, one per notebook plus an
   *  needing its own description. A summary is a separate `overall` row. */
  scope: "overall" | "each";
  chartStyle: DebriefChartStyle | null;
  /** Set = the PLAYER draws it, and the shape and bindings are ignored. */
  clientChart: string | null;
  xAxis: string | null;
  /** !important one chart may plot several measures; the series is then the measure. */
  yAxis: string[];
  grouping: string | null;
}

/** The same chart with a round's copy joined on. `description` and `resolved` exist only here. */
export interface DebriefChart
  extends Omit<DebriefChartConfig, "simulationTypeId" | "chartStyle"> {
  /** !important `_id` REPEATS across a `scope: "each"` chart's instances. This is what
   *  tells them apart, null is the summary. Key by the pair, never `_id`. */
  productId: string | null;
  productName: string | null;
  description: string | null;
  resolved: boolean;
  /** !important IDENTITY ONLY, no `shape`. `/round-debrief` withholds the spec and
   *  ships `svg` instead, so nothing downstream of it holds the grammar. */
  chartStyle: Omit<DebriefChartStyle, "shape"> | null;
  /** The finished picture, drawn by the server. Null when the chart has no
   *  shape, its spec would not render, or it is unresolved and never drawn. */
  svg: string | null;
}

export interface RoundDebrief {
  simulationId: string;
  roundNumber: number;
  /** `null` for an operator, they are not one of the columns. */
  you: string | null;
  teams: DebriefTeamRef[];
  products: DebriefProductDto[];
  rounds: DebriefRoundDto[];
  /** The slide's slots, for the description editor. Sort a copy. */
  charts: DebriefChart[];
}
