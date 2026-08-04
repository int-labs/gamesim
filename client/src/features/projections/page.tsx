import { TrendingUp } from "lucide-react";
import * as React from "react";
import { Card, CardHeader } from "@/components/app/card";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";
import { useProjections, useRounds, useTeams } from "@/lib/api-hooks";
import { money, percent } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

function ProjectionsInner() {
  const { simulationId } = useScope();
  const { data: teams = [] } = useTeams(simulationId ?? undefined);
  const { data: rounds = [] } = useRounds(simulationId ?? undefined);

  const [teamId, setTeamId] = React.useState<string>("");
  const [round, setRound] = React.useState<string>("");

  React.useEffect(() => {
    if (!teamId && teams.length) setTeamId(teams[0]._id);
  }, [teams, teamId]);
  React.useEffect(() => {
    if (!round && rounds.length) {
      const sorted = [...rounds].sort((a: any, b: any) => b.roundNumber - a.roundNumber);
      setRound(String(sorted[0].roundNumber));
    }
  }, [rounds, round]);

  const { data = [], isLoading } = useProjections(
    simulationId ?? undefined,
    teamId || undefined,
    round ? Number(round) : undefined
  );

  const doc = data[0];
  const products: [string, any][] = doc?.projections ? Object.entries(doc.projections) : [];

  const totals = products.reduce(
    (acc, [, p]: [string, any]) => ({
      revenue: acc.revenue + (p.revenue ?? 0),
      cogs: acc.cogs + (p.COGS ?? 0),
      gross: acc.gross + (p.grossProfit ?? 0),
      customers: acc.customers + (p.customersObtained ?? 0),
    }),
    { revenue: 0, cogs: 0, gross: 0, customers: 0 }
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="w-[200px]">
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t: any) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[170px]">
          <Select value={round} onValueChange={setRound}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Round" />
            </SelectTrigger>
            <SelectContent>
              {[...rounds]
                .sort((a: any, b: any) => a.roundNumber - b.roundNumber)
                .map((r: any) => (
                  <SelectItem key={r._id} value={String(r.roundNumber)}>
                    Round {r.roundNumber}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Badge tone="count">{products.length} products</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<TrendingUp />}
            title="No projections for this round"
            hint="Projections are written when an operator calculates the round, or when a team runs a what-if from the player."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard compact label="Revenue" value={Math.round(totals.revenue)} />
            <StatCard compact label="COGS" value={Math.round(totals.cogs)} />
            <StatCard compact label="Gross profit" value={Math.round(totals.gross)} />
            <StatCard compact label="Customers" value={Math.round(totals.customers)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {products.map(([productId, p]: [string, any]) => (
              <Card key={productId}>
                <CardHeader
                  title={`Product ${productId.slice(-6)}`}
                  subtitle={`${Math.round(p.customersObtained ?? 0)} customers`}
                  action={
                    p.marketShare != null ? (
                      <Badge tone="brand">{percent(p.marketShare)} strength</Badge>
                    ) : (
                      <Badge tone="warning">what-if</Badge>
                    )
                  }
                />
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ["Selling price", money(p.sellingPrice)],
                    ["Dynamic price", money(p.dynamicPrice)],
                    ["Revenue", money(p.revenue)],
                    ["COGS", money(p.COGS)],
                    ["Gross profit", money(p.grossProfit)],
                    ["Product score", (p.productScore ?? 0).toFixed(3)],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-baseline justify-between gap-2">
                      <dt className="text-[12px] text-muted-foreground">{label}</dt>
                      <dd className="text-[13px] font-semibold tnum text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function ProjectionsPage() {
  return (
    <>
      <PageHeader
        title="Projections"
        subtitle="Each team's financial picture per round — the official numbers written by calcFinancials."
      />
      <ScopeGuard>
        <ProjectionsInner />
      </ScopeGuard>
    </>
  );
}
