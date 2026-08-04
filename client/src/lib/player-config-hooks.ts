import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/api";

/**
 * PlayerConfig — the operator-editable catalog behind the notebook player.
 *
 * The console always works against the DRAFT (`?draft=true`); the player only
 * ever reads the published snapshot. That separation is the point: an operator
 * can rebuild a catalog mid-classroom and nothing reaches players until they
 * press Publish.
 */

export type ConfigIssue = { path: string; message: string };

export type PlayerConfigDoc = {
  simulationTypeId: string;
  version: number;
  status?: "draft" | "published";
  publishedAt: string | null;
  draft: boolean;
  config: Record<string, any>;
};

const key = (typeId?: string) => ["player-config", typeId] as const;

export function usePlayerConfig(simulationTypeId?: string) {
  return useQuery({
    queryKey: key(simulationTypeId),
    enabled: !!simulationTypeId,
    // Always the draft — this is the editing surface.
    queryFn: async (): Promise<PlayerConfigDoc | null> => {
      try {
        const res = await api.getPlayerConfig(simulationTypeId!, true);
        return res.data as PlayerConfigDoc;
      } catch (e: any) {
        // 404 is a supported state: no config yet, player uses bundled defaults.
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });
}

/** Published snapshot — what players actually see. Used for the diff badge. */
export function usePublishedPlayerConfig(simulationTypeId?: string) {
  return useQuery({
    queryKey: [...key(simulationTypeId), "published"],
    enabled: !!simulationTypeId,
    queryFn: async (): Promise<PlayerConfigDoc | null> => {
      try {
        const res = await api.getPlayerConfig(simulationTypeId!);
        return res.data as PlayerConfigDoc;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });
}

/** Server-side zod issues, surfaced inline rather than as a toast blob. */
function extractIssues(e: any): ConfigIssue[] {
  const issues = e?.response?.data?.issues;
  return Array.isArray(issues) ? issues : [];
}

export function useSaveSection(simulationTypeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ section, value }: { section: string; value: unknown }) => {
      const res = await api.patchPlayerConfigSection(simulationTypeId!, section, value);
      return res.data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: key(simulationTypeId) });
      const warnings: ConfigIssue[] = data?.warnings ?? [];
      if (warnings.length) {
        toast.warning(`Saved “${vars.section}” with ${warnings.length} warning(s)`, {
          description: warnings[0]?.message,
        });
      } else {
        toast.success(`Saved ${vars.section}`);
      }
    },
    onError: (e: any) => {
      const issues = extractIssues(e);
      toast.error(
        issues.length
          ? `${issues.length} problem(s) — nothing was saved`
          : e?.response?.data?.message ?? "Couldn't save this section"
      );
    },
  });
}

export function usePublishConfig(simulationTypeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note?: string) => {
      const res = await api.publishPlayerConfig(simulationTypeId!, note);
      return res.data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: key(simulationTypeId) });
      toast.success(
        data?.changed ? `Published version ${data.version}` : "Already published — no changes"
      );
    },
    onError: (e: any) => {
      const issues = extractIssues(e);
      toast.error(e?.response?.data?.message ?? "Couldn't publish", {
        description: issues[0]?.message,
      });
    },
  });
}

export function useRevertConfig(simulationTypeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.revertPlayerConfig(simulationTypeId!);
      return res.data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: key(simulationTypeId) });
      toast.success(data?.message ?? "Draft reverted");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't revert the draft"),
  });
}
