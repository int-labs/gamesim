import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  CloudUpload,
  EyeOff,
  MessageSquareText,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import * as api from "@/api";
import { Card } from "@/components/app/card";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Label, Skeleton, StatusDot } from "@/components/ui/primitives";
import { useSimulations, useTeams } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

type Section = {
  _id?: string;
  title: string;
  body: string;
  teamId?: string | null;
  order?: number;
};

type DebriefDoc = {
  status: "draft" | "published";
  publishedAt: string | null;
  title: string;
  intro: string;
  sections: Section[];
};

function DebriefEditor() {
  const qc = useQueryClient();
  const { simulationId } = useScope();
  const { data: teams = [] } = useTeams(simulationId ?? undefined);
  const { data: sims = [] } = useSimulations();
  const simulation = sims.find((s: any) => s._id === simulationId);

  const debrief = useQuery({
    queryKey: ["debrief", simulationId],
    enabled: !!simulationId,
    queryFn: async (): Promise<DebriefDoc | null> => {
      try {
        return (await api.getDebrief(simulationId!)).data as DebriefDoc;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  const [title, setTitle] = React.useState("Debrief");
  const [intro, setIntro] = React.useState("");
  const [sections, setSections] = React.useState<Section[]>([]);

  React.useEffect(() => {
    if (debrief.data) {
      setTitle(debrief.data.title ?? "Debrief");
      setIntro(debrief.data.intro ?? "");
      setSections(debrief.data.sections ?? []);
    }
  }, [debrief.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["debrief", simulationId] });

  const save = useMutation({
    mutationFn: () => api.putDebrief(simulationId!, { title, intro, sections }),
    onSuccess: () => {
      invalidate();
      toast.success("Debrief saved as draft");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.issues?.[0]?.message ?? "Couldn't save the debrief"),
  });

  const publish = useMutation({
    mutationFn: () => api.publishDebrief(simulationId!),
    onSuccess: (res: any) => {
      invalidate();
      const d = res?.data ?? {};
      // Publishing is necessary but not sufficient — say so rather than let an
      // operator assume teams can now read it.
      if (d.visibleToTeams) toast.success("Debrief published — teams can read it now");
      else
        toast.warning("Debrief published, but still hidden", {
          description: `It unlocks when the simulation is Completed (currently ${d.simulationStatus}).`,
        });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Couldn't publish the debrief"),
  });

  const unpublish = useMutation({
    mutationFn: () => api.unpublishDebrief(simulationId!),
    onSuccess: () => {
      invalidate();
      toast.success("Debrief hidden from teams");
    },
  });

  const update = (i: number, patch: Partial<Section>) =>
    setSections((ss) => ss.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setSections((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const isPublished = debrief.data?.status === "published";
  const simCompleted = simulation?.status === "Completed";

  if (debrief.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      {/* Visibility is the thing an operator must never be confused about. */}
      <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
        <div className="flex items-center gap-2">
          <StatusDot tone={isPublished && simCompleted ? "success" : "warning"} />
          <span className="text-[13px] font-semibold text-foreground">
            {isPublished && simCompleted
              ? "Teams can read this"
              : isPublished
                ? "Published, but still hidden"
                : "Draft — not visible to teams"}
          </span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {isPublished && !simCompleted
            ? `A debrief unlocks only when the simulation is Completed — this one is ${simulation?.status ?? "unknown"}.`
            : isPublished
              ? `Published ${relativeTime(debrief.data?.publishedAt ?? null)}`
              : "Save your changes, then publish when you're ready."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isPublished && (
            <Button variant="outline" size="sm" onClick={() => unpublish.mutate()}>
              <EyeOff /> Hide
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save draft
          </Button>
          <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate()}>
            <CloudUpload /> Publish
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="db-title">Title</Label>
            <Input id="db-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-intro">Introduction</Label>
          <Textarea
            id="db-intro"
            className="min-h-24"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="How the simulation went, in a paragraph or two."
          />
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold text-foreground">Sections</h2>
          <Badge tone="count">{sections.length}</Badge>
        </div>

        {sections.length === 0 && (
          <Card padded={false}>
            <EmptyState
              icon={<MessageSquareText />}
              title="No sections yet"
              hint="Add a section per theme — pricing, production, what the winning team did differently."
            />
          </Card>
        )}

        {sections.map((s, i) => (
          <Card key={s._id ?? i} className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Section title</Label>
                <Input
                  value={s.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="What decided the round"
                />
              </div>
              <div className="w-52 space-y-1.5">
                <Label>Visible to</Label>
                <Select
                  value={s.teamId ?? "all"}
                  onValueChange={(v) => update(i, { teamId: v === "all" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teams</SelectItem>
                    {teams.map((t: any) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.teamName} only
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-6 flex flex-col">
                <IconButton label="Move up" size="sm" onClick={() => move(i, -1)}>
                  <ChevronUp />
                </IconButton>
                <IconButton label="Move down" size="sm" onClick={() => move(i, 1)}>
                  <ChevronDown />
                </IconButton>
              </div>
              <IconButton
                label="Remove section"
                size="sm"
                className="mt-6 hover:text-destructive"
                onClick={() => setSections((ss) => ss.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </IconButton>
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                className="min-h-28"
                value={s.body}
                onChange={(e) => update(i, { body: e.target.value })}
              />
            </div>
          </Card>
        ))}

        <Button
          variant="outline"
          onClick={() => setSections((ss) => [...ss, { title: "", body: "", teamId: null }])}
        >
          <Plus /> Add section
        </Button>
      </div>
    </>
  );
}

export default function DebriefPage() {
  const { simulationName } = useScope();
  return (
    <>
      <PageHeader
        title="Debrief"
        subtitle={
          simulationName
            ? `The wrap-up for ${simulationName}. Teams can read it once it's published and the simulation is complete.`
            : "The end-of-simulation wrap-up."
        }
      />
      <ScopeGuard>
        <DebriefEditor />
      </ScopeGuard>
    </>
  );
}
