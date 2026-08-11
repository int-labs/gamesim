import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Pin, Plus, Save, Trash2, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import * as api from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/overlays";
import { Label, Switch } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RoundNote {
  _id: string;
  simulationId: string;
  roundNumber: number;
  teamId?: string | null;
  title: string;
  body?: string;
  imageAssetId?: string | null;
  pinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TeamOption {
  _id: string;
  teamName?: string;
  name?: string;
}

const notesKey = (simulationId?: string, roundNumber?: number) =>
  ["round-notes", { simulationId, roundNumber }] as const;

function unwrapNotes(response: { data: unknown }): RoundNote[] {
  if (Array.isArray(response.data)) return response.data as RoundNote[];
  const body = response.data as { data?: unknown } | null;
  return body && Array.isArray(body.data) ? (body.data as RoundNote[]) : [];
}

/** Fetches the general notes and any team-targeted notes visible in this scope. */
export function useRoundNotes(simulationId?: string, roundNumber?: number) {
  return useQuery({
    queryKey: notesKey(simulationId, roundNumber),
    queryFn: () =>
      simulationId
        ? api.getRoundNotes(simulationId, roundNumber).then(unwrapNotes)
        : Promise.resolve([] as RoundNote[]),
    enabled: !!simulationId,
  });
}

function noteTeamLabel(note: RoundNote, teamName?: (id: string) => string) {
  return note.teamId && teamName ? teamName(note.teamId) : "Everyone";
}

export function NotesList({
  notes,
  teamName,
  onEdit,
  onDelete,
}: {
  notes: RoundNote[];
  teamName?: (id: string) => string;
  onEdit?: (note: RoundNote) => void;
  onDelete?: (note: RoundNote) => void;
}) {
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <article
          key={note._id}
          className={cn(
            "rounded-lg border border-border bg-card p-4",
            note.pinned && "border-primary/35 bg-accent/30"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-sans text-[14px] font-semibold text-foreground">{note.title}</h3>
                {note.pinned && (
                  <Badge tone="brand" size="sm">
                    <Pin className="size-3" /> Pinned
                  </Badge>
                )}
                <Badge tone={note.teamId ? "info" : "outline"} size="sm">
                  {note.teamId ? <Users className="size-3" /> : null}
                  {noteTeamLabel(note, teamName)}
                </Badge>
              </div>
              {note.body && (
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-body">{note.body}</p>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                {relativeTime(note.updatedAt ?? note.createdAt)}
              </p>
            </div>
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-1">
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    aria-label={`Edit ${note.title}`}
                    onClick={() => onEdit(note)}
                  >
                    <Pencil />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    className="text-destructive hover:bg-destructive-tint hover:text-destructive"
                    aria-label={`Delete ${note.title}`}
                    onClick={() => onDelete(note)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

type NoteDraft = {
  title: string;
  body: string;
  teamId: string;
  pinned: boolean;
};

const emptyDraft = (): NoteDraft => ({ title: "", body: "", teamId: "", pinned: false });

export function RoundNotesDialog({
  open,
  onOpenChange,
  simulationId,
  roundNumber,
  teams = [],
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  simulationId?: string;
  roundNumber?: number;
  teams?: TeamOption[];
}) {
  const query = useRoundNotes(simulationId, roundNumber);
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<NoteDraft>(emptyDraft);
  const [editing, setEditing] = React.useState<RoundNote | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<RoundNote | null>(null);
  const [touched, setTouched] = React.useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["round-notes"] });

  const create = useMutation({
    mutationFn: (body: object) => api.createRoundNote(body),
    onSuccess: async () => {
      await invalidate();
      toast.success("Note added");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? "Couldn't add the note"),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.updateRoundNote(id, body),
    onSuccess: async () => {
      await invalidate();
      toast.success("Note updated");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? "Couldn't update the note"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRoundNote(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Note deleted");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? "Couldn't delete the note"),
  });

  React.useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft());
    setEditing(null);
    setTouched(false);
  }, [open, roundNumber]);

  const set = <K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const startEdit = (note: RoundNote) => {
    setEditing(note);
    setDraft({
      title: note.title,
      body: note.body ?? "",
      teamId: note.teamId ?? "",
      pinned: !!note.pinned,
    });
    setTouched(false);
  };

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditing(null);
    setTouched(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!draft.title.trim() || !simulationId || roundNumber == null) return;

    const body = {
      roundNumber,
      teamId: draft.teamId || null,
      title: draft.title.trim(),
      body: draft.body,
      pinned: draft.pinned,
    };

    if (editing) {
      await update.mutateAsync({ id: editing._id, body });
    } else {
      await create.mutateAsync({ simulationId, ...body });
    }
    resetForm();
  };

  const teamName = React.useCallback(
    (id: string) => {
      const team = teams.find((candidate) => String(candidate._id) === String(id));
      return team?.teamName ?? team?.name ?? "One team";
    },
    [teams]
  );

  const isSaving = create.isPending || update.isPending;
  const titleError = touched && !draft.title.trim();
  const canWrite = !!simulationId && roundNumber != null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) resetForm();
          onOpenChange(value);
        }}
      >
        <DialogContent width="max-w-[720px]">
          <DialogTitle>
            {roundNumber != null ? `Round ${roundNumber} notes` : "Round notes"}
          </DialogTitle>
          <DialogDescription>
            Leave context for the facilitator or feedback targeted to one team. General notes are visible to everyone.
          </DialogDescription>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <section className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">Notes on this round</h3>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {query.data?.length ?? 0} {query.data?.length === 1 ? "note" : "notes"}
                  </p>
                </div>
                {query.data && query.data.length > 0 && (
                  <Badge tone="count">{query.data.length}</Badge>
                )}
              </div>

              {query.isLoading ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Loading notes…
                </div>
              ) : query.isError ? (
                <EmptyState
                  kind="error"
                  title="Couldn't load notes"
                  hint="The API may be unavailable."
                  action={
                    <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                      Try again
                    </Button>
                  }
                />
              ) : (query.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<Pin />}
                  title="No notes yet"
                  hint="Add the first piece of context for this round."
                />
              ) : (
                <NotesList
                  notes={query.data ?? []}
                  teamName={teamName}
                  onEdit={startEdit}
                  onDelete={setPendingDelete}
                />
              )}
            </section>

            <form onSubmit={submit} noValidate className="rounded-lg border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-2">
                {editing ? <Save className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
                <h3 className="text-[13px] font-semibold text-foreground">
                  {editing ? "Edit note" : "Add a note"}
                </h3>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="round-note-title">Title</Label>
                  <Input
                    id="round-note-title"
                    value={draft.title}
                    error={titleError}
                    maxLength={120}
                    placeholder="What should the room remember?"
                    onChange={(event) => set("title", event.target.value)}
                  />
                  {titleError && <p className="text-[11.5px] text-destructive">A note needs a title.</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="round-note-body">Context</Label>
                  <Textarea
                    id="round-note-body"
                    value={draft.body}
                    maxLength={5000}
                    rows={5}
                    placeholder="Add the why behind the result…"
                    onChange={(event) => set("body", event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="round-note-team">Audience</Label>
                  <select
                    id="round-note-team"
                    value={draft.teamId}
                    onChange={(event) => set("teamId", event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Everyone</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>
                        {team.teamName ?? team.name ?? team._id}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11.5px] leading-4 text-muted-foreground">
                    Team notes stay private to that team; general notes are visible to everyone.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
                  <div>
                    <Label htmlFor="round-note-pinned">Pin note</Label>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">Keep it at the top of the list.</p>
                  </div>
                  <Switch
                    id="round-note-pinned"
                    checked={draft.pinned}
                    onCheckedChange={(value) => set("pinned", value)}
                  />
                </div>
              </div>

              {!canWrite && (
                <p className="mt-4 text-[11.5px] leading-4 text-warning">
                  Select a simulation and round before adding notes.
                </p>
              )}

              <DialogFooter className="mt-5">
                {editing && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
                <Button type="submit" loading={isSaving} disabled={!canWrite}>
                  {editing ? <Save /> : <Plus />}
                  {editing ? "Save note" : "Add note"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.title ?? "this note"}”?`}
        description="This removes the note for every viewer. The action cannot be undone."
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete._id);
          setPendingDelete(null);
        }}
        loading={remove.isPending}
      />
    </>
  );
}
