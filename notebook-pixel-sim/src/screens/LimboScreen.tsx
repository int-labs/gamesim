import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { getRoundDebrief, getStoredSession, GamesimApiError } from '@/gamesim/client';
import type { DebriefChartDto, RoundDebriefDto } from '@/gamesim/types';
import { PixelPanel } from '@/components/primitives';
import { ChartLegend, type LegendEntry } from '@/components/charts/ChartLegend';
import { PixelVocPlot, type VocRow } from '@/components/charts/PixelVocPlot';
import { buildTeamPalette, colorFor } from '@/components/charts/chartTheme';
import {
  priceSensitivityFromBounds,
  weightScaleFor,
  TOP_DRIVER_SHARE,
} from '@/engine/finlit/core/config/fieldConfig';
import { diminishingReturnsFactor } from '@/engine/finlit/core/mathUtils';
import { RoundNotesCard } from '@/gamesim/OperatorContent';
import { LEARNING_POINTS, PHASE_INTRO } from '@/content/copy';

/** Limbo: the round debrief, read after the operator calculates and before the next phase. Arranges only; the server draws. */

type Load =
  | { state: 'loading' }
  /** 404 is the normal state while the round is still open, not an error. */
  | { state: 'waiting'; message: string }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: RoundDebriefDto };

// No polling: the refresh button is the only re-fetch.

export function LimboScreen({
  roundNumber,
  onContinue,
}: {
  roundNumber: number;
  /** Rendered as the exit only once the debrief has loaded, the whole point of
   *  limbo is that the team reads this before moving on. */
  onContinue?: () => void;
}) {
  // Read once; the no-session case is the initial state, not a setState in the effect.
  const session = useMemo(() => getStoredSession(), []);
  const [load, setLoad] = useState<Load>(() =>
    session
      ? { state: 'loading' }
      : { state: 'error', message: 'No session — sign in again to see the debrief.' },
  );

  // Bumped by refresh to re-run the effect, so there is one fetch path.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    getRoundDebrief({ simulationId: session.simulationId, roundNumber })
      .then((data) => { if (!cancelled) setLoad({ state: 'ready', data }); })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof GamesimApiError && err.status === 404) {
          setLoad({ state: 'waiting', message: err.message });
          return;
        }
        setLoad({
          state: 'error',
          message: err instanceof Error ? err.message : 'Could not load the debrief.',
        });
      });

    return () => { cancelled = true; };
  }, [roundNumber, session, attempt]);

  const refresh = () => {
    setLoad({ state: 'loading' });
    setAttempt((n) => n + 1);
  };

  if (load.state === 'loading') return <Notice title="Loading the debrief…" body="Fetching this round's results." />;
  if (load.state === 'waiting') {
    return (
      <Notice
        title="Waiting for the results"
        body="Your decisions are in. The facilitator hasn't closed this round yet — check back once they have."
        // The server's own reason: three causes 404 here and only one is "not calculated yet".
        detail={load.message}
        onRefresh={refresh}
      />
    );
  }
  if (load.state === 'error') {
    return <Notice title="Debrief unavailable" body={load.message} onRefresh={refresh} />;
  }

  return <DebriefBody data={load.data} onContinue={onContinue} />;
}

/** A category and the chart instances that render inside it. */
interface Segment {
  /** The operator's `category`. Empty = ungrouped, which renders with no
   *  collapsible wrapper rather than under a blank heading. */
  category: string;
  charts: DebriefChartDto[];
}

/** Order the instances, then cut into segments. Nothing is filtered. */
function toSegments(charts: DebriefChartDto[]): Segment[] {
  // Copy first: sorting the prop array in place would reorder the caller's.
  const ordered = [...charts].sort((a, b) => a.order - b.order);

  const segments: Segment[] = [];
  for (const chart of ordered) {
    const category = chart.category ?? '';
    // Appended to the last segment only, so two runs of a category stay apart.
    const tail = segments[segments.length - 1];
    if (tail && tail.category === category) tail.charts.push(chart);
    else segments.push({ category, charts: [chart] });
  }

  // !important client-drawn segments come first, whatever their `order`.
  return [
    ...segments.filter((s) => s.charts.some((c) => c.clientChart)),
    ...segments.filter((s) => !s.charts.some((c) => c.clientChart)),
  ];
}

function DebriefBody({
  data,
  onContinue,
}: {
  data: RoundDebriefDto;
  onContinue?: () => void;
}) {
  const { roundNumber } = data;
  const segments = useMemo(() => toSegments(data.charts ?? []), [data.charts]);

  return (
    // A full screen with its own opaque surface, or a long debrief cannot scroll.
    <div className="absolute inset-0 z-10 overflow-y-auto bg-cream-100">
      {/* 80vw, not a `max-w-*` step, so the page scales with the rail and the stage. */}
      <div className="flex flex-col gap-4 p-3 sm:p-4 w-[80vw] mx-auto">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="eyebrow eyebrow-sm text-ink-700">Round debrief</div>
            <h1 className="h2 leading-none">Round {roundNumber + 1}</h1>
          </div>
        </header>

        <LearningPoint roundNumber={roundNumber} />

        {/* Takes the debrief's round explicitly; the default reads the next one. */}
        <RoundNotesCard roundNumber={roundNumber} />

        {segments.length === 0 ? (
          // An empty debrief is a configured outcome, not a failure.
          <PixelPanel title="Nothing to read yet">
            <div className="body text-ink-800 leading-relaxed">
              The facilitator hasn't written up this round's charts.
            </div>
          </PixelPanel>
        ) : (
          segments.map((s, i) =>
            s.category ? (
              <CollapsibleSegment key={`${s.category}:${i}`} title={s.category}>
                {s.charts.map((c) => <ChartSlide key={instanceKey(c)} chart={c} data={data} />)}
              </CollapsibleSegment>
            ) : (
              s.charts.map((c) => <ChartSlide key={instanceKey(c)} chart={c} data={data} />)
            ),
          )
        )}

        {onContinue && (
          <div className="flex justify-end pt-2 pb-4">
            <button onClick={onContinue} className="game-btn min-h-[44px]">
              <span className="btn-label uppercase">Continue to next phase</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** !important key by the pair; a `scope: each` chart's instances share an `_id`. */
const instanceKey = (c: DebriefChartDto) => `${c._id}:${c.productId ?? ''}`;

/** One category of the slide, open by default: a closed segment is never found. */
function CollapsibleSegment({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 border-2 border-ink-900 bg-cream-50 px-3 py-2 text-left min-h-[44px]"
        aria-expanded={open}
      >
        <span className="eyebrow uppercase text-ink-800">{title}</span>
        <span className="body-sm text-ink-700">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  );
}

/** One chart instance. !important the SVG is injected unsanitised on purpose: it is our own output, sanitised at the console boundary. */
function ChartSlide({ chart, data }: { chart: DebriefChartDto; data: RoundDebriefDto }) {
  const title = chart.productName ? `${chart.name} · ${chart.productName}` : chart.name;

  // A `clientChart` key with no component here renders as copy with no figure.
  const Client = chart.clientChart ? CLIENT_CHARTS[chart.clientChart] : undefined;

  // No figure means no split row, or the copy is stranded beside an empty cell.
  const hasFigure = !!Client || !!chart.svg;

  return (
    <PixelPanel title={title}>
      {/* Figure left, reading right. */}
      <div className={clsx('grid gap-4 items-start', hasFigure && 'lg:grid-cols-2')}>
        {hasFigure && (
          // !important `min-w-0`, or the SVG's intrinsic width pushes the copy out of the panel.
          <div className="min-w-0">
            {Client && <Client chart={chart} data={data} />}
            {chart.svg && (
              // Native size, never scaled: shrinking the root <svg> shrinks its type too.
              <div
                className="w-full overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: chart.svg }}
              />
            )}
          </div>
        )}
        {chart.description && (
          <div className="min-w-0 body text-ink-700 leading-relaxed">
            {chart.description}
          </div>
        )}
      </div>
    </PixelPanel>
  );
}

/* ── The charts this client draws itself ─────────────────────────────── */

type ClientChartProps = { chart: DebriefChartDto; data: RoundDebriefDto };

/** Keyed by the spec's `key`, not `fieldId`, which differs per notebook. */
interface VocComputed {
  key: string;
  label: string;
  weight: number;
  dots: VocRow['dots'];
}

/** VoC rows for one notebook; both normalisations live here. */
function vocRowsFor(
  data: RoundDebriefDto,
  here: RoundDebriefDto['rounds'][number] | null,
  product: RoundDebriefDto['products'][number],
  palette: Map<string, string>,
  scale: number,
): VocComputed[] {
  return product.fields.map((f) => {
    // `selling_price` carries direction 0 and takes its weight from the shared helper.
    const weight = f.key === 'selling_price'
      ? priceSensitivityFromBounds(f.minValue, f.maxValue).weight * TOP_DRIVER_SHARE
      : (f.direction ?? 0) * scale;

    // !important mirrors the server's `calcDiminishingReturnsCostFactor`.
    const min = f.minValue ?? 0;
    const max = f.maxValue ?? 0;
    const PEAK = diminishingReturnsFactor(max, min, max);
    const attainable = max * PEAK;

    const dots: VocRow['dots'] = [];
    for (const t of data.teams) {
      const raw = here?.teams[t.teamId]?.byProduct[product.productId]?.fieldValues[f.fieldId];
      if (raw == null || attainable <= 0 || weight == null) continue;
      // Floor only, the curve is meant to SEE an overshoot and decay past the
      // ceiling, which is the whole point of it being centred on `max`.
      const resolved = Math.max(raw, min);
      const captured = resolved * diminishingReturnsFactor(resolved, min, max);
      dots.push({
        teamId: t.teamId,
        label: t.teamName,
        color: colorFor(palette, t.teamId),
        value: (captured / attainable) * weight,
      });
    }

    return { key: f.key, label: f.label, weight, dots };
  });
}

/** Every notebook's rows merged by spec key and AVERAGED, not summed. */
function mergeVoc(perProduct: VocComputed[][]): VocComputed[] {
  const byKey = new Map<string, VocComputed[]>();
  for (const rows of perProduct) {
    for (const r of rows) {
      const hit = byKey.get(r.key);
      if (hit) hit.push(r);
      else byKey.set(r.key, [r]);
    }
  }

  const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;

  return [...byKey.values()].map((group) => {
    const dotsByTeam = new Map<string, VocRow['dots'][number][]>();
    for (const r of group) {
      for (const d of r.dots) {
        const hit = dotsByTeam.get(d.teamId);
        if (hit) hit.push(d);
        else dotsByTeam.set(d.teamId, [d]);
      }
    }
    return {
      key:    group[0].key,
      label:  group[0].label,
      weight: mean(group.map((r) => r.weight)),
      dots:   [...dotsByTeam.values()].map((ds) => ({
        ...ds[0],
        value: mean(ds.map((d) => d.value)),
      })),
    };
  });
}

/** Voice of customer, the one chart this client draws. */
function VocSection({ chart, data }: ClientChartProps) {
  const here = data.rounds.find((r) => r.roundNumber === data.roundNumber) ?? null;
  const palette = useMemo(
    () => buildTeamPalette(data.teams.map((t) => t.teamId)),
    [data.teams],
  );

  // !important the divisor spans every notebook, matching reportMatrix's Weight column.
  const scale = weightScaleFor(
    data.products.flatMap((p) =>
      p.fields.filter((f) => f.key !== 'selling_price').map((f) => f.direction),
    ),
  );

  const rows: VocRow[] = useMemo(() => {
    const wanted = chart.productId
      ? data.products.filter((p) => p.productId === chart.productId)
      : data.products;
    const perProduct = wanted.map((p) => vocRowsFor(data, here, p, palette, scale));
    const computed = chart.productId ? perProduct[0] ?? [] : mergeVoc(perProduct);

    // Weight descending, on the effective weight, matching reportMatrix.
    return [...computed]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .map((r) => ({ id: r.key, label: r.label, weight: r.weight, dots: r.dots }));
  }, [chart.productId, data, here, palette, scale]);

  const legend: LegendEntry[] = data.teams.map((t) => ({
    id: t.teamId,
    label: t.teamName,
    color: colorFor(palette, t.teamId),
  }));

  if (rows.length === 0) return null;

  return (
    <>
      <PixelVocPlot rows={rows} youId={data.you} />
      <ChartLegend entries={legend} youId={data.you} />
    </>
  );
}

/** !important mirrors `server/src/constants/clientCharts.ts`. */
const CLIENT_CHARTS: Record<string, (p: ClientChartProps) => React.ReactNode> = {
  voc: VocSection,
};

/** The phase's learning point, resolved through `PHASE_INTRO[phase].learningFocus`. */
function LearningPoint({ roundNumber }: { roundNumber: number }) {
  // `roundNumber` is 0-based on the wire; PHASE_INTRO is keyed 1-based.
  const phase = roundNumber + 1;
  const focus = (PHASE_INTRO as Record<number, { learningFocus?: string } | undefined>)[phase]
    ?.learningFocus;
  const lp = focus
    ? (LEARNING_POINTS as Record<string, { title: string; blurb: string } | undefined>)[focus]
    : undefined;
  if (!lp) return null;

  return (
    <div className="bg-cream-50 border-2 border-ink-900 px-3 py-2">
      <div className="eyebrow eyebrow-sm text-ink-700">Learning point</div>
      <div className="body-sm font-bold leading-tight">{lp.title}</div>
      <div className="body-sm text-ink-800 leading-snug mt-1">{lp.blurb}</div>
    </div>
  );
}

function Notice({
  title, body, detail, onRefresh,
}: {
  title: string;
  body: string;
  detail?: string;
  onRefresh?: () => void;
}) {
  return (
    // Same full-screen treatment as the loaded page, the waiting state was the
    // one most often seen, and it was the least visible.
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-cream-100">
      <PixelPanel title={title}>
        <div className="body text-ink-800 leading-relaxed max-w-prose">{body}</div>
        {detail && (
          <div className="chart-label text-ink-700 mt-2 max-w-prose">{detail}</div>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="game-btn min-h-[44px] mt-3">
            <span className="btn-label uppercase">Check again</span>
          </button>
        )}
      </PixelPanel>
    </div>
  );
}
