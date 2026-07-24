import { useState } from 'react';
import { useGame } from '@/state/store';
import { PixelButton, PixelTooltip } from '@/components/primitives';
import { ConfirmDayModal } from '@/components/ConfirmDayModal';

export function BottomActionBar() {
  const day = useGame((s) => s.meta.day);
  const energy = useGame((s) => s.player.energy);
  const ended = useGame((s) => s.meta.ended);
  const pendingEvent = useGame((s) => s.meta.pendingEventId);
  const pendingEval = useGame((s) => s.meta.pendingEvalPhase);
  const segment = useGame((s) => s.market.targetSegment);
  const pushMascot = useGame((s) => s.pushMascot);
  const showToast = useGame((s) => s.showToast);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDays, setConfirmDays] = useState(1);

  const blocked = ended || !!pendingEvent || pendingEval !== null;
  const blockReason = ended
    ? 'Run ended. Open Results.'
    : pendingEvent
    ? 'Resolve the event modal to continue.'
    : pendingEval !== null
    ? 'Complete the evaluation to continue.'
    : null;

  const tryAdvance = (n: number) => {
    if (blocked) return;
    if (!segment && day < 5) {
      pushMascot({
        id: 'pick_segment',
        type: 'warning',
        body: 'Pick a target audience first - without a segment your demand stays cold.',
        priority: 1,
        mood: 'concerned_soft',
      });
      return;
    }
    setConfirmDays(n);
    setConfirmOpen(true);
  };

  return (
    <>
      <div className="pixel-frame bg-leather text-cream-50 px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 xl:gap-3 mr-auto min-w-0">
          <div className="leading-tight">
            <div className="font-hud text-[11px] uppercase tracking-wider text-cream-50">Day {day} / 90</div>
            <div className="text-[12px] text-cream-50/85">Energy {energy}</div>
          </div>
          {blockReason && (
            <span className="font-hud text-[9px] xl:text-[10px] uppercase tracking-wider text-warn px-1.5 py-1 bg-ink-900/40 border-2 border-warn max-w-[230px] xl:max-w-none truncate">
              {blockReason}
            </span>
          )}
        </div>

        <PixelTooltip text="Undo last decision (Step 4)">
          <PixelButton
            variant="ghost"
            size="sm"
            onClick={() =>
              showToast({ kind: 'hint', text: 'Undo wires up in Step 4 with the real engine.', ms: 1800 })
            }
          >
            Undo
          </PixelButton>
        </PixelTooltip>

        <PixelTooltip text="Save snapshot to browser">
          <PixelButton
            variant="ghost"
            size="sm"
            onClick={() => showToast({ kind: 'success', text: 'Saved to browser.', ms: 1500 })}
          >
            Save
          </PixelButton>
        </PixelTooltip>

        <PixelTooltip text="Skip 5 days at once">
          <PixelButton variant="secondary" size="sm" onClick={() => tryAdvance(5)} disabled={blocked}>
            +5 Days
          </PixelButton>
        </PixelTooltip>

        <PixelTooltip text="Preview impact, then confirm">
          <PixelButton variant="primary" size="md" onClick={() => tryAdvance(1)} disabled={blocked}>
            Confirm · Next Day →
          </PixelButton>
        </PixelTooltip>
      </div>

      <ConfirmDayModal open={confirmOpen} onClose={() => setConfirmOpen(false)} days={confirmDays} />
    </>
  );
}
