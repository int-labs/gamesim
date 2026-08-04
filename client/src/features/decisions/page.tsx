import type { ColumnDef } from "@tanstack/react-table";
import { GitBranch, Trash2 } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EntityCell, IconTile, ProgressLinear } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/primitives";
import { DetailDialog, DetailMap } from "@/components/app/detail-dialog";
import {
  useDecisions,
  useDeleteDecisionsByRound,
  useProducts,
  useRounds,
  useTeams,
} from "@/lib/api-hooks";
import { money, percent, relativeTime } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

/**
 * Decisions written before the `inputs[].fields` flattening fix are stored
 * doubly-nested and are unreadable by both calculators. Detect and label them
 * rather than crashing (spec §20 pitfall 14).
 */
function isLegacyShape(input: any): boolean {
  const fields = input?.fields;
  if (!Array.isArray(fields) || fields.length === 0) return false;
  return Array.isArray(fields[0]);
}

/**
 * Renders a submitted value the way the field means it.
 *
 * The raw store is faithful and unreadable — a projected market share arrives
 * as `0.08333333333333333`, which no facilitator can compare against another
 * team at a glance. Money follows its field type; a share reads as a percent;
 * everything else is trimmed to the precision the engine actually uses.
 */
function formatValue(raw: unknown, def: any): unknown {
  if (raw === null || raw === undefined || raw === "") return raw;
  if (typeof raw !== "number") return raw;

  if (def?.type === "money") return money(raw);
  // A stored fraction that means a percentage. Keyed off the field key rather
  // than the magnitude — a genuine 0.5 unit cost must not become "50%".
  if (typeof def?.key === "string" && /share|rate|percent/i.test(def.key) && Math.abs(raw) <= 1) {
    return percent(raw);
  }
  // Trailing float noise helps nobody; four places is past anything the
  // decision form can even enter.
  return Number.isInteger(raw) ? String(raw) : String(Number(raw.toFixed(4)));
}

/**
 * What a team actually submitted.
 *
 * The table can only show that N fields were sent — which is a count, not an
 * answer. The question this page exists for is "what did they choose?", and
 * until now the only way to see it was to query Mongo directly.
 *
 * Field ids are resolved back to their product's LABELS; a raw ObjectId beside
 * a number tells an operator nothing. Enum values are resolved through the
 * field's `options` map for the same reason.
 */
function DecisionDetail({
  row,
  onOpenChange,
}: {
  row: any | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: products = [] } = useProducts();

  const fields = React.useMemo(() => {
    if (!row) return [];
    const product = products.find((p: any) => String(p._id) === String(row.productId));
    const defs: any[] = product?.fields ?? [];

    return (row.fields ?? []).map((f: any) => {
      const def = defs.find((d: any) => String(d._id) === String(f.fieldId));
      const raw = f.value;
      // An enum's stored value is its option KEY; the operator picked a label.
      const label =
        def?.type === "enum" && def?.options && typeof raw === "string" && raw in def.options
          ? `${raw} (${def.options[raw]})`
          : formatValue(raw, def);
      return {
        label: def?.label ?? "Unknown field",
        key: def?.key,
        type: def?.type,
        value: label,
        // A field the product no longer has: the decision still references it,
        // and hiding that would make a scoring mismatch impossible to explain.
        orphaned: !def,
      };
    });
  }, [row, products]);

  if (!row) return null;

  return (
    <DetailDialog
      open={!!row}
      onOpenChange={onOpenChange}
      eyebrow="Decision"
      title={row.productName}
      subtitle={`Submitted by ${row.teamName} · ${relativeTime(row.submittedAt)}`}
      leading={<IconTile icon={<GitBranch />} tone="brand" />}
      sections={[
        {
          title: "Submitted values",
          fields:
            fields.length === 0
              ? [{ label: "Values", value: "This decision carries no field values.", wide: true, empty: true }]
              : fields.map((f: any) => ({
                  label: f.orphaned ? `${f.label} · no longer on the product` : f.label,
                  value:
                    typeof f.value === "object" && f.value !== null ? (
                      <DetailMap value={f.value} />
                    ) : (
                      <span className={f.orphaned ? "text-warning" : undefined}>{String(f.value ?? "—")}</span>
                    ),
                  mono: f.type === "number" || f.type === "money",
                  empty: f.value === undefined || f.value === null || f.value === "",
                })),
        },
        {
          title: "Context",
          fields: [
            { label: "Team", value: row.teamName },
            { label: "Global inputs", value: String(row.globalInputs) },
            { label: "Fields submitted", value: String(row.fieldCount), mono: true },
            {
              label: "Storage format",
              value: row.legacy ? (
                <Badge tone="danger" size="sm">Legacy — unreadable by the engine</Badge>
              ) : (
                <Badge tone="success" size="sm">Current</Badge>
              ),
            },
          ],
        },
      ]}
    />
  );
}

function DecisionsTable() {
  const { simulationId } = useScope();
  const { data: rounds = [] } = useRounds(simulationId ?? undefined);
  const { data: teams = [] } = useTeams(simulationId ?? undefined);

  const [round, setRound] = React.useState<string>("");

  // Default to the highest Active round, else the highest-numbered.
  React.useEffect(() => {
    if (round || rounds.length === 0) return;
    const sorted = [...rounds].sort((a: any, b: any) => b.roundNumber - a.roundNumber);
    const active = sorted.find((r: any) => r.status === "Active") ?? sorted[0];
    if (active) setRound(String(active.roundNumber));
  }, [rounds, round]);

  const roundNumber = round ? Number(round) : undefined;
  const { data = [], isLoading, isError, refetch } = useDecisions(simulationId ?? undefined, roundNumber);
  const delByRound = useDeleteDecisionsByRound();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [detail, setDetail] = React.useState<any | null>(null);

  const teamName = React.useCallback(
    (id: string) => teams.find((t: any) => t._id === id)?.teamName ?? "Unknown team",
    [teams]
  );

  // One row per product decision, flattened out of each team's document.
  const rows = React.useMemo(
    () =>
      data.flatMap((d: any) =>
        (d.inputs ?? []).map((input: any, i: number) => ({
          _id: `${d._id}-${i}`,
          teamId: d.teamId,
          teamName: teamName(String(d.teamId)),
          productName: input.productName ?? "Unnamed product",
          fieldCount: Array.isArray(input.fields) ? input.fields.length : 0,
          globalInputs: (d.globalInputs ?? []).length,
          legacy: isLegacyShape(input),
          submittedAt: d.createdAt,
          // The actual submitted values — the whole point of the page, and
          // previously not carried past the row count.
          fields: Array.isArray(input.fields) ? input.fields : [],
          productId: input.productId,
        }))
      ),
    [data, teamName]
  );

  const submittedTeams = new Set(data.map((d: any) => String(d.teamId))).size;

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product decision",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<GitBranch />} tone="brand" />}
            primary={row.original.productName}
            secondary={row.original.legacy ? undefined : `${row.original.fieldCount} fields submitted`}
            trailing={
              row.original.legacy ? (
                <Badge tone="danger" size="sm">
                  Legacy format
                </Badge>
              ) : undefined
            }
          />
        ),
      },
      {
        accessorKey: "teamName",
        header: "Team",
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.teamName} src={row.original.avatar?.url} size="md" />
            <span className="text-[13px] font-semibold text-foreground">{row.original.teamName}</span>
          </div>
        ),
      },
      {
        accessorKey: "globalInputs",
        header: "Global inputs",
        size: 140,
        cell: ({ row }) => <Badge tone="count">{row.original.globalInputs}</Badge>,
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.submittedAt)}</span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-[190px]">
          <Select value={round} onValueChange={setRound}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Pick a round" />
            </SelectTrigger>
            <SelectContent>
              {[...rounds]
                .sort((a: any, b: any) => a.roundNumber - b.roundNumber)
                .map((r: any) => (
                  <SelectItem key={r._id} value={String(r.roundNumber)}>
                    Round {r.roundNumber} · {r.status}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="font-semibold tnum text-foreground">
            {submittedTeams}/{teams.length}
          </span>
          teams submitted
          <div className="w-24">
            <ProgressLinear
              thin
              value={submittedTeams}
              total={Math.max(teams.length, 1)}
              tone="success"
            />
          </div>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive-tint"
            disabled={rows.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 /> Clear round decisions
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search decisions…"
        groupBy="teamName"
        onRowClick={(row: any) => setDetail(row)}
        empty={
          <EmptyState
            icon={<GitBranch />}
            title={`No decisions for round ${round || "—"} yet`}
            hint="Teams submit from the player app. Rows appear here the moment they do."
          />
        }
      />

      <DecisionDetail row={detail} onOpenChange={(v) => !v && setDetail(null)} />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={`Clear all decisions for round ${round}?`}
        description={`This deletes every team's submission for round ${round}. They will need to resubmit from the player app. Use this to clear decisions stored in the old nested format.`}
        confirmText={`round ${round}`}
        confirmLabel="Delete decisions"
        loading={delByRound.isPending}
        onConfirm={async () => {
          if (!simulationId || roundNumber == null) return;
          // The dialog closes itself once this resolves.
          await delByRound.mutateAsync({ simulationId, roundNumber });
        }}
      />
    </>
  );
}

export default function DecisionsPage() {
  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle="What each team submitted this round — the raw input to the market model."
      />
      <ScopeGuard>
        <DecisionsTable />
      </ScopeGuard>
    </>
  );
}
