import { useState } from 'react';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import type { Archetype, Segment } from '@/types';
import { ARCHETYPE_INFO } from '@/data/notebookArchetypes';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelBadge, PixelButton } from '@/components/primitives';
import { setProductField } from '@/engine/mockEngine';
import clsx from 'clsx';

const VIEWS = ['angle', 'front', 'spine', 'open', 'shelf'] as const;
type View = (typeof VIEWS)[number];

interface Props {
  open?: boolean;
  onClose?: () => void;
  /** When true, render inline (e.g. inside the left-dock Details drawer). */
  inline?: boolean;
  /** When true, show a single representative view (no angle switcher). */
  hideViews?: boolean;
}

export function ArchetypeDetailModal({ open, onClose, inline, hideViews }: Props) {
  // May be undefined with an EMPTY portfolio (deleting the last notebook is
  // permitted) — the Details drawer can open in that state, so every access
  // below the guard must stay behind `if (!product)`.
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? (s.portfolio.productLines[0] as (typeof s.portfolio.productLines)[0] | undefined),
  );
  const apply = useGame((s) => s.apply);
  // Hooks run unconditionally (before the empty-portfolio early return).
  const [arch, setArch] = useState<Archetype>(product?.archetype ?? 'student');
  const [view, setView] = useState<View>('angle');

  if (!product) {
    const empty = (
      <div className="flex flex-col items-center justify-center text-center px-4 py-12 gap-2">
        <div className="text-[13px] font-bold text-text">No notebook to inspect</div>
        <p className="text-[11.5px] text-text-2 max-w-[28ch]">
          Add one in <span className="font-bold text-text">Notebook Items</span> first - details show up here.
        </p>
      </div>
    );
    if (inline) return <div className="pb-2">{empty}</div>;
    return (
      <PixelModal open={!!open} onClose={onClose} title="Notebook Details" width="min(720px, calc(100vw - 32px))">
        {empty}
      </PixelModal>
    );
  }

  const info = ARCHETYPE_INFO[arch];
  const a = (A.notebook as any)[arch];

  const body = (
    <div className="flex flex-col gap-3">
      {/* Archetype switcher — stacked icon-over-label tiles so the labels
          never overflow in the ~380px drawer. */}
      <div className="grid grid-cols-3 gap-2">
        {(['student', 'planner', 'daily'] as Archetype[]).map((id) => (
          <button
            key={id}
            onClick={() => setArch(id)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 px-1 py-2 border-2 transition-transform cursor-pointer min-w-0',
              arch === id
                ? 'border-ink-900 bg-cream-100 shadow-pixel-2 -translate-y-0.5 ring-2 ring-ui-primary/40'
                : 'border-ink-700/30 bg-cream-50 hover:-translate-y-0.5 hover:shadow-pixel-2',
            )}
          >
            <img src={(A.notebook as any)[id].hardcover_ring} alt="" className="h-9 object-contain" style={{ imageRendering: 'pixelated' }} />
            <span className="font-hud text-[8.5px] uppercase truncate max-w-full">{id === 'daily' ? 'Daily' : id}</span>
          </button>
        ))}
      </div>

      {/* Image — single view in the drawer, or an angle carousel in the modal. */}
      <div className="bg-cream-100 pixel-frame p-3 flex flex-col items-center gap-2">
        <div className="w-full flex items-center justify-center min-h-[220px]">
          <img src={hideViews ? a.view.angle : a.view[view]} alt="" className="max-h-[220px] object-contain" draggable={false} />
        </div>
        <div className={clsx('flex items-center gap-1 flex-wrap justify-center', hideViews && 'hidden')}>
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-selected={view === v}
              className={clsx(
                'px-2 py-1 border text-[10px] uppercase tracking-wider font-bold transition-colors cursor-pointer',
                view === v
                  ? 'bg-surface text-text border-border shadow-[1px_1px_0_0_var(--c-shadow)]'
                  : 'bg-transparent text-text-2 border-border-soft hover:bg-surface hover:text-text',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Title + tagline */}
      <div>
        <div className="font-hud text-[16px] uppercase tracking-wide text-ink-900 leading-tight">{info.title}</div>
        <div className="text-[14px] text-ink-700 leading-snug mt-1">{info.tagline}</div>
      </div>

      {/* Description */}
      <p className="text-[14px] text-ink-900 leading-relaxed">{info.description}</p>

      {/* Best for */}
      <Card title="Best for">
        <div className="flex flex-wrap gap-1.5">
          {info.bestFor.map((s) => (
            <PixelBadge key={s} tone="success">{labelSeg(s)}</PixelBadge>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Card title="Strengths" tone="success">
          <ul className="text-[14px] text-ink-900 leading-snug list-disc pl-5 space-y-1">
            {info.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Card>
        <Card title="Trade-offs" tone="warn">
          <ul className="text-[14px] text-ink-900 leading-snug list-disc pl-5 space-y-1">
            {info.tradeoffs.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Card>
      </div>

      <Card title="Cost & production">
        <p className="text-[14px] text-ink-900 leading-relaxed mb-1.5">{info.costNote}</p>
        <p className="text-[14px] text-ink-700 leading-relaxed">{info.productionNote}</p>
      </Card>

      <Card title="Why choose this" tone="info">
        <p className="text-[14px] text-ink-900 leading-relaxed">{info.whyChoose}</p>
      </Card>

      <div className="flex justify-end gap-2 pt-1">
        {arch !== product.archetype && (
          <PixelButton
            variant="primary"
            size="md"
            onClick={() => {
              apply((s) => setProductField(s, 'archetype', arch));
              if (onClose) onClose();
            }}
          >
            Switch to {info.title}
          </PixelButton>
        )}
      </div>
    </div>
  );

  if (inline) return <div className="pb-2">{body}</div>;
  return (
    <PixelModal open={!!open} onClose={onClose} title="Notebook Details" width="min(720px, calc(100vw - 32px))">
      {body}
    </PixelModal>
  );
}

function Card({
  title,
  tone = 'neutral',
  children,
}: {
  title: string;
  tone?: 'neutral' | 'success' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  const headBg =
    tone === 'success' ? 'bg-success-soft' :
    tone === 'warn' ? 'bg-warn-soft' :
    tone === 'info' ? 'bg-info-soft' : 'bg-cream-200';
  return (
    <div className="border-2 border-ink-900 bg-cream-50 shadow-pixel-1">
      <div className={`px-3 py-1.5 border-b-2 border-ink-900 ${headBg}`}>
        <div className="font-hud text-[10px] uppercase tracking-wider text-ink-900">{title}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function labelSeg(s: Segment) {
  return s === 'students' ? 'Students' : s === 'creators' ? 'Creators' : s === 'professionals' ? 'Professionals' : 'Gift Buyers';
}
