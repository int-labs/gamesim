import clsx from 'clsx';

/**
 * One legend for every chart here — HTML rather than SVG, so the labels wrap
 * and inherit the pixel type scale instead of needing manual line-breaking
 * inside a viewBox.
 *
 * `youId` marks the reading team. The debrief shows every team's figures, so
 * "which one am I" is the first question the chart has to answer.
 */

export interface LegendEntry {
  /** Stable identity — the teamId or category key, never an array position. */
  id:    string;
  label: string;
  color: string;
  /** Renders as an outline rather than a solid chip — used for the VoC weight
   *  tick, which is not a series. */
  tick?: boolean;
}

export function ChartLegend({
  entries,
  youId = null,
}: {
  entries: LegendEntry[];
  youId?: string | null;
}) {
  if (entries.length === 0) return null;

  return (
    // !important a vertical list beside the chart, as the server's Vega legends sit.
    <div className="flex flex-col gap-1.5 body-sm text-ink-800">
      {entries.map((e) => {
        const you = e.id === youId;
        return (
          <div key={e.id} className="flex items-center gap-2">
            {e.tick ? (
              <span className="inline-block w-0.5 h-4 bg-ink-900 shrink-0" />
            ) : (
              <span
                className={clsx(
                  'inline-block w-3.5 h-3.5 shrink-0 border',
                  you ? 'border-ink-900 border-2' : 'border-ink-900',
                )}
                style={{ background: e.color }}
              />
            )}
            <span className={clsx(you && 'font-bold')}>
              {e.label}
              {you && ' (you)'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
