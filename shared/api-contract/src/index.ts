// Shared player HTTP + socket contracts used by the notebook player client and
// the gamesim server. Keep this package free of runtime logic — DTOs and event
// payload shapes only — so both sides can import the same types without pulling
// Express/React/Zustand into the other process.
import type { FinlitDecisions, FinlitLine, FinlitPhaseResult } from '@gamesim/finlit-engine';

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

export type RoundStatus = 'Pending' | 'Active' | 'Completed';

export interface BootstrapRound {
  id: string;
  number: number;
  status: RoundStatus;
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

/** Socket.IO events the server emits after committed lifecycle transitions. */
export type GamesimSocketEvent =
  | 'round.started'
  | 'round.completed'
  | 'decision.submitted'
  | 'result.published';

export interface RoundStartedPayload {
  roundNumber: number;
}

export interface RoundCompletedPayload {
  roundId: string;
  roundNumber: number;
}

export interface DecisionSubmittedPayload {
  teamId: string;
  roundId: string;
  roundNumber: number;
  decisionId: string;
}

export interface ResultPublishedPayload {
  roundId: string;
  roundNumber: number;
  teamIds: string[];
}

export type { FinlitDecisions, FinlitLine, FinlitPhaseResult };
