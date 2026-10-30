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

/**
 * LIMBO — the round debrief the team reads after the operator calculates, and
 * before it confirms the next phase.
 *
 * ── THIS SCREEN DRAWS NOTHING AND DERIVES NOTHING ───────────────────────────
 * Every chart on this page is a finished SVG the server rendered from the
 * operator's configuration. This file's whole job is arrangement: order the
 * instances, group them into collapsible segments, and inject the picture.
 *
 * It was thirteen hardcoded sections until 2026-10-27, each with its own
 * derivation, and that is exactly what the configuration layer replaced — a
 * slide that could only ever describe ONE simulation. Story order is now the
 * operator's `order`, and which segment a chart sits in is their `category`.
 *
 * ── EXCEPT THE VoC PLOT, AND PERMANENTLY ───────────────────────────────────
 * It is still drawn here, and it is not pending work. A configured chart binds
 * to figures the server already derived; the VoC plot's CONTENT is a
 * derivation — `diminishingReturnsFactor` is this simulation's calculation
 * layer, and it means something different in the next one. Owner's ruling:
 * the shape of this chart changes per simulation, so the server owns the SLOT
 * and this file owns the drawing.
 *
 * It is still an ordinary `DebriefChart` row — ordered, named, grouped, and
 * hidden until a description is written. It carries `clientChart: "voc"` and
 * no shape, and `CLIENT_CHARTS` below maps that key to the component.
 */

type Load =
  | { state: 'loading' }
  /** 404 is the NORMAL state while the round is still open — the server refuses
   *  an uncalculated round rather than leaking a live one. Not an error.
   *  Carries the server's own reason: the endpoint 404s for three different
   *  causes and only one of them is "not calculated yet". */
  | { state: 'waiting'; message: string }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: RoundDebriefDto };

// NO POLLING. The first version fetched once and never again, which left a
// screen promising "the debrief appears here as soon as they do" that could not
// deliver — limbo is entered BEFORE the operator closes the round. A timer was
// the other fix and was rejected: this codebase removed polling everywhere on
// purpose, and a player sitting on a waiting screen can press a button.

export function LimboScreen({
  roundNumber,
  onContinue,
}: {
  roundNumber: number;
  /** Rendered as the exit only once the debrief has loaded — the whole point of
   *  limbo is that the team reads this before moving on. */
  onContinue?: () => void;
}) {
  // Read once, and the no-session case is the INITIAL state rather than a
  // synchronous setState inside the effect — that extra render is avoidable
  // here, unlike in the animation components where the rule is downgraded.
  const session = useMemo(() => getStoredSession(), []);
  const [load, setLoad] = useState<Load>(() =>
    session
      ? { state: 'loading' }
      : { state: 'error', message: 'No session — sign in again to see the debrief.' },
  );

  // Bumped by the refresh button to re-run the effect. A counter rather than a
  // callback so there is ONE fetch path, used by both the first load and every
  // retry — two paths would drift on error handling.
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
        // The server's own reason. Three different causes 404 here and only one
        // is "not calculated yet"; showing it means a misconfigured simulation
        // cannot masquerade as a slow facilitator.
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

/**
 * Order the instances, then cut them into segments.
 *
 * ⚠ UNRESOLVED CHARTS ARE DROPPED FIRST. A slot with no description is not a
 * slide — the server already declines to draw one, and a segment left holding
 * only unresolved charts must disappear with them rather than render as an
 * empty collapsible nobody can open onto anything.
 *
 * `sort` is stable and the server emits a `scope: "each"` chart as its summary
 * followed by its notebooks, so that reading order survives the sort without
 * any secondary key.
 */
function toSegments(charts: DebriefChartDto[]): Segment[] {
  const ordered = charts.filter((c) => c.resolved).sort((a, b) => a.order - b.order);

  const segments: Segment[] = [];
  for (const chart of ordered) {
    const category = chart.category ?? '';
    // Appended to the LAST segment only when the category matches, never looked
    // up across the whole list: two runs of the same category separated by a
    // third are two segments, which is what the operator's `order` asked for.
    const tail = segments[segments.length - 1];
    if (tail && tail.category === category) tail.charts.push(chart);
    else segments.push({ category, charts: [chart] });
  }

  // ⚠ CLIENT-DRAWN SEGMENTS COME FIRST, whatever their `order`. Owner's rule:
  // the VoC category always opens the debrief. `order` still decides the rest,
  // and the relative order WITHIN each group is kept — this is a partition,
  // not a re-sort.
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
    // A FULL SCREEN, like PhaseIntroScreen and StartScreen: `absolute inset-0`
    // with its own opaque surface. Without it the page rendered transparent
    // over `AppBackground` and, because App's container is
    // `h-screen overflow-hidden`, a long debrief could not scroll either.
    <div className="absolute inset-0 z-10 overflow-y-auto bg-cream-100">
      {/* 80vw, not a `max-w-*` step. The rail and the stage are both sized in
          `vw` and this page was capped at `max-w-5xl` (1024px), so on a wide
          screen it sat in a narrow column with the charts squeezed and the
          prose hard to read. A viewport fraction scales with everything else. */}
      <div className="flex flex-col gap-4 p-3 sm:p-4 w-[80vw] mx-auto">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="eyebrow eyebrow-sm text-ink-700">Round debrief</div>
            <h1 className="h2 leading-none">Round {roundNumber + 1}</h1>
          </div>
        </header>

        <LearningPoint roundNumber={roundNumber} />

        {/* Moved here 2026-10-08 from the deleted "Phase N complete" step, which
            was its only call site. Takes the DEBRIEF's round explicitly — the
            default reads `bootstrap.round`, which by now is the NEXT round.
            Renders nothing when the facilitator wrote no notes. */}
        <RoundNotesCard roundNumber={roundNumber} />

        {segments.length === 0 ? (
          // ⚠ AN EMPTY DEBRIEF IS A CONFIGURED OUTCOME, not a failure. It means
          // the facilitator wrote no descriptions for this round, and saying so
          // is the only way a team can tell that apart from a broken page.
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

/** ⚠ THE PAIR, never `_id`. A `scope: "each"` chart emits N + 1 instances that
 *  all share an `_id`; keying on it alone collapses a whole notebook breakdown
 *  into one row and React reuses the wrong node for it. */
const instanceKey = (c: DebriefChartDto) => `${c._id}:${c.productId ?? ''}`;

/**
 * One category of the slide, open by default.
 *
 * OPEN, because a team is reading this once, in a fixed stretch of time, and a
 * closed segment is a chart they will never find. Collapsing exists so a long
 * debrief can be put away after it is read, not so it starts hidden.
 */
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

/**
 * ONE CHART INSTANCE — title, the operator's copy, and the server's picture.
 *
 * ⚠ THE SVG IS INJECTED UNSANITISED, deliberately. It is not operator input: it
 * is output this server produced from a spec the console sanitised on save and
 * the renderer refused executable keys in. Scrubbing it here would be a second
 * opinion about markup we generated ourselves, and the likeliest outcome is a
 * broken gradient or clip path rather than any security gained.
 *
 * A null `svg` still renders the slide. The copy is the lesson; the chart
 * illustrates it, and a shape that failed to compile should not take the
 * facilitator's writing down with it.
 */
function ChartSlide({ chart, data }: { chart: DebriefChartDto; data: RoundDebriefDto }) {
  const title = chart.productName ? `${chart.name} · ${chart.productName}` : chart.name;

  // THE ESCAPE HATCH. A key with no component here renders as copy with no
  // figure — the same as a chart whose spec would not compile, and visible
  // rather than silent.
  const Client = chart.clientChart ? CLIENT_CHARTS[chart.clientChart] : undefined;

  // Whether there is anything to put in the left cell at all. A chart whose
  // spec failed to compile has none, and splitting the row then would strand
  // the copy in the right half beside an empty box.
  const hasFigure = !!Client || !!chart.svg;

  return (
    <PixelPanel title={title}>
      {/* ⚠ FIGURE LEFT, READING RIGHT — they are a pair, read together. The
          copy used to sit ABOVE the chart, so a team read the conclusion, then
          scrolled past it to find the evidence, and could never hold both at
          once. One slide is now one row.

          `lg:`, not `md:`: this page is `w-[80vw]`, so a 768px viewport gives
          two ~300px columns and the server renders its charts 720px wide.
          Below that the two cells stack and the old order is restored by the
          source order — figure first, then its reading. */}
      <div className={clsx('grid gap-4 items-start', hasFigure && 'lg:grid-cols-2')}>
        {hasFigure && (
          // `min-w-0` or the SVG's intrinsic width widens the grid track and
          // pushes the copy out of the panel — the same trap as the stat tiles
          // in PhaseSequenceModal.
          <div className="min-w-0">
            {Client && <Client chart={chart} data={data} />}
            {chart.svg && (
              // Vega writes fixed `width`/`height` onto the root `<svg>`, so it
              // is capped to its cell here rather than left to overflow.
              <div
                className="w-full overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
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

/** One computed VoC row before it becomes a `VocRow` — keyed by the spec's
 *  `key` rather than its `fieldId`, because the same axis carries a different
 *  fieldId on every notebook and the summary has to merge across them. */
interface VocComputed {
  key: string;
  label: string;
  weight: number;
  dots: VocRow['dots'];
}

/**
 * VoC rows for ONE notebook.
 *
 * THE TWO NORMALISATIONS LIVE HERE, and nowhere else:
 *   weight — `direction × scale`, or `priceSensitivity().weight` for `selling_price`
 *   bubble — `(captured / attainable) × weight`, on the weight's own scale
 *
 * The server ships raw bounds precisely so `priceSensitivity()` stays the one
 * definition shared with the market tab.
 */
function vocRowsFor(
  data: RoundDebriefDto,
  here: RoundDebriefDto['rounds'][number] | null,
  product: RoundDebriefDto['products'][number],
  palette: Map<string, string>,
  scale: number,
): VocComputed[] {
  return product.fields.map((f) => {
    // `selling_price` carries direction 0 and takes its weight from the shared
    // helper; every other spec uses the operator's authored `direction`.
    //
    // BOTH ARRIVE AT THE SAME CEILING by different routes, because they are
    // different quantities. A `direction` is scaled by the catalogue's divisor
    // so the top driver lands on 0.95. Price sensitivity is ALREADY a 0..1
    // share of the price universe, so it takes the anchor directly.
    const weight = f.key === 'selling_price'
      ? priceSensitivityFromBounds(f.minValue, f.maxValue).weight * TOP_DRIVER_SHARE
      : (f.direction ?? 0) * scale;

    // ⚠ MIRRORS THE SERVER. `diminishingReturnsFactor` is the client's copy of
    // `calcDiminishingReturnsCostFactor`, and `PEAK` must stay its value at the
    // optimum. If that curve moves and this does not, every bubble lands at the
    // wrong height while still looking plausible.
    const min = f.minValue ?? 0;
    const max = f.maxValue ?? 0;
    const PEAK = diminishingReturnsFactor(max, min, max);
    const attainable = max * PEAK;

    const dots: VocRow['dots'] = [];
    for (const t of data.teams) {
      const raw = here?.teams[t.teamId]?.byProduct[product.productId]?.fieldValues[f.fieldId];
      if (raw == null || attainable <= 0 || weight == null) continue;
      // Floor only — the curve is meant to SEE an overshoot and decay past the
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

/**
 * Every notebook's rows, merged into one — THE SUMMARY.
 *
 * Merged BY SPEC KEY and AVERAGED. A spec means the same thing on every
 * notebook that declares it, so the summary answers "where does each team sit
 * on this driver across its whole portfolio". Summing instead would make a
 * team look stronger for making more notebooks, which is a different question
 * and not the one the axis is labelled with.
 *
 * A key only some notebooks carry is averaged over the ones that do — the
 * others have no position on it to dilute.
 */
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

/**
 * VOICE OF CUSTOMER — the one chart this client draws.
 *
 * A `scope: "each"` row, so it arrives as the all-notebooks summary plus one
 * instance per notebook. ⚠ THE SUMMARY ALWAYS EXISTS — it is not an optional
 * extra, it is the chart that opens the debrief.
 */
function VocSection({ chart, data }: ClientChartProps) {
  const here = data.rounds.find((r) => r.roundNumber === data.roundNumber) ?? null;
  const palette = useMemo(
    () => buildTeamPalette(data.teams.map((t) => t.teamId)),
    [data.teams],
  );

  // ⚠ THE DIVISOR SPANS EVERY NOTEBOOK, not one.
  //
  // The same normalisation `reportMatrix` applies to its Weight column, and it
  // has to be the same SET or the two surfaces disagree: only ONE driver in the
  // catalogue reaches 0.95, and every other notebook's best spec lands below
  // it. Scaled per notebook, every chart would read 0.95 at the top.
  //
  // `selling_price` is excluded: it carries direction 0 and would only drag the
  // divisor down.
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

    // WEIGHT DESCENDING — the heaviest driver is most of the answer, matching
    // the competitor report's rule in `reportMatrix.ts`. Sorted on the
    // EFFECTIVE weight, not raw `direction`: `selling_price` carries 0 and took
    // its tick from `priceSensitivityFromBounds`.
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

/** key → component. ⚠ MIRRORS `server/src/constants/clientCharts.ts`; a key
 *  there with no entry here is a chart that configures, describes and renders
 *  nothing. */
const CLIENT_CHARTS: Record<string, (p: ClientChartProps) => React.ReactNode> = {
  voc: VocSection,
};

/**
 * The phase's learning point, as the header of its own debrief.
 *
 * Resolved through `PHASE_INTRO[phase].learningFocus`, which is the SAME
 * mapping the phase intro used to open the round — so the debrief closes the
 * loop on the lesson the team was told they were practising, rather than
 * naming a second one.
 *
 * Renders nothing when a phase has no configured focus; an invented lesson is
 * worse than none.
 */
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
    // Same full-screen treatment as the loaded page — the waiting state was the
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
