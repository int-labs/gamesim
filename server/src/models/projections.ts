import mongoose, { Document, Schema, Types } from "mongoose";
import type { TeamGlobalInputCosts } from "../sim/calcFinancials";

// ============================================================
// Interfaces
// ============================================================

export interface BizPerf {
  [fieldKey: string]: number;
}

export interface PnL {
  [fieldKey: string]: number;
}

export interface BalanceSheet {
  [fieldKey: string]: number;
}

export interface Cashflow {
  [fieldKey: string]: number;
}

export interface Projection {
  [productKey: string]: {
    [metricKey: string]: number;
  };
}

export interface ProjectionsInterface extends Document {
  simulationId:  Types.ObjectId;
  teamId:        Types.ObjectId;
  roundNumber:   number;
  bizperf:       BizPerf;
  pnl:           PnL;
  balanceSheet:  BalanceSheet;
  cashflow:      Cashflow;
  projections:   Projection;
  /** Team-level global input costs, charged once per round; the what-if twin of `Decision.scoredTeam`. */
  team:          TeamGlobalInputCosts | null;
  createdAt:     Date;
  updatedAt:     Date;
}

// ============================================================
// Schema
// ============================================================

const projectionsSchema = new Schema<ProjectionsInterface>(
  {
    simulationId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Simulation",
      index:    true,
    },
    teamId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "Team",
      index:    true,
    },
    roundNumber: {
      type:     Number,
      required: true,
    },
    bizperf: {
      type:    Schema.Types.Mixed, // { [fieldKey]: value }
      default: null,
    },
    pnl: {
      type:    Schema.Types.Mixed, // { [fieldKey]: value }
      default: null,
    },
    balanceSheet: {
      type:    Schema.Types.Mixed, // { [fieldKey]: value }
      default: null,
    },
    cashflow: {
      type:    Schema.Types.Mixed, // { [fieldKey]: value }
      default: null,
    },
    projections: {
      type:    Schema.Types.Mixed, // { [productKey]: { [metricKey]: value } }
      default: null,
    },
    team: {
      type:    Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// One projection document per team per round per simulation
projectionsSchema.index(
  { simulationId: 1, teamId: 1, roundNumber: 1 },
  { unique: true }
);

// ============================================================
// Model export
// ============================================================

const Projections = mongoose.model<ProjectionsInterface>(
  "Projections",
  projectionsSchema,
  "projections"
);

export default Projections;