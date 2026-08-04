import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The "active simulation" every scoped page filters by (spec §10.0).
 * Rounds, Teams, Decisions, Results and Projections are meaningless without it,
 * so it lives in one store and is surfaced as a topbar picker.
 */
type ScopeState = {
  simulationId: string | null;
  simulationName: string | null;
  setScope: (id: string | null, name?: string | null) => void;
};

export const useScope = create<ScopeState>()(
  persist(
    (set) => ({
      simulationId: null,
      simulationName: null,
      setScope: (simulationId, simulationName = null) => set({ simulationId, simulationName }),
    }),
    { name: "il-scope" }
  )
);
