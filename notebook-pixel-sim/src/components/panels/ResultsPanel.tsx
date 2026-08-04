import { useState } from 'react';
import { useGame } from '@/state/store';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { finalScore } from '@/engine/mockEngine';
import clsx from 'clsx';

// History moved to the navbar dropdown. The Results page is now focused
// on outcome — what happened (Evaluation) and what score the player got.
type SubTab = 'evaluation' | 'score';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'score', label: 'Score' },
];

export function ResultsPanel() {
  const evals = useGame((s) => s.evaluations.resolved);
  const insights = useGame((s) => s.insights);
  const day = useGame((s) => s.meta.day);
  const ended = useGame((s) => s.meta.ended);
  const route = useGame((s) => s.meta.route);
  const score = ended ? finalScore(useGame.getState()) : null;
  const [tab, setTab] = useState<SubTab>('evaluation');

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Results sections"
        className="grid grid-cols-2 gap-1 p-1 bg-surface-2/50 border border-border-soft"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-2 py-2 tab-label-sm transition-colors cursor-pointer truncate',
              tab === t.id
                ? 'bg-surface text-text border border-border shadow-[1px_1px_0_0_var(--c-shadow)]'
                : 'border border-transparent text-text-2 hover:bg-surface/60 hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'evaluation' && (
        <PixelPanel title="Phase Evaluations">
          {evals.length === 0 ? (
            <div className="body-xs text-ink-700 leading-snug">
              No evaluation completed yet. They land at end of Day 30, 60 and 90.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {evals.map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-cream-50 border-2 border-ink-900 px-3 py-2">
                  <span className="eyebrow eyebrow-sm">Phase {e.phase}</span>
                  <span className="body-xs text-ink-800">Day {e.day}</span>
                  {e.insightCorrect === true && <PixelBadge tone="success">Insight ✓</PixelBadge>}
                  {e.insightCorrect === false && <PixelBadge tone="warn">Insight ✗</PixelBadge>}
                  {e.insightCorrect === null && <PixelBadge tone="neutral">No answer</PixelBadge>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 body-xs text-ink-700 leading-snug">
            Insight score so far: <strong>{insights.score.correct}</strong> / {insights.score.total}
          </div>
        </PixelPanel>
      )}

      {tab === 'score' && (
        <PixelPanel title="Score Summary">
          {score ? (
            <div className="text-center">
              <div className="eyebrow eyebrow-sm text-ink-700">Final Score</div>
              <div className="h2 leading-none mt-1">
                {score.total}<span className="body-sm text-ink-700">/100</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-3 hint">
                <PixelBadge tone="success">Profit {score.netProfit}/50</PixelBadge>
                <PixelBadge tone="info">Inventory {score.inventory}/25</PixelBadge>
                <PixelBadge tone="brand">Insight {score.insight}/25</PixelBadge>
              </div>
            </div>
          ) : (
            <div className="body-xs text-ink-900 leading-relaxed">
              Final score reveals on Day 90. You're on Day {day}.
              <ul className="list-disc pl-5 mt-2 body-xs text-ink-800 space-y-1">
                <li>Net Profit · 50 pts (driven by your choices over 90 days)</li>
                <li>Inventory Cleanliness · 25 pts (avoid stockout & overstock)</li>
                <li>Insight Bonus · 25 pts (correct insight checks at evals)</li>
              </ul>
              {route === 'investor' && (
                <div className="mt-3 body-xs text-ink-700 leading-snug">
                  Investor route: −15 pts if $3,000 isn't repaid by Day 90.
                </div>
              )}
            </div>
          )}
        </PixelPanel>
      )}

    </div>
  );
}
