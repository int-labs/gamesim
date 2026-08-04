import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Central key factory — every feature's queries.ts imports from here so
 *  invalidation from sockets/mutations can't drift from the read keys. */
export const qk = {
  simulations: () => ["simulations"] as const,
  simulation: (id: string) => ["simulations", id] as const,
  simulationTypes: () => ["simulation-types"] as const,
  simulationType: (id: string) => ["simulation-types", id] as const,
  rounds: (simulationId?: string) => ["rounds", { simulationId }] as const,
  round: (id: string) => ["rounds", id] as const,
  teams: (simulationId?: string) => ["teams", { simulationId }] as const,
  users: () => ["users"] as const,
  segments: (simulationTypeId?: string) => ["segments", { simulationTypeId }] as const,
  products: (simulationTypeId?: string, segmentId?: string) =>
    ["products", { simulationTypeId, segmentId }] as const,
  drivers: (productId?: string) => ["drivers", { productId }] as const,
  globalInputs: (simulationTypeId?: string) => ["global-inputs", { simulationTypeId }] as const,
  globalInputItems: (id: string) => ["global-inputs", id, "items"] as const,
  initiatives: () => ["initiatives"] as const,
  decisions: (simulationId?: string, teamId?: string, roundNumber?: number) =>
    ["decisions", { simulationId, teamId, roundNumber }] as const,
  paramList: () => ["param-list"] as const,
  projections: (simulationId?: string, teamId?: string, roundNumber?: number) =>
    ["projections", { simulationId, teamId, roundNumber }] as const,
  results: (simulationId?: string, roundNumber?: number) =>
    ["results", { simulationId, roundNumber }] as const,
  baseData: (simulationTypeId?: string) => ["base-data", { simulationTypeId }] as const,
  imageAssets: () => ["image-assets"] as const,
};
