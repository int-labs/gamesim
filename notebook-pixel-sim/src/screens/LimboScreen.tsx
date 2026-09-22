import { useEffect, useMemo, useState } from 'react';
import { getRoundDebrief, getStoredSession, GamesimApiError } from '@/gamesim/client';
import type { RoundDebriefDto } from '@/gamesim/types';
import { PixelPanel } from '@/components/primitives';
import { ChartLegend, type LegendEntry } from '@/components/charts/ChartLegend';
import { PixelBarChart, type BarSeries } from '@/components/charts/PixelBarChart';
import { PixelColumnStack, type StackSlice } from '@/components/charts/PixelColumnStack';
import { PixelLineChart, type LineSeries } from '@/components/charts/PixelLineChart';
import { PixelBubbleChart, type Bubble } from '@/components/charts/PixelBubbleChart';
import { PixelVocPlot, type VocRow } from '@/components/charts/PixelVocPlot';
import {
  SERIES_COLORS,
  buildTeamPalette,
  colorFor,
  shortMoney,
} from '@/components/charts/chartTheme';
import { priceSensitivityFromBounds } from '@/engine/finlit/core/config/fieldConfig';
import { LEARNING_POINTS, PHASE_INTRO } from '@/content/copy';

/**
 * LIMBO — the round debrief the team reads after the operator calculates, and
 * before it confirms the next phase.
 *
 * ── THIS SCREEN DERIVES NOTHING IT COULD READ ───────────────────────────────
 * Every money and unit figure comes straight off `GET /round-debrief`. The only
 * arithmetic here is turning raw field bounds into the two 0..1 positions the
 * VoC axis needs, and that arithmetic is owned locally on purpose:
 * `priceSensitivity()` in fieldConfig.ts is the ONE definition of the price
 * tick, shared with the market tab, and the server ships raw bounds precisely
 * so it stays that way.
 *
 * Story order is the operator's, and the sections below follow it exactly:
 *   energy → cash → revenue → profit → cost → capacity → TnO → VoC
 */

type Load =
  | { state: 'loading' }
  /** 404 is the NORMAL state while the round is still open — the server refuses
   *  an uncalculated round rather than leaking a live one. Not an error. */
  | { state: 'waiting' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: RoundDebriefDto };

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

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getRoundDebrief({ simulationId: session.simulationId, roundNumber })
      .then((data) => { if (!cancelled) setLoad({ state: 'ready', data }); })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof GamesimApiError && err.status === 404) {
          setLoad({ state: 'waiting' });
          return;
        }
        setLoad({
          state: 'error',
          message: err instanceof Error ? err.message : 'Could not load the debrief.',
        });
      });
    return () => { cancelled = true; };
  }, [roundNumber, session]);

  if (load.state === 'loading') return <Notice title="Loading the debrief…" body="Fetching this round's results." />;
  if (load.state === 'waiting') {
    return (
      <Notice
        title="Waiting for the results"
        body="Your decisions are in. The facilitator hasn't calculated this round yet — the debrief appears here as soon as they do."
      />
    );
  }
  if (load.state === 'error') return <Notice title="Debrief unavailable" body={load.message} />;

  return <DebriefBody data={load.data} onContinue={onContinue} />;
}

function DebriefBody({
  data,
  onContinue,
}: {
  data: RoundDebriefDto;
  onContinue?: () => void;
}) {
  const { teams, products, rounds, roundNumber, you } = data;

  // Built once from the roster and read ONLY by id — a chart that coloured by
  // array position would repaint a team whenever the roster order shifted, and
  // this page shows several rounds side by side.
  const palette = useMemo(
    () => buildTeamPalette(teams.map((t) => t.teamId)),
    [teams],
  );

  const legend: LegendEntry[] = teams.map((t) => ({
    id: t.teamId,
    label: t.teamName,
    color: colorFor(palette, t.teamId),
  }));

  const here = rounds.find((r) => r.roundNumber === roundNumber) ?? null;
  const roundLabels = rounds.map((r) => `Round ${r.roundNumber + 1}`);

  /** One bar series per team for a single-round figure. */
  const perTeam = (pick: (t: string) => number | null): BarSeries[] =>
    teams.map((t) => ({
      id: t.teamId,
      label: t.teamName,
      color: colorFor(palette, t.teamId),
      values: [pick(t.teamId)],
    }));

  /** One line series per team across every round loaded. */
  const overRounds = (pick: (t: string, r: typeof rounds[number]) => number | null): LineSeries[] =>
    teams.map((t) => ({
      id: t.teamId,
      label: t.teamName,
      color: colorFor(palette, t.teamId),
      values: rounds.map((r) => pick(t.teamId, r)),
    }));

  const figure = (teamId: string, key: keyof NonNullable<typeof here>['teams'][string]) => {
    const v = here?.teams[teamId]?.[key];
    return typeof v === 'number' ? v : null;
  };

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 max-w-5xl mx-auto">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="eyebrow eyebrow-sm text-ink-700">Round debrief</div>
          <h1 className="h2 leading-none">Round {roundNumber + 1}</h1>
        </div>
        <ChartLegend entries={legend} youId={you} />
      </header>

      <LearningPoint roundNumber={roundNumber} />

      {/* ── Story opener: effort and money ─────────────────────────────── */}
      <Section title="Total energy consumption" note="Energy spent on levers — hiring, vendors, channels, marketing.">
        <PixelBarChart
          groups={['This round']}
          series={perTeam((t) => figure(t, 'energy'))}
          yLabel="Energy"
        />
      </Section>

      <Section title="Cash utilization" note="Opening balance and where it closed.">
        <PixelBarChart
          groups={teams.map((t) => t.teamName)}
          series={[
            {
              id: 'open', label: 'Start', color: SERIES_COLORS[0],
              values: teams.map((t) => figure(t.teamId, 'cashOpening')),
            },
            {
              id: 'close', label: 'End', color: SERIES_COLORS[0],
              values: teams.map((t) => figure(t.teamId, 'cashClosing')),
            },
          ]}
          delta
          fadeLead
          format={shortMoney}
          yLabel="Cash ($)"
        />
      </Section>

      {/* ── 1. Revenue ─────────────────────────────────────────────────── */}
      <Section title="Total revenue">
        <PixelLineChart
          points={roundLabels}
          series={overRounds((t, r) => r.teams[t]?.revenue ?? null)}
          format={shortMoney}
          yLabel="Revenue ($)"
        />
      </Section>

      <Section title="Revenue by notebook" note="Each team's revenue split across the notebooks they made.">
        <PixelColumnStack
          columns={teams.map((t) => t.teamName)}
          slices={products.map((p, i) => ({
            id: p.productId,
            label: p.productName,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            values: teams.map((t) => here?.teams[t.teamId]?.byProduct[p.productId]?.revenue ?? null),
          }))}
          format={shortMoney}
          yLabel="Revenue ($)"
        />
        <ChartLegend entries={products.map((p, i) => ({
          id: p.productId, label: p.productName, color: SERIES_COLORS[i % SERIES_COLORS.length],
        }))} />
      </Section>

      {/* ── 2. Profit ──────────────────────────────────────────────────── */}
      <Section title="Gross profit">
        <PixelLineChart
          points={roundLabels}
          series={overRounds((t, r) => r.teams[t]?.grossProfit ?? null)}
          format={shortMoney}
          yLabel="Gross profit ($)"
        />
      </Section>

      <Section title="Net profit">
        <PixelLineChart
          points={roundLabels}
          series={overRounds((t, r) => r.teams[t]?.netProfit ?? null)}
          format={shortMoney}
          yLabel="Net profit ($)"
        />
      </Section>

      {/* ── 3. Cost ────────────────────────────────────────────────────── */}
      <Section title="Total cost" note="COGS plus operating expenses.">
        <PixelBarChart
          groups={['This round']}
          series={perTeam((t) => {
            const c = figure(t, 'cogs');
            const o = figure(t, 'operatingExpenses');
            // Both or neither: a total built from one half would understate it
            // silently, which is worse than showing no bar.
            return c == null || o == null ? null : c + o;
          })}
          format={shortMoney}
          yLabel="Cost ($)"
        />
      </Section>

      <CostBreakdown data={data} here={here} />

      {/* ── 4. Capacity ────────────────────────────────────────────────── */}
      <Section title="Units sold vs demand" note="Demand is the customers each team won; units sold is what stock allowed.">
        <PixelBarChart
          groups={teams.map((t) => t.teamName)}
          series={[
            {
              id: 'demand', label: 'Customers obtained', color: SERIES_COLORS[1],
              values: teams.map((t) => figure(t.teamId, 'customersObtained')),
            },
            {
              id: 'sold', label: 'Units sold', color: SERIES_COLORS[2],
              values: teams.map((t) => figure(t.teamId, 'unitsSold')),
            },
          ]}
          yLabel="Units"
        />
        <ChartLegend entries={[
          { id: 'demand', label: 'Customers obtained', color: SERIES_COLORS[1] },
          { id: 'sold', label: 'Units sold', color: SERIES_COLORS[2] },
        ]} />
      </Section>

      <Section title="Price vs units sold" note="Bubble area is units sold.">
        <PriceVsUnits data={data} here={here} palette={palette} />
      </Section>

      {/* ── 5. TnO ─────────────────────────────────────────────────────── */}
      <TnOBreakdown data={data} here={here} palette={palette} />

      {/* ── 6. Voice of Customer ───────────────────────────────────────── */}
      {products.map((p) => (
        <VocSection key={p.productId} data={data} here={here} product={p} palette={palette} />
      ))}

      {onContinue && (
        <div className="flex justify-end pt-2">
          <button onClick={onContinue} className="game-btn min-h-[44px]">
            <span className="btn-label uppercase">Continue to next phase</span>
          </button>
        </div>
      )}
    </div>
  );
}

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
      <div className="body-xs text-ink-800 leading-snug mt-1">{lp.blurb}</div>
    </div>
  );
}

/* ── Sections that need their own derivation ─────────────────────────── */

/** Cost categories are OPERATOR FREE TEXT — collected from the data, never a
 *  hardcoded list, or renaming a row on the console silently drops a band. */
function CostBreakdown({
  data, here,
}: { data: RoundDebriefDto; here: RoundDebriefDto['rounds'][number] | null }) {
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const t of data.teams) {
      for (const k of Object.keys(here?.teams[t.teamId]?.costByCategory ?? {})) seen.add(k);
    }
    return [...seen].sort();
  }, [data.teams, here]);

  if (categories.length === 0) return null;

  const slices: StackSlice[] = categories.map((c, i) => ({
    id: c,
    label: c,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    values: data.teams.map((t) => here?.teams[t.teamId]?.costByCategory[c] ?? null),
  }));

  return (
    <Section title="Total cost breakdown" note="Cost rows as the facilitator named them.">
      <PixelColumnStack
        columns={data.teams.map((t) => t.teamName)}
        slices={slices}
        format={shortMoney}
        yLabel="Cost ($)"
      />
      <ChartLegend entries={slices.map((s) => ({ id: s.id, label: s.label, color: s.color }))} />
    </Section>
  );
}

/** Lever investment, one chart per container — hiring, vendors, marketing and
 *  channels each get their own, as the operator asked. */
function TnOBreakdown({
  data, here, palette,
}: {
  data: RoundDebriefDto;
  here: RoundDebriefDto['rounds'][number] | null;
  palette: Map<string, string>;
}) {
  const levers = useMemo(() => {
    const seen = new Set<string>();
    for (const t of data.teams) {
      for (const k of Object.keys(here?.teams[t.teamId]?.energyByLever ?? {})) seen.add(k);
    }
    return [...seen].sort();
  }, [data.teams, here]);

  if (levers.length === 0) return null;

  return (
    <Section title="Investment level of operations" note="Energy committed to each kind of lever.">
      <PixelBarChart
        groups={levers}
        series={data.teams.map((t) => ({
          id: t.teamId,
          label: t.teamName,
          color: colorFor(palette, t.teamId),
          values: levers.map((l) => here?.teams[t.teamId]?.energyByLever[l] ?? null),
        }))}
        yLabel="Energy"
      />
    </Section>
  );
}

function PriceVsUnits({
  data, here, palette,
}: {
  data: RoundDebriefDto;
  here: RoundDebriefDto['rounds'][number] | null;
  palette: Map<string, string>;
}) {
  // One bubble per team per notebook they actually made. A notebook with no
  // scored block is omitted rather than plotted at the origin, which would read
  // as "priced at zero, sold none".
  const bubbles: Bubble[] = [];
  for (const t of data.teams) {
    for (const p of data.products) {
      const bp = here?.teams[t.teamId]?.byProduct[p.productId];
      if (!bp || bp.sellingPrice == null || bp.unitsSold == null) continue;
      bubbles.push({
        id: `${t.teamId}:${p.productId}`,
        label: t.teamName.slice(0, 2).toUpperCase(),
        color: colorFor(palette, t.teamId),
        x: bp.unitsSold,
        y: bp.sellingPrice,
        size: bp.unitsSold,
      });
    }
  }
  return <PixelBubbleChart bubbles={bubbles} xLabel="Units sold" yLabel="Price ($)" />;
}

/**
 * VoC for one notebook.
 *
 * THE TWO NORMALISATIONS LIVE HERE, and nowhere else:
 *   tick — `direction`, or `priceSensitivity().weight` for `selling_price`
 *   dot  — `(value − min) / (max − min)`
 *
 * The server ships raw bounds precisely so `priceSensitivity()` stays the one
 * definition shared with the market tab.
 */
function VocSection({
  data, here, product, palette,
}: {
  data: RoundDebriefDto;
  here: RoundDebriefDto['rounds'][number] | null;
  product: RoundDebriefDto['products'][number];
  palette: Map<string, string>;
}) {
  const rows: VocRow[] = product.fields.map((f) => {
    const span = (f.maxValue ?? 0) - (f.minValue ?? 0);
    const position = (v: number) =>
      span > 0 ? Math.max(0, Math.min(1, (v - (f.minValue ?? 0)) / span)) : null;

    // `selling_price` carries direction 0 and takes its weight from the shared
    // helper; every other spec uses the operator's authored `direction`.
    //
    // FROM THE WIRE'S BOUNDS, not `priceSensitivity(genre)` — the genre id is
    // not the product name, and that lookup would miss and return defaults
    // while still type-checking.
    const weight = f.key === 'selling_price'
      ? priceSensitivityFromBounds(f.minValue, f.maxValue).weight
      : f.direction;

    const dots: VocRow['dots'] = [];
    for (const t of data.teams) {
      const raw = here?.teams[t.teamId]?.byProduct[product.productId]?.fieldValues[f.fieldId];
      if (raw == null) continue;
      const p = position(raw);
      if (p == null) continue;
      dots.push({ teamId: t.teamId, label: t.teamName, color: colorFor(palette, t.teamId), value: p });
    }

    return { id: f.fieldId, label: f.label, weight, dots };
  });

  if (rows.length === 0) return null;

  return (
    <Section
      title={`Voice of customer · ${product.productName}`}
      note="The tick is how much this market weighs each spec. The dots are how far up it each team invested — two different kinds of number on one axis."
    >
      <PixelVocPlot rows={rows} youId={data.you} />
    </Section>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <PixelPanel title={title}>
      {note && <div className="body-xs text-ink-700 leading-snug mb-2">{note}</div>}
      <div className="flex flex-col gap-2">{children}</div>
    </PixelPanel>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <PixelPanel title={title}>
        <div className="body-xs text-ink-800 leading-relaxed max-w-prose">{body}</div>
      </PixelPanel>
    </div>
  );
}
