import { useGame } from '@/state/store';
import { eventForDay, EVENTS } from '@/data/events';
import { applyEventChoice } from '@/engine/mockEngine';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton, PixelBadge } from '@/components/primitives';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { fmt$ } from '@/utils/format';
import { useState } from 'react';
import clsx from 'clsx';

export function EventModal() {
  const pendingId = useGame((s) => s.meta.pendingEventId);
  const day = useGame((s) => s.meta.day);
  const apply = useGame((s) => s.apply);
  const cash = useGame((s) => s.player.cash);
  const energy = useGame((s) => s.player.energy);
  const finished = useGame((s) => s.inventory.totalFinished);
  const pushMascot = useGame((s) => s.pushMascot);
  const [picked, setPicked] = useState<'A' | 'B' | 'C' | 'D' | null>(null);

  const ev = pendingId ? EVENTS.find((e) => e.id === pendingId) ?? eventForDay(day) : null;
  if (!ev) return null;

  const confirm = () => {
    if (!picked) return;
    apply((s) => applyEventChoice(s, ev.id, picked));
    pushMascot({
      id: 'event_done_' + ev.id,
      type: 'success',
      body: `Decision logged. We'll see how it plays out over the next days.`,
      priority: 3,
      mood: 'happy_soft',
    });
    setPicked(null);
  };

  return (
    <PixelModal open={!!pendingId} hideClose title={`Day ${day} - ${ev.title}`} width="min(820px, calc(100vw - 32px))">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2 w-[120px] shrink-0">
          <MascotAvatar mood={ev.mascotMood} size={76} />
          <PixelBadge tone="warn">EVENT</PixelBadge>
        </div>
        <div className="flex-1">
          <p className="font-body body-xs text-ink-900 mb-3">{ev.body}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <PixelBadge tone="neutral">Cash {fmt$(cash)}</PixelBadge>
            <PixelBadge tone="neutral">Energy {energy}</PixelBadge>
            <PixelBadge tone="neutral">Stock {finished}</PixelBadge>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {ev.options.map((o) => {
              const isPicked = picked === o.id;
              return (
              <button
                key={o.id}
                onClick={() => setPicked(o.id)}
                className={clsx(
                  'text-left p-3 border-2 transition-transform',
                  isPicked
                    ? 'border-primary bg-[#221710] shadow-pixel-3 -translate-y-0.5'
                    : 'border-ink-900 bg-cream-50 shadow-pixel-1 hover:-translate-y-0.5',
                )}
              >
                <div className={clsx('eyebrow eyebrow-sm mb-0.5', isPicked ? 'text-[#FAF7E8]' : 'text-ink-900')}>
                  {o.id}. {o.label}
                </div>
                <div className={clsx('hint font-body mb-1', isPicked ? 'text-[#FAF7E8]/85' : 'text-ink-800')}>{o.description}</div>
                <div className="flex flex-wrap gap-1">
                  <PixelBadge tone="warn">E−{o.cost.energy}</PixelBadge>
                  {o.cost.cash ? <PixelBadge tone="error">{fmt$(-o.cost.cash)}</PixelBadge> : null}
                  {o.effects.slice(0, 3).map((e, i) => (
                    <PixelBadge key={i} tone="neutral">{e}</PixelBadge>
                  ))}
                </div>
              </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <PixelButton variant="ghost" size="md" onClick={() => setPicked(null)}>Re-read options</PixelButton>
            <PixelButton variant="primary" size="md" disabled={!picked} onClick={confirm}>
              {picked ? `Confirm - Choose ${picked}` : 'Pick an option'}
            </PixelButton>
          </div>
        </div>
      </div>
    </PixelModal>
  );
}
