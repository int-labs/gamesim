import { Database, Download, Pencil, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { IconTile } from "@/components/app/bits";
import { Card, CardHeader } from "@/components/app/card";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { useBaseData, useProducts, useRounds, useSegments } from "@/lib/api-hooks";
import { useScope } from "@/lib/scope-store";
import {
  CalculatedRoundsNotice,
  MarketSizeEditor,
  OverridesEditor,
} from "@/features/base-data/editor";
import { count } from "@/lib/format";

export default function BaseDataPage() {
  const { data: doc, isLoading, isError, refetch } = useBaseData();
  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();
  const { simulationId } = useScope();
  const { data: rounds = [] } = useRounds(simulationId ?? undefined);
  const [mode, setMode] = React.useState<"view" | "market" | "overrides">("view");

  const segmentName = React.useCallback(
    (id: string) => segments.find((s: any) => String(s._id) === id)?.name ?? `Segment ${id.slice(-6)}`,
    [segments]
  );
  const productName = React.useCallback(
    (id: string) => products.find((p: any) => String(p._id) === id)?.productName ?? `Product ${id.slice(-6)}`,
    [products]
  );

  // Rounds that already have results — the ones the server will refuse to
  // let us re-price without an explicit override.
  const calculatedRounds = React.useMemo(
    () => rounds.filter((r: any) => r.status === "Completed").map((r: any) => r.roundNumber),
    [rounds]
  );

  const download = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-data-${doc?._id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Base data exported");
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Base data" subtitle="The market model behind a simulation type." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  if (isError || !doc) {
    return (
      <>
        <PageHeader title="Base data" subtitle="The market model behind a simulation type." />
        <Card padded={false}>
          <EmptyState
            icon={<Database />}
            title="No base data for this type"
            hint="Base data holds market sizes and the scoring model. Provision it before running a round."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const marketSegments = doc.marketData?.segments ?? [];
  const modelSegments = doc.marketModel?.segments ?? [];
  const csatSegments = doc.csatMarketModel?.segments ?? [];

  const productCount = modelSegments.reduce(
    (a: number, s: any) => a + (s.products?.length ?? 0),
    0
  );
  const fieldCount = modelSegments.reduce(
    (a: number, s: any) =>
      a + (s.products ?? []).reduce((b: number, p: any) => b + (p.fields?.length ?? 0), 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Base data"
        subtitle="Market sizes, the competitive scoring model, and CSAT drivers for the active simulation type."
        actions={
          <>
            <Button
              variant="outline"
              shape="pill"
              onClick={() => setMode(mode === "overrides" ? "view" : "overrides")}
            >
              <SlidersHorizontal /> Round overrides
            </Button>
            <Button
              variant="outline"
              shape="pill"
              onClick={() => setMode(mode === "market" ? "view" : "market")}
            >
              <Pencil /> Edit market sizes
            </Button>
            <Button variant="outline" shape="pill" onClick={download}>
              <Download /> Export JSON
            </Button>
          </>
        }
      />

      {mode === "market" && (
        <>
          <CalculatedRoundsNotice rounds={calculatedRounds} />
          <MarketSizeEditor
            baseDataId={doc._id}
            marketData={doc.marketData}
            segmentName={segmentName}
            productName={productName}
            onDone={() => setMode("view")}
          />
        </>
      )}

      {mode === "overrides" && (
        <OverridesEditor
          baseDataId={doc._id}
          overrides={doc.perRoundOverrides ?? {}}
          rounds={rounds.map((r: any) => r.roundNumber).sort((a: number, b: number) => a - b)}
          onDone={() => setMode("view")}
        />
      )}

      {mode === "view" && (
        <>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Market segments", value: marketSegments.length, tone: "gold" as const },
          { label: "Scored products", value: productCount, tone: "success" as const },
          { label: "Competing fields", value: fieldCount, tone: "brand" as const },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-4">
            <IconTile icon={<Database />} tone={s.tone} size="lg" />
            <div>
              <div className="text-[13px] text-muted-foreground">{s.label}</div>
              <div className="font-display text-[26px] font-semibold leading-none tnum text-foreground">
                {count(s.value)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Market sizes"
            subtitle="Available market per segment, product and year"
            action={<Badge tone="count">{marketSegments.length}</Badge>}
          />
          <div className="mt-4 space-y-3">
            {marketSegments.map((seg: any, i: number) => (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="mb-2 text-[12px] font-semibold text-foreground">
                  Segment {String(seg.segmentId).slice(-6)}
                </div>
                {(seg.products ?? []).map((p: any, j: number) => (
                  <div key={j} className="flex flex-wrap items-center gap-2 py-1">
                    <span className="text-[12px] text-muted-foreground">
                      Product {String(p.productId).slice(-6)}
                    </span>
                    {Object.entries(p.yearlyData ?? {}).map(([year, v]: [string, any]) => (
                      <Badge key={year} tone="outline" size="sm" className="tnum">
                        Y{year}: {count(v?.marketSize)}
                      </Badge>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Scoring model"
            subtitle="Fields the market model competes teams on"
            action={<Badge tone="count">{fieldCount}</Badge>}
          />
          <div className="mt-4 space-y-3">
            {modelSegments.map((seg: any, i: number) =>
              (seg.products ?? []).map((p: any, j: number) => (
                <div key={`${i}-${j}`} className="rounded-md border border-border p-3">
                  <div className="mb-2 text-[12px] font-semibold text-foreground">
                    Product {String(p.productId).slice(-6)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.fields ?? []).map((f: any, k: number) => (
                      <Badge key={k} tone="navy" size="sm">
                        {f.label ?? f.key}
                      </Badge>
                    ))}
                    {(p.fields ?? []).length === 0 && (
                      <span className="text-[12px] text-muted-foreground">No competing fields</span>
                    )}
                  </div>
                </div>
              ))
            )}
            {csatSegments.length > 0 && (
              <p className="text-[12px] text-muted-foreground">
                Plus {csatSegments.length} CSAT driver group
                {csatSegments.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        </Card>
      </div>
        </>
      )}
    </>
  );
}
