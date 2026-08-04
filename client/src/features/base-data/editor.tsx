import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import * as api from "@/api";
import { Card, CardHeader } from "@/components/app/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Base Data edit mode.
 *
 * Market sizes are keyed by round, and they're an INPUT to calcMarketModel —
 * so changing a round that has already been calculated would leave results
 * nothing can reproduce. The server refuses those edits (409, naming the exact
 * rounds); this UI surfaces that refusal and offers the deliberate override
 * rather than hiding it.
 */

type YearlyData = Record<string, { marketSize: number }>;

export function MarketSizeEditor({
  baseDataId,
  marketData,
  segmentName,
  productName,
  onDone,
}: {
  baseDataId: string;
  marketData: any;
  segmentName: (id: string) => string;
  productName: (id: string) => string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<any>(() => JSON.parse(JSON.stringify(marketData)));
  const [conflict, setConflict] = React.useState<{
    message: string;
    calculatedRounds: number[];
  } | null>(null);

  const years = React.useMemo(() => {
    const s = new Set<string>();
    for (const seg of draft?.segments ?? [])
      for (const p of seg.products ?? []) Object.keys(p.yearlyData ?? {}).forEach((y) => s.add(y));
    return [...s].sort((a, b) => Number(a) - Number(b));
  }, [draft]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(marketData);

  const save = useMutation({
    mutationFn: (force: boolean) =>
      api.patchBaseDataSection(baseDataId, "marketData", draft, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base-data"] });
      setConflict(null);
      toast.success("Market sizes saved");
      onDone();
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const data = e?.response?.data ?? {};
      if (status === 409) {
        // Not an error to bury — the operator has to make a call.
        setConflict({
          message: data.message ?? "",
          calculatedRounds: data.calculatedRounds ?? [],
        });
        return;
      }
      toast.error(data.issues?.[0]?.message ?? data.message ?? "Couldn't save market sizes");
    },
  });

  const setSize = (segIdx: number, prodIdx: number, year: string, value: number) =>
    setDraft((d: any) => {
      const next = JSON.parse(JSON.stringify(d));
      const yd: YearlyData = next.segments[segIdx].products[prodIdx].yearlyData ?? {};
      yd[year] = { ...(yd[year] ?? {}), marketSize: value };
      next.segments[segIdx].products[prodIdx].yearlyData = yd;
      return next;
    });

  return (
    <>
      <Card className="space-y-4">
        <CardHeader
          title="Market sizes"
          subtitle="Available market per segment, product and round. These feed calcMarketModel directly."
          action={
            <div className="flex items-center gap-2">
              {dirty && (
                <Badge tone="warning" size="sm">
                  Unsaved
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={onDone}>
                <X /> Cancel
              </Button>
              <Button
                size="sm"
                disabled={!dirty}
                loading={save.isPending}
                onClick={() => save.mutate(false)}
              >
                <Save /> Save
              </Button>
            </div>
          }
        />

        {(draft?.segments ?? []).map((seg: any, si: number) => (
          <div key={si} className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted px-3 py-2">
              <span className="text-[13px] font-semibold text-foreground">
                {segmentName(String(seg.segmentId))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">
                      <span className="eyebrow text-muted-foreground">Product</span>
                    </th>
                    {years.map((y) => (
                      <th key={y} className="w-32 px-3 py-2 text-left">
                        <span className="eyebrow text-muted-foreground">Round {y}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(seg.products ?? []).map((p: any, pi: number) => (
                    <tr key={pi} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <span className="text-[13px] font-medium text-foreground">
                          {productName(String(p.productId))}
                        </span>
                      </td>
                      {years.map((y) => (
                        <td key={y} className="px-3 py-2">
                          <Input
                            inputSize="sm"
                            type="number"
                            min={0}
                            className="tnum"
                            value={p.yearlyData?.[y]?.marketSize ?? ""}
                            onChange={(e) => setSize(si, pi, y, Number(e.target.value))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>

      <ConfirmDialog
        open={!!conflict}
        onOpenChange={(v) => !v && setConflict(null)}
        title="These rounds have already been calculated"
        description={
          <>
            {/* The API's message ends with "…or retry with ?force=true", which is
                advice for a script, not for someone looking at a Save button. */}
            {(conflict?.message ?? "").replace(/\s*Delete those results first.*$/, "")}
            <br />
            <br />
            Forcing the change keeps the existing results as they are — they will no longer match
            the market sizes that produced them. Recalculate those rounds afterwards if you need
            them to agree.
          </>
        }
        confirmLabel="Save anyway"
        loading={save.isPending}
        onConfirm={() => save.mutate(true)}
      />
    </>
  );
}

/** Per-round tweaks layered over the base numbers. */
export function OverridesEditor({
  baseDataId,
  overrides,
  rounds,
  onDone,
}: {
  baseDataId: string;
  overrides: Record<string, any>;
  rounds: number[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<Record<string, any>>(
    () => JSON.parse(JSON.stringify(overrides ?? {}))
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(overrides ?? {});

  const save = useMutation({
    mutationFn: () => api.patchBaseDataSection(baseDataId, "perRoundOverrides", draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base-data"] });
      toast.success("Round overrides saved");
      onDone();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.issues?.[0]?.message ??
          e?.response?.data?.message ??
          "Couldn't save overrides"
      ),
  });

  const setMult = (round: number, value: string) =>
    setDraft((d) => {
      const next = { ...d };
      if (value === "") delete next[String(round)];
      else next[String(round)] = { ...(next[String(round)] ?? {}), demandMultiplier: Number(value) };
      return next;
    });

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Per-round overrides"
        subtitle="A demand multiplier layered over that round's market sizes. 1.0 (or blank) leaves them alone."
        action={
          <div className="flex items-center gap-2">
            {dirty && (
              <Badge tone="warning" size="sm">
                Unsaved
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onDone}>
              <X /> Cancel
            </Button>
            <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              <Save /> Save
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rounds.map((r) => (
          <div key={r} className="space-y-1.5">
            <Label htmlFor={`ov-${r}`}>Round {r}</Label>
            <Input
              id={`ov-${r}`}
              inputSize="sm"
              type="number"
              step="0.05"
              min={0}
              placeholder="1.0"
              className="tnum"
              value={draft[String(r)]?.demandMultiplier ?? ""}
              onChange={(e) => setMult(r, e.target.value)}
            />
          </div>
        ))}
      </div>
      {rounds.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No rounds configured for this simulation type yet.
        </p>
      )}
    </Card>
  );
}

export function CalculatedRoundsNotice({ rounds }: { rounds: number[] }) {
  if (rounds.length === 0) return null;
  return (
    <div className={cn("mb-4 flex items-center gap-3 rounded-lg bg-warning-tint p-3")}>
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <p className="text-[12.5px] leading-4 text-warning">
        Round{rounds.length > 1 ? "s" : ""} {rounds.join(", ")}{" "}
        {rounds.length > 1 ? "have" : "has"} already been calculated. Changing{" "}
        {rounds.length > 1 ? "their" : "its"} market size needs an explicit override.
      </p>
    </div>
  );
}
