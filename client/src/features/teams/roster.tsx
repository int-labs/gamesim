import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Dice5, Plus, Trash2, UserRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import * as api from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/overlays";
import { Avatar, Label, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Team roster + avatars.
 *
 * Avatars are DiceBear SVGs rendered server-side and returned as data URIs, so
 * a face is self-contained — no storage round-trip and nothing to 404. Only
 * attribution-free styles are offered (see server/src/services/avatars.ts).
 */

export type TeamAvatar = {
  kind: "dicebear" | "upload";
  style?: string | null;
  seed?: string | null;
  imageAssetId?: string | null;
  url: string;
};

export type Member = {
  _id?: string;
  name: string;
  role?: string | null;
  avatar?: TeamAvatar | null;
  order?: number;
};

/* ─────────────────────────────── data hooks ─────────────────────────────── */

export function useRoster(teamId?: string) {
  return useQuery({
    queryKey: ["team-roster", teamId],
    enabled: !!teamId,
    queryFn: async () => (await api.getTeamMembers(teamId!)).data as {
      teamId: string;
      teamName: string;
      avatar: TeamAvatar | null;
      members: Member[];
    },
  });
}

function useAvatarStyles() {
  return useQuery({
    queryKey: ["avatar-styles"],
    staleTime: Infinity,
    queryFn: async () =>
      (await api.getAvatarStyles()).data.styles as {
        id: string;
        label: string;
        license: string;
        note: string;
      }[],
  });
}

/* ──────────────────────────── avatar picker ─────────────────────────────── */

/** SVG → img src without base64, which would choke on non-Latin1 characters. */
const svgToDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function StylePreview({
  style,
  seed,
  selected,
  onSelect,
}: {
  style: { id: string; label: string; license: string };
  seed: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["avatar-preview", style.id, seed],
    queryFn: async () => (await api.previewAvatar(style.id, seed)).data.svg as string,
    staleTime: Infinity,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${style.label} · ${style.license}`}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
        selected
          ? "border-primary bg-accent"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted"
      )}
    >
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-md bg-muted">
        {data ? (
          <img src={svgToDataUri(data)} alt={style.label} className="size-full object-cover" />
        ) : (
          <Skeleton className="size-full" />
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium text-foreground">
        {style.label}
      </span>
    </button>
  );
}

export function AvatarPickerDialog({
  open,
  onOpenChange,
  title,
  initialSeed,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initialSeed: string;
  current?: TeamAvatar | null;
  onPick: (avatar: TeamAvatar | null) => void;
}) {
  const { data: styles = [] } = useAvatarStyles();
  const [seed, setSeed] = React.useState(initialSeed);
  const [style, setStyle] = React.useState(current?.style ?? "pixelArt");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSeed(current?.seed || initialSeed);
      setStyle(current?.style ?? "pixelArt");
    }
  }, [open, initialSeed, current]);

  const chosen = styles.find((s) => s.id === style);

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await api.createDiceBearAvatar(style, seed || initialSeed, initialSeed);
      onPick(res.data as TeamAvatar);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Couldn't generate the avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="max-w-[560px]">
        <DialogTitle>{title}</DialogTitle>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Avatars are generated from a style and a seed — the same pair always gives the same
          face, so it stays stable across rounds.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="avatar-seed">Seed</Label>
            <div className="flex gap-2">
              <Input
                id="avatar-seed"
                inputSize="sm"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder={initialSeed}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeed(Math.random().toString(36).slice(2, 10))}
              >
                <Dice5 /> Shuffle
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Style</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {styles.map((s) => (
                <StylePreview
                  key={s.id}
                  style={s}
                  seed={seed || initialSeed}
                  selected={s.id === style}
                  onSelect={() => setStyle(s.id)}
                />
              ))}
            </div>
            {chosen && (
              <p className="text-[11.5px] text-muted-foreground">
                {chosen.note} · Licence: <strong>{chosen.license}</strong>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          {current && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => {
                onPick(null);
                onOpenChange(false);
              }}
            >
              Remove avatar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={saving} onClick={confirm}>
            Use this avatar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────── roster dialog ─────────────────────────────── */

export function RosterDialog({
  team,
  open,
  onOpenChange,
}: {
  team: { _id: string; teamName: string } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const roster = useRoster(open && team ? team._id : undefined);

  const [members, setMembers] = React.useState<Member[]>([]);
  const [teamAvatar, setTeamAvatar] = React.useState<TeamAvatar | null>(null);
  const [picker, setPicker] = React.useState<{ kind: "team" | "member"; index?: number } | null>(
    null
  );

  React.useEffect(() => {
    if (roster.data) {
      setMembers(roster.data.members ?? []);
      setTeamAvatar(roster.data.avatar ?? null);
    }
  }, [roster.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.putTeamMembers(team!._id, members);
      await api.putTeamAvatar(team!._id, teamAvatar ?? { avatar: null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-roster", team?._id] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Roster saved");
      onOpenChange(false);
    },
    onError: (e: any) => {
      const issue = e?.response?.data?.issues?.[0]?.message;
      toast.error(e?.response?.data?.message ?? "Couldn't save the roster", {
        description: issue,
      });
    },
  });

  const update = (i: number, patch: Partial<Member>) =>
    setMembers((ms) => ms.map((m, j) => (i === j ? { ...m, ...patch } : m)));

  const move = (i: number, dir: -1 | 1) =>
    setMembers((ms) => {
      const j = i + dir;
      if (j < 0 || j >= ms.length) return ms;
      const next = [...ms];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent width="max-w-[640px]">
          <DialogTitle>{team?.teamName} · roster</DialogTitle>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Members are display-only — names and faces for the room. Scores and strength come
            from the round calculation, not from here.
          </p>

          {roster.isLoading ? (
            <div className="mt-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {/* Team avatar */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3">
                {teamAvatar ? (
                  <img
                    src={teamAvatar.url}
                    alt={team?.teamName ?? ""}
                    className="size-12 shrink-0 rounded-full bg-card object-cover"
                  />
                ) : (
                  <Avatar name={team?.teamName ?? "?"} size="2xl" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-foreground">Team avatar</div>
                  <div className="text-[12px] text-muted-foreground">
                    {teamAvatar ? `${teamAvatar.style} · seed “${teamAvatar.seed}”` : "Using initials"}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPicker({ kind: "team" })}>
                  Change
                </Button>
              </div>

              {/* Members */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Members</Label>
                  <Badge tone="count">{members.length} / 12</Badge>
                </div>

                {members.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                    No members yet.
                  </p>
                )}

                {members.map((m, i) => (
                  <div
                    key={m._id ?? i}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setPicker({ kind: "member", index: i })}
                      title="Change avatar"
                      className="shrink-0 rounded-full transition-opacity hover:opacity-80"
                    >
                      {m.avatar ? (
                        <img
                          src={m.avatar.url}
                          alt={m.name}
                          className="size-10 rounded-full bg-muted object-cover"
                        />
                      ) : (
                        <Avatar name={m.name || "?"} size="xl" />
                      )}
                    </button>
                    <Input
                      inputSize="sm"
                      placeholder="Name"
                      value={m.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                    <Input
                      inputSize="sm"
                      className="w-40"
                      placeholder="Role (optional)"
                      value={m.role ?? ""}
                      onChange={(e) => update(i, { role: e.target.value })}
                    />
                    <div className="flex shrink-0 flex-col">
                      <IconButton label="Move up" size="sm" onClick={() => move(i, -1)}>
                        <ChevronUp />
                      </IconButton>
                      <IconButton label="Move down" size="sm" onClick={() => move(i, 1)}>
                        <ChevronDown />
                      </IconButton>
                    </div>
                    <IconButton
                      label="Remove member"
                      size="sm"
                      className="hover:text-destructive"
                      onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={members.length >= 12}
                  onClick={() => setMembers((ms) => [...ms, { name: "", role: "" }])}
                >
                  <Plus /> Add member
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={members.some((m) => !m.name.trim())}
              onClick={() => save.mutate()}
            >
              Save roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarPickerDialog
        open={!!picker}
        onOpenChange={(v) => !v && setPicker(null)}
        title={
          picker?.kind === "team"
            ? `Avatar for ${team?.teamName}`
            : `Avatar for ${members[picker?.index ?? 0]?.name || "member"}`
        }
        initialSeed={
          picker?.kind === "team"
            ? team?.teamName ?? "team"
            : members[picker?.index ?? 0]?.name || "member"
        }
        current={
          picker?.kind === "team" ? teamAvatar : members[picker?.index ?? 0]?.avatar ?? null
        }
        onPick={(avatar) => {
          if (picker?.kind === "team") setTeamAvatar(avatar);
          else if (picker?.index != null) update(picker.index, { avatar });
        }}
      />
    </>
  );
}

/** Small stack of member faces for the Teams table. */
export function MemberStack({ members }: { members?: Member[] }) {
  const list = members ?? [];
  if (list.length === 0)
    return <span className="text-[12px] text-muted-foreground">—</span>;

  return (
    <div className="flex items-center -space-x-2">
      {list.slice(0, 4).map((m, i) =>
        m.avatar ? (
          <img
            key={m._id ?? i}
            src={m.avatar.url}
            alt={m.name}
            title={m.role ? `${m.name} · ${m.role}` : m.name}
            className="size-7 rounded-full bg-muted object-cover ring-2 ring-card"
          />
        ) : (
          <span key={m._id ?? i} title={m.name} className="ring-2 ring-card rounded-full">
            <Avatar name={m.name || "?"} size="md" />
          </span>
        )
      )}
      {list.length > 4 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
          +{list.length - 4}
        </span>
      )}
    </div>
  );
}

export { UserRound };
