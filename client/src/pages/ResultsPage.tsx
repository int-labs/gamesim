import { ResultsPanel } from '@/components/panels/ResultsPanel';

/**
 * Results page — phase debrief, decision history, score so far.
 */
export function ResultsPage() {
  return (
    <div className="flex-1 min-h-0 px-4 pb-3 grid grid-cols-1 gap-4">
      <section className="min-w-0 min-h-0 flex flex-col panel overflow-hidden">
        <header className="px-4 py-3 border-b border-border-soft bg-surface-2 shrink-0">
          <div className="panel-title text-text">Phase results &amp; insights</div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Look at what happened, why it happened, and what to try next phase.
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ResultsPanel />
        </div>
      </section>
    </div>
  );
}
