import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { getRoundDebrief, getStoredSession, GamesimApiError } from '@/gamesim/client';
import type {
  DebriefChartDto,
  DebriefTeamRoundDto,
  LeaderboardBlockDto,
  RoundDebriefDto,
} from '@/gamesim/types';
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
import { ROUND_BG, forRound } from '@/assets';
import { fmt$, fmtInt, fmtPct } from '@/utils/format';

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

  // !important segments follow the operator's `order`; client-drawn charts get no special place.
  return segments;
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
      {/* The round intro's scene art, fixed behind the scroll and blurred under the page's cream. */}
      <img
        src={forRound(ROUND_BG, roundNumber + 1)}
        alt=""
        draggable={false}
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none fixed inset-0 bg-cream-100/60 backdrop-blur-md" />
      {/* 80vw, not a `max-w-*` step, so the page scales with the rail and the stage. */}
      <div className="relative flex flex-col gap-4 p-3 sm:p-4 w-[80vw] mx-auto">
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
                <ChartGallery charts={s.charts} data={data} />
              </CollapsibleSegment>
            ) : (
              <ChartGallery key={`:${i}`} charts={s.charts} data={data} />
            ),
          )
        )}

        <ProfitAndLoss data={data} />

        <Leaderboard data={data} />

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

/** !important key by chart, notebook and item; the instances of one chart share an `_id`. */
const instanceKey = (c: DebriefChartDto) => `${c._id}:${c.productId ?? ''}:${c.inputId ?? ''}`;

/** One category of the slide, closed by default; the header opens it. */
function CollapsibleSegment({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
      {open && children}
    </div>
  );
}

/** A triangle pointing left or right, the gallery's step buttons. */
function StepArrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden="true">
      <polygon points={dir === 'left' ? '10,1 10,11 2,6' : '2,1 2,11 10,6'} fill="currentColor" />
    </svg>
  );
}

/** One chart at a time; every slide stays mounted and only the current one shows. */
function ChartGallery({ charts, data }: { charts: DebriefChartDto[]; data: RoundDebriefDto }) {
  const [curr, setCurr] = useState(0);
  const last = charts.length - 1;
  const step = 'game-btn min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40';

  return (
    <div className="flex items-center gap-2">
      {charts.length > 1 && (
        <button onClick={() => setCurr(curr - 1)} disabled={curr === 0} className={step} aria-label="Previous chart">
          <StepArrow dir="left" />
        </button>
      )}
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        {charts.map((c, index) => (
          <div key={instanceKey(c)} className={index === curr ? 'block' : 'hidden'}>
            <ChartSlide chart={c} data={data} />
          </div>
        ))}
        {charts.length > 1 && (
          <div className="body-sm text-ink-700 text-center">{curr + 1} / {charts.length}</div>
        )}
      </div>
      {charts.length > 1 && (
        <button onClick={() => setCurr(curr + 1)} disabled={curr === last} className={step} aria-label="Next chart">
          <StepArrow dir="right" />
        </button>
      )}
    </div>
  );
}

/** One chart instance. !important the SVG is injected unsanitised on purpose: it is our own output, sanitised at the console boundary. */
function ChartSlide({ chart, data }: { chart: DebriefChartDto; data: RoundDebriefDto }) {
  const instance = chart.productName ?? chart.inputLabel;
  const title = instance ? `${chart.name} · ${instance}` : chart.name;

  // A `clientChart` key with no component here renders as copy with no figure.
  const Client = chart.clientChart ? CLIENT_CHARTS[chart.clientChart] : undefined;

  const hasFigure = !!Client || !!chart.svg;

  return (
    <PixelPanel title={title}>
      {/* Notes on top, then the chart across the full panel width. */}
      <div className="flex flex-col gap-4">
        {chart.description && (
          <div className="body text-ink-700 leading-relaxed">{chart.description}</div>
        )}
        {hasFigure && (
          // !important `min-w-0`, or the SVG's intrinsic width pushes past the panel.
          <div className="min-w-0">
            {Client && <Client chart={chart} data={data} />}
            {chart.svg && (
              // Native size where it fits; scales down (type included) only when the panel is narrower.
              <div
                className="w-full [&>svg]:max-w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: chart.svg }}
              />
            )}
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
    // Legend to the right of the plot; stacks under it only on a narrow screen.
    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <PixelVocPlot rows={rows} youId={data.you} />
      </div>
      <div className="shrink-0 sm:pt-4">
        <ChartLegend entries={legend} youId={data.you} />
      </div>
    </div>
  );
}

/** !important mirrors `server/src/constants/clientCharts.ts`. */
const CLIENT_CHARTS: Record<string, (p: ClientChartProps) => React.ReactNode> = {
  voc: VocSection,
};

/**
 * The round's income statement, every team side by side.
 * !important read, never derived: these are the same `sumScored` figures the
 * analysis report prints. Only the margin is computed, as the report does.
 */
function ProfitAndLoss({ data }: { data: RoundDebriefDto }) {
  const round = data.rounds.find((r) => r.roundNumber === data.roundNumber) ?? null;
  if (!round) return null;

  const money = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? '--' : fmt$(n);

  const ROWS: Array<[string, (t: DebriefTeamRoundDto) => string]> = [
    ['Revenue',            (t) => money(t.revenue)],
    ['COGS',               (t) => money(t.cogs)],
    ['Gross Profit',       (t) => money(t.grossProfit)],
    ['Operating Expenses', (t) => money(t.operatingExpenses)],
    ['Net Profit',         (t) => money(t.netProfit)],
    // Blank rather than 0%: a team that sold nothing has no margin, and 0%
    // reads as one that broke even.
    ['Profit Margin', (t) =>
      t.revenue == null || t.netProfit == null || t.revenue === 0
        ? '--'
        : fmtPct(t.netProfit / t.revenue, 1)],
  ];

  return (
    <PixelPanel title="Profit & loss">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="eyebrow eyebrow-sm text-left text-ink-700 py-1.5 pr-3" />
              {data.teams.map((t) => (
                <th
                  key={t.teamId}
                  className={clsx(
                    'eyebrow eyebrow-sm text-right py-1.5 px-2 whitespace-nowrap',
                    t.teamId === data.you ? 'text-ink-900' : 'text-ink-700',
                  )}
                >
                  {t.teamName}{t.teamId === data.you ? ' (you)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, cell]) => (
              <tr
                key={label}
                className={clsx(
                  'border-t border-border-soft',
                  // The two totals carry the statement; the rest are workings.
                  (label === 'Net Profit' || label === 'Gross Profit') && 'bg-cream-50',
                )}
              >
                <td className="item-name text-text py-1.5 pr-3 whitespace-nowrap">{label}</td>
                {data.teams.map((t) => {
                  const block = round.teams[String(t.teamId)];
                  return (
                    <td
                      key={t.teamId}
                      className={clsx(
                        'num-sm text-right py-1.5 px-2 tabular-nums whitespace-nowrap',
                        t.teamId === data.you ? 'text-ink-900' : 'text-text-2',
                      )}
                    >
                      {block ? cell(block) : '--'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PixelPanel>
  );
}

/**
 * The standings, closing the debrief.
 * !important only `totals` and `standing` are cumulative. Every block below is
 * ranked within THIS round, which is why a rank can move while points only rise.
 */
function Leaderboard({ data }: { data: RoundDebriefDto }) {
  const board = data.leaderboard;
  if (!board || board.blocks.length === 0) return null;

  const fmtValue = (v: number | null, format: LeaderboardBlockDto['format']) => {
    if (v == null || !Number.isFinite(v)) return '--';
    if (format === 'money') return fmt$(v);
    if (format === 'percent') return fmtPct(v, 1);
    return fmtInt(v);
  };

  // By standing, so the winner reads first. Ties share a placing, so the
  // secondary sort keeps the roster order stable rather than arbitrary.
  const ranked = [...data.teams].sort(
    (a, b) =>
      (board.standing[String(a.teamId)] ?? 99) - (board.standing[String(b.teamId)] ?? 99),
  );

  return (
    <PixelPanel title="Leaderboard">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="eyebrow eyebrow-sm text-left text-ink-700 py-1.5 pr-3">Team</th>
              <th className="eyebrow eyebrow-sm text-right text-ink-700 py-1.5 px-2">Rank</th>
              {board.blocks.map((b) => (
                <th
                  key={b.metricKey}
                  className="eyebrow eyebrow-sm text-right text-ink-700 py-1.5 px-2 whitespace-nowrap"
                >
                  {b.label}
                </th>
              ))}
              <th className="eyebrow eyebrow-sm text-right text-ink-900 py-1.5 pl-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((t) => {
              const key = String(t.teamId);
              const you = t.teamId === data.you;
              return (
                <tr
                  key={key}
                  className={clsx('border-t border-border-soft', you && 'bg-cream-50')}
                >
                  <td className={clsx(
                    'item-name py-1.5 pr-3 whitespace-nowrap',
                    you ? 'text-ink-900' : 'text-text',
                  )}>
                    {t.teamName}{you ? ' (you)' : ''}
                  </td>
                  <td className="num-sm text-right py-1.5 px-2 tabular-nums text-text-2">
                    {board.standing[key] ? `#${board.standing[key]}` : '--'}
                  </td>
                  {board.blocks.map((b) => {
                    const cell = b.scores[key];
                    return (
                      <td
                        key={b.metricKey}
                        className="num-sm text-right py-1.5 px-2 tabular-nums text-text-2 whitespace-nowrap"
                      >
                        {fmtValue(cell?.value ?? null, b.format)}
                      </td>
                    );
                  })}
                  <td className={clsx(
                    'num-sm text-right py-1.5 pl-2 tabular-nums',
                    you ? 'text-ink-900' : 'text-text',
                  )}>
                    {fmtInt(board.totals[key] ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PixelPanel>
  );
}

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
