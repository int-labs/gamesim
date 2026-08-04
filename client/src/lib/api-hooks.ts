import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/api";
import { qk } from "@/lib/query-client";
import { useScope } from "@/lib/scope-store";

/**
 * Query/mutation layer over the existing axios wrapper. `api.ts` itself is
 * untouched — the spec keeps it as the single endpoint definition (§0).
 *
 * Two server quirks are absorbed here so pages never see them:
 *  - GET /teams returns `{data:[...]}` while every other list returns a bare
 *    array, and it ignores its simulationId filter (getAllTeams is wired, not
 *    getTeams) — so we unwrap AND filter client-side.
 *  - GET /base-data 404s when empty instead of returning [] (see the
 *    provision-notebook script comment) — treated as empty, not an error.
 */

const list = <T,>(p: Promise<{ data: any }>) =>
  p.then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d as T[];
    if (d && Array.isArray(d.data)) return d.data as T[];
    return [] as T[];
  });

/* ------------------------------------------------------------- Simulations */

export function useSimulations() {
  return useQuery({ queryKey: qk.simulations(), queryFn: () => list<any>(api.getSimulations()) });
}

export function useCreateSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.createSimulation(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.simulations() });
      toast.success("Simulation created");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't create the simulation"),
  });
}

export function useDeleteSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSimulation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.simulations() });
      toast.success("Simulation deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the simulation"),
  });
}

/* -------------------------------------------------------- Simulation types */

export function useSimulationTypes() {
  return useQuery({
    queryKey: qk.simulationTypes(),
    queryFn: () => list<any>(api.getSimulationTypes()),
  });
}

/* ------------------------------------------------------------------ Rounds */

export function useRounds(simulationId?: string) {
  return useQuery({
    queryKey: qk.rounds(simulationId),
    queryFn: () => list<any>(api.getRounds(simulationId)),
    enabled: !!simulationId,
  });
}

export function useCreateRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.createRound(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rounds"] });
      toast.success("Round created");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't create the round"),
  });
}

export function useUpdateRoundStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: string; timer?: any }) =>
      api.patchRound(id, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["rounds"] });
      toast.success(
        vars.status === "Active"
          ? "Round started"
          : vars.status === "Completed"
            ? "Round closed"
            : "Round updated"
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't update the round"),
  });
}

export function useDeleteRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRound(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rounds"] });
      toast.success("Round deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the round"),
  });
}

/** Recalculate an Active round in place, leaving it open. */
export function useCalculateRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roundId: string) => api.calculateRound(roundId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["projections"] });
      qc.invalidateQueries({ queryKey: ["rounds"] });
    },
  });
}

/**
 * The normal way to finish a round: close + calculate + advance the simulation,
 * atomically. Replaces the old two-step flow, where closing first left the
 * round permanently uncalculable.
 */
export function useEndRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roundId, skipCalculation }: { roundId: string; skipCalculation?: boolean }) =>
      api.endRound(roundId, { skipCalculation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["projections"] });
      qc.invalidateQueries({ queryKey: ["rounds"] });
      qc.invalidateQueries({ queryKey: qk.simulations() });
    },
  });
}

/* ------------------------------------------------------------------- Teams */

export function useTeams(simulationId?: string) {
  return useQuery({
    queryKey: qk.teams(simulationId),
    queryFn: async () => {
      const all = await list<any>(api.getTeams(simulationId));
      // The endpoint ignores its filter — narrow it here.
      return simulationId ? all.filter((t) => t.simulationId === simulationId) : all;
    },
  });
}

/**
 * A Team is the competing entity; a `role:"team"` User is the credential that
 * lets it in. Creating only the Team leaves a team that CANNOT LOG IN, so this
 * chains both — mirroring how stratagem does it in one transaction
 * (simulationControllers.ts: save Team → generate slug passkey → save User).
 *
 * `POST /users` derives simulationId from the teamId and generates the unique
 * passkey server-side. It requires a password even for passkey users, which is
 * never used on this path (login-passkey only matches on `passkey`), so we send
 * an unguessable random value to make the password route effectively dead.
 */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { simulationId: string; teamName: string; teamLeader?: string }) => {
      const teamRes = await api.createTeam(body);
      const team = (teamRes.data as any)?.data ?? teamRes.data;

      try {
        const userRes = await api.createUser({
          role: "team",
          teamId: team._id,
          password: crypto.randomUUID(),
        });
        return { team, user: userRes.data as any, loginIssued: true as const };
      } catch (e: any) {
        // The team exists but has no way in — say so plainly rather than
        // reporting success and letting it fail at the player's login screen.
        return {
          team,
          user: null,
          loginIssued: false as const,
          loginError: e?.response?.data?.message ?? "Couldn't issue a pass key",
        };
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: qk.users() });
      if (res.loginIssued) toast.success(`${res.team.teamName} created with a pass key`);
      else
        toast.warning(`${res.team.teamName} created, but it has no pass key yet`, {
          description: "Issue one from the team's row menu before the round opens.",
        });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't create the team"),
  });
}

/** Repairs a team that exists without a login (or adds a second credential). */
export function useIssueTeamPasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) =>
      api.createUser({ role: "team", teamId, password: crypto.randomUUID() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users() });
      toast.success("Pass key issued");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't issue a pass key"),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the team"),
  });
}

/* ------------------------------------------------------------------- Users */

export function useUsers() {
  return useQuery({ queryKey: qk.users(), queryFn: () => list<any>(api.getUsers()) });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users() });
      toast.success("User deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the user"),
  });
}

export function useRegeneratePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.regeneratePasskey(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: qk.users() });
      // Show the new key: rotating one the operator can't read leaves the team
      // locked out until someone goes looking for it.
      const next = res?.data?.passkey;
      toast.success("Pass key regenerated", {
        description: next ? `The new key is ${next}. The old one no longer works.` : undefined,
      });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't regenerate the passkey"),
  });
}

/* ---------------------------------------------------- Catalog collections */

/**
 * `/products` and `/segments` REQUIRE simulationTypeId — called bare they
 * return `{message}`, not an empty array. So resolve the type from the scoped
 * simulation (falling back to the first type) and never query without one.
 */
export function useActiveSimulationTypeId(): string | undefined {
  const { simulationId } = useScope();
  const { data: sims = [] } = useSimulations();
  const { data: types = [] } = useSimulationTypes();

  const scoped = sims.find((s: any) => s._id === simulationId)?.simulationTypeId;
  return scoped ?? types[0]?._id;
}

export function useSegments(simulationTypeId?: string) {
  const fallback = useActiveSimulationTypeId();
  const typeId = simulationTypeId ?? fallback;
  return useQuery({
    queryKey: qk.segments(typeId),
    queryFn: () => list<any>(api.getSegments(typeId)),
    enabled: !!typeId,
  });
}

export function useProducts(simulationTypeId?: string, segmentId?: string) {
  const fallback = useActiveSimulationTypeId();
  const typeId = simulationTypeId ?? fallback;
  return useQuery({
    queryKey: qk.products(typeId, segmentId),
    queryFn: () => list<any>(api.getProducts(typeId, segmentId)),
    enabled: !!typeId,
  });
}

export function useInitiatives() {
  return useQuery({ queryKey: qk.initiatives(), queryFn: () => list<any>(api.getInitiatives()) });
}



/* --------------------------------------------------- Round-scoped results */

export function useDecisions(simulationId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: qk.decisions(simulationId, undefined, roundNumber),
    queryFn: () => list<any>(api.getDecisions(simulationId, undefined, roundNumber)),
    enabled: !!simulationId,
  });
}

export function useDeleteDecisionsByRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ simulationId, roundNumber }: { simulationId: string; roundNumber: number }) =>
      api.deleteDecisionsByRound(simulationId, roundNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success("Round decisions deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the decisions"),
  });
}

export function useResults(simulationId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: qk.results(simulationId, roundNumber),
    queryFn: () => list<any>(api.getResults(simulationId, roundNumber)),
    enabled: !!simulationId,
  });
}

export function useProjections(simulationId?: string, teamId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: qk.projections(simulationId, teamId, roundNumber),
    queryFn: () => list<any>(api.getProjections(simulationId, teamId, roundNumber)),
    enabled: !!simulationId && !!teamId,
  });
}

/* ------------------------------------------------------------ Reference data */

/** `/drivers` 400s without productId, so it is always queried per product. */
export function useDrivers(productId?: string) {
  return useQuery({
    queryKey: qk.drivers(productId),
    queryFn: () => list<any>(api.getDrivers(productId)),
    enabled: !!productId,
  });
}

/**
 * Every team's filed run outcome.
 *
 * Distinct from `useResults` (how teams compared) and `useCohortProjections`
 * (the server's financials) — this is what the PLAYER's own engine produced,
 * which is the only place the design PDF's rubric actually exists.
 */
export function useRunReports(simulationId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: ["run-reports", simulationId, roundNumber],
    queryFn: () => list<any>(api.getRunReports(simulationId!, roundNumber)),
    enabled: !!simulationId,
  });
}

/**
 * Live progress for every team in the open round.
 *
 * Polled fast: this is the only view that answers "who needs help right now",
 * and a facilitator reads it while walking the room.
 */
export function useTeamProgress(simulationId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: ["team-progress", simulationId, roundNumber],
    queryFn: () => list<any>(api.getTeamProgress(simulationId!, roundNumber)),
    enabled: !!simulationId,
    refetchInterval: 15_000,
  });
}

/**
 * Every team's projections for a simulation.
 *
 * `teamId` is deliberately omitted: the route now scopes a TEAM token to its
 * own row and lets staff read the whole cohort, which is what the debrief's
 * charts are built from. (It previously took `teamId` straight from the query
 * with no role check, so any team could read a rival's P&L.)
 */
export function useCohortProjections(simulationId?: string) {
  return useQuery({
    queryKey: ["projections", "cohort", simulationId],
    queryFn: () => list<any>(api.getProjections(simulationId!)),
    enabled: !!simulationId,
  });
}

export function useGlobalInputs(simulationTypeId?: string) {
  const fallback = useActiveSimulationTypeId();
  const typeId = simulationTypeId ?? fallback;
  return useQuery({
    queryKey: qk.globalInputs(typeId),
    queryFn: () => list<any>(api.getGlobalInputs(typeId)),
    enabled: !!typeId,
  });
}

export function useParamLists() {
  return useQuery({ queryKey: qk.paramList(), queryFn: () => list<any>(api.getParamLists()) });
}

/**
 * Returns the single base-data document (or null). Two quirks handled here:
 * the endpoint responds with a bare OBJECT rather than a list, and it 404s
 * when empty instead of returning nothing.
 */
export function useBaseData(simulationTypeId?: string) {
  const fallback = useActiveSimulationTypeId();
  const typeId = simulationTypeId ?? fallback;
  return useQuery({
    queryKey: qk.baseData(typeId),
    queryFn: async () => {
      try {
        const res = await api.getBaseData(typeId);
        const d = res.data;
        if (Array.isArray(d)) return (d[0] ?? null) as any;
        return (d && typeof d === "object" && d._id ? d : null) as any;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!typeId,
  });
}

export function useImageAssets() {
  return useQuery({ queryKey: qk.imageAssets(), queryFn: () => list<any>(api.getImageAssets()) });
}

/** Which storage backend is live, and whether uploads survive a redeploy. */
export function useStorageStatus() {
  return useQuery({
    queryKey: ["image-assets", "storage"],
    queryFn: async () => (await api.getStorageStatus()).data as
      | { driver: "supabase" | "local"; durable: boolean; message: string }
      | undefined,
    staleTime: Infinity, // decided once at server boot; it cannot change under us
  });
}

/**
 * Uploads one file per request — the API takes a single `image` field, and one
 * request per file means a rejected file reports its own reason instead of
 * failing a whole batch.
 */
export function useUploadImageAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const results = await Promise.allSettled(
        files.map((file) => {
          const fd = new FormData();
          fd.append("image", file);
          return api.uploadImageAsset(fd);
        })
      );
      const failed = results
        .map((r, i) => ({ r, name: files[i].name }))
        .filter((x) => x.r.status === "rejected")
        .map((x) => ({
          name: x.name,
          message:
            (x.r as PromiseRejectedResult).reason?.response?.data?.message ?? "Upload failed",
        }));
      return { uploaded: results.length - failed.length, failed };
    },
    onSuccess: ({ uploaded, failed }) => {
      qc.invalidateQueries({ queryKey: qk.imageAssets() });
      if (uploaded > 0) toast.success(`${uploaded} image${uploaded === 1 ? "" : "s"} uploaded`);
      // Name every rejection: "3 of 5 failed" leaves the operator guessing which.
      for (const f of failed) toast.error(`${f.name}: ${f.message}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't upload"),
  });
}

export function useDeleteImageAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteImageAsset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.imageAssets() });
      toast.success("Image deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete the image"),
  });
}

/* ────────────────────────── Collection CRUD ──────────────────────────────
 * The console is CRUD over each collection, so these follow one shape:
 * mutate → invalidate the list → toast. Errors surface the server's own
 * message, which is usually specific ("Segment name already exists") and far
 * more useful than a generic failure string.
 * ------------------------------------------------------------------------ */

function crudToast(verb: string, noun: string) {
  return {
    ok: () => toast.success(`${noun} ${verb}`),
    fail: (e: any) =>
      toast.error(e?.response?.data?.message ?? `Couldn't ${verb.replace(/d$/, "")} the ${noun}`),
  };
}

/** create / update / delete for one collection, sharing a query key. */
function crud<TCreate extends object, TUpdate extends object>(cfg: {
  noun: string;
  key: readonly unknown[];
  create: (data: TCreate) => Promise<any>;
  update?: (id: string, data: TUpdate) => Promise<any>;
  remove: (id: string) => Promise<any>;
  /** Extra keys to refresh — e.g. deleting a product changes its fields. */
  also?: readonly unknown[][];
}) {
  const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: cfg.key });
    for (const k of cfg.also ?? []) qc.invalidateQueries({ queryKey: k });
  };

  return {
    useCreate() {
      const qc = useQueryClient();
      const t = crudToast("created", cfg.noun);
      return useMutation({
        mutationFn: (data: TCreate) => cfg.create(data),
        onSuccess: () => { invalidate(qc); t.ok(); },
        onError: t.fail,
      });
    },
    useUpdate() {
      const qc = useQueryClient();
      const t = crudToast("saved", cfg.noun);
      return useMutation({
        mutationFn: ({ id, data }: { id: string; data: TUpdate }) => {
          if (!cfg.update) throw new Error(`${cfg.noun} cannot be edited.`);
          return cfg.update(id, data);
        },
        onSuccess: () => { invalidate(qc); t.ok(); },
        onError: t.fail,
      });
    },
    useDelete() {
      const qc = useQueryClient();
      const t = crudToast("deleted", cfg.noun);
      return useMutation({
        mutationFn: (id: string) => cfg.remove(id),
        onSuccess: () => { invalidate(qc); t.ok(); },
        onError: t.fail,
      });
    },
  };
}

export const productCrud = crud({
  noun: "Product",
  key: ["products"],
  create: (d) => api.createProduct(d),
  update: (id, d) => api.updateProduct(id, d),
  remove: (id) => api.deleteProduct(id),
  also: [["product-fields"]],
});

export const segmentCrud = crud({
  noun: "Segment",
  key: ["segments"],
  create: (d) => api.createSegment(d),
  update: (id, d) => api.updateSegment(id, d),
  remove: (id) => api.deleteSegment(id),
});

export const simulationTypeCrud = crud({
  noun: "Simulation type",
  key: ["simulation-types"],
  create: (d) => api.createSimulationType(d),
  update: (id, d) => api.updateSimulationType(id, d),
  remove: (id) => api.deleteSimulationType(id),
});

export const globalInputCrud = crud({
  noun: "Global input",
  key: ["global-inputs"],
  create: (d) => api.createGlobalInput(d),
  update: (id, d) => api.updateGlobalInput(id, d),
  remove: (id) => api.deleteGlobalInput(id),
});

/**
 * Simulations were create-and-delete only: an operator could start a cohort but
 * never rename it, change its status, or move its dates. `updateSimulation`
 * existed on the server and in api.ts the whole time with nothing calling it.
 */
export const simulationCrud = crud({
  noun: "Simulation",
  key: ["simulations"],
  create: (d) => api.createSimulation(d),
  update: (id, d) => api.updateSimulation(id, d),
  remove: (id) => api.deleteSimulation(id),
});

/**
 * Param lists were treated as read-only on the strength of a bad file-name
 * guess — `paramRoutes.ts` is mounted at `/param-list` with POST, DELETE and a
 * PATCH that upserts ONE parameter at a time, keyed by `paramCode`.
 */
export const paramListCrud = {
  ...crud({
    noun: "Param list",
    key: ["param-lists"],
    create: (d) => api.createParamList(d),
    remove: (id) => api.deleteParamList(id),
  }),

  /** PATCH /param-list/:id/parameters — upsert a single parameter by code. */
  useUpsertParameter() {
    const qc = useQueryClient();
    const t = crudToast("saved", "Parameter");
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) =>
        api.updateParamListParameters(id, data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["param-lists"] });
        t.ok();
      },
      onError: t.fail,
    });
  },
};

export const teamCrud = crud({
  noun: "Team",
  key: ["teams"],
  create: (d) => api.createTeam(d),
  update: (id, d) => api.updateTeam(id, d),
  remove: (id) => api.deleteTeam(id),
});

export const driverCrud = crud({
  noun: "Driver",
  key: ["drivers"],
  create: (d) => api.createDriver(d),
  update: (id, d) => api.updateDriver(id, d),
  remove: (id) => api.deleteDriver(id),
});

export const initiativeCrud = crud({
  noun: "Initiative",
  key: ["initiatives"],
  create: (d) => api.createInitiative(d),
  update: (id, d) => api.updateInitiative(id, d),
  remove: (id) => api.deleteInitiative(id),
});

/**
 * Decision fields are nested under a product (`/products/:id/fields/:fieldId`),
 * so they need a product id alongside the field id and can't use `crud()`,
 * whose whole shape assumes a flat `/collection/:id`. Same toasts, same
 * invalidation — products carry `fields[]` inline, so both keys must refresh.
 */
const fieldKeys = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["products"] });
  qc.invalidateQueries({ queryKey: ["product-fields"] });
};

export const productFieldCrud = {
  useCreate() {
    const qc = useQueryClient();
    const t = crudToast("created", "Decision field");
    return useMutation({
      mutationFn: ({ productId, data }: { productId: string; data: any }) =>
        api.createProductField(productId, data),
      onSuccess: () => { fieldKeys(qc); t.ok(); },
      onError: t.fail,
    });
  },
  useUpdate() {
    const qc = useQueryClient();
    const t = crudToast("saved", "Decision field");
    return useMutation({
      mutationFn: ({ productId, fieldId, data }: { productId: string; fieldId: string; data: any }) =>
        api.updateProductField(productId, fieldId, data),
      onSuccess: () => { fieldKeys(qc); t.ok(); },
      onError: t.fail,
    });
  },
  useDelete() {
    const qc = useQueryClient();
    const t = crudToast("deleted", "Decision field");
    return useMutation({
      mutationFn: ({ productId, fieldId }: { productId: string; fieldId: string }) =>
        api.deleteProductField(productId, fieldId),
      onSuccess: () => { fieldKeys(qc); t.ok(); },
      onError: t.fail,
    });
  },
};
