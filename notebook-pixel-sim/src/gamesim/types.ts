// Response/request shapes for the gamesim backend's player API. Kept as a
// standalone contract module (not derived from gamesim's own TS — the two
// repos don't share a package), mirrored by hand against
// gamesim/server/src/controllers/playerControllers.ts.
import type { FinlitDecisions, FinlitLine, FinlitPhaseResult } from '@/engine/finlit/types';

export interface BootstrapUser {
  id: string;
}
export interface BootstrapTeam {
  id: string;
  name: string;
}
export interface BootstrapSimulation {
  id: string;
  type: string;
  status: string;
}
export interface BootstrapRound {
  id: string;
  number: number;
  status: 'Pending' | 'Active' | 'Completed';
}
export interface BootstrapPermissions {
  canEditDecision: boolean;
  canSubmitDecision: boolean;
  canViewResult: boolean;
}
export interface BootstrapResponse {
  user: BootstrapUser;
  team: BootstrapTeam;
  simulation: BootstrapSimulation;
  round: BootstrapRound | null;
  permissions: BootstrapPermissions;
}

export type DecisionStatus = 'draft' | 'submitted' | 'locked';

export interface FinlitDecisionPayload {
  lines: FinlitLine[];
  decisions: FinlitDecisions;
}

export interface TeamRoundDecisionDto {
  id: string;
  simulationId: string;
  roundId: string;
  teamId: string;
  engineKey: string;
  status: DecisionStatus;
  payload: FinlitDecisionPayload;
  version: number;
  configVersion: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewResponse {
  engineVersion: string;
  configVersion: string;
  decisionVersion: number | null;
  result: FinlitPhaseResult;
}

export interface TeamRoundResultDto {
  id: string;
  simulationId: string;
  roundId: string;
  roundNumber: number;
  teamId: string;
  engineKey: string;
  engineVersion: string;
  configVersion: string;
  decisionId: string;
  payload: FinlitPhaseResult;
  finalizedAt: string;
}

export interface VersionConflictBody {
  message: string;
  currentVersion: number;
  current: TeamRoundDecisionDto;
}
