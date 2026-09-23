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

// ── Round debrief (the player's limbo slide, read-only for the operator) ──
// Mirrors `server/src/services/debriefSeries.ts` by hand, like every shape in
// this file. Numbers and RAW BOUNDS only — the server does no 0..1
// normalisation, because the player client owns those formulas.

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
  /** Normalised productScore — what the decisions EARNED of the market. */
  marketFit: number | null;
  /** `customersObtained / Σ customersObtained` — share of customers WON. */
  marketShare: number | null;
  productScore: number | null;
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
  /** Operator-owned FREE TEXT keys — read them from the data, never hardcode. */
  costByCategory: Record<string, number>;
  energyByLever: Record<string, number>;
  byProduct: Record<string, DebriefTeamProductDto>;
}

export interface DebriefRoundDto {
  roundNumber: number;
  teams: Record<string, DebriefTeamRoundDto>;
}

export interface RoundDebrief {
  simulationId: string;
  roundNumber: number;
  /** `null` for an operator — they are not one of the columns. */
  you: string | null;
  teams: DebriefTeamRef[];
  products: DebriefProductDto[];
  rounds: DebriefRoundDto[];
}
