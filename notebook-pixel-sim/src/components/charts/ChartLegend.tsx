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
    <div className="flex flex-wrap gap-x-3 gap-y-1 chart-label">
      {entries.map((e) => {
        const you = e.id === youId;
        return (
          <div key={e.id} className="flex items-center gap-1">
            {e.tick ? (
              <span className="inline-block w-0.5 h-3 bg-ink-900" />
            ) : (
              <span
                className={clsx(
                  'inline-block w-2 h-2 border',
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
